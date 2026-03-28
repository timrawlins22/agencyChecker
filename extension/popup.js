/**
 * AgentPortal Carrier Sync - Popup Script
 * Handles login, carrier listing, and sync triggering.
 */

// --- DOM Elements ---
const loginView = document.getElementById('loginView');
const mainView = document.getElementById('mainView');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const apiUrlInput = document.getElementById('apiUrl');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const agentName = document.getElementById('agentName');
const carrierList = document.getElementById('carrierList');
const syncAllBtn = document.getElementById('syncAllBtn');
const mappedCount = document.getElementById('mappedCount');

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    const config = await sendMessage({ type: 'GET_CONFIG' });
    
    if (config.token && config.apiBaseUrl) {
        showMainView(config);
        loadCarriers();
    } else {
        showLoginView();
    }

    // Listen for sync state updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'SYNC_STATE_UPDATE') {
            updateCarrierStatus(message.companyId, message.state);
        }
    });
});

// --- Login ---
loginBtn.addEventListener('click', async () => {
    const apiBaseUrl = apiUrlInput.value.trim().replace(/\/$/, '');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!apiBaseUrl || !username || !password) {
        showError('Please fill in all fields.');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    hideError();

    try {
        // Call the backend login API directly
        const response = await fetch(`${apiBaseUrl}/api/agent/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok || !data.token) {
            throw new Error(data.error || 'Login failed');
        }

        // Store credentials in background
        await sendMessage({
            type: 'LOGIN',
            apiBaseUrl,
            token: data.token,
            agentInfo: data.agentInfo
        });

        showMainView({ apiBaseUrl, token: data.token, agentInfo: data.agentInfo });
        loadCarriers();

    } catch (err) {
        if (err.message === 'Failed to fetch') {
            showError(`Can't reach the server. If using HTTPS with a self-signed certificate, open ${apiBaseUrl} in your browser first and accept the certificate, then try again.`);
        } else {
            showError(err.message);
        }
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
});

// --- Logout ---
logoutBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'LOGOUT' });
    showLoginView();
});

// --- Sync All ---
syncAllBtn.addEventListener('click', () => {
    sendMessage({ type: 'SYNC_ALL' });
    syncAllBtn.disabled = true;
    syncAllBtn.textContent = 'Syncing...';
    setTimeout(() => {
        syncAllBtn.disabled = false;
        syncAllBtn.textContent = 'Sync All';
    }, 5000);
});

// --- Load Carriers ---
async function loadCarriers() {
    try {
        const response = await sendMessage({ type: 'GET_CARRIERS' });
        
        if (response.error) {
            carrierList.innerHTML = `<p style="font-size: 12px; color: #dc2626; padding: 8px;">Error: ${response.error}</p>`;
            return;
        }

        const carriers = response.carriers;
        const mapped = carriers.filter(c => c.hasPattern);
        mappedCount.textContent = `${mapped.length} of ${carriers.length} carriers mapped`;

        if (carriers.length === 0) {
            carrierList.innerHTML = '<p style="font-size: 12px; color: #94a3b8; text-align: center; padding: 16px;">No carriers configured.</p>';
            return;
        }

        carrierList.innerHTML = carriers.map(carrier => `
            <div class="carrier-item" data-company-id="${carrier.id}">
                <div class="carrier-info">
                    <div class="carrier-name">${carrier.name}</div>
                    <div class="carrier-status ${carrier.hasPattern ? 'mapped' : 'unmapped'}" id="status-${carrier.id}">
                        ${carrier.hasPattern ? '✓ Mapped' : '○ No mapping'}
                    </div>
                </div>
                ${carrier.hasPattern ? `
                    <button class="btn btn-sync" data-sync="${carrier.id}">
                        Sync Now
                    </button>
                ` : ''}
            </div>
        `).join('');

        // Attach sync button handlers
        document.querySelectorAll('[data-sync]').forEach(btn => {
            btn.addEventListener('click', () => {
                const companyId = btn.dataset.sync;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span>';
                sendMessage({ type: 'SYNC_CARRIER', companyId });
            });
        });

        // Get current sync states
        const { syncState } = await sendMessage({ type: 'GET_SYNC_STATE' });
        if (syncState) {
            Object.entries(syncState).forEach(([companyId, state]) => {
                updateCarrierStatus(companyId, state);
            });
        }

    } catch (err) {
        carrierList.innerHTML = `<p style="font-size: 12px; color: #dc2626; padding: 8px;">Failed to load carriers.</p>`;
    }
}

// --- Update Carrier Status ---
function updateCarrierStatus(companyId, state) {
    const statusEl = document.getElementById(`status-${companyId}`);
    const syncBtn = document.querySelector(`[data-sync="${companyId}"]`);
    if (!statusEl) return;

    switch (state.status) {
        case 'fetching':
        case 'starting':
        case 'running':
        case 'uploading':
            statusEl.className = 'carrier-status syncing';
            statusEl.innerHTML = `<span class="spinner" style="margin-right: 4px;"></span> ${state.message}`;
            if (syncBtn) { syncBtn.disabled = true; syncBtn.innerHTML = '<span class="spinner"></span>'; }
            break;

        case 'success':
            statusEl.className = 'carrier-status success';
            statusEl.textContent = `✓ ${state.message}`;
            if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = 'Sync Now'; }
            break;

        case 'error':
            statusEl.className = 'carrier-status error';
            statusEl.textContent = `✗ ${state.message}`;
            if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = 'Retry'; }
            break;
    }
}

// --- Helpers ---
function showLoginView() {
    loginView.classList.remove('hidden');
    mainView.classList.add('hidden');
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Not connected';
}

function showMainView(config) {
    loginView.classList.add('hidden');
    mainView.classList.remove('hidden');
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected';
    agentName.textContent = config.agentInfo?.name || config.agentInfo?.username || 'Agent';
}

function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
}

function hideError() {
    loginError.classList.add('hidden');
}

function sendMessage(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
    });
}
