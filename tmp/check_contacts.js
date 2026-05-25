const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const contacts = await prisma.contact.findMany({
      take: 10,
      select: { id: true, name: true, role: true, status: true }
    });
    console.log('Sample Contacts:', JSON.stringify(contacts, null, 2));
    
    // Check possible values currently in the DB
    const roles = await prisma.$queryRaw`SELECT role, COUNT(*) as count FROM contact GROUP BY role`;
    console.log('Current Role Distribution:', roles);
    
    const statuses = await prisma.$queryRaw`SELECT status, COUNT(*) as count FROM contact GROUP BY status`;
    console.log('Current Status Distribution:', statuses);

  } catch (err) {
    console.error('Error checking data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
