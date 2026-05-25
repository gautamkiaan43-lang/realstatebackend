const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const conversionService = require('../src/services/conversion.service');
const dealService = require('../src/services/deal.service');

async function verify() {
    console.log("🧪 Starting CRM Integrity Verification...");

    try {
        // 1. Test Lead to Contact Ownership Lock
        const mockLead = await prisma.lead.create({
            data: {
                name: "Test Ownership",
                email: `test_owner_${Date.now()}@example.com`,
                owner_id: 2, // Assuming agent id 2 exists
                created_by_id: 1,
                status: 'NEW'
            }
        });

        const performer = { id: 1, name: "Admin", role: "SUPER_ADMIN" };
        const converted = await conversionService.convertLead(mockLead.id, {
            propertyId: null, // No property = No deal yet
            dealValue: 100000
        }, performer);

        if (converted.contact.agent_id === 2) {
            console.log("✅ Lead owner correctly mapped to Contact agent_id.");
        } else {
            console.log("❌ Contact agent_id mapping FAULT.");
        }

        // 2. Test Deal Ownership Lock (Requirement #3/6)
        // Link to a property
        const property = await prisma.property.findFirst({ where: { status: 'AVAILABLE' }});
        if (property) {
            const deal = await dealService.createDeal({
                contactId: converted.contact.id,
                propertyId: property.id,
                value: 500000
            }, performer);

            if (deal.agent_id === 2) {
                console.log("✅ Deal correctly inherited agent_id from Contact.");
            } else {
                console.log("❌ Deal agent_id inheritance FAULT.");
            }

            // 3. Test Agent Blocking (Requirement #5)
            const agentPerformer = { id: 2, name: "Agent", role: "AGENT" };
            try {
                await dealService.updateDeal(deal.id, { agent_id: 1 }, agentPerformer);
                console.log("❌ FAULT: Agent was able to reassign deal ownership!");
            } catch (e) {
                console.log("✅ Agent correctly blocked from reassigned ownership.");
            }
        }

        console.log("\nVerification Complete.");
    } catch (error) {
        console.error("❌ Verification Error:", error.message);
    } finally {
        // Cleanup test data usually, but I'll leave it for inspection if needed.
        await prisma.$disconnect();
    }
}

verify();
