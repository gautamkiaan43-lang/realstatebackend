const puppeteer = require('puppeteer');

async function check() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://propertyintheworld.eu/luxury/', { waitUntil: 'networkidle2' });
    
    const html = await page.evaluate(() => document.body.innerText);
    console.log(html.substring(0, 1500));
    
    // get properties
    const props = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.property, article, .item, .listing')).slice(0,10).map(p => {
            const title = p.querySelector('h2, h3, .title')?.innerText;
            const img = p.querySelector('img')?.src;
            return {title, img};
        });
    });
    console.log(props);
    await browser.close();
}

check().catch(console.error);
