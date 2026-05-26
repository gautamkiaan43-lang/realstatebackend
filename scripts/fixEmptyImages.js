const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80';
const FALLBACK_HOTEL = 'https://images.unsplash.com/photo-1542314831-c6a4d14d8c85?auto=format&fit=crop&w=1200&q=80';
const FALLBACK_LAND = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80';

async function fixEmptyImages() {
    const allProps = await prisma.property.findMany();
    let fixedCount = 0;
    
    for (const p of allProps) {
        let isBroken = false;
        
        // Check if media is empty
        if (!p.media || p.media === '[]' || p.media.trim() === '') {
            isBroken = true;
        } else {
            // Check if it's a small placeholder image
            try {
                const mediaArr = JSON.parse(p.media);
                if (mediaArr && mediaArr.length > 0) {
                    const url = mediaArr[0].url;
                    if (url.startsWith('/images/')) {
                        const localPath = '../../frontend_23may/public' + url;
                        if (fs.existsSync(__dirname + '/' + localPath)) {
                            const size = fs.statSync(__dirname + '/' + localPath).size;
                            if (size < 30000) {
                                isBroken = true; // Still a placeholder
                            }
                        } else {
                            isBroken = true; // File doesn't exist
                        }
                    }
                } else {
                    isBroken = true; // Parsed array is empty
                }
            } catch (e) {
                isBroken = true; // Malformed JSON
            }
        }
        
        if (isBroken) {
            // Assign fallback based on title/type
            let fallbackUrl = FALLBACK_IMAGE;
            const titleLower = p.title.toLowerCase();
            
            if (titleLower.includes('hotel') || titleLower.includes('resort')) {
                fallbackUrl = FALLBACK_HOTEL;
            } else if (titleLower.includes('terreno') || titleLower.includes('land')) {
                fallbackUrl = FALLBACK_LAND;
            }
            
            const newMedia = JSON.stringify([{ url: fallbackUrl, isPrimary: true }]);
            
            await prisma.property.update({
                where: { id: p.id },
                data: { media: newMedia }
            });
            console.log(`Fixed missing/broken image for: "${p.title}"`);
            fixedCount++;
        }
    }
    
    console.log(`\nFixed total of ${fixedCount} properties with broken images.`);
}

fixEmptyImages()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
