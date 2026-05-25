const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log("🚀 Starting Final Integrity Fix (Pure SQL)...");

    try {
        // 1. Map Agent Ownership for Contacts (from Leads)
        const contactUpdateCount = await prisma.$executeRawUnsafe(`
            UPDATE contact c
            JOIN lead l ON c.created_from_lead_id = l.id
            SET c.agent_id = l.owner_id
            WHERE c.agent_id IS NULL AND l.owner_id IS NOT NULL
        `);
        console.log(`- Mapped Agent ownership for ${contactUpdateCount} contacts.`);

        // 2. Map Agent Ownership for Deals (from Contacts)
        const dealUpdateCount = await prisma.$executeRawUnsafe(`
            UPDATE deal d
            LEFT JOIN contact bc ON d.buyer_contact_id = bc.id
            LEFT JOIN contact c ON d.contact_id = c.id
            SET d.agent_id = COALESCE(bc.agent_id, c.agent_id, d.assigned_to)
            WHERE d.agent_id IS NULL
        `);
        console.log(`- Mapped Agent ownership for ${dealUpdateCount} deals.`);

        // 3. Mark Legacy Deals (No property link)
        const legacyCount = await prisma.$executeRawUnsafe(`
            UPDATE deal SET is_legacy = 1 WHERE property_id IS NULL OR property_id = 0
        `);
        console.log(`- Marked ${legacyCount} deals as LEGACY.`);

        console.log("🎉 Integrity Fix Complete.");
    } catch (error) {
        console.error("❌ SQL Error:", error.message);
    }
}

fix()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
