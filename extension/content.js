/**
 * AgentPortal Carrier Sync - Content Script Step Executor
 * 
 * Injected into carrier portal tabs by the background worker.
 * Replays recorded pattern steps directly in the page DOM.
 * Adapted from server-side patternExecuter.js for browser context.
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for an element matching the selector to appear in the DOM
 */
function waitForSelector(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el && el.offsetParent !== null) {
            return resolve(el);
        }

        const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for selector: ${selector}`));
        }, timeout);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el && el.offsetParent !== null) {
                clearTimeout(timer);
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
}

/**
 * Wait for an element containing specific text
 */
function waitForText(tagName, text, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const find = () => {
            const elements = Array.from(document.querySelectorAll(tagName));
            return elements.find(el => el.innerText.trim().includes(text) && el.offsetParent !== null);
        };

        const el = find();
        if (el) return resolve(el);

        const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for text "${text}" in <${tagName}>`));
        }, timeout);

        const observer = new MutationObserver(() => {
            const el = find();
            if (el) {
                clearTimeout(timer);
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

/**
 * Simulate realistic typing into an input element
 */
function simulateType(element, text) {
    element.focus();
    element.value = '';
    element.dispatchEvent(new Event('focus', { bubbles: true }));

    for (const char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Scrape visible table data from the page.
 * Used instead of file downloads in the extension context.
 */
function scrapeTableData() {
    const tables = document.querySelectorAll('table');
    if (tables.length === 0) return null;

    const results = [];

    for (const table of tables) {
        const headers = [];
        const rows = [];

        // Get headers
        const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th');
        headerCells.forEach(cell => headers.push(cell.innerText.trim()));

        // If no thead, try first row
        if (headers.length === 0) {
            const firstRow = table.querySelector('tr');
            if (firstRow) {
                firstRow.querySelectorAll('th, td').forEach(cell => headers.push(cell.innerText.trim()));
            }
        }

        // Get data rows (skip header row if headers were from first row)
        const dataRows = table.querySelectorAll('tbody tr');
        const rowsToProcess = dataRows.length > 0 
            ? dataRows 
            : Array.from(table.querySelectorAll('tr')).slice(headers.length > 0 ? 1 : 0);

        rowsToProcess.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) return;

            const rowData = {};
            cells.forEach((cell, idx) => {
                const key = headers[idx] || `column_${idx}`;
                rowData[key] = cell.innerText.trim();
            });
            rows.push(rowData);
        });

        if (rows.length > 0) {
            results.push({ headers, rows });
        }
    }

    return results.length > 0 ? results : null;
}

/**
 * Execute a single step
 */
async function executeStep(step, stepIndex, totalSteps) {
    console.log(`[Sync] Step ${stepIndex + 1}/${totalSteps}: ${step.action} → ${step.selector || step.url || step.text || ''}`);

    switch (step.action) {
        case 'navigate':
            window.location.href = step.url;
            // Wait for the page to reload
            await new Promise(resolve => {
                window.addEventListener('load', resolve, { once: true });
                setTimeout(resolve, 10000); // fallback timeout
            });
            await sleep(2000);
            break;

        case 'click': {
            const el = await waitForSelector(step.selector);
            await sleep(500);
            el.click();
            break;
        }

        case 'clickByText': {
            const el = await waitForText(step.selector, step.text);
            await sleep(500);
            el.click();
            break;
        }

        case 'type': {
            const el = await waitForSelector(step.selector);
            // Skip credential placeholders — agent is already logged in
            if (step.value === '[[USERNAME]]' || step.value === '[[PASSWORD]]') {
                console.log(`[Sync] Skipping credential field: ${step.selector}`);
                break;
            }
            simulateType(el, step.value);
            break;
        }

        case 'download': {
            // In extension context, scrape table data instead of downloading
            console.log('[Sync] Download step → scraping visible table data...');
            await sleep(3000); // Wait for data to load
            const scraped = scrapeTableData();
            if (scraped) {
                // Store scraped data to return later
                window.__agentPortalScrapedData = scraped;
                console.log(`[Sync] Scraped ${scraped.reduce((sum, t) => sum + t.rows.length, 0)} rows from ${scraped.length} table(s)`);
            } else {
                console.warn('[Sync] No table data found on page');
            }
            break;
        }

        case 'wait_selector': {
            await waitForSelector(step.selector, 30000);
            break;
        }

        case 'wait_time': {
            const ms = parseInt(step.value);
            if (!isNaN(ms)) await sleep(ms);
            break;
        }

        case 'end_session':
            console.log('[Sync] End session step reached.');
            break;

        case 'save_cookies':
            // No-op in extension context — browser manages cookies natively
            break;

        default:
            console.warn(`[Sync] Unknown action: ${step.action}, skipping.`);
    }

    // Human-like delay between steps
    if (step.delay && !isNaN(step.delay)) {
        await sleep(Math.min(step.delay, 5000));
    }
}

/**
 * Detect if the current page is showing an MFA/2FA challenge.
 */
function detectMFA() {
    const pageText = document.body.innerText.toLowerCase();
    const mfaKeywords = [
        'verification code', 'enter code', 'two-factor', 'two factor',
        'multi-factor', 'multi factor', 'mfa', '2fa', 'one-time password',
        'one time password', 'otp', 'authenticator', 'security code',
        'enter the code', 'we sent a code', 'check your email',
        'check your phone', 'text message', 'sms code'
    ];

    const hasKeyword = mfaKeywords.some(kw => pageText.includes(kw));
    if (!hasKeyword) return false;

    // Also look for a short text input (likely a code field)
    const inputs = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"], input:not([type])');
    const hasCodeInput = Array.from(inputs).some(input => {
        const maxLen = input.maxLength;
        const placeholder = (input.placeholder || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        return (maxLen > 0 && maxLen <= 10) ||
               placeholder.includes('code') || placeholder.includes('otp') ||
               name.includes('code') || name.includes('otp') || name.includes('token') ||
               id.includes('code') || id.includes('otp') || id.includes('token');
    });

    return hasCodeInput || hasKeyword;
}

/**
 * Wait for the user to complete MFA. Polls until the MFA indicators disappear.
 */
function waitForMFACompletion(timeout = 300000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const originalUrl = window.location.href;

        const check = () => {
            // MFA is complete if page navigated away or MFA indicators are gone
            if (window.location.href !== originalUrl || !detectMFA()) {
                resolve();
                return;
            }
            if (Date.now() - startTime > timeout) {
                reject(new Error('MFA timeout — code was not entered within 5 minutes.'));
                return;
            }
            setTimeout(check, 1000);
        };

        // Start checking after a brief delay (give the user a moment)
        setTimeout(check, 2000);
    });
}

/**
 * Execute all steps sequentially
 */
async function executeAllSteps(steps, companyId) {
    const scrapedData = { tables: [], pageTitle: document.title, url: window.location.href };

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Stop if we hit end_session
        if (step.action === 'end_session') break;

        // --- MFA Detection (check before each step) ---
        if (detectMFA()) {
            console.log('[Sync] MFA detected! Notifying background worker...');
            chrome.runtime.sendMessage({ type: 'MFA_DETECTED', companyId });
            await waitForMFACompletion();
            console.log('[Sync] MFA completed, resuming steps.');
            chrome.runtime.sendMessage({ type: 'MFA_COMPLETED', companyId });
            await sleep(2000); // Allow page to settle after MFA
        }

        try {
            await executeStep(step, i, steps.length);
        } catch (error) {
            console.error(`[Sync] Step ${i + 1} failed:`, error);
            return {
                success: false,
                error: `Step ${i + 1} (${step.action}) failed: ${error.message}`,
                data: scrapedData
            };
        }
    }

    // Collect any scraped data
    if (window.__agentPortalScrapedData) {
        scrapedData.tables = window.__agentPortalScrapedData;
    }

    // Also try to scrape any visible tables at the end (in case no download step)
    if (scrapedData.tables.length === 0) {
        const finalScrape = scrapeTableData();
        if (finalScrape) {
            scrapedData.tables = finalScrape;
        }
    }

    return {
        success: true,
        data: scrapedData
    };
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_STEPS') {
        console.log(`[Sync] Received ${message.steps.length} steps for ${message.companyId}`);

        executeAllSteps(message.steps, message.companyId)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true; // async response
    }
});

console.log('[AgentPortal Extension] Content script loaded.');
