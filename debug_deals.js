const dealService = require('./src/services/deal.service');

async function debug() {
    try {
        console.log("🔍 Debugging Deal Fetch...");
        const user = { id: 2, role: 'AGENT' };
        const deals = await dealService.getAllDeals(user);
        console.log(`✅ Success: Fetched ${deals.length} deals.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ FAILED to load deals:");
        console.error(error);
        process.exit(1);
    }
}

debug();
