const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const prop = await prisma.property.findFirst({
        where: { title: 'BILOCALE' }
    });
    console.log("Updated BILOCALE:");
    console.log(prop.features);
    console.log("Bedrooms:", prop.bedrooms, "Area:", prop.area);
}
main().finally(() => prisma.$disconnect());
