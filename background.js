console.log('Background script loaded');

// Helper function to find BullX tab
async function findBullXTab() {
    return new Promise((resolve) => {
        chrome.windows.getAll({ populate: true }, (windows) => {
            for (const window of windows) {
                for (const tab of window.tabs) {
                    if (tab.url && tab.url.includes('bullx.io')) {
                        console.log('Found BullX tab:', tab);
                        resolve(tab);
                        return;
                    }
                }
            }
            resolve(null);
        });
    });
}

// Helper function to get tokens from BullX tab
async function getBullXTokensFromTab(tab) {
    console.log('Getting tokens from tab:', tab.url);
    
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    // Log all storage for debugging
                    console.log('LocalStorage keys:', Object.keys(localStorage));
                    
                    // Direct approach - get _authToken
                    const authToken = localStorage.getItem('_authToken');
                    console.log('Found authToken:', !!authToken);

                    if (!authToken) {
                        // Try to find any token in localStorage
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            const value = localStorage.getItem(key);
                            if (value && value.startsWith('eyJ')) {
                                console.log('Found token in key:', key);
                                return {
                                    sessionToken: value,
                                    debug: { source: key }
                                };
                            }
                        }
                        
                        return {
                            error: 'No auth token found. Please log into BullX.',
                            debug: {
                                localStorage: Object.keys(localStorage),
                                cookies: document.cookie
                            }
                        };
                    }

                    return {
                        sessionToken: authToken,
                        debug: {
                            source: '_authToken',
                            hasToken: true
                        }
                    };
                } catch (e) {
                    console.error('Error in token extraction:', e);
                    return { error: e.message };
                }
            }
        });

        console.log('Script execution result:', result);

        if (!result?.[0]?.result || result[0].result.error) {
            throw new Error(result[0]?.result?.error || 'Failed to get token');
        }

        return {
            sessionToken: result[0].result.sessionToken,
            csToken: 'default-cs-token'
        };

    } catch (error) {
        console.error('Error getting tokens:', error);
        throw error;
    }
}

// Add this to your existing background.js
async function makeProxiedRequest(url, options) {
    try {
        console.log('Making proxied request to:', url);
        console.log('Request options:', JSON.stringify(options, null, 2));

        // For order request (POST)
        if (options.method === 'POST') {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': options.headers.Authorization,
                    'Accept': '*/*',
                    'Content-Type': 'text/plain',
                    'Origin': 'https://neo.bullx.io',
                    'Referer': 'https://neo.bullx.io/',
                    'Connection': 'keep-alive'
                },
                body: JSON.stringify({
                    "name": "placeOrderV3",
                    "data": {
                        "chainId": 1399811149,
                        "baseToken": {
                            "address": options.body.data.baseToken.address,
                            "decimals": 6,
                            "protocol": "PUMP"
                        },
                        "quoteToken": {
                            "address": "So11111111111111111111111111111111111111112",
                            "decimals": 9
                        },
                        "orderType": "BUY_MARKET_ORDER_V1",
                        "amounts": {
                            "0": "500000000" // Fixed amount in SOL units (0.5 SOL)
                        },
                        "wallets": ["0"],
                        "slippage": 30,
                        "isMEVOnly": true,
                        "priorityFee": 0.0001,
                        "bribe": 0.0001,
                        "burstable": false,
                        "maxBurstChunks": 40,
                        "language": "en"
                    }
                }),
                credentials: 'include'
            });

            console.log('Order response status:', response.status);
            const responseText = await response.text();
            console.log('Order response:', responseText);

            try {
                const data = JSON.parse(responseText);
                return { success: true, data };
            } catch (e) {
                return { success: true, data: responseText };
            }
        }

        // For GET requests (token info)
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                ...options.headers,
                'Accept': '*/*',
                'Content-Type': 'text/plain',
                'Origin': 'https://neo.bullx.io',
                'Referer': 'https://neo.bullx.io/'
            },
            credentials: 'include'
        });

        const data = await response.json();
        return { success: true, data };

    } catch (error) {
        console.error('Proxy request failed:', error);
        return { success: false, error: error.message };
    }
}

async function refreshBullXToken(refreshToken) {
    try {
        const response = await fetch('https://securetoken.googleapis.com/v1/token?key=bsg-v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=refresh_token&refresh_token=${refreshToken}`
        });

        const data = await response.json();
        if (data.access_token) {
            return data.access_token;
        }
        throw new Error('Failed to refresh token');
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

// Update your message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_BULLX_TOKENS') {
        (async () => {
            try {
                const bullxTab = await findBullXTab();
                if (!bullxTab) {
                    throw new Error('Please open BullX in another tab first');
                }
                
                const tokens = await getBullXTokensFromTab(bullxTab);
                console.log('Got tokens:', tokens);
                sendResponse(tokens);
                
            } catch (error) {
                console.error('Error:', error);
                sendResponse({ error: error.message });
            }
        })();
        
        return true; // Keep the message channel open
    }
    else if (request.type === 'PROXY_REQUEST') {
        (async () => {
            const result = await makeProxiedRequest(request.url, request.options);
            sendResponse(result);
        })();
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
}); 