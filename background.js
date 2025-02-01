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

// Helper function to get a specific cookie
async function getCookie(name, domain = 'api-neo.bullx.io') {
    return new Promise((resolve) => {
        chrome.cookies.get({
            name: name,
            url: `https://${domain}`
        }, (cookie) => {
            resolve(cookie ? cookie.value : null);
        });
    });
}

// Helper function to store tokens
async function storeTokens(tokens) {
    return new Promise((resolve) => {
        chrome.storage.local.set(tokens, () => {
            console.log('Tokens stored:', tokens);
            resolve();
        });
    });
}

// Modified getBullXTokensFromTab function
async function getBullXTokensFromTab(tab) {
    try {
        // Get all required cookies with exact names from your screenshot
        const [bullxToken, bullxNonceId, bullxVisitorId, bullxCsToken, bullxSessionToken] = await Promise.all([
            getCookie('bullx-token', 'api-neo.bullx.io'),
            getCookie('bullx-nonce-id', 'api-neo.bullx.io'),
            getCookie('bullx-visitor-id', 'api-neo.bullx.io'),
            getCookie('bullx-cs-token', 'api-neo.bullx.io'),
            getCookie('bullx-session-token', 'api-neo.bullx.io')
        ]);

        // If bullxToken is null, use bullxSessionToken as fallback
        const tokens = {
            bullxToken: bullxToken || bullxSessionToken, // Use session token if token is null
            bullxNonceId,
            bullxVisitorId,
            bullxCsToken,
            bullxSessionToken
        };

        console.log('Got cookies:', tokens);

        // Check for required tokens
        if (!tokens.bullxCsToken || !(tokens.bullxToken || tokens.bullxSessionToken)) {
            console.error('Missing required cookies');
            return false;
        }

        // Store tokens using chrome.storage.local
        await storeTokens(tokens);

        return tokens;

    } catch (error) {
        console.error('Error getting tokens:', error);
        return false;
    }
}

// Add this to your existing background.js
async function makeProxiedRequest(url, options) {
    try {
        // Get fresh tokens before making request
        const tokens = await getBullXTokensFromTab(await findBullXTab());
        if (!tokens) {
            throw new Error('Failed to get required tokens');
        }

        console.log('Making proxied request to:', url);
        
        // Match exact headers from working cURL request
        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.6',
            'authorization': options.headers?.Authorization,
            'content-type': 'text/plain',
            'cookie': `bullx-token=${tokens.bullxToken}; bullx-nonce-id=${tokens.bullxNonceId}; bullx-visitor-id=${tokens.bullxVisitorId}; bullx-cs-token=${tokens.bullxCsToken}; bullx-session-token=${tokens.bullxSessionToken}`,
            'origin': 'https://neo.bullx.io',
            'priority': 'u=1, i',
            'referer': 'https://neo.bullx.io/',
            'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Brave";v="132"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'x-cs-token': tokens.bullxCsToken
        };

        const requestOptions = {
            method: options.method || 'GET',
            headers,
            credentials: 'include'
        };

        // For POST requests, ensure body matches exactly
        if (options.method === 'POST' && options.body) {
            requestOptions.body = JSON.stringify({
                name: "placeOrderV3",
                data: {
                    chainId: 1399811149,
                    baseToken: options.body.data.baseToken,
                    quoteToken: options.body.data.quoteToken,
                    orderType: "BUY_MARKET_ORDER_V1",
                    amounts: options.body.data.amounts,
                    wallets: options.body.data.wallets,
                    slippage: 30,
                    isMEVOnly: true,
                    priorityFee: 0.0001,
                    bribe: 0.0001,
                    burstable: false,
                    maxBurstChunks: 40,
                    language: "en"
                }
            });
        }

        console.log('Request options:', {
            url,
            method: requestOptions.method,
            headers: requestOptions.headers,
            body: requestOptions.body
        });

        const response = await fetch(url, requestOptions);
        console.log('Response status:', response.status);
        
        const responseText = await response.text();
        console.log('Response:', responseText);

        try {
            return { success: true, data: JSON.parse(responseText) };
        } catch (e) {
            return { success: true, data: responseText };
        }

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
        makeProxiedRequest(request.url, request)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
}); 