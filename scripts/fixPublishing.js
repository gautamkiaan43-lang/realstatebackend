const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    const scraped = await prisma.property.findMany({
        where: {
            description: {
                contains: "Scraped property data from onOffice"
            }
        }
    });
    
    console.log(`Found ${scraped.length} scraped properties. Fixing publishing...`);
    
    for (let p of scraped) {
        let pub = {};
        try { pub = JSON.parse(p.publishing || '{}'); } catch (_) {}
        console.log(`ID ${p.id} - ${p.title} publishing: `, JSON.stringify(pub));
    }
    
    // Fix: make sure all scraped properties have correct site keys and are enabled
    const allScraped = await prisma.property.findMany({
        where: {
            id: { in: [13, 14, 15, 16, 17] }
        }
    });
    
    for (let [i, p] of allScraped.entries()) {
        let siteKey = 'tosco';
        if (i % 3 === 1) siteKey = 'world';
        if (i % 3 === 2) siteKey = 'hotels';
        
        const publishingObj = {
            tosco:  { enabled: siteKey === 'tosco',  status: siteKey === 'tosco'  ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() },
            world:  { enabled: siteKey === 'world',  status: siteKey === 'world'  ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() },
            hotels: { enabled: siteKey === 'hotels', status: siteKey === 'hotels' ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() }
        };
        
        await prisma.property.update({
            where: { id: p.id },
            data: { publishing: JSON.stringify(publishingObj) }
        });
        console.log(`Fixed ID ${p.id} - ${p.title} -> siteKey: ${siteKey}`);
    }
    console.log('All fixed! Refresh your browser now.');
}

fix().catch(e => console.error(e)).finally(() => prisma.$disconnect());
