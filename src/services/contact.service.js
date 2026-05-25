const prisma = require('../config/prisma');
const auditService = require('./audit.service');

class ContactService {
    _parseContact(contact) {
        if (!contact) return null;
        try {
            return {
                ...contact,
                tags: typeof contact.tags === 'string' ? JSON.parse(contact.tags || '[]') : (contact.tags || []),
                notes: typeof contact.notes === 'string' ? JSON.parse(contact.notes || '[]') : (contact.notes || []),
                documents: typeof contact.documents === 'string' ? JSON.parse(contact.documents || '[]') : (contact.documents || []),
                buyerDetails: typeof contact.buyerDetails === 'string' ? JSON.parse(contact.buyerDetails || '{}') : (contact.buyerDetails || {}),
                sellerDetails: typeof contact.sellerDetails === 'string' ? JSON.parse(contact.sellerDetails || '{}') : (contact.sellerDetails || {}),
                leadDetails: typeof contact.leadDetails === 'string' ? JSON.parse(contact.leadDetails || '{}') : (contact.leadDetails || {}),
                companyDetails: typeof contact.companyDetails === 'string' ? JSON.parse(contact.companyDetails || '{}') : (contact.companyDetails || {})
            };
        } catch (e) {
            console.error("Contact Parse Error:", e);
            return contact;
        }
    }

    _normalize(email, phone) {
        const cleanEmail = email ? email.trim().toLowerCase() : null;
        // Strip everything except numbers and '+' for phone
        const cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : null;
        return { email: cleanEmail, phone: cleanPhone };
    }

    _validateBuyerDetails(details) {
        if (!details || typeof details !== 'object') return {};
        return {
            budgetMin: parseFloat(details.budgetMin) || 0,
            budgetMax: parseFloat(details.budgetMax) || 0,
            preferredLocations: Array.isArray(details.preferredLocations) ? details.preferredLocations : [],
            propertyTypeInterest: details.propertyTypeInterest || 'Residential'
        };
    }

    async createContact(data, creatorId) {
        // 1. Normalize phone/email BEFORE any checks
        const { email, phone } = this._normalize(data.email, data.phone);

        // 2. Strict Field Rule (Mandatory Requirement #5)
        if (!email && !phone) {
            throw new Error("Validation Failed: A contact must have at least an email address or a phone number.");
        }

        // 3. Deduplication Check (Safety Enhancement #2)
        if (email || phone) {
            const existing = await prisma.contact.findFirst({
                where: {
                    isDeleted: false,
                    OR: [
                        email ? { email } : null,
                        phone ? { phone } : null
                    ].filter(Boolean)
                }
            });
            if (existing) {
                console.log(`[DEDUPLICATION] Reusing existing contact #${existing.id} for ${email || phone}`);
                return this._parseContact(existing);
            }
        }

        // 4. Validate Assignment (Safety Enhancement #9)
        let assignedToId = parseInt(data.assigned_to || data.assignedAgentId || creatorId);
        const targetUser = await prisma.user.findUnique({ where: { id: assignedToId } });
        
        // If assigned contact is not an agent, and creator is an agent, fallback to creator
        if (targetUser && targetUser.role !== 'AGENT') {
            const creator = await prisma.user.findUnique({ where: { id: creatorId } });
            if (creator && creator.role === 'AGENT') {
                assignedToId = creatorId;
            }
        }

        const sourceLeadId = data.lead_id || data.created_from_lead_id || data.source_lead_id;
        
        // Extract data from nested leadDetails if existing
        const source = data.source || data.leadDetails?.source;
        const message = data.message || data.leadDetails?.interestNotes;

        // Clean up and construct final data object
        const finalData = {
            name: data.name,
            email: email,
            phone: phone,
            source: source,
            message: message,
            role: data.role || 'BUYER',
            status: data.status || 'ACTIVE',
            tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || '[]'),
            notes: Array.isArray(data.notes) ? JSON.stringify(data.notes) : (data.notes || '[]'),
            documents: Array.isArray(data.documents) ? JSON.stringify(data.documents) : (data.documents || '[]'),
            buyerDetails: JSON.stringify(this._validateBuyerDetails(data.buyerDetails)),
            sellerDetails: data.sellerDetails ? JSON.stringify(data.sellerDetails) : '{}',
            leadDetails: data.leadDetails ? JSON.stringify(data.leadDetails) : '{}',
            companyDetails: data.companyDetails ? JSON.stringify(data.companyDetails) : '{}',
            team_id: data.teamId ? parseInt(data.teamId) : null,
            lead_id: sourceLeadId ? parseInt(sourceLeadId) : null,
            created_from_lead_id: sourceLeadId ? parseInt(sourceLeadId) : null,
            agent_id: data.agent_id || data.agentId || assignedToId,
            assigned_to: assignedToId,
            is_internal: data.is_internal === true // Support manual internal flag if needed, usually false
        };

        const contact = await prisma.contact.create({
            data: finalData
        });
        
        await auditService.log({
            userId: creatorId,
            action: 'CREATE_CONTACT',
            entityType: 'Contact',
            entityId: contact.id,
            newValue: finalData
        });

