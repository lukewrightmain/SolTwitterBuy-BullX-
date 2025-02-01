// Immediate logging when script loads
console.log('🌟 Solana Quick Buy Extension Loading...');
window.addEventListener('load', () => {
    console.log('🌟 Page fully loaded');
});

// Debug logging
const DEBUG = true;
function log(...args) {
    console.log('🚀 [Solana Quick Buy]:', ...args);  // Removed DEBUG check to ensure logging
}

// Log that we're starting
log('Extension script starting...');

let isEnabled = false;

// Check initial state
try {
    chrome.storage.local.get(['enabled'], function(result) {
        log('Extension state loaded:', result);
        isEnabled = result.enabled ?? false;
        log('Extension is:', isEnabled ? 'ENABLED' : 'DISABLED');
        if (isEnabled) {
            log('🚀 Initializing extension...');
            initialize();
        }
    });
} catch (error) {
    console.error('Error accessing chrome storage:', error);
}

// Listen for toggle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ('enabled' in message) {
        isEnabled = message.enabled;
        if (isEnabled) {
            initialize();
        } else {
            // Remove all quick buy buttons
            document.querySelectorAll('.quick-buy-btn').forEach(btn => btn.remove());
        }
    }
});

// Regular expression to match Solana contract addresses
const solanaAddressRegex = /(?:\/spot\/)?([1-9A-HJ-NP-Za-km-z]{32,44})/;

