const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function check() {
    const props = await prisma.property.findMany();
    let allGood = true;
    props.forEach(p => {
        let m;
        try {
            m = JSON.parse(p.media);
            if (typeof m === 'string') {
               m = JSON.parse(m);
            }
        } catch(e) {
            return;
        }
        if (m && m[0] && m[0].url) {
            const imgPath = path.join('C:/Users/91969/Desktop/kiaan priya/Real Estate CRM/frontend_23may/public', m[0].url);
            if (!fs.existsSync(imgPath)) {
                console.log('MISSING IMAGE FOR:', p.title, m[0].url);
                allGood = false;
            }
        }
    });
    if (allGood) console.log('All images found!');
}
check().finally(() => prisma.$disconnect());
