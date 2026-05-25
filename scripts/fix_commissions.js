const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCommissions() {
    console.log('--- STARTING COMMISSION RECOVERY PROTOCOL ---\n');
    
    try {
        const commissions = await prisma.commission.findMany({
            include: {
                deal: {
                    include: {
                        property: true
                    }
                },
                agent: true
            }
        });

        console.log(`Analyzing ${commissions.length} commission records...`);
        let fixedCount = 0;

        for (const comm of commissions) {
            let needsUpdate = false;
            const updateData = {};

            // 1. Fix Status (Mapping "In sospeso" or case issues)
            const normalizedStatus = comm.status?.toUpperCase();
            if (normalizedStatus === 'IN SOSPESO' || !normalizedStatus || normalizedStatus === 'PENDING') {
                if (comm.status !== 'PENDING') {
                    updateData.status = 'PENDING';
                    needsUpdate = true;
                }
            }

            // 2. Fix percentage/amount if 0
            if (parseFloat(comm.amount) === 0 || parseFloat(comm.percentage) === 0) {
                const deal = comm.deal;
                if (deal && deal.value) {
                    const dealValue = parseFloat(deal.value);
                    const prop = deal.property;
                    const commVal = prop?.commissionValue ? parseFloat(prop.commissionValue) : 3.0; // Default 3%
                    const commType = prop?.commissionType || 'PERCENTAGE';

                    let calculatedAmount = 0;
                    if (commType === 'PERCENTAGE') {
                        calculatedAmount = (dealValue * commVal) / 100;
                    } else {
                        calculatedAmount = commVal;
                    }

                    updateData.amount = calculatedAmount;
                    updateData.percentage = commVal;
                    needsUpdate = true;
                }
            }

            // 3. Fix Missing Agent (Fallback to Deal assigned_to)
            if (!comm.agent_id && comm.deal?.assigned_to) {
                updateData.agent_id = comm.deal.assigned_to;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await prisma.commission.update({
                    where: { id: comm.id },
                    data: updateData
                });
                fixedCount++;
                console.log(`[FIXED] Commission #${comm.id}: Status=${updateData.status || comm.status}, Amount=${updateData.amount || comm.amount}`);
            }
        }

        console.log(`\n--- PROTOCOL COMPLETE: ${fixedCount} records stabilized ---`);
    } catch (error) {
        console.error('CRITICAL ERROR DURING RECOVERY:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixCommissions();
