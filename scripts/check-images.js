const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkImages() {
  const titlesToCheck = [
    "4 VANI TIRLI", "VILLETTA A SCHIERA", "Immobile 55", "Splendido Appartamento in Vendita a Siena", 
    "ITALIA TOSCANA GROSSETO COMUNE DI ROCCALBEGNA", "Immobile 64", "GROSSETO - ROSELLE STRADA DEI LAGHI", 
    "FOLLONICA (GR) ITALIA VILLA UNIFAMILIARE", "CASOLARE", "TERRENO AGRICOLO", "Immobile 17",
    "lTERRENO SEGGIANO", "TERRENO", "VILLA TRIFAMILIARE", "Terratetto", "APPARTAMENTO PRINCIPINA A MARE",
    "STICCIANO", "SASSOFORTINO", "Grosseto"
  ];

  try {
    const properties = await prisma.property.findMany({
      where: {
        title: { in: titlesToCheck }
      }
    });
    
    console.log(`Found ${properties.length} properties matching the titles.`);
    
    for (const p of properties) {
      console.log(`\n--- ${p.title} ---`);
      console.log(`Media: ${p.media}`);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkImages();
