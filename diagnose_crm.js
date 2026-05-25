const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
    console.log("--- CRM Diagnostic Start ---");

    // 1. Check for Orphan Deals
    const orphanDeals = await prisma.deal.findMany({
        where: { contact_id: 0 } // Prisma might use 0 or null if not enforced, but schema says Int. 
        // Actually, if it's required (Int), Prisma won't allow null. 
        // I'll check for deals where contact doesn't exist anymore or ID is invalid.
    });
    
    const allDeals = await prisma.deal.findMany({
        include: { contact: true }
    });
    
    const actualOrphans = allDeals.filter(d => !d.contact);
    console.log(`Orphan Deals found: ${actualOrphans.length}`);
    actualOrphans.forEach(d => console.log(` - Deal ID: ${d.id}, Title: ${d.title}`));

    // 2. Check for Duplicate Contacts
    const contacts = await prisma.contact.findMany({
        where: { isDeleted: false }
    });

    const duplicates = [];
    const seenEmails = new Map();
    const seenPhones = new Map();

    contacts.forEach(c => {
        if (c.email) {
            const email = c.email.toLowerCase().trim();
            if (seenEmails.has(email)) {
                duplicates.push({ id: c.id, name: c.name, type: 'email', value: email });
            } else {
                seenEmails.set(email, c.id);
            }
        }
        if (c.phone) {
            const phone = c.phone.replace(/[^\d+]/g, '');
            if (seenPhones.has(phone)) {
                duplicates.push({ id: c.id, name: c.name, type: 'phone', value: phone });
            } else {
                seenPhones.set(phone, c.id);
            }
        }
    });

    console.log(`Duplicate Contacts found: ${duplicates.length}`);
    duplicates.forEach(d => console.log(` - Contact ID: ${d.id}, Name: ${d.name}, Match: ${d.type} (${d.value})`));

    console.log("--- CRM Diagnostic End ---");
    await prisma.$disconnect();
}

diagnose();
