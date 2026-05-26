const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    const dataPath = path.join(__dirname, 'scraped_affitto.json');
    if (!fs.existsSync(dataPath)) {
        console.error('scraped_affitto.json not found! Run scrapeAffitto.js first.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Importing ${data.length} rental properties into database...\n`);

    for (const [index, prop] of data.entries()) {
        const siteKey = 'tosco'; // Assign rentals to Tosco as requested
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
                title: prop.title || 'Immobile in Affitto',
                slug,
                price: prop.price || 0,
                description: prop.description || '',
                type: prop.type || 'Appartamento (Affitto)',
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
}

main()
    .catch(e => console.error('Import failed:', e))
    .finally(() => prisma.$disconnect());
