/**
 * reScrapeImages.js
 * Re-scrapes images for properties that ended up with the 22044-byte placeholder image.
 * Uses Puppeteer to visit each property URL and find the real image.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const IMAGES_DIR = path.join(__dirname, '../../frontend_23may/public/images');

// The 25 properties with broken images - title -> onOffice URL
const BROKEN_PROPS = [
    { title: 'CASOLARE', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3711', localImage: '/images/scraped_1779785872860_10.jpg' },
    { title: 'TERRENO AGRICOLO', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3707', localImage: '/images/scraped_1779785874944_11.jpg' },
    { title: 'Immobile 17', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3691', localImage: '/images/scraped_1779785882855_16.jpg' },
    { title: 'TERRENO SEGGIANO', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3639', localImage: '/images/scraped_1779785900786_27.jpg' },
    { title: 'TERRENO', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3637', localImage: '/images/scraped_1779785902413_28.jpg' },
    { title: 'VILLA TRIFAMILIARE', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3615', localImage: '/images/scraped_1779785907024_31.jpg' },
    { title: 'Terratetto', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3599', localImage: '/images/scraped_1779785913422_35.jpg' },
    { title: '4 VANI TIRLI', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3597', localImage: '/images/scraped_1779785915093_36.jpg' },
    { title: 'APPARTAMENTO PRINCIPINA A MARE', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3581', localImage: '/images/scraped_1779785918035_38.jpg' },
    { title: 'STICCIANO', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3567', localImage: '/images/scraped_1779785921019_40.jpg' },
    { title: 'VILLETTA A SCHIERA', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3563', localImage: '/images/scraped_1779785924022_42.jpg' },
    { title: 'Immobile 51', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3531', localImage: '/images/scraped_1779785936533_50.jpg' },
    { title: 'SASSOFORTINO', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3523', localImage: '/images/scraped_1779785939760_52.jpg' },
    { title: 'Immobile 55', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3487', localImage: '/images/scraped_1779785942536_54.jpg' },
    { title: 'ORBETELLO', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3477', localImage: '/images/scraped_1779785945525_56.jpg' },
    { title: 'Splendido Appartamento in Vendita a Siena', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3439', localImage: '/images/scraped_1779785946840_57.jpg' },
    { title: 'Italia Toscana Roccastrada', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3197', localImage: '/images/scraped_1779785949838_59.jpg' },
    { title: 'ITALIA TOSCANA GROSSETO COMUNE DI ROCCALBEGNA', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3157', localImage: '/images/scraped_1779785951144_60.jpg' },
    { title: 'Italia Toscana Cana', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3137', localImage: '/images/scraped_1779785952475_61.jpg' },
    { title: 'TERRENO', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=3109', localImage: '/images/scraped_1779785953787_62.jpg' },
    { title: 'Immobile 64', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=2711', localImage: '/images/scraped_1779785955097_63.jpg' },
    { title: 'GROSSETO ZONA PIZZETTI', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=1703', localImage: '/images/scraped_1779785961491_67.jpg' },
    { title: 'GROSSETO - ROSELLE STRADA DEI LAGHI', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=1431', localImage: '/images/scraped_1779785964801_69.jpg' },
    { title: 'FOLLONICA (GR) ITALIA VILLA UNIFAMILIARE', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=613', localImage: '/images/scraped_1779785969338_72.jpg' },
    { title: 'Italia Toscana Grosseto AGRO DI ARCILLE', url: 'https://smartsite2.myonoffice.de/kunden/lucavitale/191/immobilien.xhtml?id[obj0]=361', localImage: '/images/scraped_1779785971014_73.jpg' },
];

const PLACEHOLDER_SIZE = 22044;

function downloadImage(imageUrl, destPath) {
    return new Promise((resolve, reject) => {
        const proto = imageUrl.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        proto.get(imageUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                return downloadImage(response.headers.location, destPath).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                // Check if it's another placeholder
                const size = fs.statSync(destPath).size;
                if (size === PLACEHOLDER_SIZE || size < 5000) {
                    fs.unlinkSync(destPath);
                    reject(new Error(`Downloaded file is placeholder or too small (${size} bytes)`));
                } else {
                    resolve(true);
                }
            });
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

async function scrapePropertyImage(browser, propUrl) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(propUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        // Find the main property image - try multiple selectors
        const imageUrl = await page.evaluate(() => {
            const selectors = [
                '.immobilien-detail img',
                '.property-image img',
                '.detail-image img',
                'img[src*="immobilien"]',
                'img[src*="expose"]',
                'img[src*="objekt"]',
                '.carousel img',
                '.slider img',
                '.gallery img',
                'main img',
                'article img',
                '.content img',
            ];

            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.src && !el.src.includes('placeholder') && !el.src.includes('no-image') && el.naturalWidth > 100) {
                    return el.src;
                }
            }

            // Fallback: find any large image
            const allImgs = Array.from(document.querySelectorAll('img'));
            const bigImg = allImgs.find(img => 
                img.src && 
                img.naturalWidth > 200 && 
                img.naturalHeight > 150 &&
                !img.src.includes('logo') &&
                !img.src.includes('icon') &&
                !img.src.includes('banner')
            );
            return bigImg ? bigImg.src : null;
        });

        return imageUrl;
    } finally {
        await page.close();
    }
}

async function main() {
    console.log(`\n🔧 Re-scraping images for ${BROKEN_PROPS.length} properties with broken images...\n`);

    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let fixed = 0;
    let failed = 0;
    const results = [];

    for (const prop of BROKEN_PROPS) {
        const localFilename = path.basename(prop.localImage);
        const destPath = path.join(IMAGES_DIR, localFilename);
        
        console.log(`\n[${BROKEN_PROPS.indexOf(prop) + 1}/${BROKEN_PROPS.length}] "${prop.title}"`);
        console.log(`  URL: ${prop.url}`);

        try {
            // Step 1: Scrape the image URL from the page
            const imageUrl = await scrapePropertyImage(browser, prop.url);
            
            if (!imageUrl) {
                console.log(`  ❌ No image found on page`);
                failed++;
                results.push({ title: prop.title, status: 'NO_IMAGE_ON_PAGE' });
                continue;
            }

            console.log(`  🖼️  Found image: ${imageUrl.substring(0, 80)}...`);

            // Step 2: Download the image, overwriting the placeholder
            await downloadImage(imageUrl, destPath);
            const newSize = fs.statSync(destPath).size;
            
            console.log(`  ✅ Downloaded! Size: ${newSize} bytes`);
            fixed++;
            results.push({ title: prop.title, status: 'FIXED', imageUrl, newSize });

            // Small delay to be respectful to the server
            await new Promise(r => setTimeout(r, 1500));

        } catch (err) {
            console.log(`  ❌ Failed: ${err.message}`);
            failed++;
            results.push({ title: prop.title, status: 'FAILED', error: err.message });
        }
    }

    await browser.close();
    
    // Save results
    fs.writeFileSync(path.join(__dirname, 'reScrape_results.json'), JSON.stringify(results, null, 2));

    console.log(`\n\n=== Re-Scrape Complete ===`);
    console.log(`✅ Fixed: ${fixed}`);
    console.log(`❌ Failed/No image: ${failed}`);
    console.log(`Results saved to: scripts/reScrape_results.json`);

    // For failed properties, update DB to use a fallback Unsplash image based on type
    if (failed > 0) {
        console.log('\n📦 Assigning fallback images for properties that could not be fixed...');
        const fallbacks = {
            'TERRENO': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
            'TERRENO AGRICOLO': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
            'CASOLARE': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
            'DEFAULT': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80'
        };

        for (const r of results.filter(x => x.status !== 'FIXED')) {
            const fallbackUrl = fallbacks[r.title] || fallbacks['DEFAULT'];
            const prop = BROKEN_PROPS.find(p => p.title === r.title);
            if (!prop) continue;

            // Update the database entry to use the fallback URL
            const updated = await prisma.property.updateMany({
                where: { 
                    title: prop.title,
                    media: { contains: path.basename(prop.localImage) }
                },
                data: {
                    media: JSON.stringify([{ url: fallbackUrl, isPrimary: true }])
                }
            });
            if (updated.count > 0) {
                console.log(`  📷 Fallback assigned for "${r.title}"`);
            }
        }
    }

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('Script failed:', e);
    process.exit(1);
});
