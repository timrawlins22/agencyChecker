const axios = require('axios');
const https = require('https');

// Ignore self-signed certs for localhost testing
const agent = new https.Agent({
    rejectUnauthorized: false
});

async function testLogin() {
    try {
        console.log('Attempting login with demo_agent...');
        const response = await axios.post('https://localhost:3443/api/agent/login', {
            username: 'demo_agent',
            password: 'password123'
        }, { httpsAgent: agent });

        if (response.data.token) {
            console.log('✅ Login Successful!');
            console.log('Token received:', response.data.token.substring(0, 20) + '...');
            console.log('Agent Info:', response.data.agentInfo.name);
        } else {
            console.error('❌ Login Failed: No token received');
        }
    } catch (error) {
        console.error('❌ Login Failed:', error.response ? error.response.data : error.message);
    }
}

testLogin();
