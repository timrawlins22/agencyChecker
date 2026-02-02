// utils/jobQueue.js

const db = require('../src/config/db');
const botRunner = require('./botRunner'); // We will create this file next
const MAX_CONCURRENT_JOBS = 1; // Start with 1 to ensure single-threaded runs

let jobQueue = []; // In-memory array of job objects
let runningJobs = 0;

/**
 * Adds a new job to the queue and triggers processing.
 * @param {string} agentId The ID of the agent requesting the job.
 * @param {number} companyId The ID of the carrier to run.
 * @param {string} source How the job was triggered (e.g., 'MANUAL', 'SCHEDULED').
 */// = 'MANUAL'
const addJobToQueue = async (agentId, companyId, agentCompanyId, source, username, password) => {
    // 1. Create a PENDING record in the database
    const [result] = await db.execute(
        `INSERT INTO jobs (agent_id, company_id, agent_company_id, run_date, status, start_time) 
        VALUES (?, ?, ?, CURDATE(), 'PENDING', NOW())
        ON DUPLICATE KEY UPDATE 
            status = VALUES(status), 
            start_time = VALUES(start_time)`,
        [agentId, companyId, agentCompanyId]
    );
    const jobId = result.insertId;

    // 2. Add to in-memory queue
    jobQueue.push({ jobId, agentId, companyId, source, username, password });
    console.log(`Job #${jobId} added to queue. Queue size: ${jobQueue.length}`);
    
    // 3. Kick off the processor if capacity is available
    processQueue();
};

/**
 * Core function to check queue and start jobs up to MAX_CONCURRENT_JOBS.
 */
const processQueue = async () => {
    if (jobQueue.length === 0 || runningJobs >= MAX_CONCURRENT_JOBS) {
        return; // Nothing to do or max capacity reached
    }
    
    // Dequeue the next job
    const job = jobQueue.shift();
    runningJobs++;

    console.log(`Starting job #${job.jobId} (${job.agentId} | ${job.companyId}). Running: ${runningJobs}`);

    try {
        // --- 4. RUN THE BOT ---
        // The botRunner function handles Puppeteer and returns the final status
        const finalStatus = await botRunner.runJob(job);
        
        // --- 5. Log completion in DB ---
        await db.execute(
            'UPDATE jobs SET status = ?, end_time = NOW() WHERE job_id = ?',
            [finalStatus, job.jobId]
        );

    } catch (err) {
        console.error(`Job #${job.jobId} failed unexpectedly:`, err);
        // Log failure to DB
        await db.execute(
            'UPDATE jobs SET status = "FAILED", error_message = ?, end_time = NOW() WHERE job_id = ?',
            [err.message || 'Unknown processing error', job.jobId]
        );
    } finally {
        runningJobs--;
        console.log(`Finished job #${job.jobId}. Running: ${runningJobs}.`);
        
        // Process the next item recursively
        processQueue(); 
    }
};

module.exports = { 
    addJobToQueue,
    getQueueStatus: () => ({ queueLength: jobQueue.length, runningJobs }),
    processQueue // Expose for initial setup
};