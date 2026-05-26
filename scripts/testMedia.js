const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
    const props = await prisma.property.findMany({
        where: {
            title: {
                in: [
                    '4 VANI TIRLI', 'VILLETTA A SCHIERA', 'Immobile 55', 'Immobile 64',
                    'Splendido Appartamento in Vendita a Siena', 'GROSSETO - ROSELLE STRADA DEI LAGHI',
                    'FOLLONICA (GR) ITALIA VILLA UNIFAMILIARE', 'CASOLARE', 'TERRENO AGRICOLO',
                    'Immobile 17', 'TERRENO SEGGIANO', 'TERRENO', 'VILLA TRIFAMILIARE',
                    'Terratetto', 'APPARTAMENTO PRINCIPINA A MARE', 'STICCIANO', 'SASSOFORTINO', 'Grosseto'
                ]
            }
        }
    });
    console.log(JSON.stringify(props.map(p => ({ title: p.title, media: p.media, id: p.id })), null, 2));
}
check().finally(() => prisma.$disconnect());
