const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function runTest() {
    console.log('🚀 Starting RBAC Flow Test...');

    try {
        // 1. Admin Login
        console.log('--- Step 1: Admin Login ---');
        const adminLogin = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@crm.com',
            password: 'password123'
        });
        const adminToken = adminLogin.data.token;
        console.log('✅ Admin logged in.');

        // 2. Admin creates Manager
        console.log('--- Step 2: Admin creates Manager ---');
        const managerData = {
            name: 'John Manager',
            email: `manager_${Date.now()}@crm.com`,
            password: 'password123'
        };
        const createManager = await axios.post(`${API_URL}/users/manager`, managerData, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Manager created:', createManager.data.data.user.email);

        // 3. Manager Login
        console.log('--- Step 3: Manager Login ---');
        const managerLogin = await axios.post(`${API_URL}/auth/login`, {
            email: managerData.email,
            password: 'password123'
        });
        const managerToken = managerLogin.data.token;
        console.log('✅ Manager logged in.');

        // 4. Manager creates Agent
        console.log('--- Step 4: Manager creates Agent ---');
        const agentData = {
            name: 'Sarah Agent',
            email: `agent_${Date.now()}@crm.com`,
            password: 'password123'
        };
        const createAgent = await axios.post(`${API_URL}/users/agent`, agentData, {
            headers: { Authorization: `Bearer ${managerToken}` }
        });
        console.log('✅ Agent created:', createAgent.data.data.user.email);
        console.log('✅ Agent belongs to manager ID:', createAgent.data.data.user.manager_id);

        console.log('\n🏆 RBAC Flow Test Passed Successfully!');

    } catch (error) {
        console.error('❌ Test Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

runTest();
