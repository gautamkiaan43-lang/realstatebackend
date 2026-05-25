const prisma = require('../config/prisma');
const commissionService = require('./commission.service');
const activityService = require('./activity.service');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');

class DealService {
    _parseDeal(deal) {
        if (!deal) return null;
        try {
            return {
                ...deal,
                notes: typeof deal.notes === 'string' ? JSON.parse(deal.notes || '[]') : (deal.notes || []),
                history: typeof deal.history === 'string' ? JSON.parse(deal.history || '[]') : (deal.history || []),
                value: deal.value ? parseFloat(deal.value) : 0,
                // Normalization: Ensure Frontend always gets CamelCase for relations
                contactId: deal.contact_id || null,
                propertyId: deal.property_id || null,
                buyerContactId: deal.buyer_contact_id || null,
                visitDate: deal.visitDate || null,
                visitTime: deal.visitTime || null,
                submittedAt: deal.submitted_at || null,
                approvedAt: deal.approved_at || null,
                approvedBy: deal.approved_by || null,
                rejectionReason: deal.rejection_reason || null
            };
        } catch (e) {
            console.error("Deal Parse Error:", e);
            return deal;
        }
    }

    _getStages() {
        return ['DRAFT', 'NEW', 'OPEN', 'IN_PROGRESS', 'COMPLETED_BY_AGENT', 'PENDING_APPROVAL', 'APPROVED', 'WON', 'REJECTED', 'LOST'];
    }

    _validateTransition(currentStage, nextStage, role, isLegacy = false) {
        const stages = this._getStages();
        const normalizedCurrent = currentStage?.toUpperCase() || 'DRAFT';
        const normalizedNext = nextStage?.toUpperCase();

        if (isLegacy) return true;
        const currentIdx = stages.indexOf(normalizedCurrent);
        const nextIdx = stages.indexOf(normalizedNext);

        if (nextIdx === -1) return false;
        if (normalizedNext === 'LOST') return true;

        // AGENT Restrictions
        if (role === 'AGENT') {
            const forbiddenDirectToWon = normalizedNext === 'WON';
            const forbiddenDirectToApproved = normalizedNext === 'APPROVED';
            if (forbiddenDirectToWon || forbiddenDirectToApproved) return false;
        }

        return true;
    }

