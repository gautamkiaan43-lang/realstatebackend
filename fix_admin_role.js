const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userEmail = 'superadmin@ero.com';
    const updatedUser = await prisma.user.update({
        where: { email: userEmail },
        data: { role: 'SUPER_ADMIN' }
    });
    console.log(`✅ Fixed! ${userEmail} role is now: ${updatedUser.role}`);
}

main()
    .catch((e) => console.error('❌ Error during database fix:', e.message))
    .finally(async () => await prisma.$disconnect());
