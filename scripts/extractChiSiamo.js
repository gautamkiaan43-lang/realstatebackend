const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrape() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://toscointermedia.com/ChiSiamo/', { waitUntil: 'networkidle2' });
    
    // Extract text from paragraphs or divs that might contain the 'about us' text
    const text = await page.evaluate(() => {
        return document.body.innerText;
    });

    console.log(text.substring(0, 2000));
    await browser.close();
}

scrape().catch(console.error);
