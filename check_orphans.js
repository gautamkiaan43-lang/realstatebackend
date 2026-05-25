const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphans() {
    try {
        console.log("🕵️ Checking for orphan User IDs in Deals...");
        const deals = await prisma.deal.findMany({
            select: { id: true, assigned_to: true, contact_id: true, buyer_contact_id: true }
        });
        const users = await prisma.user.findMany({
            select: { id: true }
        });
        const userIds = new Set(users.map(u => u.id));
        
        const orphans = deals.filter(d => !userIds.has(d.assigned_to));
        
        if (orphans.length > 0) {
            console.log(`❌ Found ${orphans.length} deals with orphan assigned_to IDs:`, orphans.map(o => o.assigned_to));
        } else {
            console.log("✅ No orphan assigned_to IDs found in Deals.");
        }

        // Check contact_id as well
        const contacts = await prisma.contact.findMany({ select: { id: true }});
        const contactIds = new Set(contacts.map(c => c.id));
        const orphanContacts = deals.filter(d => !contactIds.has(d.contact_id));
        
        if (orphanContacts.length > 0) {
            console.log(`❌ Found ${orphanContacts.length} deals with orphan contact_id IDs:`, orphanContacts.map(o => o.contact_id));
        } else {
            console.log("✅ No orphan contact_id IDs found in Deals.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Error running diagnostic:", error);
        process.exit(1);
    }
}

checkOrphans();
