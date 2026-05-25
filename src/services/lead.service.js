const prisma = require('../config/prisma');
const assignmentService = require('./assignment.service');
const notificationService = require('./notification.service');
const activityService = require('./activity.service');
const auditService = require('./audit.service');
const { validateStatusTransition } = require('../utils/status.validator');

class LeadService {
    _parseLead(lead) {
        if (!lead) return null;
        try {
            const parsed = { ...lead };
            if (parsed.activities) {
                parsed.activities = parsed.activities.map(act => ({
                    ...act,
                    details: typeof act.details === 'string' ? JSON.parse(act.details || '{}') : (act.details || {})
                }));
            }
            return parsed;
        } catch (e) {
            console.error("Lead Parse Error:", e);
            return lead;
        }
    }

    async createLead(data, creator) {
        const { id: creatorId, role: creatorRole } = creator;

        // Clean up data to avoid passing unknown/legacy fields to Prisma
        const { assignedAgentId, created_by, assigned_to, ...cleanData } = data;

        let owner_id = null;
        let manager_id = null;
        const role = creatorRole.toUpperCase();

        // 1. Resolve Owner and Manager Atomically
        if (role === 'AGENT') {
            owner_id = creatorId;
            // Fetch creator's manager to be sure it's dynamic
            const creatorUser = await prisma.user.findUnique({ where: { id: creatorId } });
            manager_id = creatorUser?.manager_id || null;
        } else {
            // Manager or Admin context: Use explicitly assigned agent or default to null
            owner_id = assignedAgentId ? parseInt(assignedAgentId, 10) : (data.owner_id ? parseInt(data.owner_id, 10) : null);
            
            if (owner_id) {
                const assignedAgent = await prisma.user.findUnique({ where: { id: owner_id } });
                manager_id = assignedAgent?.manager_id || (role === 'MANAGER' ? creatorId : null);
            } else if (role === 'MANAGER') {
                manager_id = creatorId;
            }
        }

        // 2. Asset Integrity: Validate Property Link (Mandatory Rule #10)
        if (cleanData.property_id) {
            const propertyId = parseInt(cleanData.property_id);
            const property = await prisma.property.findUnique({ where: { id: propertyId } });
            if (!property) throw new Error(`Asset Error: Property ID #${propertyId} does not exist in the professional portfolio.`);
            cleanData.property_id = propertyId;
        }

        const lead = await prisma.lead.create({
            data: {
                ...cleanData,
                owner_id,
                manager_id,
                created_by_id: creatorId,
                updatedAt: new Date()
            }
        });

        // Automatically Assign if no owner yet (Manager/Admin context)
        if (!owner_id) {
            // Pass creator info to assignment service so it knows whether to filter by manager or assign globally
            const autoAssignedAgentId = await assignmentService.autoAssignLead(lead.id, manager_id, role);
            if (autoAssignedAgentId) {
                // Log the automatic assignment
                await activityService.logActivity({
                    leadId: lead.id,
                    userId: creatorId,
                    type: 'INITIAL_ASSIGNMENT',
                    details: {
                        method: 'ROUND_ROBIN',
                        assignedTo: autoAssignedAgentId
                    }
                });

                // Fetch updated lead to return
                return await prisma.lead.findUnique({
                    where: { id: lead.id },
                    include: { owner: true, manager: true, createdBy: true }
                });
            }
        }

        await auditService.log({
            userId: creatorId,
            action: 'CREATE_LEAD',
            entityType: 'Lead',
            entityId: lead.id,
            newValue: cleanData
        });

        return lead;
    }


    async getAllLeads(user) {
        const { id, role: rawRole } = user;
        const role = rawRole.toUpperCase();

        const leads = await prisma.lead.findMany({
            where: {
                isDeleted: false,
                ...(role === 'SUPER_ADMIN' ? {} :
                    role === 'MANAGER' ? { OR: [{ manager_id: id }, { manager_id: null }] } :
                        { owner_id: id })
            },
            include: {
                createdBy: true,
                owner: true,
                manager: true
            }
        });
        return leads.map(l => this._parseLead(l));
    }

