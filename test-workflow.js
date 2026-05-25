const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const leadService = require('./src/services/lead.service');
const conversionService = require('./src/services/conversion.service');
const dealService = require('./src/services/deal.service');
const commissionService = require('./src/services/commission.service');
const notificationService = require('./src/services/notification.service');

async function testWorkflow() {
  console.log('--- Starting CRM Workflow Verification ---');
  
  try {
    // 1. Get Accounts
    const agent = await prisma.user.findFirst({ where: { role: 'AGENT' }});
    const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' }});
    
    if (!agent || !manager) throw new Error('Agent or Manager not found in DB');
    
    console.log(`[x] Using Agent: ${agent.name} (ID: ${agent.id})`);
    console.log(`[x] Using Manager: ${manager.name} (ID: ${manager.id})`);

    // 2. Create Lead as Agent
    let lead = await leadService.createLead({
      name: 'System Test Lead',
      email: 'workflow_test@ero.com',
      phone: '1234567890',
      status: 'NEW',
      budget: 5000000,
      source: 'Direct'
    }, agent);
    
    console.log(`[x] Lead Created: ID ${lead.id}, Status ${lead.status}`);

    // 3. Agent Updates lead up to REQUESTED_CONVERSION
    lead = await leadService.updateLead(lead.id, { status: 'CONTACTED' }, agent);
    lead = await leadService.updateLead(lead.id, { status: 'QUALIFIED' }, agent);
    lead = await leadService.updateLead(lead.id, { status: 'REQUESTED_CONVERSION' }, agent);
    
    console.log(`[x] Lead Status Updated to: ${lead.status}`);

    // Try unauthorized modification (Agent changing to CONVERTED should fail)
    try {
      await leadService.updateLead(lead.id, { status: 'CONVERTED' }, agent);
      console.log('[-] ERROR: Agent was allowed to set status to CONVERTED');
    } catch(err) {
      console.log(`[x] Expected RBAC Failure: Agent cannot set CONVERTED (${err.message})`);
    }

    // 4. Manager Approves Conversion
    const conversionResult = await conversionService.convertLead(lead.id, { 
      dealValue: 5000000 
    }, manager);

    console.log(`[x] Manager Converted Lead. Deal ID: ${conversionResult.deal.id}`);

    // 5. Agent tries to change deal value (Should Fail)
    try {
      await dealService.updateDeal(conversionResult.deal.id, { value: 9999999 }, agent);
      console.log('[-] ERROR: Agent was allowed to change deal value');
    } catch(err) {
      console.log(`[x] Expected RBAC Failure: Agent cannot modify deal value (${err.message})`);
    }

    // 6. Manager marks deal as WON
    const wonDeal = await dealService.updateDeal(conversionResult.deal.id, { status: 'WON' }, manager);
    console.log(`[x] Manager marked deal as WON: ${wonDeal.status}`);

    // 7. Check Commissions
    const commissions = await prisma.commission.findMany({
      where: { deal_id: wonDeal.id }
    });
    
    if (commissions.length > 0) {
      console.log(`[x] Commission generated automatically! Value: €${commissions[0].amount.toLocaleString()}`);
    } else {
      console.log('[-] ERROR: Commission was not generated!');
    }

    // 8. Check Notifications
    const notifications = await prisma.notification.findMany({
      where: { user_id: agent.manager_id || manager.id, type: 'DEAL_WON' }
    });
    
    if (notifications.length > 0) {
      console.log(`[x] Notifications sent to Manager/Admin!`);
      console.log(`    Message: ${notifications[0].message}`);
    }

    // Cleanup
    console.log('--- Cleaning up test records ---');
    await prisma.commission.deleteMany({ where: { deal_id: wonDeal.id } });
    await prisma.deal.deleteMany({ where: { id: wonDeal.id } });
    await prisma.contact.deleteMany({ where: { created_from_lead_id: lead.id } });
    await prisma.leadactivity.deleteMany({ where: { lead_id: lead.id } });
    await prisma.lead.deleteMany({ where: { id: lead.id } });
    console.log('[x] Cleanup complete.');

  } catch(e) {
    console.error('Workflow Test Failed:', e.message);
    require('fs').writeFileSync('test-error.log', e.stack, 'utf8');
  } finally {
    await prisma.$disconnect();
  }
}

testWorkflow();
