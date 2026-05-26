const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const all = await prisma.property.findMany();
    console.log("Total properties in DB:", all.length);
    
    for (let p of all) {
        let pub = {};
        try { pub = JSON.parse(p.publishing || '{}'); } catch (_) {}
        const isTosco = pub['tosco']?.enabled && pub['tosco']?.status === 'Published';
        console.log(`ID: ${p.id} | Title: ${p.title} | is_archived: ${p.is_archived} | isTosco: ${isTosco}`);
    }
}
check().finally(() => prisma.$disconnect());
