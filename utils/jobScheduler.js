// utils/jobScheduler.js

const cron = require('node-cron');
const db = require('../src/config/db');
const { addJobToQueue } = require('./jobQueue');

// Define the time for the daily run (e.g., 2:00 AM)
// Cron format: minute hour day-of-month month day-of-week
const DAILY_SCHEDULE = '0 2 * * *'; 

/**
 * Finds all active agents and their enabled carriers, then adds a job 
 * to the queue for each pair, only if they haven't run today.
 */
const runDailySyncCheck = async () => {
    
    try {
        // SQL to find all enabled carriers for active agents
        // AND ensure the agent/company pair hasn't had a SUCCESS or MFA_WAIT run today.
        const [rows] = await db.execute(`
            SELECT 
                ac.agent_id, 
                ac.company_id,
                ac.agent_company_id,
                acc.login_username_encrypted,
                acc.login_password_encrypted
            FROM agent_companies ac
            INNER JOIN agent_carrier_credentials acc ON acc.company_id=ac.company_id
            JOIN agents a ON ac.agent_id = a.id
            WHERE ac.is_enabled = 1 AND a.active = 1
            
            -- Exclude jobs that successfully ran today (or are waiting for MFA from today)
            AND NOT EXISTS (
            SELECT 1 
            FROM jobs j
            WHERE j.agent_id = ac.agent_id 
                AND j.company_id = ac.company_id
                AND j.run_date = CURDATE()
                AND j.status IN ('SUCCESS', 'MFA_WAIT')
            );
        `);
        console.log(rows);
        if (rows.length === 0) {
            console.log('No agents require a daily sync run today.');
            return;
        }

        console.log(`Found ${rows.length} carriers requiring a sync. Adding to queue...`);

        // Add each required job to the processing queue
        for (const row of rows) {
            await addJobToQueue(row.agent_id, row.company_id, row.agent_company_id, 'SCHEDULED', row.login_username_encrypted, row.login_password_encrypted);
        }

    } catch (err) {
        console.error('Error during daily sync check:', err);
    }
};

/**
 * Initializes the cron schedule.
 */
const initScheduler = () => {
    // Schedule the task to run daily at the defined time
    cron.schedule(DAILY_SCHEDULE, () => {
        runDailySyncCheck();
    }, {
        scheduled: true,
        timezone: "America/Denver" // Use the appropriate timezone for your server/agents
    });

    console.log(`Daily sync scheduled to run at 2:00 AM (MT).`);
    // Optional: Run the check immediately on startup for testing/recency
    // runDailySyncCheck(); 
};

module.exports = { initScheduler };