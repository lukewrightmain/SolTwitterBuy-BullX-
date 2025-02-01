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

// Function to create buttons container
function createButtons(contractAddress) {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        gap: 8px;
        margin: 12px 0;
    `;

    // Quick Buy Button
    const buyButton = document.createElement('button');
    buyButton.className = 'quick-buy-btn';
    buyButton.innerHTML = '🚀 Quick Buy $0.5';
    buyButton.style.cssText = `
        background-color: rgb(29, 155, 240);
        color: rgb(255, 255, 255);
        border: none;
        border-radius: 9999px;
        padding: 6px 16px;
        cursor: pointer;
        font-size: 15px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transition: background-color 0.2s;
    `;
    
    // View on BullX Button
    const viewButton = document.createElement('button');
    viewButton.className = 'view-bullx-btn';
    viewButton.innerHTML = '👀 View on BullX';
    viewButton.style.cssText = buyButton.style.cssText;
    viewButton.style.backgroundColor = 'rgb(83, 100, 113)';
    
    viewButton.onmouseover = () => viewButton.style.backgroundColor = 'rgb(66, 83, 96)';
    viewButton.onmouseout = () => viewButton.style.backgroundColor = 'rgb(83, 100, 113)';
    
    viewButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`https://neo.bullx.io/terminal?chainId=1399811149&address=${contractAddress}`, '_blank');
    };

    // Add the existing buy button functionality
    buyButton.onmouseover = () => buyButton.style.backgroundColor = 'rgb(26, 140, 216)';
    buyButton.onmouseout = () => buyButton.style.backgroundColor = 'rgb(29, 155, 240)';
    
    buyButton.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            const tokens = await getBullXTokens();
            
            // First, get the token info
            const tokenInfoResponse = await fetch(`https://api-neo.bullx.io/secure/api/token/${contractAddress}`, {
                headers: {
                    'Authorization': `Bearer ${tokens.sessionToken}`,
                    'x-cs-token': tokens.csToken
                }
            });
            
            const tokenInfo = await tokenInfoResponse.json();
            log('Token info:', tokenInfo);

            // Calculate amount in SOL units for $0.50
            const priceInUSD = parseFloat(tokenInfo.priceUSD);
            const amountInTokens = 0.50 / priceInUSD;
            const amountInSolUnits = Math.floor(amountInTokens * Math.pow(10, 9)); // Convert to SOL units

            const response = await fetch('https://api-neo.bullx.io/secure/api/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Origin': 'https://neo.bullx.io',
                    'Referer': 'https://neo.bullx.io/',
                    'Authorization': `Bearer ${tokens.sessionToken}`
                },
                body: JSON.stringify({
                    "name": "placeOrderV3",
                    "data": {
                        "chainId": 1399811149,
                        "baseToken": {
                            "address": contractAddress,
                            "name": tokenInfo.name,
                            "symbol": tokenInfo.symbol,
                            "price": tokenInfo.price,
                            "priceUSD": tokenInfo.priceUSD,
                            "decimals": 6,
                            "protocol": "PUMP"
                        },
                        "quoteToken": {
                            "address": "So11111111111111111111111111111111111111112",
                            "decimals": 9
                        },
                        "orderType": "BUY_MARKET_ORDER_V1",
                        "amounts": {
                            [tokenInfo.wallets[0]]: amountInSolUnits.toString()
                        },
                        "wallets": [tokenInfo.wallets[0]],
                        "direction": null,
                        "referrer": "",
                        "sellStrategyId": "e18378e6-4d2d-4779-a091-41c13959d187",
                        "priorityFee": 0.0001,
                        "bribe": 0.0001,
                        "slippage": 30,
                        "isMEVOnly": true,
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
            
            buyButton.innerHTML = '✅ Order placed!';
            setTimeout(() => {
                buyButton.innerHTML = '🚀 Quick Buy $0.5';
            }, 2000);

        } catch (error) {
            console.error('Error placing order:', error);
            buyButton.innerHTML = '❌ Error: ' + error.message;
            setTimeout(() => {
                buyButton.innerHTML = '🚀 Quick Buy $0.5';
            }, 3000);
        }
    };

    container.appendChild(buyButton);
    container.appendChild(viewButton);
    return container;
}

// Helper function to get both tokens at once
async function getBullXTokens() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_BULLX_TOKENS' }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (response.error) {
                reject(new Error(response.error));
                return;
            }

            if (!response.sessionToken || !response.csToken) {
                reject(new Error('Missing tokens. Please make sure you are logged into BullX'));
                return;
            }

            resolve({
                sessionToken: response.sessionToken,
                csToken: response.csToken
            });
        });
    });
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

    // If we found a contract address, add the buttons
    if (contractAddress) {
        log('Adding buttons for contract:', contractAddress);
        const buttons = createButtons(contractAddress);
        
        // Find the best place to insert the buttons
        const tweetText = element.querySelector('[data-testid="tweetText"]');
        const tweetActions = element.querySelector('[role="group"]');
        
        if (tweetText) {
            tweetText.insertAdjacentElement('afterend', buttons);
        } else if (tweetActions) {
            tweetActions.insertAdjacentElement('beforebegin', buttons);
        } else {
            // Fallback - append to the tweet
            element.appendChild(buttons);
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