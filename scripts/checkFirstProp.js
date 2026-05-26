const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scraped_properties.json'));
console.log(data[0]);