// Function to create buy button
function createBuyButton(contractAddress) {
    const button = document.createElement('button');
    button.className = 'quick-buy-btn';
    button.innerHTML = '🚀 Quick Buy $0.5';
    button.style.cssText = `
        background-color: rgb(29, 155, 240);
        color: rgb(255, 255, 255);
        border: none;
        border-radius: 9999px;
        padding: 6px 16px;
        margin: 12px 0;
        cursor: pointer;
        font-size: 15px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transition: background-color 0.2s;
        display: block;
        width: fit-content;
    `;
    
    button.onmouseover = () => button.style.backgroundColor = 'rgb(26, 140, 216)';
    button.onmouseout = () => button.style.backgroundColor = 'rgb(29, 155, 240)';
    
    button.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            const authToken = await getBullXToken();
            const csToken = await getCSToken();
            
            if (!authToken || !csToken) {
                throw new Error('Missing authentication tokens. Please make sure you are logged into BullX.');
            }

            log('Using tokens:', { authToken: authToken.substring(0, 10) + '...', csToken: csToken.substring(0, 10) + '...' });

            const response = await fetch('https://api-neo.bullx.io/secure/api/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Origin': 'https://neo.bullx.io',
                    'Referer': 'https://neo.bullx.io/',
                    'Authorization': `Bearer ${authToken}`,
                    'x-cs-token': csToken,
                    'Cookie': `bullx-session-token=${authToken}; bullx-cs-token=${csToken}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    "name": "placeOrderV3",
                    "data": {
                        "chainId": 1399811149,
                        "baseToken": {
                            "address": contractAddress,
                            "decimals": 6,
                            "protocol": "PUMP"
                        },
                        "quoteToken": {
                            "address": "So11111111111111111111111111111111111111112",
                            "decimals": 9
                        },
                        "orderType": "BUY_MARKET_ORDER_V1",
                        "slippage": 30,
                        "isMEVOnly": true,
                        "priorityFee": 0.0001,
                        "bribe": 0.0001,
                        "burstable": false,
                        "maxBurstChunks": 40,
                        "language": "en"
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            button.innerHTML = '✅ Order placed!';
            setTimeout(() => {
                button.innerHTML = '🚀 Quick Buy $0.5';
            }, 2000);

        } catch (error) {
            console.error('Error placing order:', error);
            button.innerHTML = '❌ Error: ' + error.message;
            setTimeout(() => {
                button.innerHTML = '🚀 Quick Buy $0.5';
            }, 3000);
        }
    };
    
    return button;
}

// Helper function to get BullX token from the open tab
async function getBullXToken() {
    try {
        // Get all tabs
        const tabs = await chrome.tabs.query({url: "https://neo.bullx.io/*"});
        
        if (tabs.length === 0) {
            throw new Error('Please open BullX in another tab first');
        }
        
        // Execute script in the BullX tab to get the token
        const result = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                // Get token from localStorage
                const token = localStorage.getItem('bullx-token');
                // Get bearer token from the page
                const bearerToken = document.querySelector('meta[name="bearer-token"]')?.content;
                return { token, bearerToken };
            }
        });
        
        log('Token result:', result);
        
        if (!result?.[0]?.result?.token) {
            throw new Error('Could not get auth token. Please log into BullX');
        }
        
        return result[0].result.token;
    } catch (error) {
        log('Error getting BullX token:', error);
        throw error;
    }
}

// Helper function to get CS token
async function getCSToken() {
    try {
        // Get all tabs
        const tabs = await chrome.tabs.query({url: "https://neo.bullx.io/*"});
        
        if (tabs.length === 0) {
            throw new Error('Please open BullX in another tab first');
        }
        
        // Execute script in the BullX tab to get the token
        const result = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                // Try to get from cookie
                const csToken = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('bullx-cs-token='))
                    ?.split('=')[1];
                    
                // Also try to get from meta tag
                const metaToken = document.querySelector('meta[name="cs-token"]')?.content;
                
                return { csToken, metaToken };
            }
        });
        
        log('CS Token result:', result);
        
        const token = result?.[0]?.result?.csToken || result?.[0]?.result?.metaToken;
        
        if (!token) {
            throw new Error('Could not get CS token. Please log into BullX');
        }
        
        return token;
    } catch (error) {
        log('Error getting CS token:', error);
        throw error;
    }
}

// Function to process a tweet
function processTweet(element) {
    if (!isEnabled) {
        log('Extension disabled, skipping tweet');
        return;
    }
    
    // Don't process if already processed
    if (element.querySelector('.quick-buy-btn')) {
        log('Tweet already processed');
        return;
    }

    // Try to get contract address from multiple sources
    let contractAddress = null;

    // 1. Try to get from tweet URL if it exists
    const tweetUrl = element.querySelector('a[href*="/status/"]')?.href;
    log('Tweet URL:', tweetUrl);
    
    // 2. Try to get from any links in the tweet
    const links = element.querySelectorAll('a[href*="bullx.io"]');
    links.forEach(link => {
        const href = link.href;
        log('Found BullX link:', href);
        const match = href.match(/\/spot\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (match) {
            contractAddress = match[1];
            log('Found contract address in link:', contractAddress);
        }
    });

    // 3. Try to get from tweet text as fallback
    if (!contractAddress) {
        const tweetText = element.querySelector('[data-testid="tweetText"]');
        if (tweetText) {
            const text = tweetText.textContent;
            log('Processing tweet text:', text);
            const matches = text.match(solanaAddressRegex);
            if (matches) {
                contractAddress = matches[0];
                log('Found contract address in text:', contractAddress);
            }
        }
    }

    // If we found a contract address, add the button
    if (contractAddress) {
        log('Adding button for contract:', contractAddress);
        const button = createBuyButton(contractAddress);
        
        // Find the best place to insert the button
        const tweetText = element.querySelector('[data-testid="tweetText"]');
        const tweetActions = element.querySelector('[role="group"]');
        
        if (tweetText) {
            tweetText.insertAdjacentElement('afterend', button);
        } else if (tweetActions) {
            tweetActions.insertAdjacentElement('beforebegin', button);
        } else {
            // Fallback - append to the tweet
            element.appendChild(button);
        }
    } else {
        log('No contract address found in tweet');
    }
}

// Function to scan for tweets
function scanForTweets() {
    if (!isEnabled) {
        log('Extension disabled, skipping scan');
        return;
    }
    
    log('🔍 Starting tweet scan...');
    
    // Try multiple selectors
    const tweetSelectors = [
        'article[data-testid="tweet"]',
        '[data-testid="tweetText"]',
        '.css-175oi2r' // Twitter's container class
    ];
    
    tweetSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        log(`Found ${elements.length} elements with selector: ${selector}`);
    });

    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    
    if (tweets.length === 0) {
        log('⚠️ No tweets found!');
        // Log the entire HTML to help debug
        log('Current page HTML:', document.body.innerHTML.substring(0, 500) + '...');
        return;
    }
    
    log(`Processing ${tweets.length} tweets...`);
    tweets.forEach((tweet, index) => {
        log(`Processing tweet ${index + 1}/${tweets.length}`);
        processTweet(tweet);
    });
}

// Initialize
function initialize() {
    log('Initializing...');
    
    // Create observer for new tweets
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches('article[data-testid="tweet"]')) {
                        processTweet(node);
                    } else {
                        // Check if the added node contains tweets
                        const tweets = node.querySelectorAll('article[data-testid="tweet"]');
                        tweets.forEach(processTweet);
                    }
                }
            });
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial scan
    setTimeout(scanForTweets, 1000);
    
    // Periodic scan every 2 seconds
    setInterval(scanForTweets, 2000);
}

// Run on navigation
window.addEventListener('popstate', () => {
    if (isEnabled) {
        setTimeout(scanForTweets, 500);
    }
}); 