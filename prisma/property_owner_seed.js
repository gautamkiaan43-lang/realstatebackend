const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Restoring Property Owners & Sellers...');

    // 1. Find existing users (Agent/Manager) to assign contacts to
    const agent = await prisma.user.findUnique({ where: { email: 'agent@ero.com' } });
    if (!agent) {
        console.error('❌ Agent user not found. Please run main seed first.');
        process.exit(1);
    }

    // 2. Create SELLER Contacts
    const c1 = await prisma.contact.create({
        data: {
            name: 'Giorgio Rossi',
            email: 'giorgio@luxury-owner.it',
            phone: '+39 333 999 8888',
            role: 'SELLER',
            status: 'ACTIVE',
            assigned_to: agent.id
        }
    });

    const c2 = await prisma.contact.create({
        data: {
            name: 'Bianca Bianchi',
            email: 'bianca.b@property-holder.com',
            phone: '+39 347 111 0000',
            role: 'BOTH',
            status: 'ACTIVE',
            assigned_to: agent.id
        }
    });

    console.log(`✅ Created ${c1.name} and ${c2.name} as Sellers.`);

    // 3. Link Properties to these owners
    const properties = await prisma.property.findMany({
        take: 2,
        orderBy: { createdAt: 'desc' }
    });

    if (properties.length >= 2) {
        // Link Villa to Giorgio
        await prisma.property.update({
            where: { id: properties[0].id },
            data: { owner_id: c1.id }
        });
        
        // Link Penthouse to Bianca
        await prisma.property.update({
            where: { id: properties[1].id },
            data: { owner_id: c2.id }
        });
        console.log(`✅ Linked existing properties to Owners.`);
    } else {
        console.warn('⚠️ Fewer than 2 properties found to link.');
    }

    console.log('✨ Data Restoration Complete.');
}

seed()
    .catch(e => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
