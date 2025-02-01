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
                function tryMethod(methodName, fn) {
                    try {
                        const result = fn();
                        console.log(`Method ${methodName}:`, result ? 'Success' : 'Failed');
                        return result;
                    } catch (e) {
                        console.log(`Method ${methodName} failed:`, e);
                        return null;
                    }
                }

                // Collection of different methods to get the token
                const methods = {
                    // Method 1: Direct localStorage
                    directLocalStorage: () => localStorage.getItem('_authToken'),

                    // Method 2: Window localStorage
                    windowLocalStorage: () => window.localStorage.getItem('_authToken'),

                    // Method 3: Parse LoginInfo
                    loginInfo: () => {
                        const loginInfo = localStorage.getItem('LoginInfo');
                        if (loginInfo) {
                            const parsed = JSON.parse(loginInfo);
                            return parsed.token || parsed.authToken;
                        }
                        return null;
                    },

                    // Method 4: Check session storage
                    sessionStorage: () => sessionStorage.getItem('_authToken'),

                    // Method 5: Check for auth in cookies
                    cookies: () => {
                        const match = document.cookie.match(/authToken=([^;]+)/);
                        return match ? match[1] : null;
                    },

                    // Method 6: Check React props
                    reactProps: () => {
                        const nextElement = document.getElementById('__next');
                        return nextElement?._reactRootContainer?._internalRoot?.current?.memoizedState?.element?.props?.pageProps?.token;
                    },

                    // Method 7: Check global window object
                    globalWindow: () => window._authToken,

                    // Method 8: Parse LoginInfo from different format
                    alternateLoginInfo: () => {
                        const info = localStorage.getItem('Logininfo');
                        if (info) {
                            try {
                                const parsed = JSON.parse(info);
                                return parsed.token || parsed.authToken;
                            } catch (e) {
                                return null;
                            }
                        }
                        return null;
                    },

                    // Method 9: Check meta tags
                    metaTags: () => document.querySelector('meta[name="auth-token"]')?.content,

                    // Method 10: Try to find in any localStorage key containing 'token'
                    searchLocalStorage: () => {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key.toLowerCase().includes('token')) {
                                const value = localStorage.getItem(key);
                                if (value && value.startsWith('ey')) { // JWT tokens start with 'ey'
                                    return value;
                                }
                            }
                        }
                        return null;
                    }
                };

                // Try all methods and collect debug info
                const debugInfo = {};
                let token = null;

                for (const [methodName, method] of Object.entries(methods)) {
                    const result = tryMethod(methodName, method);
                    debugInfo[methodName] = !!result;
                    if (result && !token) {
                        token = result;
                        debugInfo.successMethod = methodName;
                    }
                }

                // Additional debug info
                debugInfo.localStorage = Object.keys(localStorage);
                debugInfo.sessionStorage = Object.keys(sessionStorage);
                debugInfo.cookies = document.cookie;
                debugInfo.url = window.location.href;

                if (token) {
                    return {
                        sessionToken: token,
                        debug: debugInfo
                    };
                }

                return {
                    error: 'No auth token found. Please log into BullX.',
                    debug: debugInfo
                };
            }
        });

        console.log('Script execution result:', result);

        if (!result?.[0]?.result || result[0].result.error) {
            console.error('Debug info:', result?.[0]?.result?.debug);
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

// Handle messages from content script
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
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
}); 