/**
 * Offscreen Document - Fetch Proxy
 * Bypasses MV3 service worker limitations with self-signed certificates
 * by running fetch inside a DOM-enabled extension page.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_PROXY') {
        const { url, options } = message;
        
        // Execute fetch in the offscreen document
        fetch(url, options)
            .then(async (response) => {
                const isJson = response.headers.get('content-type')?.includes('application/json');
                const data = isJson ? await response.json() : await response.text();
                
                sendResponse({
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                });
            })
            .catch(error => {
                sendResponse({
                    ok: false,
                    error: error.message || 'Failed to fetch'
                });
            });
            
        return true; // Keep message channel open for async response
    }
});
