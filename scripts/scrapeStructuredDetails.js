const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');

const prisma = new PrismaClient();

// Helper to fetch HTML
function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/html',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchHtml(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
}

function extractRegex(html, pattern) {
    const match = html.match(pattern);
    return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

async function scrapeDetails(url) {
    try {
        const html = await fetchHtml(url);
        
        // Extract fields using Regex based on the span structure: <span><strong>Label:</strong> <span>Value</span></span>
        let objectId = extractRegex(html, /(?:Objekt-ID|Object ID|ID Oggetto|Codice)[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
        let stanza = extractRegex(html, /(?:Rooms|Stanze|Locali)[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
        let bedrooms = extractRegex(html, /(?:Bedrooms|Camere)[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
        let bathrooms = extractRegex(html, /(?:Bathrooms|Bagni|Badezimmer)[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
        let condition = extractRegex(html, /(?:Zustand|Condizione|Condition)[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
        let actualCity = extractRegex(html, /(?:Stadt|City|Città)[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
        let area = extractRegex(html, /(?:Superficie|Area)[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
        if (area) area = area.replace(/[^\d,\.]/g, '');

        return {
            objectId: objectId || null,
            rooms: stanza || null,
            bedrooms: bedrooms || null,
            bathrooms: bathrooms || null,
            condition: condition || null,
            actualCity: actualCity || null,
            area: area || null
        };
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('Loading JSON mappings...');
    let allOriginalData = [];
    ['scraped_properties.json', 'scraped_world.json', 'scraped_hotels.json', 'scraped_affitto.json'].forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
            allOriginalData = allOriginalData.concat(data);
        } catch(e) {}
    });

    console.log(`Loaded ${allOriginalData.length} JSON records. Fetching properties from DB...`);
    const properties = await prisma.property.findMany();

    console.log(`Found ${properties.length} properties in DB. Starting extraction...`);

    let updatedCount = 0;
    
    // Process in batches of 5 to avoid overwhelming the server
    for (let i = 0; i < properties.length; i += 5) {
        const batch = properties.slice(i, i + 5);
        const promises = batch.map(async (prop) => {
            // Match by title
            let original = allOriginalData.find(d => d.title === prop.title);
            // Fallback for identical titles: match by title AND price
            if (!original || allOriginalData.filter(d => d.title === prop.title).length > 1) {
                original = allOriginalData.find(d => d.title === prop.title && Number(d.price) === Number(prop.price));
            }

            if (!original || !original.url) return;

            const details = await scrapeDetails(original.url);
            if (details) {
                // Update DB with extracted features and correct the city/bedrooms/area if they were missing or dummy
                let updateData = {
                    features: JSON.stringify(details)
                };

                if (details.actualCity && details.actualCity.length > 2 && details.actualCity !== 'BILOCALE') {
                    updateData.city = details.actualCity;
                }
                
                if (details.bedrooms && !prop.bedrooms) {
                    updateData.bedrooms = parseInt(details.bedrooms) || null;
                }
                
                if (details.area && !prop.area) {
                    updateData.area = parseFloat(details.area.replace(',','.')) || null;
                }

                await prisma.property.update({
                    where: { id: prop.id },
                    data: updateData
                });
                updatedCount++;
                console.log(`✅ Updated: ${prop.title} [ID: ${details.objectId || 'N/A'}]`);
            }
        });

        await Promise.all(promises);
        // Small delay between batches
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n🎉 Finished! Successfully updated ${updatedCount} properties with actual details.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
