// Import all specific bot functions
const runCorebridge = require('../corebridge.js');
const runForesters = require('../foresters.js');
const runFandG = require('../fandg.js');
const runAmerico = require('../americo.js');
const db = require('../src/config/db.js');
const { executeLoginPattern } = require('./patternExecuter.js');
const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
/**
 * Runs the appropriate bot based on the company ID.
 * @param {object} job The job object containing agentId, companyId, etc.
 * @returns {string} The final status ('SUCCESS', 'FAILED', 'MFA_WAIT', etc.)
 */

/*
const runJob = async (job) => {
    
    // The botMap now stores objects, not just functions
    const botMap = {
        // These IDs must match your 'companies' table
        1: { runner: runCorebridge, name: 'corebridge' }, 
        2: { runner: runForesters, name: 'foresters' },
        3: { runner: runAmerico, name: 'americo' },
        4: { runner: runFandG, name: 'fandg' },
        //3: { runner: runAmerico, name: 'americo' },
        // 3: { runner: runFandG, name: 'F&G' },
    };

    // 1. Get the entire configuration object
    const botConfig = botMap[job.companyId];

    // 2. Check if a configuration exists
    if (!botConfig) {
        // You can use the companyId from the job object here for logging
        console.error(`No runner defined for company ID ${job.companyId}`);
        return 'FAILED';
    }
    
    // Use destructuring to easily get the function and the name
    const { runner, name: carrierName } = botConfig; 

    try {
        // You can now use the carrierName in your logging!
        console.log(`Starting job for ${carrierName} (ID: ${job.companyId})`);

        // The function call remains the same, using the extracted runner function
        const status = await runner(job, carrierName); 
        
        return status; 
        
    } catch (error) {
        // Use the carrierName in the error log for better context
        console.error(`Error running bot for ${carrierName}:`, error);
        return 'FAILED';
    }
};*/
const runJob = async (job) => {
    // 1. Get the DB connection and fetch credentials
    // You'll need to fetch the credentials here once

    const [credsResults] = await db.execute(
        `SELECT agent_company_id FROM agent_carrier_credentials WHERE agent_id = ? AND company_id = ?`,
        [job.agentId, job.companyId]
    );
    const credentials = credsResults[0];

    if (!credentials) {
        console.error("No credentials found for this job.");
        return 'FAILED';
    }
    
    // 2. CHECK FOR STORED PATTERN
    const [patternResults] = await db.execute(
        `SELECT pattern_json, companies.name FROM login_patterns 
        INNER JOIN companies on companies.company_id=agent_company_id 
        WHERE agent_company_id = ?`,
        [job.companyId]
    );

    //const storedPattern = patternResults[0] ? JSON.parse(patternResults[0].pattern_json) : null;
    const storedPattern = patternResults[0] ? patternResults[0].pattern_json : null;

    // Instantiate a browser and page instance here (using Puppeteer)
    // NOTE: This is critical. You must create the environment before playback/running the bot.
    const browser = await puppeteer.launch(); 
    const page = await browser.newPage();
    let status = 'FAILED';

    try {
        if (storedPattern) {
            console.log(patternResults[0].name)
            // A. Execute the stored pattern if found
            await executeLoginPattern(storedPattern, credentials, job, patternResults[0].name);
            console.log("Login successful via stored pattern. Proceeding to main bot task.");
            
            // --- Fall through to the main bot logic after successful login ---
            
            // For now, let's assume the hardcoded bot still takes over after login
            // You'll need to determine which bot function runs *after* the custom login.
            const botMap = { /* ... */ };
            const runner = botMap[job.companyId];
            if (runner) {
                 // Pass the active page and browser to the runner function
                 // This assumes your runCorebridge/runForesters can accept these arguments now.
                 status = await runner(job, db, page, browser, company); 
            } else {
                 status = 'SUCCESS'; // Login worked, no further task needed?
            }
            
        } else {
            // B. Fallback to hardcoded logic (if no pattern is available)
            const botMap = { 
                1: runCorebridge, 
                // ... 
            };
            const runner = botMap[job.companyId];

            if (runner) {
                // The hardcoded runner handles its own login/browser setup if no pattern used.
                // You might need a more complex runner signature here if it handles everything.
                status = await runner(job, db); 
            } else {
                status = 'FAILED';
            }
        }
        
    } catch (error) {
        console.error(`Job failed for Agent ${job.agentId}:`, error);
        status = 'FAILED';
    } finally {
        // Ensure the browser is always closed
        if (browser) await browser.close(); 
    }

    return status;
};



module.exports = { runJob };