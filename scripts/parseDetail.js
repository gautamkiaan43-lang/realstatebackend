const fs = require('fs');
const html = fs.readFileSync('prop_detail.html', 'utf8');

const idMatch = html.match(/(?:ID|Object\s*ID|ID\s*Oggetto)[^>]*>([\s\S]*?)<\//i);
console.log("Object ID Regex 1:", idMatch ? idMatch[1].trim() : null);

const labels = ['ID oggetto', 'Stanze', 'Camere', 'Bagni', 'Affitto', 'Zustand', 'Condizione'];
for (const label of labels) {
    const regex = new RegExp(label + '[\\s\\S]{0,100}?<[^>]*>([^<]+)<', 'i');
    const match = html.match(regex);
    if(match) console.log(label + ":", match[1].trim());
}

console.log("Extracted Details via Cheerio:", details);

// Alternatively, let's just do a regex for common fields
console.log("Object ID:", html.match(/id\s*oggetto[^>]*>([\s\S]*?)<\//i)?.[1]?.trim() || html.match(/Objekt-ID[^>]*>([\s\S]*?)<\//i)?.[1]?.trim());
console.log("Bathrooms:", html.match(/bagni[^>]*>([\s\S]*?)<\//i)?.[1]?.trim() || html.match(/Badezimmer[^>]*>([\s\S]*?)<\//i)?.[1]?.trim());
console.log("Rooms:", html.match(/locali[^>]*>([\s\S]*?)<\//i)?.[1]?.trim() || html.match(/Zimmer[^>]*>([\s\S]*?)<\//i)?.[1]?.trim());
