const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log("🚀 Starting Data Integrity Migration...");

    // 1. Sync Lead Manager
    const leads = await prisma.lead.findMany({
        where: { owner_id: { not: null } },
        include: { owner: true }
    });

    for (const lead of leads) {
        if (lead.owner && lead.manager_id !== lead.owner.manager_id) {
            console.log(`Syncing Lead ${lead.id}: Manager ${lead.manager_id} -> ${lead.owner.manager_id}`);
            await prisma.lead.update({
                where: { id: lead.id },
                data: { manager_id: lead.owner.manager_id }
            });
        }
    }

    // 2. Isolate orphans
    const orphanDeals = await prisma.deal.findMany({
        where: { 
            OR: [
                { contact_id: 0 },
                { contact_id: null }
            ]
        }
    });

    for (const deal of orphanDeals) {
        console.log(`Marking Orphan Deal ${deal.id} as Legacy Invalid`);
        await prisma.deal.update({
            where: { id: deal.id },
            data: { is_legacy_invalid: true }
        });
    }

    console.log("🎉 Migration Complete.");
}

migrate()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
