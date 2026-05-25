const prisma = require('../config/prisma');

class PropertyService {
    _parseProperty(property) {
        if (!property) return null;
        try {
            return {
                ...property,
                publishing: typeof property.publishing === 'string' ? JSON.parse(property.publishing || '{}') : (property.publishing || {}),
                media: typeof property.media === 'string' ? JSON.parse(property.media || '[]') : (property.media || []),
                features: typeof property.features === 'string' ? JSON.parse(property.features || '[]') : (property.features || []),
                documents: typeof property.documents === 'string' ? JSON.parse(property.documents || '[]') : (property.documents || []),
                // Normalization: Ensure Frontend always gets CamelCase
                ownerId: property.owner_id || null,
            };
        } catch (e) {
            console.error("Property Parse Error:", e);
            return property;
        }
    }

    _normalizeStatus(status) {
        if (!status) return 'AVAILABLE';
        const s = status.toString().toUpperCase().replace(/[- ]/g, '_');
        const valid = ['AVAILABLE', 'RESERVED', 'SOLD', 'OFF_MARKET'];
        
        if (valid.includes(s)) return s;
        
        // Comprehensive Legacy Mapping
        if (s.includes('OFF_MARKET')) return 'OFF_MARKET';
        if (s.includes('NEGOTIATION') || s.includes('RESERVE')) return 'RESERVED';
        if (s.includes('SOLD') || s.includes('CONTRACT')) return 'SOLD';
        return 'AVAILABLE';
    }

    /**
     * Maps the frontend payload (which may contain legacy/unknown fields) to the
     * exact Prisma schema shape. This is the single source of truth for field mapping.
     * Strips: id (client-generated string), basicInfo, details, isArchived, ownerId,
     *         draftVersion, lastSavedAt — none of these are DB columns.
     */
    _sanitize(data, isUpdate = false) {
        // Flatten location: accept object or JSON string
        let location = data.location || {};
        if (typeof location === 'string') { try { location = JSON.parse(location); } catch(_) {} }

        // Flatten basicInfo -> type/status
        const basicInfo = data.basicInfo || {};

        // Flatten details -> individual columns
        const details = data.details || {};

        const clean = {
            title:         data.title,
            slug:          data.slug,
            price:         parseFloat(data.price) || 0,
            description:   data.description || null,

            // type/status come from either root level or basicInfo
            type:          data.type || basicInfo.type || 'Villa',
            status:        this._normalizeStatus(data.status || basicInfo.status),

            // location flattened to columns
            address:       location.address || data.address || null,
            city:          location.city    || data.city    || null,
            country:       location.country || data.country || 'Italy',
            lat:           location.lat     != null ? parseFloat(location.lat)  : null,
            lng:           location.lng     != null ? parseFloat(location.lng)  : null,

            // details flattened to columns (prefer root-level if already present)
            bedrooms:      data.bedrooms   != null ? parseInt(data.bedrooms)   : (details.bedrooms   != null ? parseInt(details.bedrooms)   : null),
            bathrooms:     data.bathrooms  != null ? parseInt(data.bathrooms)  : (details.bathrooms  != null ? parseInt(details.bathrooms)  : null),
            area:          data.area       != null ? parseFloat(data.area)     : (details.area       != null ? parseFloat(details.area)     : null),
            year_built:    data.year_built != null ? parseInt(data.year_built) : (details.yearBuilt  != null ? parseInt(details.yearBuilt)  : null),
            energy_rating: data.energy_rating || details.energyRating || null,

            // JSON blob fields
            features:   typeof data.features  === 'object' ? JSON.stringify(data.features)  : (data.features  || '{}'),
            media:      Array.isArray(data.media)           ? JSON.stringify(data.media)      : (data.media     || '[]'),
            documents:  Array.isArray(data.documents)       ? JSON.stringify(data.documents)  : (data.documents || '[]'),
            publishing: typeof data.publishing === 'object' ? JSON.stringify(data.publishing) : (data.publishing || '{}'),

            // Archive flag — schema uses is_archived
            is_archived:    data.isArchived ?? data.is_archived ?? false,

            // owner/user FK — schema uses owner_id (Int)
            owner_id:    data.ownerId    ? parseInt(data.ownerId)    : (data.owner_id    ? parseInt(data.owner_id)    : null),
            userId:      data.userId     ? parseInt(data.userId)     : null,

            commissionType: data.commissionType || 'PERCENTAGE',
            commissionValue: parseFloat(data.commissionValue) || parseFloat(data.commissionRate) || 3.0,
        };

        // NEVER include id in the data object for create/update if it's a string from client
        // Prisma will handle the id from the where clause in updates and autoincrement in creates.
        delete clean.id;

        return clean;
    }

