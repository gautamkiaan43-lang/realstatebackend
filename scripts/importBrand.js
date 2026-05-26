const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importBrand(jsonFile, brandKey) {
    const dataPath = path.join(__dirname, jsonFile);
    if (!fs.existsSync(dataPath)) {
        console.error(`File not found: ${dataPath}`);
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Importing ${data.length} properties into [${brandKey.toUpperCase()}]...\n`);

    for (const [index, prop] of data.entries()) {
        const slug = `${brandKey}-${prop.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now()}-${index}`;

        const publishingObj = {
            tosco:  { enabled: brandKey === 'tosco',  status: brandKey === 'tosco'  ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() },
            world:  { enabled: brandKey === 'world',  status: brandKey === 'world'  ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() },
            hotels: { enabled: brandKey === 'hotels', status: brandKey === 'hotels' ? 'Published' : 'Draft', syncState: 'idle', retryCount: 0, lastSync: new Date().toISOString() }
        };

        const mediaArr = prop.localImage ? [{ url: prop.localImage, isPrimary: true }] : [];

        await prisma.property.create({
            data: {
                title: prop.title || 'Immobile',
                slug,
                price: prop.price || 0,
                description: prop.description || '',
                type: prop.type || 'Hotel',
                status: 'AVAILABLE',
                city: prop.city && prop.city !== 'Ort' ? prop.city : 'Italia',
                country: 'Italia',
                bedrooms: prop.bedrooms || null,
                area: prop.area || null,
                media: JSON.stringify(mediaArr),
                publishing: JSON.stringify(publishingObj),
            }
        });
        console.log(`[${index + 1}/${data.length}] ✅ ${prop.title} → ${brandKey} (€${prop.price?.toLocaleString()})`);
    }

    console.log(`\n✅ Import complete! ${data.length} properties added to [${brandKey.toUpperCase()}]`);
}

// Run: node importBrand.js <jsonFile> <brandKey>
const args = process.argv.slice(2);
const jsonFile = args[0] || 'scraped_hotels.json';
const brandKey = args[1] || 'hotels';

importBrand(jsonFile, brandKey)
    .catch(e => console.error('Import failed:', e))
    .finally(() => prisma.$disconnect());
