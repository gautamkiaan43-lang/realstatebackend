const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function dumpDeals() {
    try {
        const deals = await prisma.deal.findMany({
            take: 10,
            select: {
                id: true,
                contact_id: true,
                buyer_contact_id: true,
                property_id: true,
                agent_id: true
            }
        });
        console.log(JSON.stringify(deals, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

dumpDeals();
