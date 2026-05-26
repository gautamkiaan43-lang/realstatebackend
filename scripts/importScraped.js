const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Site keys for rotating distribution across 3 brands
const SITE_KEYS = ['tosco', 'world', 'hotels'];

async function main() {
    // Step 1: Delete all old demo + previously scraped properties
    console.log('Cleaning old demo/scraped data...');
    const demoTitles = [
        'Pinnacle Palace appartment', 'Skyline Serenity', 'Luxe Vista',
        'The Crown Jewel', 'Tranquil Vista', 'demo villa',
        'Villa Roma-5', 'The Sovereign Retreat'
    ];
    await prisma.property.deleteMany({
        where: {
            OR: [
                { description: { contains: 'Scraped property data from onOffice' } },
                { title: { in: demoTitles } }
            ]
        }
    });
    console.log('Old data cleaned.\n');

    // Step 2: Load scraped JSON
    const dataPath = path.join(__dirname, 'scraped_properties.json');
    if (!fs.existsSync(dataPath)) {
        console.error('scraped_properties.json not found! Run scrapeData.js first.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Importing ${data.length} properties into database...\n`);

    for (const [index, prop] of data.entries()) {
        // ALL properties from this source belong to Tosco Intermedia ONLY
        const siteKey = 'tosco';
        const slug = `${prop.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now()}-${index}`;

        const publishingObj = {
            tosco:  { enabled: siteKey === 'tosco',  status: siteKey === 'tosco'  ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() },
            world:  { enabled: siteKey === 'world',  status: siteKey === 'world'  ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() },
            hotels: { enabled: siteKey === 'hotels', status: siteKey === 'hotels' ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() }
        };

        const mediaArr = prop.localImage
            ? [{ url: prop.localImage, isPrimary: true }]
            : [];

        await prisma.property.create({
            data: {
                title: prop.title || 'Immobile',
                slug,
                price: prop.price || 0,
                description: prop.description || '',
                type: prop.type || 'Appartamento',
                status: 'AVAILABLE',
                city: prop.city || 'Grosseto',
                country: 'Italia',
                bedrooms: prop.bedrooms || null,
                area: prop.area || null,
                media: JSON.stringify(mediaArr),
                publishing: JSON.stringify(publishingObj),
            }
        });

        console.log(`[${index + 1}/${data.length}] ✅ ${prop.title} → ${siteKey} (€${prop.price})`);
    }

    console.log('\n=== Import Complete! ===');
    console.log(`Total properties added: ${data.length}`);
    console.log(`Tosco: ${data.filter((_, i) => i % 3 === 0).length} properties`);
    console.log(`World: ${data.filter((_, i) => i % 3 === 1).length} properties`);
    console.log(`Hotels: ${data.filter((_, i) => i % 3 === 2).length} properties`);
}

main()
    .catch(e => console.error('Import failed:', e))
    .finally(() => prisma.$disconnect());
