const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { decrypt } = require('./crypto');
const path = require('path');
const fs = require('fs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Assuming these helpers are correctly imported from genericHelpers
const { loadCookies, saveCookies, waitForDownloadComplete, processDownloadedFileAndInsert } = require('../src/helpers/genericHelpers');

/**
 * Executes a stored login pattern using Puppeteer.
 * @param {Array<object>} patternSteps - The array of steps from the 'pattern_json' column.
 * @param {object} credentials - The agent's credentials object {username, password}.
 * @param {object} job - The job details including agentId, username (encrypted), and companyName.
 * @returns {Promise<void>} Resolves when the pattern is complete.
 */
async function executeLoginPattern(patternSteps, credentials, job, company) {
    
    if (!patternSteps || patternSteps.length === 0) {
        throw new Error("Cannot execute pattern: Pattern steps are empty.");
    }
    
    // --- 1. Setup ---
    const companyName = company; 
    const username = decrypt(job.username);
    const password = decrypt(job.password);
    const agentId = job.agentId;
    
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.96 Safari/537.36',
            '--lang=en-US,en;q=0.9',
        ],
        defaultViewport: null,
    });
    const context = browser.defaultBrowserContext();
    // Set up download directory
    const downloadDir = path.resolve(__dirname, `../csv/${companyName}/${agentId}`);
    try {
        fs.mkdirSync(downloadDir, { recursive: true });
        console.log(`Directory created successfully: ${downloadDir}`);
    } catch (error) {
        console.error(`Error creating directory: ${error.message}`);
    }
    
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
    
    console.log(`Starting dynamic pattern execution for ${username} (Company: ${companyName})...`);

    // --- 2. Cookie and Step Index Logic (Skipping Login) ---
    let startIndex = 0;
    let cookieLoadSuccess = false;

    try {
        await loadCookies(page, agentId, companyName);
        console.log("[Cookie Logic] Cookies loaded successfully.");
        cookieLoadSuccess = true;
    } catch (e) {
        console.log(`[Cookie Logic] Failed to load cookies: ${e.message}. Will run full login.`);
    }

    if (cookieLoadSuccess) {
        const markerIndex = patternSteps.findIndex(step => 
            //console.log(step),
            step.action === 'marker' && step.value === 'POST_LOGIN_START'
        );
        console.log(markerIndex);

        if (markerIndex !== -1) {
            startIndex = markerIndex + 1;
            console.log(`[Cookie Logic] Skipping ${startIndex} login steps using cookies.`);
            
            // Navigate immediately to the last known URL before the marker
            const preMarkerStep = patternSteps[markerIndex - 1];
            if (preMarkerStep) {
                 await page.goto(preMarkerStep.url, { waitUntil: 'networkidle2' });
            }
        }
    }
    
    // IMPORTANT: Capture existing files BEFORE execution starts
    const filesBeforeExecution = fs.existsSync(downloadDir) ? fs.readdirSync(downloadDir) : [];

    // --- 3. Step Execution Loop ---
    for (let i = startIndex; i < patternSteps.length; i++) {
        const step = patternSteps[i];
        
        // Ignore the marker step itself, as we already used it for indexing
        if (step.action === 'marker' && step.value!=="POST_LOGIN_START") continue;
        
        console.log(`Executing step ${step.step} [Index ${i}]: ${step.action} on ${step.selector || step.url || step.text}`);

        // Placeholder substitution
        let valueToUse = step.value;
        if (valueToUse === '[[USERNAME]]') valueToUse = username;
        else if (valueToUse === '[[PASSWORD]]') valueToUse = password;

        try {
            // Check if the page is ready before proceeding (useful after skipping login)
            if (i === startIndex && startIndex > 0) {
                 await sleep(1000); // Give it a moment to load after navigation
            }
            
            switch (step.action) {
                case 'navigate':
                    await page.goto(step.url, { waitUntil: 'networkidle2' });
                    break;

                case 'type':
                    if (!step.selector || !valueToUse) throw new Error("Missing selector or value for type action.");
                    await page.waitForSelector(step.selector, { visible: true, timeout: 15000 });
                    await page.evaluate(selector => document.querySelector(selector).value = '', step.selector);
                    await page.type(step.selector, valueToUse, { delay: 150 });
                    break;
                case 'marker':
                    if(step.value==="POST_LOGIN_START"){
                        console.log('saving cookies')
                        await saveCookies(context, agentId, companyName);
                    }
                case 'click':
                    if (!step.selector) throw new Error("Missing selector for click action.");
                    await page.waitForSelector(step.selector, { visible: true, timeout: 15000 });
                    
                    // Add 2-second delay before clicking
                    await sleep(2000); 
                    
                    await page.click(step.selector);
                    break;
                
                case 'download':
                    console.log(`[Download] Waiting for file to complete download in ${downloadDir}...`);

                    // Run the interceptor function using the file list captured BEFORE the loop
                    const downloadedFilename = await waitForDownloadComplete(
                        downloadDir,
                        filesBeforeExecution,
                        agentId 
                    );
                    
                    console.log(`[Download] Successfully processed file: ${downloadedFilename}`);
                    break;
                    
                case 'clickByText':
                    if (!step.selector || !step.text) throw new Error("Missing selector or text for clickByText action.");
                    
                    const textToFind = step.text.trim();
                    const cssSelector = step.selector.trim();
                    const timeoutMs = 30000;
                    
                    try {
                        const elementHandle = await page.waitForFunction(
                            (selector, text) => {
                                const elements = Array.from(document.querySelectorAll(selector));
                                const foundElement = elements.find(el => el.innerText.trim().includes(text) && el.offsetParent !== null);
                                return foundElement || false;
                            },
                            { timeout: timeoutMs },
                            cssSelector,
                            textToFind
                        );

                        if (elementHandle) {
                            // Add 2-second delay before clicking
                            await sleep(2000);
                            
                            await elementHandle.asElement().click();
                        } else {
                             throw new Error(`Element with text "${textToFind}" found, but handle failed to resolve.`);
                        }

                    } catch (error) {
                        throw new Error(`Element with text "${textToFind}" not found within ${timeoutMs / 1000} seconds.`);
                    }
                    break;
                
                case 'end_session':
                    console.log("[EXEC] End session marker reached. Closing browser.");
                    await browser.close();
                    return; // Exit the function immediately

                case 'wait_selector':
                    if (!step.selector) throw new Error("Missing selector for wait_selector action.");
                    await page.waitForSelector(step.selector, { visible: true, timeout: 30000 });
                    break;

                case 'wait_time':
                    const ms = parseInt(step.value);
                    if (!isNaN(ms)) await sleep(ms);
                    break;
                
                default:
                    console.warn(`Unknown action type: ${step.action}. Skipping.`);
            }

            // Wait for recorded delay (human-like pacing)
            if (step.delay && !isNaN(step.delay)) {
                const delayMs = Math.min(step.delay, 5000);
                await sleep(delayMs);
            }

        } catch (error) {
            console.error(`Execution failed at step ${step.step} (Index ${i}, Action: ${step.action}):`, error);
            throw new Error(`Pattern execution failed at step ${step.step}.`);
        }
    }
    console.log("Pattern execution completed successfully.");
    await browser.close();
}

module.exports = { executeLoginPattern };