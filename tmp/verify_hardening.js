const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const propertyService = require('../src/services/property.service');
const dealService = require('../src/services/deal.service');

async function verify() {
    console.log("--- STARTING INTEGRITY VERIFICATION ---");
    const mockPerformer = { id: 1, name: "Super Admin", role: "SUPER_ADMIN" };

    try {
        console.log("\n1. Testing Property Creation without Owner...");
        try {
            await propertyService.createProperty({ title: "Orphan Property", price: 100 }, 1);
            console.error("FAIL: Property created without owner!");
        } catch (e) {
            console.log("PASS: Blocked orphan property creation:", e.message);
        }

        console.log("\n2. Testing Deal Creation without Property...");
        try {
            await dealService.createDeal({ buyer_contact_id: 1, value: 1000 }, mockPerformer);
            console.error("FAIL: Deal created without property!");
        } catch (e) {
            console.log("PASS: Blocked deal without property:", e.message);
        }

        console.log("\n3. Testing Deal Auto-Mapping (Seller from Prop)...");
        // Use a real prop/buyer if exist
        const prop = await prisma.property.findFirst({ where: { NOT: { owner_id: null } } });
        const buyer = await prisma.contact.findFirst({ where: { role: 'BUYER', status: 'ACTIVE' } });
        
        if (prop && buyer) {
            const deal = await dealService.createDeal({
                property_id: prop.id,
                buyer_contact_id: buyer.id,
                value: 500000
            }, mockPerformer);
            
            if (deal.contact_id === prop.owner_id) {
                console.log("PASS: Seller auto-resolved correctly.");
            } else {
                console.error(`FAIL: Seller mismatch!`);
            }
        } else {
            console.log("SKIP: No active prop/buyer to test mapping.");
        }

    } catch (err) {
        console.error("VERIFICATION SCRIPT ERROR:", err.message);
    } finally {
        await prisma.$disconnect();
        console.log("\n--- VERIFICATION COMPLETE ---");
    }
}

verify();