    async _syncContactRole(contactId) {
        if (!contactId) return;
        const contact = await prisma.contact.findUnique({
            where: { id: parseInt(contactId) }
        });
        if (!contact) return;

        let newRole = contact.role;
        if (!contact.role || contact.role === 'Contact') {
            newRole = 'SELLER';
        }

        if (newRole !== contact.role) {
            console.log(`[ROLE_SYNC] Upgrading contact #${contactId} role: ${contact.role} -> ${newRole}`);
            await prisma.contact.update({
                where: { id: contact.id },
                data: { role: newRole }
            });
        }
    }

    async createProperty(data, creatorId = null) {
        const clean = this._sanitize(data);
        
        // Professional Model Enhancement: Mandatory Ownership & Role Validation
        if (!clean.owner_id) {
            throw new Error('Asset Error: Owner (Seller) is mandatory. Please select a valid contact.');
        }

        const owner = await prisma.contact.findUnique({
            where: { id: clean.owner_id },
            select: { status: true, role: true, name: true }
        });

        if (!owner) throw new Error(`Asset Error: The specified Owner (ID: ${clean.owner_id}) does not exist.`);
        
        if (owner.status !== 'ACTIVE') {
            throw new Error(`Protocol Breach: Contact "${owner.name}" is ${owner.status}. Only ACTIVE contacts can own property listings.`);
        }

        const validSellerRoles = ['SELLER'];
        if (!validSellerRoles.includes(owner.role)) {
            throw new Error(`Role Conflict: "${owner.name}" has role "${owner.role}". Listings require a SELLER role. (Requirement #2)`);
        }

        // If we have a authenticated creator, set them as the userId
        if (creatorId) {
            clean.userId = parseInt(creatorId);
        }

        const property = await prisma.property.create({ data: clean });
        
        // Safety Enhancement #4: Property Ownership Consistency
        if (clean.owner_id) {
            await this._syncContactRole(clean.owner_id);
        }
        
        return this._parseProperty(property);
    }

    async getAllProperties(user) {
        const { role, id } = user;
        let properties = [];

        if (role === 'SUPER_ADMIN') {
            properties = await prisma.property.findMany({
                include: { owner: true }
            });
        } else if (role === 'MANAGER') {
            properties = await prisma.property.findMany({
                where: {
                    OR: [
                        { owner: { assigned_to: id } },
                        { owner: { assignedTo: { manager_id: id } } }
                    ]
                },
                include: { owner: true }
            });
        } else {
            // AGENT Logic: See properties you own OR any AVAILABLE inventory (Acquisition Protocol support)
            properties = await prisma.property.findMany({
                where: {
                    OR: [
                        { owner: { assigned_to: id } },
                        { status: 'AVAILABLE', is_archived: false }
                    ]
                },
                include: { owner: true }
            });
        }
        return properties.map(p => this._parseProperty(p));
    }

    async getPropertyById(id, user) {
        const property = await prisma.property.findUnique({
            where: { id: parseInt(id) },
            include: { 
                owner: {
                    include: {
                        assignedTo: true
                    }
                }
            }
        });

        if (!property) return null;

        // RBAC Check: SUPER_ADMIN has full access
        if (user.role !== 'SUPER_ADMIN') {
            const isOwner = property.owner?.assigned_to === user.id;
            const isManagerOfOwner = property.owner?.assignedTo?.manager_id === user.id;
            const isAvailableInventory = property.status === 'AVAILABLE' && !property.is_archived;
            
            if (!isOwner && !isManagerOfOwner && !isAvailableInventory) {
                const error = new Error("Access Denied: You do not have permission to view this property listing.");
                error.status = 403;
                throw error;
            }
        }

        return this._parseProperty(property);
    }

    async updateProperty(id, data) {
        const clean = this._sanitize(data, true);
        
        // Safety Enhancement #10: Validate Owner Status
        if (clean.owner_id) {
            const owner = await prisma.contact.findUnique({
                where: { id: clean.owner_id },
                select: { status: true }
            });
            if (!owner || owner.status !== 'ACTIVE') {
                throw new Error('Protocol Breach: Only ACTIVE contacts can be assigned as property owners.');
            }
        }

        const property = await prisma.property.update({
            where: { id: parseInt(id) },
            data: clean
        });

        // Safety Enhancement #4: Property Ownership Consistency
        if (clean.owner_id) {
            await this._syncContactRole(clean.owner_id);
        }

        return this._parseProperty(property);
    }

    async deleteProperty(id, user) {
        if (user.role === 'AGENT') {
            const error = new Error("Agents are not permitted to delete properties. Please archive instead.");
            error.status = 403;
            throw error;
        }
        return await prisma.property.delete({
            where: { id: parseInt(id) }
        });
    }
}

module.exports = new PropertyService();
