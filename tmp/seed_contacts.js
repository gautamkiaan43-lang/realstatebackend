const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    // 1. Fetch a valid agent ID
    const agent = await prisma.user.findFirst({
        where: { role: 'AGENT', status: 'active' }
    });

    if (!agent) {
        console.error('No active Agent found. Please seed users first.');
        return;
    }

    // 2. Create a Buyer
    await prisma.contact.create({
        data: {
            name: 'Marco Rossi',
            email: 'marco.rossi@example.com',
            phone: '+39 333 111 2222',
            role: 'BUYER',
            status: 'ACTIVE',
            assigned_to: agent.id,
            buyerDetails: JSON.stringify({
                budgetMin: 500000,
                budgetMax: 800000,
                preferredLocations: ['Tuscany', 'Florence'],
                propertyTypeInterest: 'Villa'
            })
        }
    });

    // 3. Create a Seller
    await prisma.contact.create({
        data: {
            name: 'Giuseppe Verdi',
            email: 'giuseppe.verdi@example.com',
            phone: '+39 333 555 6666',
            role: 'SELLER',
            status: 'ACTIVE',
            assigned_to: agent.id
        }
    });

    // 4. Create a Both Role
    await prisma.contact.create({
        data: {
            name: 'Sofia Gallo',
            email: 'sofia.gallo@example.com',
            phone: '+39 333 777 8888',
            role: 'BOTH',
            status: 'ACTIVE',
            assigned_to: agent.id
        }
    });

    console.log('Seed protocol complete.');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
