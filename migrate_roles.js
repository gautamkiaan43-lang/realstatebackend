const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Starting Global Role Migration...');
    
    const users = await prisma.user.findMany();
    let updatedCount = 0;

    for (const user of users) {
        const normalizedRole = user.role.toUpperCase();
        if (user.role !== normalizedRole) {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: normalizedRole }
            });
            console.log(`✅ Updated User #${user.id} (${user.email}): "${user.role}" -> "${normalizedRole}"`);
            updatedCount++;
        }
    }

    console.log(`✨ Migration Complete. Updated ${updatedCount} users.`);
}

main()
    .catch((e) => console.error('❌ Migration Failed:', e))
    .finally(async () => await prisma.$disconnect());
