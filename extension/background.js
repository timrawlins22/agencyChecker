/**
 * AgentPortal Carrier Sync - Background Service Worker
 * 
 * Orchestrates pattern-based carrier syncing:
 * 1. Fetches patterns from the API
 * 2. Opens background tabs to carrier portals
 * 3. Injects the content script step executor
 * 4. Receives scraped data and uploads to the backend
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- State Management ---
let syncState = {}; // { [companyId]: { status, message, progress } }

/**
 * Get the stored API config (base URL + JWT token)
 */
async function getConfig() {
    const result = await chrome.storage.local.get(['apiBaseUrl', 'token', 'agentInfo']);
    return result;
}

/**
 * Setup offscreen document for fetch proxying
 */
let creatingOffscreen;
async function setupOffscreenDocument(path) {
    if (await chrome.offscreen.hasDocument()) return;
    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_PARSER'],
            justification: 'Fetch API requests to handle self-signed certificates'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
    }
}

/**
 * Make an authenticated API request
 */
async function apiRequest(path, options = {}) {
    const { apiBaseUrl, token } = await getConfig();
    if (!apiBaseUrl || !token) {
        throw new Error('Not logged in. Please configure API URL and token in the popup.');
    }

    const url = `${apiBaseUrl}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };

    await setupOffscreenDocument('offscreen.html');

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'FETCH_PROXY',
            url: url,
            options: { ...options, headers }
        }, response => {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!response) {
                return reject(new Error('No response from offscreen document'));
            }
            if (!response.ok) {
                // Extract error message from the API response body if available
                const errMsg = (response.data && response.data.error) || response.error || `API request failed: ${response.status} ${response.statusText}`;
                return reject(new Error(errMsg));
            }
            resolve(response.data);
        });
    });
}

/**
 * Fetch the list of carriers that have saved patterns
 */
async function fetchCarriers() {
    return apiRequest('/api/mapper/companies');
}

/**
 * Fetch a specific pattern
 */
async function fetchPattern(companyId) {
    return apiRequest(`/api/mapper/patterns/${companyId}`);
}

/**
 * Upload scraped data to the backend
 */
async function uploadSyncData(companyId, data) {
    return apiRequest('/api/mapper/sync/upload', {
        method: 'POST',
        body: JSON.stringify({ companyId, ...data })
    });
}

/**
 * Update sync state and notify the popup
 */
function updateSyncState(companyId, status, message = '', progress = 0) {
    syncState[companyId] = { status, message, progress, timestamp: Date.now() };
    // Notify the popup if it's open
    chrome.runtime.sendMessage({ 
        type: 'SYNC_STATE_UPDATE', 
        companyId, 
        state: syncState[companyId] 
    }).catch(() => {}); // Popup might not be open
}

/**
 * Inject content script and verify it's alive via PING
 */
async function injectAndPing(tabId, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            });
        } catch (e) {
            console.warn(`[Sync] Injection attempt ${i + 1} failed:`, e.message);
            if (i === maxRetries - 1) throw new Error(`Cannot inject content script: ${e.message}`);
            await sleep(2000);
            continue;
        }

        await sleep(500);

        // Verify with PING
        try {
            const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            if (resp && resp.pong) {
                console.log(`[Sync] Content script alive on: ${resp.url}`);
                return true;
            }
        } catch (e) {
            console.warn(`[Sync] PING failed, retrying... (attempt ${i + 1})`);
            await sleep(2000);
        }
    }
    throw new Error('Content script not responding after injection.');
}

/**
 * Main sync function for a single carrier
 */
async function syncCarrier(companyId) {
    let tabId = null;

    try {
        updateSyncState(companyId, 'fetching', 'Fetching pattern...');

        // 1. Fetch the pattern
        const pattern = await fetchPattern(companyId);
        const steps = pattern.steps;

        if (!steps || steps.length === 0) {
            throw new Error('No steps found in pattern.');
        }

        updateSyncState(companyId, 'starting', 'Opening carrier portal...', 10);

        // 2. Find the navigate step to get the start URL
        const navigateStep = steps.find(s => s.action === 'navigate');
        if (!navigateStep || !navigateStep.url) {
            throw new Error('Pattern has no navigate step with a URL.');
        }

        // 3. Find the POST_LOGIN_START marker to determine which steps to skip
        const markerIndex = steps.findIndex(
            s => s.action === 'marker' && s.value === 'POST_LOGIN_START'
        );

        let startIndex = 0;
        let startUrl = navigateStep.url;

        if (markerIndex !== -1) {
            startIndex = markerIndex + 1;
            const preMarkerStep = steps[markerIndex - 1];
            if (preMarkerStep && preMarkerStep.url) {
                startUrl = preMarkerStep.url;
            }
        }

        // 4. Open a background tab
        const tab = await chrome.tabs.create({ url: startUrl, active: false });
        tabId = tab.id;

        await waitForTabLoad(tabId);
        await sleep(2000);

        updateSyncState(companyId, 'running', 'Executing steps...', 30);

        // 5. Inject content script and verify it's alive
        await injectAndPing(tabId);

        // 6. Execute steps ONE BY ONE from the background
        const postLoginSteps = steps.slice(startIndex).filter(s => s.action !== 'marker');
        let allScraped = [];

        for (let i = 0; i < postLoginSteps.length; i++) {
            const step = postLoginSteps[i];
            const progress = 30 + Math.round((i / postLoginSteps.length) * 50);
            updateSyncState(companyId, 'running', `Step ${i + 1}/${postLoginSteps.length}: ${step.action}`, progress);

            if (step.action === 'end_session') break;

            if (step.action === 'navigate') {
                // Background handles navigation directly
                await chrome.tabs.update(tabId, { url: step.url });
                await waitForTabLoad(tabId);
                await sleep(2000);
                // Re-inject content script after navigation
                await injectAndPing(tabId);
                continue;
            }

            // Send single step to content script
            let result;
            try {
                result = await chrome.tabs.sendMessage(tabId, {
                    type: 'EXECUTE_STEP',
                    step: step
                });
            } catch (msgErr) {
                // Content script may have been destroyed by a click that caused navigation
                console.warn(`[Sync] Step ${i + 1} message failed, re-injecting...`, msgErr.message);
                await waitForTabLoad(tabId);
                await sleep(2000);
                await injectAndPing(tabId);

                // Retry the step
                try {
                    result = await chrome.tabs.sendMessage(tabId, {
                        type: 'EXECUTE_STEP',
                        step: step
                    });
                } catch (retryErr) {
                    throw new Error(`Step ${i + 1} (${step.action}) failed after re-injection: ${retryErr.message}`);
                }
            }

            if (!result || !result.success) {
                throw new Error(`Step ${i + 1} (${step.action}) failed: ${result?.error || 'Unknown error'}`);
            }

            // Collect scraped data from download steps
            if (result.scraped) {
                allScraped.push(...result.scraped);
            }
        }

        // 7. Final scrape attempt if no download step captured data
        if (allScraped.length === 0) {
            try {
                await injectAndPing(tabId);
                const scrapeResult = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_TABLES' });
                if (scrapeResult && scrapeResult.scraped) {
                    allScraped = scrapeResult.scraped;
                }
            } catch (e) {
                console.warn('[Sync] Final scrape failed:', e.message);
            }
        }

        // 8. Upload scraped data if we have any
        if (allScraped.length > 0) {
            updateSyncState(companyId, 'uploading', 'Uploading data...', 80);
            await uploadSyncData(companyId, {
                tables: allScraped,
                pageTitle: '',
                url: startUrl
            });
            const totalRows = allScraped.reduce((sum, t) => sum + t.rows.length, 0);
            updateSyncState(companyId, 'success', `Synced ${totalRows} rows!`, 100);
        } else {
            updateSyncState(companyId, 'success', 'Steps completed (no table data found).', 100);
        }

    } catch (error) {
        console.error(`[Sync] Failed for ${companyId}:`, error);
        updateSyncState(companyId, 'error', error.message);
    } finally {
        if (tabId) {
            try { await chrome.tabs.remove(tabId); } catch (e) { /* already closed */ }
        }
    }
}

/**
 * Wait for a tab to finish loading
 */
function waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error('Tab load timed out'));
        }, timeout);

        const listener = (id, changeInfo) => {
            if (id === tabId && changeInfo.status === 'complete') {
                clearTimeout(timer);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };

        chrome.tabs.onUpdated.addListener(listener);
    });
}

// --- Message Handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'SYNC_CARRIER':
            syncCarrier(message.companyId);
            sendResponse({ started: true });
            break;

        case 'SYNC_ALL':
            (async () => {
                try {
                    const carriers = await fetchCarriers();
                    const mapped = carriers.filter(c => c.hasPattern);
                    for (const carrier of mapped) {
                        await syncCarrier(carrier.id);
                    }
                } catch (err) {
                    console.error('[Sync All] Failed:', err);
                }
            })();
            sendResponse({ started: true });
            break;

        case 'GET_SYNC_STATE':
            sendResponse({ syncState });
            break;

        case 'MFA_DETECTED':
            // Bring the tab to the foreground so the agent can enter the code
            (async () => {
                try {
                    // Find the tab for this carrier
                    const tabs = await chrome.tabs.query({});
                    // Update sync state
                    updateSyncState(message.companyId, 'running', 'MFA required — enter your code');
                    
                    // Show a Chrome notification
                    chrome.notifications.create(`mfa-${message.companyId}`, {
                        type: 'basic',
                        iconUrl: 'icons/icon128.png',
                        title: 'MFA Required',
                        message: 'A carrier portal is asking for a verification code. Please check the open tab and enter your code.',
                        priority: 2,
                        requireInteraction: true
                    });

                    // Find and focus the tab (it's the one we opened for this sync)
                    // The tab URL won't match our API URL, so find the non-extension, non-devtools tab
                    // that was most recently created
                    for (const tab of tabs.reverse()) {
                        if (!tab.url.startsWith('chrome') && !tab.url.includes('localhost:')) {
                            await chrome.tabs.update(tab.id, { active: true });
                            if (tab.windowId) {
                                await chrome.windows.update(tab.windowId, { focused: true });
                            }
                            break;
                        }
                    }
                } catch (e) {
                    console.error('[MFA] Failed to foreground tab:', e);
                }
            })();
            sendResponse({ received: true });
            break;

        case 'MFA_COMPLETED':
            updateSyncState(message.companyId, 'running', 'MFA completed, resuming sync...');
            // Dismiss the notification
            chrome.notifications.clear(`mfa-${message.companyId}`);
            sendResponse({ received: true });
            break;

        case 'GET_CARRIERS':
            fetchCarriers()
                .then(carriers => sendResponse({ carriers }))
                .catch(err => sendResponse({ error: err.message }));
            return true; // async response

        case 'LOGIN':
            chrome.storage.local.set({
                apiBaseUrl: message.apiBaseUrl,
                token: message.token,
                agentInfo: message.agentInfo
            }).then(() => sendResponse({ success: true }));
            return true;

        case 'LOGOUT':
            chrome.storage.local.remove(['apiBaseUrl', 'token', 'agentInfo'])
                .then(() => sendResponse({ success: true }));
            return true;

        case 'GET_CONFIG':
            getConfig().then(config => sendResponse(config));
            return true;

        // --- Recording Handlers ---
        case 'START_RECORDING':
            (async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab) throw new Error('No active tab found.');
                    
                    recordingState = {
                        active: true,
                        tabId: tab.id,
                        companyId: message.companyId,
                        steps: [{
                            action: 'navigate',
                            url: tab.url,
                            description: `Navigate to ${tab.url}`,
                            delay: 0
                        }]
                    };

                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['recorder.js']
                    });

                    sendResponse({ success: true, step: recordingState.steps[0] });
                } catch (err) {
                    sendResponse({ error: err.message });
                }
            })();
            return true;

        case 'STOP_RECORDING':
            if (recordingState.active) {
                recordingState.active = false;
                // Remove recorder from tab
                try {
                    chrome.scripting.executeScript({
                        target: { tabId: recordingState.tabId },
                        func: () => { window.__agentPortalRecorderActive = false; }
                    }).catch(() => {});
                } catch (e) {}
            }
            sendResponse({ steps: recordingState.steps });
            break;

        case 'RECORD_STEP':
            if (recordingState.active && message.step) {
                message.step.step = recordingState.steps.length + 1;
                recordingState.steps.push(message.step);
                // Relay to popup
                chrome.runtime.sendMessage({
                    type: 'NEW_RECORDED_STEP',
                    step: message.step
                }).catch(() => {});
            }
            sendResponse({ received: true });
            break;

        case 'RECORDER_READY':
            sendResponse({ received: true });
            break;

        case 'INSERT_MARKER': {
            if (!recordingState.active) {
                sendResponse({ error: 'Not recording.' });
                break;
            }
            const markerStep = {
                step: recordingState.steps.length + 1,
                action: message.action || 'marker',
                value: message.value || 'POST_LOGIN_START',
                url: recordingState.steps[recordingState.steps.length - 1]?.url || '',
                description: message.description || 'Marker step',
                delay: 0
            };
            recordingState.steps.push(markerStep);
            // Relay to popup
            chrome.runtime.sendMessage({
                type: 'NEW_RECORDED_STEP',
                step: markerStep
            }).catch(() => {});
            sendResponse({ success: true, step: markerStep });
            break;
        }

        case 'GET_RECORDING_STATE':
            sendResponse({
                active: recordingState.active,
                steps: recordingState.steps,
                companyId: recordingState.companyId
            });
            return false;

        case 'SAVE_PATTERN':
            (async () => {
                try {
                    const steps = recordingState.steps.filter(s => s && s.action);
                    await apiRequest(`/api/mapper/patterns/${message.companyId}`, {
                        method: 'POST',
                        body: JSON.stringify({ steps })
                    });
                    recordingState = { active: false, tabId: null, companyId: null, steps: [] };
                    sendResponse({ success: true, stepCount: steps.length });
                } catch (err) {
                    sendResponse({ error: err.message });
                }
            })();
            return true;
    }
});

// --- Recording State ---
let recordingState = { active: false, tabId: null, companyId: null, steps: [] };

// Re-inject recorder when the recording tab navigates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (
        recordingState.active &&
        tabId === recordingState.tabId &&
        changeInfo.status === 'complete'
    ) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['recorder.js']
            });
            console.log('[Recorder] Re-injected after navigation to', tab.url);
        } catch (e) {
            console.warn('[Recorder] Failed to re-inject:', e.message);
        }
    }
});

console.log('[AgentPortal Extension] Background service worker loaded.');
