const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.property.findFirst({ where: { title: '4 VANI TIRLI' } }).then(p => { 
  console.log(p);
  prisma.$disconnect(); 
});