    async reassignLead(leadId, newOwnerId, performer) {
        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(leadId) }
        });

        if (!lead) throw new Error('Lead not found');

        // Validation Rules
        const role = performer.role.toUpperCase();
        if (role === 'AGENT') {
            throw new Error('Agents are not permitted to reassign leads.');
        }

        if (newOwnerId === lead.owner_id) return lead;

        const newAgent = await prisma.user.findUnique({
            where: { id: parseInt(newOwnerId) }
        });

        if (!newAgent || newAgent.role.toUpperCase() !== 'AGENT') {
            throw new Error('Target must be a valid Agent.');
        }

        // Manager Boundary Rule: Can only reassign within own team
        if (role === 'MANAGER' && newAgent.manager_id !== performer.id) {
            throw new Error('Access Denied: Managers can only reassign leads within their own team.');
        }

        const oldOwnerId = lead.owner_id;
        const oldManagerId = lead.manager_id;
        const newManagerId = newAgent.manager_id;

        const updatedLead = await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: {
                owner_id: newAgent.id,
                manager_id: newManagerId // Automated sync
            }
        });

        const activityType = oldOwnerId === null ? 'INITIAL_ASSIGNMENT' : 'REASSIGNED';

        // Audit Log
        await activityService.logActivity({
            leadId: lead.id,
            userId: performer.id,
            type: activityType,
            details: {
                oldOwnerId,
                newOwnerId: newAgent.id,
                oldManagerId,
                newManagerId,
                performedByRole: performer.role
            }
        });

        // Real-time Notification
        await notificationService.createNotification(
            newAgent.id,
            'LEAD_ASSIGNED',
            `Lead "${lead.name}" has been assigned to you by ${performer.name}.`
        );

        return updatedLead;
    }

    async getLeadById(id, user) {
        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(id) },
            include: {
                owner: true,
                manager: true,
                createdBy: true,
                activities: {
                    include: { user: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!lead || lead.isDeleted) throw new Error('Lead not found');

        // RBAC Check
        if (user.role !== 'SUPER_ADMIN') {
            const userId = Number(user.id);
            const isOwner = lead.owner_id === userId;
            const isManagerOfOwner = lead.manager_id === userId;
            const isUnassignedToManager = user.role === 'MANAGER' && lead.manager_id === null;

            if (!isOwner && !isManagerOfOwner && !isUnassignedToManager) {
                const error = new Error("Access Denied: You do not have permission to view this lead details.");
                error.status = 403;
                throw error;
            }
        }

        return this._parseLead(lead);
    }

    async updateLead(id, data, performer) {
        const leadId = parseInt(id);
        const currentLead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!currentLead) throw new Error('Lead not found');

        // 0. LEAD LOCK (Mandatory Requirement #2)
        const isConverted = currentLead.is_converted || currentLead.status === 'CONVERTED';
        if (isConverted) {
            const blockedFields = ['name', 'phone', 'email'];
            const attemptedEdits = Object.keys(data).filter(key => blockedFields.includes(key));

            if (attemptedEdits.length > 0) {
                throw new Error(`Data Lock Active: Core info (${attemptedEdits.join(', ')}) cannot be modified for a converted lead. Only notes and activities are permitted.`);
            }
        }

        // PROPERTY LOCK DURING REQUEST
        if (currentLead.status === 'CONVERSION_REQUESTED' && data.property_id && data.property_id !== currentLead.property_id) {
            throw new Error('Asset Lock Active: This lead is currently under conversion review. Reject the request to modify the linked property.');
        }

        // 1. Status Transition Validation
        const { rejectionReason, ...updateData } = data;

        if (updateData.status) {
            const newStatus = updateData.status.toUpperCase();
            // Handle legacy rename if incoming
            const normalizedStatus = newStatus === 'REQUESTED_CONVERSION' ? 'CONVERSION_REQUESTED' : newStatus;

            if (!validateStatusTransition(currentLead.status, normalizedStatus, performer.role)) {
                const error = new Error(`Protocol Breach: role '${performer.role}' is not permitted to move lead from ${currentLead.status} to ${normalizedStatus}`);
                error.status = 403;
                throw error;
            }
            updateData.status = normalizedStatus;
        }

        // 1.5 Automated Manager Synchronization (Visibility Guard)
        if (updateData.owner_id && updateData.owner_id !== currentLead.owner_id) {
            const newAgent = await prisma.user.findUnique({
                where: { id: parseInt(updateData.owner_id) }
            });
            if (newAgent) {
                updateData.manager_id = newAgent.manager_id;
            }
        }

        // 2. Perform Update
        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: { ...updateData, updatedAt: new Date() }
        });

        await auditService.log({
            userId: performer.id,
            action: 'UPDATE_LEAD',
            entityType: 'Lead',
            entityId: leadId,
            oldValue: currentLead,
            newValue: data
        });

        // 3. Log Activity & Notify (Point 11)
        if (updateData.status && updateData.status !== currentLead.status) {
            let activityType = 'STATUS_CHANGED';
            let activityDetails = {
                old: currentLead.status,
                new: updateData.status,
                userId: performer.id,
                timestamp: new Date().toISOString()
            };

            // Enhanced Activity for Rejection
            if (currentLead.status === 'CONVERSION_REQUESTED' && updateData.status === 'QUALIFIED') {
                activityType = 'CONVERSION_REJECTED';
                activityDetails.reason = rejectionReason || 'No reason provided';
            }

            await activityService.logActivity({
                leadId,
                userId: performer.id,
                type: activityType,
                details: activityDetails
            });

            // Notification Trigger: CONVERSION_REQUESTED -> Manager
            if (updateData.status === 'CONVERSION_REQUESTED' && currentLead.manager_id) {
                await notificationService.createNotification(
                    currentLead.manager_id,
                    'CONVERSION_REQUESTED',
                    `Action Required: Agent ${performer.name} has requested conversion for lead "${currentLead.name}".`
                );
            }
        }

        // PROPERTY LINKING LOG
        if (updateData.property_id && updateData.property_id !== currentLead.property_id) {
            await activityService.logActivity({
                leadId,
                userId: performer.id,
                type: 'PROPERTY_LINKED',
                details: {
                    property_id: updateData.property_id,
                    timestamp: new Date().toISOString()
                }
            });
        } else if (updateData.owner_id && updateData.owner_id !== currentLead.owner_id) {
            // Already handled by reassignLead but keeping for generic update compatibility
            await activityService.logActivity({
                leadId,
                userId: performer.id,
                type: 'REASSIGNED',
                details: { old: currentLead.owner_id, new: updateData.owner_id }
            });
        }

        return this._parseLead(updatedLead);
    }

    async deleteLead(id, user) {
        if (user.role === 'AGENT') {
            const error = new Error("Agents are not permitted to delete leads. Please update status to 'Invalid' or 'Lost'.");
            error.status = 403;
            throw error;
        }

        // Soft Delete
        const deletedLead = await prisma.lead.update({
            where: { id: parseInt(id) },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: user.id
            }
        });

        // Audit Logging
        if (typeof auditService?.log === 'function') {
            await auditService.log({
                userId: user.id,
                action: 'DELETE_LEAD',
                entityType: 'Lead',
                entityId: deletedLead.id,
                newValue: { isDeleted: true }
            });
        }

        return deletedLead;
    }
}

module.exports = new LeadService();
