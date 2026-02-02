const puppeteer = require('puppeteer');
//const { startRecordingSession } = require('./utils/patternRecorder'); // Your recorder function
require('dotenv').config();
const pool = require('./src/config/db'); // Your database pool
const { startRecordingSession } = require('./utils/patternRecorder');

// --- CONFIGURATION ---
// These values would normally come from a user interface, API call, or CLI arguments
const AGENT_COMPANY_ID_TO_RECORD = 123; 
const CARRIER_LOGIN_URL = 'https://www.americanamicable.com/v4/AgentLogin.php';
// ---------------------

async function initiateRecording() {
    let browser;
    let connection;

    try {
        // 1. Get a database connection
        connection = await pool.getConnection();

        // 2. Launch Puppeteer in non-headless mode (essential for user interaction)
        browser = await puppeteer.launch({
            headless: false, // The user must see and interact with the browser
            defaultViewport: null, // Use full screen
            args: ['--start-maximized']
        });

        console.log(`\n\nStarting Recording Session for ID: ${AGENT_COMPANY_ID_TO_RECORD}...`);

        // 3. Call the recorder function
        const recordingStatus = await startRecordingSession(
            browser,
            connection // Pass the active connection for saving the pattern
        );

        console.log(`\n--- Recording Final Status: ${recordingStatus} ---\n`);
        
    } catch (error) {
        console.error('\n*** FAILED TO COMPLETE RECORDING SESSION ***');
        console.error(error.message);
        return 'FAILED';

    } finally {
        // 4. Cleanup resources
        if (browser) await browser.close();
        if (connection) connection.release();
    }
}

// Execute the initiator function
initiateRecording();