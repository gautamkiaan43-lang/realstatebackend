const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    console.log("🧹 Emergency Data Cleanup...");

    // 1. Force both to buyer (we'll fix it properly after schema update)
    const count = await prisma.$executeRawUnsafe("UPDATE contact SET role = 'BUYER' WHERE role = 'BOTH'");
    console.log(`- Forced ${count} contacts to BUYER role.`);

    console.log("Done.");
}

cleanup()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
