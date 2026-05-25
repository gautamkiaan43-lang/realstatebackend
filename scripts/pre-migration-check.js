const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log("🔍 Pre-migration Data Check...");

    // 1. Check for BOTH role
    const bothContacts = await prisma.contact.findMany({
        where: { role: 'BOTH' }
    });
    console.log(`- Contacts with 'BOTH' role: ${bothContacts.length}`);

    // 2. Check for deals without property
    const legacyDeals = await prisma.deal.findMany({
        where: { property_id: null }
    });
    console.log(`- Deals without property_id (Legacy): ${legacyDeals.length}`);

    // 3. Check for properties without owner
    const ownerlessProperties = await prisma.property.findMany({
        where: { owner_id: null }
    });
    console.log(`- Properties without owner_id: ${ownerlessProperties.length}`);

    // 4. Check for leads and their owners
    const leads = await prisma.lead.findMany({
        select: { id: true, owner_id: true }
    });
    console.log(`- Total leads: ${leads.length}`);

    console.log("\nDone.");
}

check()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