        return this._parseContact(contact);
    }

    async getContactById(id, user) {
        const contact = await prisma.contact.findUnique({
            where: { id: parseInt(id) },
            include: { 
                assignedTo: true, 
                properties: true, 
                deals: true,
                fromLead: true 
            }
        });

        if (!contact || contact.isDeleted) return null;

        // RBAC Check
        if (user.role !== 'SUPER_ADMIN') {
            const isOwner = contact.assigned_to === user.id;
            const isManagerOfOwner = contact.assignedTo?.manager_id === user.id;
            if (!isOwner && !isManagerOfOwner) {
                const error = new Error("Access Denied: You do not have permission to view this contact.");
                error.status = 403;
                throw error;
            }
        }

        return this._parseContact(contact);
    }

    async getAllContacts(user, query = {}) {
        const { id, role } = user;
        const { search, status } = query;

        const where = {
            isDeleted: false,
            is_internal: false, // Strict Isolation: Never show internal testers/agents in client list
            role: { in: ['BUYER', 'SELLER'] }, // Mandatory Requirement: External clients only
            ...(role === 'SUPER_ADMIN' ? {} : 
                role === 'MANAGER' ? {
                    OR: [
                        { assigned_to: id },
                        { assignedTo: { manager_id: id } }
                    ]
                } : { assigned_to: id })
        };

        // Apply Status Filter (Optional - default to ACTIVE/INACTIVE unless specified)
        if (status) {
            where.status = status.toUpperCase();
        } else {
            // By default, exclude ARCHIVED contacts from main view
            where.status = { not: 'ARCHIVED' };
        }

        // Apply Universal Search (Name, Email, Phone)
        if (search) {
            where.AND = [
                {
                    OR: [
                        { name: { contains: search } },
                        { email: { contains: search } },
                        { phone: { contains: search } }
                    ]
                }
            ];
        }

        const contacts = await prisma.contact.findMany({
            where,
            include: { assignedTo: true, properties: true, deals: true },
            orderBy: { name: 'asc' }
        });

        return contacts.map(c => this._parseContact(c));
    }

    async updateContact(id, data, performer) {
        const contactId = parseInt(id);
        const currentContactRaw = await prisma.contact.findUnique({ where: { id: contactId }});
        if (!currentContactRaw) throw new Error('Contact not found');

        // Whitelist only valid schema fields
        const validFields = [
            'team_id', 'lead_id', 'created_from_lead_id', 'assigned_to', 'isDeleted',
            'tags', 'notes', 'documents', 'buyerDetails', 'sellerDetails', 
            'leadDetails', 'companyDetails', 'agent_id'
        ];

        const updateData = {};
        validFields.forEach(field => {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        });

        // Use 'role' if 'type' is passed from legacy frontend
        if (data.type && !updateData.role) {
            const typeMap = { 'Lead': 'BUYER', 'Buyer': 'BUYER', 'Seller': 'SELLER', 'Company': 'BUYER' };
            updateData.role = typeMap[data.type] || 'BUYER';
        }

        // 1. Normalize JSON fields
        if (updateData.email || updateData.phone) {
            const { email, phone } = this._normalize(updateData.email, updateData.phone);
            if (email) updateData.email = email;
            if (phone) updateData.phone = phone;
        }

        if (updateData.buyerDetails) {
            updateData.buyerDetails = JSON.stringify(this._validateBuyerDetails(typeof updateData.buyerDetails === 'string' ? JSON.parse(updateData.buyerDetails) : updateData.buyerDetails));
        }

        const jsonFields = ['tags', 'notes', 'documents', 'sellerDetails', 'leadDetails', 'companyDetails'];
        jsonFields.forEach(field => {
            if (updateData[field] !== undefined && typeof updateData[field] === 'object') {
                updateData[field] = JSON.stringify(updateData[field]);
            }
        });

        // 3. Perform Update
        const updated = await prisma.contact.update({
            where: { id: contactId },
            data: updateData
        });

        if (performer) {
            await auditService.log({
                userId: performer.id,
                action: 'UPDATE_CONTACT',
                entityType: 'Contact',
                entityId: contactId,
                oldValue: currentContactRaw,
                newValue: updateData
            });
        }

        return this._parseContact(updated);
    }

    async deleteContact(id, user) {
        if (user.role === 'AGENT') {
            const error = new Error("Agents are not permitted to delete contacts. Please archive instead.");
            error.status = 403;
            throw error;
        }

        const contactId = parseInt(id);
        
        // Safety Enhancement #3: Prevent hard deletion - use ARCHIVED status
        const archivedContact = await prisma.contact.update({
            where: { id: contactId },
            data: {
                isDeleted: true,
                status: 'ARCHIVED',
                deletedAt: new Date(),
                deletedBy: user.id
            }
        });

        await auditService.log({
            userId: user.id,
            action: 'ARCHIVE_CONTACT',
            entityType: 'Contact',
            entityId: contactId,
            newValue: { status: 'ARCHIVED', isDeleted: true }
        });

        return archivedContact;
    }
}

module.exports = new ContactService();
