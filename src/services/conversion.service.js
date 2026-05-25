const prisma = require('../config/prisma');
const activityService = require('./activity.service');
const notificationService = require('./notification.service');

class ConversionService {
    /**
     * Converts a Lead into a Contact AND a Deal in a single atomic transaction.
     * @param {number} leadId 
     * @param {Object} data - { dealValue, propertyId, assignedToId }
     * @param {Object} performer - User performing the action
     */
    async convertLead(leadId, data, performer) {
        const id = parseInt(leadId);

        return await prisma.$transaction(async (tx) => {
            // 1. Fetch Lead (Explicit lock check)
            const lead = await tx.lead.findUnique({
                where: { id },
                include: { owner: true }
            });

            if (!lead || lead.isDeleted) throw new Error('Lead not found');

            // Mandatory Requirement #9: Double Conversion Block
            if (lead.is_converted || lead.status === 'CONVERTED') {
                throw new Error('Action Blocked: This lead has already been converted to a contact and cannot be processed again.');
            }

            // 1.2 Idempotency Guard (By Lead ID relationship)
            let contact = await tx.contact.findFirst({
                where: {
                    OR: [
                        { lead_id: id },
                        { created_from_lead_id: id }
                    ],
                    isDeleted: false
                }
            });

            if (contact) {
                throw new Error('Consistency Error: A contact already exists for this lead ID. Conversion aborted.');
            }

            // 1.3 Deduplication (Mandatory Requirement #2) - By Normalized Email/Phone
            const contactService = require('./contact.service');
            const { email, phone } = contactService._normalize(lead.email, lead.phone);

            if (email || phone) {
                contact = await tx.contact.findFirst({
                    where: {
                        isDeleted: false,
                        OR: [
                            email ? { email } : null,
                            phone ? { phone } : null
                        ].filter(Boolean)
                    }
                });

                if (contact) {
                    console.log(`[CONVERSION_DEDUPLICATION] Reusing existing contact #${contact.id} for Lead #${id}`);
                }
            }

            // 1.5 Validate Property ID (Mandatory Requirement #1)
            const propertyToLink = data.propertyId || lead.property_id;
            const parsedPropertyId = propertyToLink ? parseInt(propertyToLink, 10) : null;

            if (!parsedPropertyId) {
                throw new Error('Asset Required: A deal cannot be created without a linked property. Please select a property asset to continue conversion.');
            }

            if (parsedPropertyId) {
                const propertyExists = await tx.property.findUnique({
                    where: { id: parsedPropertyId },
                    select: { id: true, status: true }
                });
                if (!propertyExists) {
                    throw new Error(`Asset Error: Property #${parsedPropertyId} does not exist.`);
                }
                if (propertyExists.status === 'SOLD') {
                    throw new Error(`Asset Lock: Property #${parsedPropertyId} is already marked as SOLD.`);
                }
            }

            // 2. Resolve Deal Value (Mandatory Requirement: deal_value > 0)
            const explicitValue = data.dealValue ? parseFloat(data.dealValue) : null;
            let finalDealValue = explicitValue;

            if ((finalDealValue === null || finalDealValue <= 0) && parsedPropertyId) {
                const property = await tx.property.findUnique({
                    where: { id: parsedPropertyId },
                    select: { price: true }
                });
                if (property && property.price) {
                    finalDealValue = parseFloat(property.price);
                }
            }

            if (!finalDealValue || finalDealValue <= 0) {
                finalDealValue = 0; // Will be caught by deal.service if strictly required on creation
            }

            // 3. Create OR Link Contact
            if (!contact) {
                // FIXED: Each contact from Lead must be BUYER only (Requirement #4)
                const role = 'BUYER';
                
                const buyerDetails = {
                    budgetMin: lead.budget ? Number(lead.budget) * 0.8 : 0,
                    budgetMax: lead.budget ? Number(lead.budget) : 0,
                    preferredLocations: lead.location_interest ? [lead.location_interest] : [],
                    propertyTypeInterest: lead.property_type_interest || 'Residential'
                };

                contact = await tx.contact.create({
                    data: {
                        name: lead.name,
                        email: email,
                        phone: phone,
                        source: lead.source || 'LEAD_CONVERSION',
                        message: lead.message,
                        role: role,
                        status: 'ACTIVE',
                        lead_id: lead.id,
                        created_from_lead_id: lead.id,
                        // FIXED: Agent who converts lead OWNS the contact (Requirement #2)
                        agent_id: lead.owner_id || performer.id, 
                        assigned_to: data.assignedToId || lead.owner_id || performer.id,
                        buyerDetails: JSON.stringify(buyerDetails),
                        sellerDetails: JSON.stringify({})
                    }
                });
            } else {
                // Link Lead to existing contact if not already linked
                await tx.contact.update({
                    where: { id: contact.id },
                    data: {
                        lead_id: lead.id,
                        created_from_lead_id: lead.id,
                        // FIXED: Ensure agent ownership is preserved on reuse if missing
                        agent_id: contact.agent_id || lead.owner_id || performer.id
                    }
                });
            }

            // 4. Create Deal (STRICT: No Property = No Deal)
            // FIXED: Only create deal if property is selected (Requirement #3 & #5)
            let deal = null;
            if (parsedPropertyId) {
                // Fetch property to resolve Seller (Requirement #5)
                const property = await tx.property.findUnique({
                    where: { id: parsedPropertyId },
                    select: { owner_id: true }
                });

                if (!property || !property.owner_id) {
                    throw new Error('Integrity Fault: The associated property has no registered Listing Seller. Conversion blocked.');
                }

                deal = await tx.deal.create({
                    data: {
                        // PRIMARY MAPPING (Requirement #5 & #8)
                        contact_id: Number(property.owner_id), // Seller
                        buyer_contact_id: Number(contact.id),  // Buyer
                        property_id: parsedPropertyId,
                        
                        value: finalDealValue,
                        status: 'DRAFT', // Pipeline starts at DRAFT (Requirement #1)
                        stage: 'DRAFT',
                        type: 'BUYER', 
                        agent_id: contact.agent_id || lead.owner_id || performer.id,
                        assigned_to: contact.agent_id || lead.owner_id || performer.id,
                        source: 'LEAD_CONVERSION',
                        lead_id: lead.id,
                        notes: JSON.stringify([]),
                        history: JSON.stringify([
                            { 
                                stage: 'DRAFT', 
                                timestamp: new Date().toISOString(), 
                                details: `Professional conversion from Lead #${lead.id}. Linked to Property #${parsedPropertyId} (Seller #${property.owner_id}).` 
                            }
                        ])
                    }
                });
            }

            // 5. Update Lead Status & Tracking (Mandatory Requirement #2)
            const updatedLead = await tx.lead.update({
                where: { id },
                data: {
                    status: 'CONVERTED',
                    is_converted: true,
                    converted_to_contact_id: contact.id
                }
            });

            // 6. Log Activities (Atomic transaction context)
            await tx.leadactivity.create({
                data: {
                    lead_id: lead.id,
                    user_id: performer.id,
                    type: 'LEAD_CONVERSION',
                    details: JSON.stringify({
                        contact_id: contact.id,
                        deal_id: deal ? deal.id : null,
                        value: deal ? deal.value : 0,
                        action: deal ? 'LEAD_TO_CONTACT_DEAL' : 'LEAD_TO_CONTACT_ONLY'
                    })
                }
            });

            // 7. Notification
            if (lead.owner_id && lead.owner_id !== performer.id) {
                const message = deal 
                    ? `Success: Lead "${lead.name}" converted to Deal #${deal.id} by ${performer.name}.`
                    : `Success: Lead "${lead.name}" converted to Contact #${contact.id} by ${performer.name}.`;
                await tx.notification.create({
                    data: {
                        user_id: lead.owner_id,
                        type: 'CONVERSION_SUCCESS',
                        message: message
                    }
                });
            }

            return { lead: updatedLead, contact, deal };
        });
    }
}

module.exports = new ConversionService();