    async createDeal(data, performer) {
        console.log(`[DEAL_SERVICE] Creation Initiated. Data:`, data, `Performer:`, performer.id);
        const creatorId = performer.id;
        const role = performer.role?.toUpperCase();

        // 1. Structural Enforcement (Mandatory Rule #5 & #6)
        const buyerId = data.buyer_contact_id || data.buyerContactId || data.contact_id || data.contactId;
        const propertyId = data.property_id || data.propertyId;
        const value = parseFloat(data.value || 0);

        if (!buyerId) throw new Error('Identity Fault: A valid Buyer Contact ID is mandatory for deal protocols.');
        if (!propertyId) throw new Error('Asset Fault: A specific Property ID must be linked to initialize a deal.');

        // 2. Fetch Entities with Integrity Locks (Requirement #5)
        const [buyer, property] = await Promise.all([
            prisma.contact.findUnique({ where: { id: parseInt(buyerId) } }),
            prisma.property.findUnique({
                where: { id: parseInt(propertyId) },
                include: { owner: true }
            })
        ]);

        if (!buyer) throw new Error(`Identity Error: Buyer ID #${buyerId} not found.`);
        if (buyer.status !== 'ACTIVE') throw new Error(`Protocol Violation: Buyer "${buyer.name}" is ${buyer.status}.`);
        if (buyer.role !== 'BUYER') throw new Error(`Role Conflict: "${buyer.name}" is registered as ${buyer.role}. Only BUYER roles are permitted for acquisitions.`);

        if (!property) throw new Error(`Asset Error: Property ID #${propertyId} not found.`);
        
        // [AUTO-RESOLUTION] Resolve Seller from Property Ownership (Mandatory Requirement #5)
        const sellerId = property.owner_id || property.ownerId;
        if (!sellerId) throw new Error('Integrity Fault: This property has no registered Listing Seller. Creation blocked.');

        // [AGENT MAPPING] (Requirement #5)
        // If lead_id exists, prefer lead.owner_id, else fallback to buyer.agent_id
        let resolvedAgentId = buyer.agent_id || buyer.assigned_to;
        if (data.lead_id) {
            const lead = await prisma.lead.findUnique({ where: { id: parseInt(data.lead_id) } });
            if (lead) resolvedAgentId = lead.owner_id || lead.assigned_agent_id || resolvedAgentId;
        }
        
        const finalAgentId = resolvedAgentId || creatorId;

        // 3. Financial Guard
        if (value <= 0) throw new Error('Financial Error: Deal value must be greater than zero.');

        // 4. Transaction Creation
        const deal = await prisma.deal.create({
            data: {
                title: data.title || `Protocol: ${property.title} / ${buyer.name}`,
                value: value,
                stage: 'DRAFT',
                status: 'DRAFT',
                priority: data.priority || 'Medium',
                assigned_to: parseInt(finalAgentId),
                agent_id: parseInt(finalAgentId),
                property_id: parseInt(propertyId),
                buyer_contact_id: parseInt(buyerId),
                contact_id: parseInt(sellerId), // Seller is the primary workflow contact
                type: 'BUYER',
                source: data.source || 'MANUAL',
                lead_id: data.lead_id ? parseInt(data.lead_id) : null,
                notes: typeof data.notes === 'object' ? JSON.stringify(data.notes) : (data.notes || '[]'),
                history: JSON.stringify([{
                    stage: 'DRAFT',
                    timestamp: new Date(),
                    performer: performer.name,
                    action: 'PROTOCOL_INITIATED',
                    details: 'Strict relational mapping enforced.'
                }])
            },
            include: { assignedTo: true, contact: true, property: { include: { owner: true } } }
        });

        const isSellerDeal = deal.type === 'SELLER';
        await auditService.log({
            userId: creatorId,
            action: isSellerDeal ? 'CREATE_DEAL_LISTING' : 'CREATE_DEAL_ACQUISITION',
            entityType: 'Deal',
            entityId: deal.id,
            newValue: deal
        });

        return this._parseDeal(deal);
    }

    async getAllDeals(user) {
        const { id, role } = user;
        const dealInclude = {
            assignedTo: true,
            contact: true,
            buyer: true,
            property: { include: { owner: true } }
        };

        let deals = [];

        if (role === 'SUPER_ADMIN') {
            deals = await prisma.deal.findMany({
                where: { isDeleted: false },
                include: dealInclude
            });
        } else if (role === 'MANAGER') {
            deals = await prisma.deal.findMany({
                where: {
                    isDeleted: false,
                    OR: [
                        { assigned_to: id },
                        { agent_id: id },
                        { assignedTo: { manager_id: id } }
                    ]
                },
                include: dealInclude
            });
        } else {
            deals = await prisma.deal.findMany({
                where: {
                    isDeleted: false,
                    OR: [
                        { assigned_to: id },
                        { agent_id: id }
                    ]
                },
                include: dealInclude
            });
        }
        return deals.map(d => this._parseDeal(d));
    }

    async getDealById(id, user) {
        const deal = await prisma.deal.findUnique({
            where: { id: parseInt(id) },
            include: {
                assignedTo: true,
                contact: true,
                buyer: true,
                property: { include: { owner: true } }
            }
        });

        if (!deal || deal.isDeleted) return null;

        // RBAC Check
        if (user.role !== 'SUPER_ADMIN') {
            const isAssigned = deal.assigned_to === user.id;
            const isManagerOfAssigned = deal.assignedTo?.manager_id === user.id;
            if (!isAssigned && !isManagerOfAssigned) {
                const error = new Error("Access Denied: You do not have permission to view this deal.");
                error.status = 403;
                throw error;
            }
        }

        return this._parseDeal(deal);
    }

