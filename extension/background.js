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

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API request failed: ${response.status}`);
    }

    return response.json();
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
        //    (Agent is already logged in via their browser cookies)
        const markerIndex = steps.findIndex(
            s => s.action === 'marker' && s.value === 'POST_LOGIN_START'
        );

        // If there's a marker, skip login steps and go to the post-login URL
        let startIndex = 0;
        let startUrl = navigateStep.url;

        if (markerIndex !== -1) {
            startIndex = markerIndex + 1;
            // Use the URL from the step right before the marker
            const preMarkerStep = steps[markerIndex - 1];
            if (preMarkerStep && preMarkerStep.url) {
                startUrl = preMarkerStep.url;
            }
        }

        // 4. Open a background tab
        const tab = await chrome.tabs.create({ url: startUrl, active: false });
        tabId = tab.id;

        // Wait for the tab to fully load
        await waitForTabLoad(tabId);
        await sleep(2000); // Extra buffer for JS-heavy pages

        updateSyncState(companyId, 'running', 'Executing steps...', 30);

        // 5. Inject and execute the content script
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });

        // 6. Send the steps to the content script
        const postLoginSteps = steps.slice(startIndex).filter(s => s.action !== 'marker');
        
        const result = await chrome.tabs.sendMessage(tabId, {
            type: 'EXECUTE_STEPS',
            steps: postLoginSteps,
            companyId: companyId
        });

        updateSyncState(companyId, 'uploading', 'Uploading data...', 80);

        // 7. Upload scraped data to the backend
        if (result && result.data) {
            await uploadSyncData(companyId, result.data);
        }

        updateSyncState(companyId, 'success', `Synced successfully!`, 100);

    } catch (error) {
        console.error(`[Sync] Failed for ${companyId}:`, error);
        updateSyncState(companyId, 'error', error.message);
    } finally {
        // 8. Close the background tab
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
    }
});

console.log('[AgentPortal Extension] Background service worker loaded.');
