const readline = require('readline');
const db = require('../src/config/db');
const { saveLoginPattern } = require('./patternStorage');
//const { saveCookies } = require('./cookieUtils'); 

/**
 * Creates the floating UI buttons in the browser.
 */
function injectRecorderUI() {
    if (!document.body) {
        console.warn('Document body not yet available for UI injection.');
        return;
    }
    
    if (document.getElementById('recorder-actions')) return; 

    const div = document.createElement('div');
    div.id = 'recorder-actions';
    div.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #333;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 99999;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    div.innerHTML = '<h4>Recorder Actions</h4>';

    const createButton = (text, action, value = null, special = false) => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.cssText = `
            padding: 5px 10px;
            cursor: pointer;
            border: none;
            border-radius: 3px;
            background: ${special ? '#3498db' : '#2ecc71'};
            color: white;
            font-weight: bold;
        `;
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const payload = {
                // REMOVED: step: window._stepCount++
                action: action,
                selector: action, 
                value: value, 
                url: window.location.href,
                description: `${text} action inserted.`,
                delay: 0
            };
            
            console.log('STEP_JSON', JSON.stringify(payload));
        };
        return btn;
    };

    const btnLoginStart = createButton('🔑 Logged-In Start Marker', 'marker', 'POST_LOGIN_START', true);
    div.appendChild(btnLoginStart);
    
    const btnDownload = createButton('⬇️ Download Expected', 'download', 'download', true);
    div.appendChild(btnDownload);

    const btnSaveCookies = createButton('🍪 Save Cookies', 'save_cookies', 'save', false);
    div.appendChild(btnSaveCookies);

    const btnEndFlow = createButton('🛑 END Flow / Close Page', 'end_session', 'close', false);
    div.appendChild(btnEndFlow);

    document.body.appendChild(div);
}


/**
 * Inject recorder listeners into the browser context.
 */
function attachRecorderListeners() {
    if (window.__recordingActive) return;
    window.__recordingActive = true;
    // REMOVED: if (!window._stepCount) window._stepCount = 1;

    let lastTimestamp = Date.now();

    const getSelector = (el) => {
        if (el.id) return `#${el.id}`;
        
        if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;

        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (attr.name.startsWith('data-') && attr.value) {
                return `${el.tagName.toLowerCase()}[${attr.name}="${attr.value}"]`;
            }
        }
        
        let selector = el.tagName.toLowerCase();
        if (el.className)
            selector += '.' + el.className.trim().split(/\s+/).filter(c => c).join('.');
        
        if (selector === el.tagName.toLowerCase() && el.parentNode) {
            const siblings = Array.from(el.parentNode.children).filter(child => child.tagName === el.tagName);
            const index = siblings.indexOf(el) + 1;
            return `${selector}:nth-of-type(${index})`;
        }

        return selector;
    };

    const recordStep = (payload) => {
        const now = Date.now();
        // NOTE: Delay calculation remains in browser, which is correct
        payload.delay = now - lastTimestamp; 
        lastTimestamp = now;

        if (
            window._lastPayload &&
            window._lastPayload.action === payload.action &&
            window._lastPayload.selector === payload.selector &&
            window._lastPayload.url === payload.url &&
            window._lastPayload.value === payload.value
        ) {
            return;
        }
        window._lastPayload = payload;
        // The Node.js listener assigns the step number based on array length
        console.log('STEP_JSON', JSON.stringify(payload));
    };

    // Inject the UI immediately after listener setup
    injectRecorderUI();

    document.addEventListener(
        'click',
        (e) => {
            // If the click originated from our floating UI, stop immediately.
            if (e.target.closest('#recorder-actions')) {
                return;
            }
            
            let target = e.target;
            while (
                target && 
                target !== document.body && 
                target.tagName !== 'A' && 
                target.tagName !== 'BUTTON' && 
                target.tagName !== 'INPUT' &&
                !target.onclick && 
                target.getAttribute('role') !== 'button' && 
                target.getAttribute('role') !== 'link'
            ) {
                if (target.parentElement && (target.parentElement.id || target.parentElement.hasAttribute('data-id'))) {
                    target = target.parentElement;
                    break;
                }
                target = target.parentElement;
            }
            if (!target) return;

            const standardSelector = getSelector(target);
            
            let action = 'click';
            let selector = standardSelector;
            let text = null; 

            if (target.innerText.trim().length > 3 && (target.tagName === 'SPAN' || target.tagName === 'A' || selector.includes(':nth-'))) {
                 action = 'clickByText';
                 selector = target.tagName.toLowerCase(); 
                 text = target.innerText.trim().substring(0, 50); 
            }

            const payload = {
                // REMOVED: step: window._stepCount++
                action: action, 
                selector: selector,
                ...(text && { text: text }), 
                url: window.location.href,
                description: `Click on ${target.innerText.substring(0, 20).trim()}...`,
            };
            recordStep(payload);
        },
        { capture: true }
    );

    document.addEventListener(
        'change',
        (e) => {
            const target = e.target;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && target.tagName !== 'SELECT') return;
            const selector = getSelector(target);
            let value = target.value;

            if (
                selector.toLowerCase().includes('user') ||
                target.name?.toLowerCase().includes('user')
            ) {
                value = '[[USERNAME]]';
            } else if (
                selector.toLowerCase().includes('pass') ||
                target.name?.toLowerCase().includes('pass') ||
                target.name?.toLowerCase().includes('pin')
            ) {
                value = '[[PASSWORD]]';
            }

            const payload = {
                // REMOVED: step: window._stepCount++
                action: 'type',
                selector,
                value,
                url: window.location.href,
                description: `Type into ${target.name || selector}`,
            };
            recordStep(payload);
        },
        { capture: true }
    );

    console.log('[Recorder] Listeners attached (with timing)');
}

