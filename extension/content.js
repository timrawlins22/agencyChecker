/**
 * AgentPortal Carrier Sync - Content Script Step Executor
 * 
 * Injected into carrier portal tabs by the background worker.
 * Executes ONE step at a time (called by background for each step).
 * After navigation steps, the background re-injects this script.
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
 */
function scrapeTableData() {
    const tables = document.querySelectorAll('table');
    if (tables.length === 0) return null;

    const results = [];

    for (const table of tables) {
        const headers = [];
        const rows = [];

        const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th');
        headerCells.forEach(cell => {
            const cleanText = cell.innerText.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
            headers.push(cleanText);
        });

        if (headers.length === 0) {
            const firstRow = table.querySelector('tr');
            if (firstRow) {
                firstRow.querySelectorAll('th, td').forEach(cell => {
                    const cleanText = cell.innerText.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
                    headers.push(cleanText);
                });
            }
        }

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
 * Execute a single step. Returns result immediately.
 */
async function executeStep(step) {
    console.log(`[Sync] Executing: ${step.action} → ${step.selector || step.url || step.text || ''}`);

    switch (step.action) {
        case 'navigate':
            // Background handles navigation directly — this shouldn't be called
            // But just in case, return a signal
            return { navigated: true, url: step.url };

        case 'click': {
            const el = await waitForSelector(step.selector);
            await sleep(500);
            el.click();
            await sleep(1000);
            return { done: true };
        }

        case 'clickByText': {
            const el = await waitForText(step.selector, step.text);
            await sleep(500);
            el.click();
            await sleep(1000);
            return { done: true };
        }

        case 'type': {
            const el = await waitForSelector(step.selector);
            if (step.value === '[[USERNAME]]' || step.value === '[[PASSWORD]]') {
                console.log(`[Sync] Skipping credential field: ${step.selector}`);
                return { done: true };
            }
            simulateType(el, step.value);
            return { done: true };
        }

        case 'download': {
            console.log('[Sync] Download step → scraping visible table data...');
            await sleep(3000);
            const scraped = scrapeTableData();
            if (scraped) {
                console.log(`[Sync] Scraped ${scraped.reduce((sum, t) => sum + t.rows.length, 0)} rows from ${scraped.length} table(s)`);
                return { done: true, scraped: scraped };
            } else {
                console.warn('[Sync] No table data found on page');
                return { done: true, scraped: null };
            }
        }

        case 'wait_selector': {
            await waitForSelector(step.selector, 30000);
            return { done: true };
        }

        case 'wait_time': {
            const ms = parseInt(step.value);
            if (!isNaN(ms)) await sleep(ms);
            return { done: true };
        }

        case 'end_session':
            return { done: true, ended: true };

        case 'save_cookies':
            return { done: true };

        default:
            console.warn(`[Sync] Unknown action: ${step.action}, skipping.`);
            return { done: true };
    }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
        sendResponse({ pong: true, url: window.location.href });
        return false;
    }

    if (message.type === 'EXECUTE_STEP') {
        executeStep(message.step)
            .then(result => sendResponse({ success: true, ...result }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // async response
    }

    if (message.type === 'SCRAPE_TABLES') {
        const scraped = scrapeTableData();
        sendResponse({ success: true, scraped: scraped });
        return false;
    }

    if (message.type === 'CHECK_MFA') {
        sendResponse({ mfa: detectMFA() });
        return false;
    }
});

console.log('[AgentPortal Extension] Content script loaded on', window.location.href);
