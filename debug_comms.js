const commissionService = require('./src/services/commission.service');

async function debug() {
    try {
        console.log("🔍 Debugging Commission Fetch...");
        const user = { id: 1, role: 'SUPER_ADMIN' };
        const comms = await commissionService.getAllCommissions(user);
        console.log(`✅ Success: Fetched ${comms.length} commissions.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ FAILED to load commissions:");
        console.error(error);
        process.exit(1);
    }
}

debug();
