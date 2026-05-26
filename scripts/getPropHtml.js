const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrape() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://smartsite2.myonoffice.de/kunden/lucavitale/191/affitto.xhtml?id[obj0]=3773', { waitUntil: 'networkidle2' });
    
    const html = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('prop_detail.html', html);

    console.log("HTML saved to prop_detail.html");
    await browser.close();
}

scrape().catch(console.error);
