const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const properties = await prisma.property.findMany();
    
    let toscoCount = 0;
    let worldCount = 0;
    let hotelsCount = 0;
    let unassigned = 0;

    properties.forEach(p => {
      let assigned = false;
      let pub = p.publishing;
      
      // If pub is a string (because of JSON.stringify), parse it
      if (typeof pub === 'string') {
        try {
          pub = JSON.parse(pub);
        } catch (e) {
          // ignore
        }
      }

      if (pub && pub.tosco && (pub.tosco.status === 'published' || pub.tosco.status === 'Published')) {
        toscoCount++;
        assigned = true;
      }
      if (pub && pub.world && (pub.world.status === 'published' || pub.world.status === 'Published')) {
        worldCount++;
        assigned = true;
      }
      if (pub && pub.hotels && (pub.hotels.status === 'published' || pub.hotels.status === 'Published')) {
        hotelsCount++;
        assigned = true;
      }

      if (!assigned) {
        unassigned++;
      }
    });

    console.log(`Total properties in DB: ${properties.length}`);
    console.log(`Published on Tosco: ${toscoCount}`);
    console.log(`Published on World: ${worldCount}`);
    console.log(`Published on Hotels: ${hotelsCount}`);
    console.log(`Unassigned / Not published anywhere: ${unassigned}`);

    // Print first property's publishing object to see its structure
    if (properties.length > 0) {
      console.log('Sample publishing object:', properties[0].publishing);
    }
    
  } catch (error) {
    console.error('Error verifying properties:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