// Helper function to safely evaluate code and wait for the DOM
async function safeEvaluateCode(page, browserCode) {
    await page.waitForSelector('body', { timeout: 10000 }).catch(() => {
        console.warn('[Recorder] Body selector not found, attempting injection anyway...');
    });
    
    await page.evaluate(browserCode);
}


/**
 * Start recording session
 */
async function startRecordingSession(browser, connection) {
    const browserCode = `
        ${injectRecorderUI.toString()}
        ${attachRecorderListeners.toString()}
        attachRecorderListeners();
    `;
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const companyName = await new Promise((resolve) => {
        rl.question('Enter the company name: ', (answer) => resolve(answer.trim()));
    });

    const startUrl = await new Promise((resolve) => {
        rl.question('Enter the login/start URL: ', (answer) => resolve(answer.trim()));
    });

    const page = await browser.newPage();
    const recordedSteps = [];
    // REMOVED: stepCount variable is no longer needed here.
    let lastTimestamp = Date.now();

    const recordStep = (step) => {
        // Node.js is now responsible for sequential step numbering
        step.step = recordedSteps.length + 1; 

        // Delay calculation is still done in the browser context via 'STEP_JSON'
        // If the payload from the browser doesn't have a delay, calculate it here
        if (step.delay === undefined) {
             const now = Date.now();
             step.delay = now - lastTimestamp;
             lastTimestamp = now;
        }

        const last = recordedSteps[recordedSteps.length - 1];
        if (
            last &&
            last.action === step.action &&
            last.selector === step.selector &&
            last.url === step.url &&
            last.value === step.value
        ) {
            return; // skip duplicate
        }

        recordedSteps.push(step);
    };

    // Listen for browser console messages
    page.on('console', (msg) => {
        const text = msg.text();
        if (text.startsWith('STEP_JSON')) {
            try {
                const json = JSON.parse(text.replace('STEP_JSON', '').trim());
                
                if (json.action === 'save_cookies') {
                    console.log(`[NODE LOG] Saving current authenticated cookies via UI click for ${companyName}...`);
                    //saveCookies(page, companyName); 
                    return;
                }
                
                recordStep(json);
                console.log(
                    `[BROWSER EVENT] ${json.action.toUpperCase()} ${json.selector} (Step ${recordedSteps.length})`
                );
            } catch (err) {
                console.warn('Failed to parse step JSON:', text);
            }
        }
    });

    // Navigation tracking is simplified to only reattach listeners
    page.on('framenavigated', async (frame) => {
        if (frame !== page.mainFrame()) return;
        
        console.log(`[NODE LOG] Navigation occurred (not recorded): ${frame.url()}`);

        try {
            await safeEvaluateCode(page, browserCode);
        } catch (e) {
            console.error('Failed to reattach recorder listeners:', e.message);
        }
    });


    try {
        // ONLY RECORD THE INITIAL NAVIGATE STEP
        await page.goto(startUrl, { waitUntil: 'networkidle0' });
        recordStep({
            // STEP is assigned by recordStep function
            action: 'navigate',
            url: startUrl,
            description: `Maps to ${startUrl}`,
        });

        await safeEvaluateCode(page, browserCode);

        console.log('------------------------------------------------------------');
        console.log('Recording started. Perform flow sequence.');
        console.log('Press ENTER in this console to stop recording...');

        await new Promise((resolve) => rl.once('line', () => resolve()));
        rl.close();
        
        // INSERT POST-LOGIN MARKER STEP
        recordStep({
            // STEP is assigned by recordStep function
            action: 'marker',
            value: 'POST_LOGIN_START',
            url: recordedSteps[recordedSteps.length - 1]?.url || 'N/A',
            description: 'Marker: All steps before this are part of the initial login flow.',
            delay: 0
        });

        // This is the fallback save cookies action 
        console.log(`[NODE LOG] Final check: Saving authenticated cookies for ${companyName}...`);
        //await saveCookies(page, companyName); 

        const finalSteps = recordedSteps.filter((s) => s && s.action);
        console.log(`Total steps captured: ${finalSteps.length}`);
        console.table(
            finalSteps.map((s) => ({
                step: s.step,
                action: s.action,
                delay: `${s.delay} ms`,
                url: s.url,
            }))
        );

        await saveLoginPattern(connection, finalSteps, companyName);
        console.log(`✅ Pattern successfully saved to DB for company: ${companyName}`);

        return 'SUCCESS';
    } catch (err) {
        console.error('❌ Recording failed:', err);
        throw err;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { startRecordingSession };