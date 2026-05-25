const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function patchDeals() {
    try {
        const result = await prisma.deal.updateMany({
            where: {
                stage: {
                    in: ['new', 'NEW']
                }
            },
            data: {
                stage: 'INITIATED'
            }
        });
        console.log(`[PATCH] Successfully normalized ${result.count} deals to INITIATED stage.`);

        // Also fix any deals where status is null or undefined to OPEN
        const resultStatus = await prisma.deal.updateMany({
            where: {
                status: null
            },
            data: {
                status: 'OPEN'
            }
        });
        console.log(`[PATCH] Successfully initialized ${resultStatus.count} deal statuses to OPEN.`);
        
    } catch (e) {
        console.error("Patch Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

patchDeals();
