/**
 * AgentPortal Carrier Sync - Popup Script
 * Handles login, carrier listing, sync triggering, and pattern recording.
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

// Recording elements
const recordCompanySelect = document.getElementById('recordCompanySelect');
const startRecordBtn = document.getElementById('startRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const savePatternBtn = document.getElementById('savePatternBtn');
const discardPatternBtn = document.getElementById('discardPatternBtn');
const recordStartArea = document.getElementById('recordStartArea');
const recordActiveArea = document.getElementById('recordActiveArea');
const recordDoneArea = document.getElementById('recordDoneArea');
const recordStatusBar = document.getElementById('recordStatusBar');
const recordStepList = document.getElementById('recordStepList');
const markerLoginBtn = document.getElementById('markerLoginBtn');
const markerDownloadBtn = document.getElementById('markerDownloadBtn');
const markerCookiesBtn = document.getElementById('markerCookiesBtn');
const markerEndBtn = document.getElementById('markerEndBtn');

// --- Tab Switching ---
function switchToTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
    const content = document.getElementById(tabId);
    if (content) content.classList.add('active');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
});

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    const config = await sendMessage({ type: 'GET_CONFIG' });
    
    if (config.token && config.apiBaseUrl) {
        showMainView(config);
        loadCarriers();
        await loadRecordCompanies();
        await checkRecordingState();
    } else {
        showLoginView();
    }

    // Listen for sync state updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'SYNC_STATE_UPDATE') {
            updateCarrierStatus(message.companyId, message.state);
        }
        if (message.type === 'NEW_RECORDED_STEP') {
            addStepToList(message.step);
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
        const response = await fetch(`${apiBaseUrl}/api/agent/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok || !data.token) {
            throw new Error(data.error || 'Login failed');
        }

        await sendMessage({
            type: 'LOGIN',
            apiBaseUrl,
            token: data.token,
            agentInfo: data.agentInfo
        });

        showMainView({ apiBaseUrl, token: data.token, agentInfo: data.agentInfo });
        loadCarriers();
        loadRecordCompanies();

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

// =============================================
// --- RECORDING TAB ---
// =============================================

async function loadRecordCompanies() {
    try {
        const response = await sendMessage({ type: 'GET_CARRIERS' });
        if (response.error || !response.carriers) return;

        recordCompanySelect.innerHTML = '<option value="">Select a carrier...</option>';
        response.carriers.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + (c.hasPattern ? ' (has mapping)' : '');
            recordCompanySelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load companies for recorder:', err);
    }
}

async function checkRecordingState() {
    const state = await sendMessage({ type: 'GET_RECORDING_STATE' });
    if (!state) return;

    if (state.active || (state.steps && state.steps.length > 0)) {
        // Auto-switch to Record tab
        switchToTab('recordTab');

        // Restore carrier selection
        if (state.companyId) {
            recordCompanySelect.value = state.companyId;
        }

        // Restore steps
        recordStepList.innerHTML = '';
        if (state.steps) {
            state.steps.forEach(s => addStepToList(s));
        }

        // Show correct UI state
        if (state.active) {
            showRecordingActive();
        } else {
            showRecordingDone();
        }
    }
}

// Start Recording
startRecordBtn.addEventListener('click', async () => {
    const companyId = recordCompanySelect.value;
    if (!companyId) {
        alert('Please select a carrier first.');
        return;
    }

    startRecordBtn.disabled = true;
    startRecordBtn.textContent = 'Starting...';
    recordStepList.innerHTML = '';

    const result = await sendMessage({ type: 'START_RECORDING', companyId });
    
    if (result.error) {
        alert('Failed to start recording: ' + result.error);
        startRecordBtn.disabled = false;
        startRecordBtn.textContent = '⏺ Start Recording';
        return;
    }

    showRecordingActive();
    if (result.step) {
        addStepToList(result.step);
    }
});

// Stop Recording
stopRecordBtn.addEventListener('click', async () => {
    const result = await sendMessage({ type: 'STOP_RECORDING' });
    showRecordingDone();
});

// Save Pattern
savePatternBtn.addEventListener('click', async () => {
    // Get companyId from dropdown OR from background state (in case popup was reopened)
    let companyId = recordCompanySelect.value;
    if (!companyId) {
        const state = await sendMessage({ type: 'GET_RECORDING_STATE' });
        companyId = state?.companyId;
    }
    if (!companyId) {
        alert('No carrier selected. Please select a carrier.');
        return;
    }

    savePatternBtn.disabled = true;
    savePatternBtn.textContent = 'Saving...';

    const result = await sendMessage({ type: 'SAVE_PATTERN', companyId });
    
    if (result.error) {
        alert('Failed to save: ' + result.error);
        savePatternBtn.disabled = false;
        savePatternBtn.textContent = '💾 Save Pattern';
        return;
    }

    alert(`Pattern saved! ${result.stepCount} steps.`);
    showRecordingIdle();
    recordStepList.innerHTML = '';
    loadCarriers(); // Refresh the sync tab
});

// Discard
discardPatternBtn.addEventListener('click', () => {
    if (!confirm('Discard this recording?')) return;
    sendMessage({ type: 'STOP_RECORDING' });
    showRecordingIdle();
    recordStepList.innerHTML = '';
});

// --- Marker Buttons ---
markerLoginBtn.addEventListener('click', () => {
    sendMessage({
        type: 'INSERT_MARKER',
        action: 'marker',
        value: 'POST_LOGIN_START',
        description: 'Logged-In Start Marker'
    });
});

markerDownloadBtn.addEventListener('click', () => {
    sendMessage({
        type: 'INSERT_MARKER',
        action: 'download',
        value: 'download',
        description: 'Download Expected'
    });
});

markerCookiesBtn.addEventListener('click', () => {
    sendMessage({
        type: 'INSERT_MARKER',
        action: 'save_cookies',
        value: 'save',
        description: 'Save Cookies'
    });
});

markerEndBtn.addEventListener('click', () => {
    sendMessage({
        type: 'INSERT_MARKER',
        action: 'end_session',
        value: 'close',
        description: 'End Flow'
    });
});

// --- Recording UI State ---
function showRecordingActive() {
    recordStartArea.classList.add('hidden');
    recordActiveArea.classList.remove('hidden');
    recordDoneArea.classList.add('hidden');
    recordCompanySelect.disabled = true;
    recordStatusBar.className = 'record-status-bar active';
    recordStatusBar.innerHTML = '<div class="rec-dot"></div> Recording...';
    startRecordBtn.disabled = false;
    startRecordBtn.textContent = '⏺ Start Recording';
}

function showRecordingDone() {
    recordStartArea.classList.add('hidden');
    recordActiveArea.classList.add('hidden');
    recordDoneArea.classList.remove('hidden');
    recordCompanySelect.disabled = true;
    recordStatusBar.className = 'record-status-bar idle';
    recordStatusBar.innerHTML = 'Recording stopped. Save or discard.';
}

function showRecordingIdle() {
    recordStartArea.classList.remove('hidden');
    recordActiveArea.classList.add('hidden');
    recordDoneArea.classList.add('hidden');
    recordCompanySelect.disabled = false;
    recordStatusBar.className = 'record-status-bar idle';
    recordStatusBar.innerHTML = 'Ready to record';
    savePatternBtn.disabled = false;
    savePatternBtn.textContent = '💾 Save Pattern';
}

function addStepToList(step) {
    const div = document.createElement('div');
    const isMarker = step.action === 'marker' || step.action === 'download' || step.action === 'end_session' || step.action === 'save_cookies';
    div.className = `step-item${isMarker ? ' marker-step' : ''}`;
    
    const detail = step.action === 'navigate' 
        ? step.url 
        : step.action === 'type' 
            ? `${step.selector} = ${step.value}` 
            : step.description || step.selector || step.value || '';

    div.innerHTML = `
        <div class="step-num">${step.step || ''}</div>
        <div class="step-action">${step.action}</div>
        <div class="step-detail" title="${detail}">${detail}</div>
    `;
    recordStepList.appendChild(div);
    recordStepList.scrollTop = recordStepList.scrollHeight;
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