    async updateDeal(id, data, performer) {
        const isOverride = !!(data.isOverride || data.isAdminAction);
        const dealId = parseInt(id);
        const currentDealRaw = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { assignedTo: true, property: true, contact: true }
        });
        if (!currentDealRaw) throw new Error("Deal not found");

        const currentDeal = this._parseDeal(currentDealRaw);
        const role = performer.role.toUpperCase();

        // 0. LOCK AFTER SUBMISSION (Requirement #3)
        const isLockedStatus = ['PENDING_APPROVAL', 'APPROVED', 'WON'].includes(currentDeal.status?.toUpperCase());
        if (isLockedStatus && role === 'AGENT') {
            throw new Error(`Integrity Lock: Deal #${dealId} is currently ${currentDeal.status}. Editing is restricted during approval protocol.`);
        }

        // 1. RBAC & Transition Hardening
        if (role !== 'SUPER_ADMIN') {
            const isOwner = currentDeal.assigned_to === performer.id;
            const isManagerOfOwner = currentDeal.assignedTo?.manager_id === performer.id;

            if (!isOwner && !isManagerOfOwner) {
                throw new Error("Access Denied: You do not have permission to modify this deal.");
            }
        }

        // 1.2 Resource Modification Guard: Agent cannot change critical fields
        if (role === 'AGENT') {
            const blocked = ['type', 'deal_type', 'value', 'assigned_to', 'assignedTo', 'contact_id', 'buyer_contact_id', 'agent_id', 'property_id'];
            const attempt = Object.keys(data).filter(k => blocked.includes(k));
            if (attempt.length > 0) {
                throw new Error(`Authority Breach: Role 'AGENT' is restricted from modifying locked fields: ${attempt.join(', ')}.`);
            }
        }

        // 2. Stage Transition & Approval Workflow (New Logic)
        const targetStatus = data.status?.toUpperCase();
        const targetStage = data.stage?.toUpperCase() || targetStatus;

        if (targetStatus && targetStatus !== currentDeal.status) {
            // Validate sequence
            if (!this._validateTransition(currentDeal.status, targetStatus, role)) {
                throw new Error(`Protocol Fault: Invalid transition from ${currentDeal.status} to ${targetStatus}.`);
            }

            // Handle Specific Transitions
            if (targetStatus === 'PENDING_APPROVAL') {
                const checkValue = data.value !== undefined ? parseFloat(data.value) : currentDeal.value;
                if (checkValue <= 0) throw new Error("Financial Lock: Value must be > 0 to submit for approval.");
                if (!currentDeal.property_id && !data.propertyId) throw new Error("Asset Lock: Property must be linked before submission.");
                data.submitted_at = new Date();
            }

            if (targetStatus === 'APPROVED' || targetStatus === 'WON') {
                if (role === 'AGENT') throw new Error("Access Denied: Agents cannot authorize deal approval.");
                data.status = 'WON';
                data.stage = 'WON';
                data.approved_by = performer.id;
                data.approved_at = new Date();
                data.rejection_reason = null;
            }

            if (targetStatus === 'REJECTED') {
                if (role === 'AGENT') throw new Error("Access Denied: Agents cannot reject deals.");
                if (!data.rejection_reason) throw new Error("Correction Required: A reason must be provided for deal rejection.");
                data.status = 'IN_PROGRESS'; // Move back to working state
                data.stage = 'IN_PROGRESS';
            }
        }

        // 3. Financial Safeguards
        const newValue = data.value !== undefined ? parseFloat(data.value) : currentDeal.value;

        // 4. Atomic WON Closing (Mandatory Requirement #6 & Conflict Resolution Rule #2)
        const isClosingAsWon = (data.status === 'WON' || data.stage === 'WON') && currentDeal.status !== 'WON';

        if (isClosingAsWon) {
            if (role === 'AGENT' && !isOverride) throw new Error("Access Denied: Agents cannot close deals as WON.");

            const targetPropertyId = data.propertyId ? parseInt(data.propertyId) : currentDeal.property_id;
            if (!targetPropertyId) throw new Error("Asset Requirement: A Property must be linked before closing.");

            return await prisma.$transaction(async (tx) => {
                // 4.1 Asset Protection: Ensure property isn't sold
                const property = await tx.property.findUnique({
                    where: { id: targetPropertyId }
                });
                if (property?.status === 'SOLD') throw new Error("Asset Lock: This property is already SOLD.");

                // 4.2 Close the winning Deal
                const updated = await tx.deal.update({
                    where: { id: dealId },
                    data: {
                        status: 'WON',
                        stage: 'WON',
                        value: newValue,
                        property_id: targetPropertyId,
                        approved_by: data.approved_by || currentDeal.approved_by || performer.id,
                        approved_at: data.approved_at || currentDeal.approved_at || new Date(),
                        history: JSON.stringify([
                            ...currentDeal.history,
                            { stage: 'WON', timestamp: new Date().toISOString(), performer: performer.name }
                        ])
                    },
                    include: { assignedTo: true, contact: true, property: true }
                });

                // 4.3 Conflict Resolution: Mark all OTHER open deals for this property as LOST
                const conflictCount = await tx.deal.updateMany({
                    where: {
                        property_id: targetPropertyId,
                        id: { not: dealId },
                        status: 'OPEN',
                        isDeleted: false
                    },
                    data: {
                        status: 'LOST',
                        stage: 'LOST',
                        lostReason: `Property SOLD via Deal #${dealId}`
                    }
                });

                if (conflictCount.count > 0) {
                    console.log(`[CONFLICT_RESOLVER] Automated resolution: ${conflictCount.count} competing deals marked LOST for Property #${targetPropertyId}`);
                }

                // 4.5 Automated Commission Ledgering (Requirement #7)
                console.log(`[COMMISSION_TRIGGER] Generating revenue record for Deal #${dealId} (Agent #${updated.agent_id || updated.assigned_to})`);
                await commissionService.createCommissionInTransaction(tx, {
                    deal_id: dealId,
                    agent_id: updated.agent_id || updated.assigned_to,
                    amount: null // Service will auto-calculate
                });

                return updated;
            });

            return this._parseDeal(closingResult);
        }

        // 5. Generic Update & REOPEN Logic
        const updateData = { ...data };
        delete updateData.isOverride;
        delete updateData.isAdminAction;

        if (data.value !== undefined) updateData.value = parseFloat(data.value);
        if (data.propertyId) updateData.property_id = parseInt(data.propertyId);
        if (data.contact_id) updateData.contact_id = parseInt(data.contact_id);
        if (data.assigned_to) updateData.assigned_to = parseInt(data.assigned_to);

        // REOPEN Logic: If status is explicitly changed back to OPEN or stage changed from terminal to active
        const isReopeningFromLost = currentDeal.status === 'LOST' && (data.status === 'OPEN' || (data.stage && data.stage !== 'LOST'));
        const isReopeningFromWon = currentDeal.status === 'WON' && (data.status === 'OPEN' || (data.stage && data.stage !== 'WON'));

        if (isReopeningFromLost || isReopeningFromWon) {
            if (role !== 'SUPER_ADMIN' && role !== 'MANAGER') {
                throw new Error("Authority Breach: Only Managers or Admins can REOPEN closed deals.");
            }
            updateData.status = 'OPEN';
            if (isReopeningFromLost) updateData.lostReason = null;
        }

        // Handle Visit Data (Mandatory Workflow Support)
        if (data.visitDate) updateData.visitDate = new Date(data.visitDate);
        if (data.visitTime !== undefined) updateData.visitTime = data.visitTime;

        // Auto-clear legacy invalid if contact is fixed
        if (updateData.contact_id) updateData.is_legacy_invalid = false;

        if (data.stage && data.stage !== currentDeal.stage) {
            updateData.history = JSON.stringify([
                ...currentDeal.history,
                {
                    stage: data.stage,
                    timestamp: new Date().toISOString(),
                    prev: currentDeal.stage,
                    type: isOverride ? 'ADMIN_OVERRIDE' : 'WORKFLOW_TRANSITION'
                }
            ]);
        }

        const updated = await prisma.$transaction(async (tx) => {
            // If reopening from WON, revert property status to AVAILABLE
            if (isReopeningFromWon && currentDeal.property_id) {
                await tx.property.update({
                    where: { id: currentDeal.property_id },
                    data: { status: 'AVAILABLE' }
                });
                console.log(`[REOPEN_PROTOCOL] Reverting Property #${currentDeal.property_id} to AVAILABLE due to Deal Reopen.`);
            }

            const result = await tx.deal.update({
                where: { id: dealId },
                data: updateData,
                include: { assignedTo: true, contact: true, property: true }
            });

            // AUDIT Detailed Changes (If Admin Action)
            if (isOverride || data.isAdminAction) {
                const auditedFields = ['value', 'property_id', 'contact_id', 'assigned_to', 'stage', 'status'];
                for (const field of auditedFields) {
                    if (data[field] !== undefined || updateData[field] !== undefined) {
                        const oldVal = currentDealRaw[field];
                        const newVal = result[field];
                        if (oldVal !== newVal) {
                            await auditService.log({
                                userId: performer.id,
                                action: isOverride ? 'ADMIN_OVERRIDE' : 'ADMIN_CORRECTION',
                                entityType: 'Deal',
                                entityId: dealId,
                                oldValue: { [field]: oldVal },
                                newValue: { [field]: newVal },
                                tx
                            });
                        }
                    }
                }
            }

            return result;
        });

        return this._parseDeal(updated);
    }

    async addNote(id, noteText, userId) {
        const currentDealRaw = await prisma.deal.findUnique({ where: { id: parseInt(id) } });
        const currentDeal = this._parseDeal(currentDealRaw);
        const notes = Array.isArray(currentDeal.notes) ? currentDeal.notes : [];

        const updated = await prisma.deal.update({
            where: { id: parseInt(id) },
            data: {
                notes: JSON.stringify([
                    ...notes,
                    { id: Date.now(), text: noteText, userId, timestamp: new Date().toISOString() }
                ])
            },
            include: { assignedTo: true, contact: true, property: true }
        });
        return this._parseDeal(updated);
    }

    async deleteDeal(id, user) {
        if (user.role === 'AGENT') {
            const error = new Error("Agents are not permitted to delete deals. Please mark as Lost or Closed.");
            error.status = 403;
            throw error;
        }

        const deletedDeal = await prisma.deal.update({
            where: { id: parseInt(id) },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: user.id
            }
        });

        await auditService.log({
            userId: user.id,
            action: 'DELETE_DEAL',
            entityType: 'Deal',
            entityId: parseInt(id),
            newValue: { isDeleted: true }
        });

        return deletedDeal;
    }
    /**
     * Identifies and flags legacy deals that do not comply with the new
     * mandatory Buyer + Property relationship model.
     */
    async validateLegacyDeals() {
        console.log(`[LEGACY_AUDIT] Initiating system-wide deal integrity check...`);
        const deals = await prisma.deal.findMany({
            where: { isDeleted: false, is_legacy_invalid: false }
        });

        let flaggedCount = 0;
        for (const deal of deals) {
            const hasBuyer = !!deal.buyer_contact_id;
            const hasProperty = !!deal.property_id;

            if (!hasBuyer || !hasProperty) {
                await prisma.deal.update({
                    where: { id: deal.id },
                    data: { is_legacy_invalid: true }
                });
                flaggedCount++;
            }
        }
        console.log(`[LEGACY_AUDIT] Audit Complete. ${flaggedCount} deals flagged as INVALID_LEGACY.`);
        return { flagged: flaggedCount };
    }
}

module.exports = new DealService();
