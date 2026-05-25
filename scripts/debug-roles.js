const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    console.log("🔍 DB Debug Role Check...");
    const roles = await prisma.$queryRawUnsafe("SELECT DISTINCT role FROM contact");
    console.log("- Unique roles in contact table:", JSON.stringify(roles));

    const boths = await prisma.$queryRawUnsafe("SELECT id, name, role FROM contact WHERE role = 'BOTH'");
    console.log("- Contacts with role 'BOTH':", JSON.stringify(boths));

    console.log("Done.");
}

debug()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
