const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairRoles() {
    console.log('🚀 CRM Role Protocol: Initiating Raw SQL Database Repair...');

    try {
        // 1. Normalize all agent roles
        const agentUpdate = await prisma.$executeRaw`
            UPDATE User SET role = 'AGENT' WHERE role = 'agent' OR role = '' OR role IS NULL
        `;
        console.log(`✅ Normalized Agent records: ${agentUpdate} updated`);

        // 2. Normalize all manager roles
        const managerUpdate = await prisma.$executeRaw`
            UPDATE User SET role = 'MANAGER' WHERE role = 'manager'
        `;
        console.log(`✅ Normalized Manager records: ${managerUpdate} updated`);

        // 3. Normalize all superadmin roles
        const adminUpdate = await prisma.$executeRaw`
            UPDATE User SET role = 'SUPER_ADMIN' WHERE role = 'superadmin' OR role = 'super_admin'
        `;
        console.log(`✅ Normalized SuperAdmin records: ${adminUpdate} updated`);

        console.log(`\n🎉 Protocol Complete. All records are now uppercase-compliant.`);
    } catch (error) {
        console.error('❌ Protocol Breach: Raw SQL update failed.', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

repairRoles();
