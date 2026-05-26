const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://smartsite2.myonoffice.de/kunden/lucavitale/191';
const IMAGES_DIR = path.join(__dirname, '..', '..', 'frontend_23may', 'public', 'images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
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

function downloadImage(url, filename) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('http')) { resolve(null); return; }
        const filepath = path.join(IMAGES_DIR, filename);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode === 200) {
                const file = fs.createWriteStream(filepath);
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve(`/images/${filename}`); });
                file.on('error', () => resolve(null));
            } else {
                res.resume();
                resolve(null);
            }
        }).on('error', () => resolve(null));
    });
}

function extractText(html, regex) {
    const match = html.match(regex);
    return match ? match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim() : null;
}

function extractAllImages(html) {
    const imgs = [];
    const regex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
        const src = m[1];
        if (src.includes('/expose/') || src.includes('/images/obj') || src.includes('/Objekte/') || src.includes('myonoffice')) {
            if (!src.includes('logo') && !src.includes('icon') && !src.includes('bullet')) {
                imgs.push(src.startsWith('http') ? src : `${BASE_URL}/${src.replace(/^\//, '')}`);
            }
        }
    }
    return [...new Set(imgs)]; // deduplicate
}

async function scrapePropertyDetail(url, index) {
    console.log(`  Scraping: ${url}`);
    let html;
    try {
        html = await fetchHtml(url);
    } catch (e) {
        console.log(`  Error fetching ${url}: ${e.message}`);
        return null;
    }

    let title = extractText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!title) title = extractText(html, /<h2[^>]*class="[^"]*expose-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    if (!title) title = `Affitto Immobile ${index + 1}`;
    title = title.replace(/\n/g, ' ').trim();

    let price = 0;
    const pricePatterns = [
        /class="[^"]*preis[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i,
        /([\d\.\,]+)\s*€/,
        /€\s*([\d\.\,]+)/,
        /<span[^>]*>([\d\.]+\s*€[^<]*)<\/span>/i
    ];
    for (const pat of pricePatterns) {
        const m = html.match(pat);
        if (m) {
            const raw = m[1].replace(/[^\d,\.]/g, '').replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(raw);
            if (parsed > 0) { price = parsed; break; }
        }
    }

    let city = extractText(html, /class="[^"]*ort[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (!city) city = extractText(html, /class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (!city) city = 'Grosseto';

    let type = 'Appartamento (Affitto)';
    if (title.toLowerCase().includes('villa')) type = 'Villa (Affitto)';
    else if (title.toLowerCase().includes('fondo') || title.toLowerCase().includes('commerciale')) type = 'Commerciale (Affitto)';
    else if (title.toLowerCase().includes('garage')) type = 'Garage (Affitto)';
    else if (title.toLowerCase().includes('hotel') || title.toLowerCase().includes('resort')) type = 'Hotel (Affitto)';

    let bedrooms = null;
    const roomMatch = html.match(/(\d+)\s*(?:camere|vani|zimmer|rooms?)/i);
    if (roomMatch) bedrooms = parseInt(roomMatch[1]);

    let area = null;
    const areaMatch = html.match(/(\d+)\s*(?:m²|mq|sqm)/i);
    if (areaMatch) area = parseFloat(areaMatch[1]);

    let description = '';
    const descPatterns = [
        /<div[^>]*class="[^"]*beschreibung[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*freitext[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    ];
    for (const pat of descPatterns) {
        const m = html.match(pat);
        if (m && m[1].replace(/<[^>]+>/g, '').trim().length > 20) {
            description = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            break;
        }
    }

    const condMatch = html.match(/Zustand:\s*([^<\n]+)/i);
    const condition = condMatch ? condMatch[1].trim() : null;
    if (condition && !description) description = `Condizione: ${condition}.`;

    const energyMatch = html.match(/prestazione energetica.*?APE/i);
    const hasEnergy = !!energyMatch;

    if (!description) {
        description = `${type} situato a ${city}${area ? `, superficie ${area} mq` : ''}${bedrooms ? `, ${bedrooms} camere` : ''}${condition ? `, condizione: ${condition}` : ''}. ${hasEnergy ? 'Certificazione energetica APE disponibile.' : ''}`;
    }

    const allImgUrls = extractAllImages(html);
    if (allImgUrls.length === 0) {
        const fallback = html.match(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"[^>]*>/i);
        if (fallback) allImgUrls.push(fallback[1].startsWith('http') ? fallback[1] : `${BASE_URL}/${fallback[1].replace(/^\//, '')}`);
    }

    let localImage = null;
    if (allImgUrls.length > 0) {
        const imgFilename = `scraped_affitto_${Date.now()}_${index}.jpg`;
        localImage = await downloadImage(allImgUrls[0], imgFilename);
        if (localImage) console.log(`  Image saved: ${localImage}`);
    }

    return {
        title,
        price,
        city,
        type,
        bedrooms,
        area,
        description,
        localImage,
        url,
        condition,
        status: 'RENTAL'
    };
}

async function getAllPropertyLinks() {
    const allLinks = new Set();
    const totalPages = 3;

    for (let page = 1; page <= totalPages; page++) {
        // Changed to affitto.xhtml
        const listUrl = `${BASE_URL}/affitto.xhtml?languag=ITA&p[obj0]=${page}`;
        console.log(`Fetching page ${page}/${totalPages}: ${listUrl}`);
        try {
            const html = await fetchHtml(listUrl);
            const regex = /href="([^"]*id\[obj0\]=\d+[^"]*)"/g;
            let m;
            while ((m = regex.exec(html)) !== null) {
                let link = m[1].replace(/&amp;/g, '&');
                if (!link.startsWith('http')) link = `${BASE_URL}/${link.replace(/^\//, '')}`;
                if (!link.includes('p[obj0]=')) allLinks.add(link);
            }
        } catch (e) {
            console.log(`  Error on page ${page}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 800));
    }

    return [...allLinks];
}

async function main() {
    console.log('=== Affitto Scraper Started ===\n');

    console.log('Step 1: Collecting all property links...');
    const links = await getAllPropertyLinks();
    console.log(`\nFound ${links.length} unique properties across all pages.\n`);

    console.log('Step 2: Scraping individual property pages...');
    const results = [];
    for (let i = 0; i < links.length; i++) {
        const prop = await scrapePropertyDetail(links[i], i);
        if (prop) {
            results.push(prop);
            console.log(`  [${i+1}/${links.length}] Done: ${prop.title} | €${prop.price} | ${prop.city}`);
        }
        await new Promise(r => setTimeout(r, 600));
    }

    const outputPath = path.join(__dirname, 'scraped_affitto.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n=== Done! Scraped ${results.length} properties ===`);
    console.log(`Saved to: ${outputPath}`);
}

main().catch(console.error);
