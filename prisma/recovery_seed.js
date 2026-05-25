const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recover() {
    console.log('🔄 Executing high-affinity recovery seed...');

    const agent = await prisma.user.findUnique({ where: { email: 'agent@ero.com' } });
    const manager = await prisma.user.findUnique({ where: { email: 'manager@ero.com' } });
    const superadmin = await prisma.user.findUnique({ where: { email: 'superadmin@ero.com' } });

    if (!agent || !manager || !superadmin) {
        console.error('❌ Base users not found. Run standard seed first.');
        process.exit(1);
    }

    // 1. Properties
    console.log('🏗️ Restoring Properties...');
    const p1 = await prisma.property.create({
        data: {
            title: 'Villa Mediterranean Paradise',
            slug: 'villa-mediterranean-paradise-' + Date.now(),
            price: 4500000.00,
            type: 'Villa',
            status: 'AVAILABLE',
            city: 'Forte dei Marmi',
            country: 'Italy',
            bedrooms: 6,
            bathrooms: 5,
            area: 450,
            commissionType: 'PERCENTAGE',
            commissionValue: 3.00,
            userId: agent.id
        }
    });

    const p2 = await prisma.property.create({
        data: {
            title: 'Modern Penthouse Milan',
            slug: 'modern-penthouse-milan-' + Date.now(),
            price: 2100000.00,
            type: 'Apartment',
            status: 'AVAILABLE',
            city: 'Milan',
            country: 'Italy',
            bedrooms: 3,
            bathrooms: 3,
            area: 210,
            commissionType: 'FIXED',
            commissionValue: 50000.00,
            userId: agent.id
        }
    });

    // 2. Leads
    console.log('👥 Restoring Leads...');
    const l1 = await prisma.lead.create({
        data: {
            name: 'Marco Valeri',
            email: 'marco.valeri@client.com',
            phone: '+39 333 111 2222',
            source: 'Website',
            message: 'Interested in luxury villas in Forte dei Marmi.',
            status: 'NEW',
            budget: 5000000.00,
            property_type_interest: 'Villa',
            owner_id: agent.id,
            manager_id: manager.id,
            created_by_id: superadmin.id
        }
    });

    const l2 = await prisma.lead.create({
        data: {
            name: 'Elena Bianchi',
            email: 'elena@lux-interior.it',
            phone: '+39 347 555 6666',
            source: 'Referral',
            message: 'Looking for a high-end apartment in Milan center.',
            status: 'QUALIFIED',
            budget: 2500000.00,
            property_type_interest: 'Apartment',
            owner_id: agent.id,
            manager_id: manager.id,
            created_by_id: superadmin.id,
            property_id: p2.id
        }
    });

    console.log('✅ Recovery Complete.');
}

recover()
    .catch(e => {
        console.error('❌ Recovery failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
