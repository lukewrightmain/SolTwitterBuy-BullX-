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
        align-items: center;
    `;

    // SOL Amount Input - now reads default from storage
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.step = '0.1';
    amountInput.min = '0.1';
    amountInput.style.cssText = `
        width: 70px;
        padding: 6px;
        border: 1px solid rgb(83, 100, 113);
        border-radius: 4px;
        background: transparent;
        color: inherit;
        margin-right: 4px;
    `;
    
    // Load saved settings
    chrome.storage.local.get({
        defaultSolAmount: 0.5,
        priorityFee: 0.0001,
        bribeFee: 0.0001,
        slippage: 30
    }, function(settings) {
        amountInput.value = settings.defaultSolAmount;
    });

    // Buy on BullX Button (previously View button)
    const buyButton = document.createElement('button');
    buyButton.className = 'buy-bullx-btn';
    buyButton.innerHTML = '🚀 Buy on BullX';
    buyButton.style.cssText = `
        background-color: rgb(83, 100, 113);
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
    
    buyButton.onmouseover = () => buyButton.style.backgroundColor = 'rgb(66, 83, 96)';
    buyButton.onmouseout = () => buyButton.style.backgroundColor = 'rgb(83, 100, 113)';
    
    buyButton.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            // Get current settings
            const settings = await chrome.storage.local.get({
                priorityFee: 0.0001,
                bribeFee: 0.0001,
                slippage: 30
            });

            const solAmount = parseFloat(amountInput.value);
            if (isNaN(solAmount) || solAmount <= 0) {
                throw new Error('Please enter a valid SOL amount');
            }

            // Convert SOL to lamports (1 SOL = 1e9 lamports)
            const lamports = Math.floor(solAmount * 1e9).toString();
            
            // First get token info
            const tokenInfoResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                url: `https://api-neo.bullx.io/secure/api/token/${contractAddress}`,
                method: 'GET'
            });

            if (!tokenInfoResponse.success) {
                throw new Error('Failed to get token info');
            }

            const tokenInfo = tokenInfoResponse.data;

            // Prepare order data with more accurate transaction details
            const orderData = {
                method: 'POST',
                url: 'https://api-neo.bullx.io/secure/api/order',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'origin': 'https://neo.bullx.io',
                    'referer': 'https://neo.bullx.io/'
                },
                body: {
                    name: "placeOrderV3",
                    data: {
                        chainId: 1399811149, // Solana mainnet chain ID
                        baseToken: {
                            address: contractAddress,
                            decimals: tokenInfo.decimals || 9,
                            protocol: "RAYDIUM",
                            price: tokenInfo.price,
                            priceUSD: tokenInfo.priceUSD
                        },
                        quoteToken: {
                            address: "So11111111111111111111111111111111111111112", // WSOL address
                            decimals: 9,
                            price: "1",
                            symbol: "WSOL"
                        },
                        orderType: "BUY_MARKET_ORDER_V1",
                        amounts: {
                            "0": lamports // Using the converted lamports amount
                        },
                        wallets: ["0"],
                        direction: "BUY",
                        slippage: settings.slippage,
                        priorityFee: settings.priorityFee,
                        bribe: settings.bribeFee,
                        isMEVOnly: false,
                        burstable: false,
                        maxBurstChunks: 40
                    }
                }
            };

            // Send order request
            const orderResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                ...orderData
            });

            if (orderResponse.success && orderResponse.data?.orderId) {
                // Poll for transaction status with exponential backoff
                let attempts = 0;
                const maxAttempts = 15;
                const pollStatus = async () => {
                    if (attempts >= maxAttempts) {
                        alert('Transaction build timed out. Please check BullX for status.');
                        return;
                    }

                    const statusResponse = await chrome.runtime.sendMessage({
                        type: 'PROXY_REQUEST',
                        url: `https://api-neo.bullx.io/secure/api/order/${orderResponse.data.orderId}`,
                        method: 'GET'
                    });

                    if (statusResponse.success && statusResponse.data?.transaction) {
                        alert(`Order placed successfully for ${solAmount} SOL!`);
                    } else {
                        attempts++;
                        // Exponential backoff: 1s, 2s, 4s, 8s, etc.
                        setTimeout(pollStatus, Math.min(1000 * Math.pow(2, attempts), 10000));
                    }
                };

                pollStatus();
            } else {
                const errorMsg = orderResponse.data?.message || orderResponse.error || 'Unknown error';
                alert('Failed to place order: ' + errorMsg);
            }

        } catch (error) {
            console.error('Error placing order:', error);
            alert('Error placing order: ' + error.message);
        }
    };

    container.appendChild(amountInput);
    container.appendChild(buyButton);
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
    
    // Check for existing buttons using a data attribute
    if (element.getAttribute('data-bullx-processed') === 'true') {
        log('Tweet already processed, skipping');
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

        // Mark the tweet as processed
        element.setAttribute('data-bullx-processed', 'true');
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
    
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-bullx-processed="true"])');
    
    if (tweets.length === 0) {
        log('No new tweets to process');
        return;
    }
    
    log(`Processing ${tweets.length} new tweets...`);
    tweets.forEach((tweet, index) => {
        log(`Processing tweet ${index + 1}/${tweets.length}`);
        processTweet(tweet);
    });
}

