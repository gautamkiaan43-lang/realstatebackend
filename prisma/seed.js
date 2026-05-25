const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Superadmin
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@ero.com' }
  });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('superadmin123', 10);
    await prisma.user.create({
      data: { name: 'Super Admin', email: 'superadmin@ero.com', password: hashedPassword, role: 'SUPER_ADMIN' }
    });
    console.log('✅ Superadmin created');
  }

  // 2. Manager
  const existingManager = await prisma.user.findUnique({
    where: { email: 'manager@ero.com' }
  });
  if (!existingManager) {
    const managerPassword = await bcrypt.hash('manager123', 10);
    await prisma.user.create({
      data: { name: 'Giulia B.', email: 'manager@ero.com', password: managerPassword, role: 'MANAGER' }
    });
    console.log('✅ Manager created');
  }
  
  // 3. Agent
  const existingAgent = await prisma.user.findUnique({
    where: { email: 'agent@ero.com' }
  });
  if (!existingAgent) {
    const agentPassword = await bcrypt.hash('agent123', 10);
    const manager = await prisma.user.findUnique({ where: { email: 'manager@ero.com' } });
    
    await prisma.user.create({
      data: { 
        name: 'Agent Rossi', 
        email: 'agent@ero.com', 
        password: agentPassword, 
        role: 'AGENT',
        manager_id: manager ? manager.id : null
      }
    });
    console.log('✅ Agent created');
  }

  // 4. Website Configs
  const websiteCount = await prisma.websiteConfig.count();
  if (websiteCount === 0) {
    await prisma.websiteConfig.createMany({
      data: [
        {
          name: 'Tosco Intermedia Main',
          domain: 'toscointermedia.com',
          apiEndpoint: 'https://api.toscointermedia.com/v1',
          status: 'connected',
          lastSync: new Date('2026-03-25T10:00:00Z')
        },
        {
          name: 'Luxury Milan Portal',
          domain: 'milan.luxuryrealestate.it',
          apiEndpoint: 'https://api.luxmilan.it/v1',
          status: 'connected',
          lastSync: new Date('2026-03-24T15:30:00Z')
        },
        {
          name: 'Internal Agent Showcase',
          domain: 'agents.erocrm.internal',
          apiEndpoint: '',
          status: 'disconnected'
        }
      ]
    });
    console.log('✅ Website configurations seeded');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
