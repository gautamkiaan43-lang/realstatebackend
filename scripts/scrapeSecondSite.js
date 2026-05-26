const fs = require('fs');
const path = require('path');
const https = require('https');

// ── CONFIG ── Change these per run ──────────────────────────────────────
const SITE_BASE = 'https://smartsite2.myonoffice.de/kunden/lucavitale/185';
const TOTAL_PAGES = 5;
const BRAND_KEY = 'world';
const OUTPUT_FILE = path.join(__dirname, 'scraped_world.json');
// ────────────────────────────────────────────────────────────────────────

const IMAGES_DIR = path.join(__dirname, '..', '..', 'frontend_23may', 'public', 'images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } };
        https.get(url, options, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchHtml(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
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
            } else { res.resume(); resolve(null); }
        }).on('error', () => resolve(null));
    });
}

function extractText(html, regex) {
    const m = html.match(regex);
    return m ? m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim() : null;
}

function extractImages(html) {
    const imgs = [];
    const regex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
        const src = m[1];
        if ((src.includes('/expose/') || src.includes('/Objekte/') || src.includes('myonoffice')) &&
            !src.includes('logo') && !src.includes('icon') && !src.includes('sprite')) {
            imgs.push(src.startsWith('http') ? src : `${SITE_BASE}/${src.replace(/^\//, '')}`);
        }
    }
    return [...new Set(imgs)];
}

async function scrapeProperty(url, index) {
    let html;
    try { html = await fetchHtml(url); } catch (e) { return null; }

    let title = extractText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || `Hotel ${index + 1}`;
    title = title.replace(/\n/g, ' ').trim();

    let price = 0;
    const pricePatterns = [/([\d\.\,]+)\s*€/, /€\s*([\d\.\,]+)/];
    for (const pat of pricePatterns) {
        const m = html.match(pat);
        if (m) {
            const raw = m[1].replace(/\./g, '').replace(',', '.');
            const p = parseFloat(raw);
            if (p > 0) { price = p; break; }
        }
    }

    let city = 'Italia';
    const cityMatch = html.match(/(?:Città|Comune|Ort|City)[\s\S]{0,30}?([A-ZÀÈÉÌÒÙ][a-zàèéìòù]+(?:\s[A-ZÀÈÉÌÒÙ][a-zàèéìòù]+)*)/);
    if (cityMatch) city = cityMatch[1];
    // Try to extract from title (e.g. "HOTEL 4 STELLE VENEZIA")
    const titleCityMatch = title.match(/(?:VENEZIA|ROMA|FIRENZE|MILAN[OE]|NAPOLI|SICILIA|VERONA|TORINO|BOLOGNA)/i);
    if (titleCityMatch) city = titleCityMatch[0];

    let type = 'Hotel';
    if (title.toLowerCase().includes('resort')) type = 'Resort';
    else if (title.toLowerCase().includes('agriturismo')) type = 'Agriturismo';
    else if (title.toLowerCase().includes('b&b') || title.toLowerCase().includes('bed')) type = 'B&B';
    else if (title.toLowerCase().includes('villa')) type = 'Villa';

    let bedrooms = null;
    const rmMatch = html.match(/(\d+)\s*(?:camere|stanze|zimmer|rooms?)/i);
    if (rmMatch) bedrooms = parseInt(rmMatch[1]);

    let area = null;
    const areaMatch = html.match(/(\d+)\s*(?:m²|mq)/i);
    if (areaMatch) area = parseFloat(areaMatch[1]);

    let description = '';
    const descPatterns = [
        /<div[^>]*class="[^"]*beschreibung[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*freitext[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    ];
    for (const pat of descPatterns) {
        const m = html.match(pat);
        if (m && m[1].replace(/<[^>]+>/g,'').trim().length > 20) {
            description = m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
            break;
        }
    }
    if (!description) {
        description = `${type} situato a ${city}${area ? `, superficie ${area} mq` : ''}${bedrooms ? `, ${bedrooms} camere` : ''}.`;
    }

    const imgUrls = extractImages(html);
    let localImage = null;
    if (imgUrls.length > 0) {
        localImage = await downloadImage(imgUrls[0], `hotels_${Date.now()}_${index}.jpg`);
    }

    return { title, price, city, type, bedrooms, area, description, localImage, url };
}

async function getAllLinks() {
    const all = new Set();
    for (let p = 1; p <= TOTAL_PAGES; p++) {
        const url = `${SITE_BASE}/immobilien.xhtml?p[obj0]=${p}`;
        console.log(`Fetching page ${p}/${TOTAL_PAGES}...`);
        try {
            const html = await fetchHtml(url);
            const rx = /href="([^"]*id\[obj0\]=\d+[^"]*)"/g;
            let m;
            while ((m = rx.exec(html)) !== null) {
                let link = m[1].replace(/&amp;/g, '&');
                if (!link.startsWith('http')) link = `${SITE_BASE}/${link.replace(/^\//, '')}`;
                if (!link.includes('p[obj0]=')) all.add(link);
            }
        } catch (e) { console.log(`  Error: ${e.message}`); }
        await new Promise(r => setTimeout(r, 800));
    }
    return [...all];
}

async function main() {
    console.log(`=== Scraping ${BRAND_KEY.toUpperCase()} site (${SITE_BASE}) ===\n`);
    const links = await getAllLinks();
    console.log(`\nFound ${links.length} properties. Scraping details...\n`);

    const results = [];
    for (let i = 0; i < links.length; i++) {
        console.log(`  [${i+1}/${links.length}] ${links[i]}`);
        const prop = await scrapeProperty(links[i], i);
        if (prop) {
            results.push(prop);
            console.log(`  ✅ ${prop.title} | €${prop.price} | ${prop.city}`);
        }
        await new Promise(r => setTimeout(r, 600));
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`\n=== Done! ${results.length} properties saved to ${OUTPUT_FILE} ===`);
}

main().catch(console.error);