// Initialize with less frequent scanning
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
                        const tweets = node.querySelectorAll('article[data-testid="tweet"]:not([data-bullx-processed="true"])');
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
    
    // Reduce periodic scan frequency to every 5 seconds
    setInterval(scanForTweets, 5000);
}

// Run on navigation
window.addEventListener('popstate', () => {
    if (isEnabled) {
        setTimeout(scanForTweets, 500);
    }
});

// Listen for contract addresses in tweets
function findContractAddresses() {
    const tweetTexts = document.querySelectorAll('article[data-testid="tweet"] div[data-testid="tweetText"]');
    
    tweetTexts.forEach(tweet => {
        const text = tweet.textContent;
        // Look for Solana-style addresses (base58 format)
        const matches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
        
        if (matches) {
            matches.forEach(address => {
                // Add "View on BullX" button if not already added
                if (!tweet.closest('article').querySelector('.bullx-button')) {
                    const button = document.createElement('button');
                    button.className = 'bullx-button';
                    button.textContent = 'View on BullX';
                    button.onclick = () => triggerBullXOrder(address);
                    
                    // Insert after the tweet text
                    tweet.parentElement.appendChild(button);
                }
            });
        }
    });
}

// Function to trigger BullX order
async function triggerBullXOrder(contractAddress) {
    try {
        // First get token info
        const tokenInfoResponse = await chrome.runtime.sendMessage({
            type: 'PROXY_REQUEST',
            url: `https://api-neo.bullx.io/secure/api/token/${contractAddress}`,
            method: 'GET'
        });

        if (!tokenInfoResponse.success) {
            throw new Error('Failed to get token info');
        }

        // Prepare order data
        const orderData = {
            method: 'POST',
            url: 'https://api-neo.bullx.io/secure/api/order',
            body: {
                name: "placeOrderV3",
                data: {
                    chainId: 1399811149,
                    baseToken: {
                        address: contractAddress,
                        decimals: tokenInfoResponse.data.decimals || 9,
                        protocol: "RAYDIUM"
                    },
                    quoteToken: {
                        address: "So11111111111111111111111111111111111111112",
                        decimals: 9
                    },
                    orderType: "BUY_MARKET_ORDER_V1",
                    amounts: {
                        "0": "500000000" // 0.5 SOL
                    },
                    wallets: ["0"],
                    slippage: 30,
                    isMEVOnly: true,
                    priorityFee: 0.0001,
                    bribe: 0.0001,
                    burstable: false,
                    maxBurstChunks: 40,
                    language: "en"
                }
            }
        };

        // Send order request
        const orderResponse = await chrome.runtime.sendMessage({
            type: 'PROXY_REQUEST',
            ...orderData
        });

        console.log('Order response:', orderResponse);

        if (orderResponse.success) {
            alert('Order placed successfully!');
        } else {
            alert('Failed to place order: ' + orderResponse.error);
        }

    } catch (error) {
        console.error('Error placing order:', error);
        alert('Error placing order: ' + error.message);
    }
}

// Run when page loads and on navigation
findContractAddresses();

// Watch for new tweets being added
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            findContractAddresses();
        }
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
}); 