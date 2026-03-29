/**
 * AgentPortal Carrier Sync - Recorder Content Script
 * 
 * Injected into carrier portal tabs during recording.
 * Captures user interactions (clicks, typing, navigation) and sends
 * them to the background worker as structured step objects.
 */

(() => {
    // Prevent double-injection
    if (window.__agentPortalRecorderActive) return;
    window.__agentPortalRecorderActive = true;

    let lastTimestamp = Date.now();
    let lastPayload = null;

    /**
     * Generate a stable CSS selector for an element
     */
    function getSelector(el) {
        if (el.id) return `#${el.id}`;

        if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;

        // Try data attributes
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (attr.name.startsWith('data-') && attr.value) {
                return `${el.tagName.toLowerCase()}[${attr.name}="${attr.value}"]`;
            }
        }

        // Use tag + class
        let selector = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string') {
            selector += '.' + el.className.trim().split(/\s+/).filter(c => c).join('.');
        }

        // Use nth-of-type as fallback
        if (selector === el.tagName.toLowerCase() && el.parentNode) {
            const siblings = Array.from(el.parentNode.children).filter(
                child => child.tagName === el.tagName
            );
            const index = siblings.indexOf(el) + 1;
            return `${selector}:nth-of-type(${index})`;
        }

        return selector;
    }

    /**
     * Send a recorded step to the background worker
     */
    function recordStep(payload) {
        const now = Date.now();
        payload.delay = now - lastTimestamp;
        lastTimestamp = now;

        // Deduplicate identical consecutive steps
        if (
            lastPayload &&
            lastPayload.action === payload.action &&
            lastPayload.selector === payload.selector &&
            lastPayload.url === payload.url &&
            lastPayload.value === payload.value
        ) {
            return;
        }
        lastPayload = payload;

        chrome.runtime.sendMessage({ type: 'RECORD_STEP', step: payload });
    }

    // --- Click listener ---
    document.addEventListener('click', (e) => {
        let target = e.target;

        // Walk up to find the meaningful interactive element
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

        // Use clickByText for elements where selector might be fragile
        if (
            target.innerText &&
            target.innerText.trim().length > 3 &&
            (target.tagName === 'SPAN' || target.tagName === 'A' || selector.includes(':nth-'))
        ) {
            action = 'clickByText';
            selector = target.tagName.toLowerCase();
            text = target.innerText.trim().substring(0, 50);
        }

        const payload = {
            action,
            selector,
            ...(text && { text }),
            url: window.location.href,
            description: `Click on ${(target.innerText || '').substring(0, 20).trim()}...`,
        };
        recordStep(payload);
    }, { capture: true });

    // --- Input change listener ---
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (
            target.tagName !== 'INPUT' &&
            target.tagName !== 'TEXTAREA' &&
            target.tagName !== 'SELECT'
        ) return;

        const selector = getSelector(target);
        let value = target.value;

        // Mask credentials
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
            action: 'type',
            selector,
            value,
            url: window.location.href,
            description: `Type into ${target.name || selector}`,
        };
        recordStep(payload);
    }, { capture: true });

    // Notify background that recorder is ready
    chrome.runtime.sendMessage({ type: 'RECORDER_READY' });

    console.log('[AgentPortal Recorder] Attached to page.');
})();
