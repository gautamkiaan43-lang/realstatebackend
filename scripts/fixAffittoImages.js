const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();
const IMAGES_DIR = path.join(__dirname, '../../frontend_23may/public/images');

function downloadImage(imageUrl, destPath) {
    return new Promise((resolve, reject) => {
        const proto = imageUrl.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        proto.get(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                return downloadImage(response.headers.location, destPath).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(true);
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto(propUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        const imageUrl = await page.evaluate(() => {
            // Try to find image.onoffice.de images
            const allImgs = Array.from(document.querySelectorAll('img'));
            const bigImg = allImgs.find(img => 
                img.src && 
                (img.src.includes('image.onoffice.de') || img.src.includes('expose')) &&
                !img.src.includes('logo') &&
                !img.src.includes('myonoffice') && // ignore placeholder
                img.naturalWidth > 150
            );
            return bigImg ? bigImg.src : null;
        });

        return imageUrl;
    } finally {
        await page.close();
    }
}

async function main() {
    const dataPath = path.join(__dirname, 'scraped_affitto.json');
    if (!fs.existsSync(dataPath)) {
        console.error('scraped_affitto.json not found!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Fetch all rental properties from DB
    const rentalProps = await prisma.property.findMany({
        where: { type: { contains: 'Affitto' } }
    });

    console.log(`Found ${rentalProps.length} rental properties in database.`);
    if(rentalProps.length === 0) return;

    const browser = await puppeteer.launch({ headless: true });
    let fixedCount = 0;

    for (const prop of rentalProps) {
        // Find original URL from scraped JSON by exact title and price
        const originalData = data.find(d => prop.title === d.title && Number(prop.price) === Number(d.price));
        if (!originalData || !originalData.url) {
            console.log(`❌ Could not find original URL for "${prop.title}"`);
            continue;
        }

        console.log(`\n⏳ Scraping real image for "${prop.title}"...`);
        console.log(`   URL: ${originalData.url}`);

        try {
            const imageUrl = await scrapePropertyImage(browser, originalData.url);
            if (!imageUrl) {
                console.log(`   ❌ No valid image found on page! (Probably truly has no image)`);
                continue;
            }

            console.log(`   ✅ Found image: ${imageUrl.substring(0, 80)}...`);

            const localFilename = `rescraped_affitto_${prop.id}_${Date.now()}.jpg`;
            const destPath = path.join(IMAGES_DIR, localFilename);

            await downloadImage(imageUrl, destPath);
            const size = fs.statSync(destPath).size;
            console.log(`   ✅ Downloaded! Size: ${size} bytes`);

            const newMedia = JSON.stringify([{ url: `/images/${localFilename}`, isPrimary: true }]);
            
            await prisma.property.update({
                where: { id: prop.id },
                data: { media: newMedia }
            });
            
            console.log(`   ✅ Database updated.`);
            fixedCount++;

        } catch(e) {
            console.log(`   ❌ Failed: ${e.message}`);
        }
    }

    await browser.close();
    console.log(`\n🎉 Replaced ${fixedCount} dummy images with ACTUAL images!`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
