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
        gap: 12px;
        margin: 12px 0;
        align-items: center;
    `;

    // Buy on BullX Button
    const buyButton = document.createElement('button');
    buyButton.className = 'bullx-btn buy-btn';
    
    // Get the default amount from storage to display on the button
    chrome.storage.local.get({
        defaultSolAmount: 0.5,
    }, function(settings) {
        buyButton.innerHTML = `🚀 Buy ${settings.defaultSolAmount} SOL`;
    });

    // View on BullX Button
    const viewButton = document.createElement('button');
    viewButton.className = 'bullx-btn view-btn';
    viewButton.innerHTML = '👀 View on BullX';

    // Shared button styles
    const buttonStyles = `
        .bullx-btn {
            background: linear-gradient(135deg, #1da1f2 0%, #1a91da 100%);
            color: white;
            border: none;
            border-radius: 9999px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: all 0.3s ease;
            box-shadow: 0 2px 5px rgba(29, 161, 242, 0.2);
            position: relative;
            overflow: hidden;
        }

        .bullx-btn:before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.2),
                transparent
            );
            transition: 0.5s;
        }

        .bullx-btn:hover:before {
            left: 100%;
        }

        .bullx-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(29, 161, 242, 0.3);
            background: linear-gradient(135deg, #1a91da 0%, #1577b5 100%);
        }

        .bullx-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 5px rgba(29, 161, 242, 0.2);
        }

        .buy-btn {
            background: linear-gradient(135deg, #00c853 0%, #009624 100%);
            box-shadow: 0 2px 5px rgba(0, 200, 83, 0.2);
        }

        .buy-btn:hover {
            background: linear-gradient(135deg, #009624 0%, #007722 100%);
            box-shadow: 0 4px 10px rgba(0, 200, 83, 0.3);
        }

        .view-btn {
            background: linear-gradient(135deg, #6200ea 0%, #4a148c 100%);
            box-shadow: 0 2px 5px rgba(98, 0, 234, 0.2);
        }

        .view-btn:hover {
            background: linear-gradient(135deg, #4a148c 0%, #311b92 100%);
            box-shadow: 0 4px 10px rgba(98, 0, 234, 0.3);
        }
    `;

    // Add styles to document
    if (!document.querySelector('#bullx-button-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'bullx-button-styles';
        styleSheet.textContent = buttonStyles;
        document.head.appendChild(styleSheet);
    }

    // View button click handler
    viewButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`https://neo.bullx.io/terminal?chainId=1399811149&address=${contractAddress}`, '_blank');
    };

    // Buy button click handler
    buyButton.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            // Get current settings
            const settings = await chrome.storage.local.get({
                defaultSolAmount: 0.5,
                priorityFee: 0.0001,
                bribeFee: 0.0001,
                slippage: 30
            });

            const solAmount = settings.defaultSolAmount;
            if (isNaN(solAmount) || solAmount <= 0) {
                throw new Error('Please enter a valid SOL amount');
            }

            // Convert SOL to lamports (1 SOL = 1e9 lamports)
            const lamports = Math.floor(solAmount * 1e9).toString();
            
            // First get token info with market data
            const tokenInfoResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                url: `https://api-neo.bullx.io/secure/api/token/${contractAddress}?includeMarketData=true`,
                method: 'GET'
            });

            if (!tokenInfoResponse.success) {
                throw new Error('Failed to get token info');
            }

            const tokenInfo = tokenInfoResponse.data;

            // Get liquidity pool info
            const poolResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                url: `https://api-neo.bullx.io/secure/api/pool/${tokenInfo.liquidityPool}`,
                method: 'GET'
            });

            if (!poolResponse.success) {
                throw new Error('Failed to get pool info');
            }

            // Prepare transaction data for BullX
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
                        chainId: 1399811149,
                        baseToken: {
                            address: contractAddress,
                            decimals: tokenInfo.decimals || 9,
                            protocol: "RAYDIUM",
                            price: tokenInfo.price,
                            priceUSD: tokenInfo.priceUSD,
                            name: tokenInfo.name,
                            symbol: tokenInfo.symbol,
                            image: tokenInfo.image,
                            liquidityPool: tokenInfo.liquidityPool
                        },
                        quoteToken: {
                            address: "So11111111111111111111111111111111111111112",
                            decimals: 9,
                            price: "1",
                            priceUSD: tokenInfo.quoteToken?.priceUSD || 0,
                            name: "Wrapped SOL",
                            symbol: "WSOL"
                        },
                        orderType: "BUY_MARKET_ORDER_V1",
                        amounts: {
                            "0": lamports
                        },
                        wallets: ["0"],
                        direction: "BUY",
                        slippage: settings.slippage,
                        priorityFee: settings.priorityFee,
                        bribe: settings.bribeFee,
                        isMEVOnly: false,
                        burstable: false,
                        maxBurstChunks: 40,
                        referrer: "",
                        sellStrategyId: null,
                        language: "en",
                        pool: {
                            ...poolResponse.data,
                            protocol: "RAYDIUM"
                        },
                        transactionParams: {
                            commitment: "confirmed",
                            preflightCommitment: "processed",
                            skipPreflight: true
                        }
                    }
                }
            };

            // Send order request to create transaction
            const orderResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                ...orderData
            });

            if (!orderResponse.success || !orderResponse.data?.orderId) {
                throw new Error(orderResponse.data?.message || 'Failed to create order');
            }

            // Poll for transaction status and signature
            let attempts = 0;
            const maxAttempts = 30; // Increased max attempts
            const pollStatus = async () => {
                if (attempts >= maxAttempts) {
                    throw new Error('Transaction build timed out');
                }

                const statusResponse = await chrome.runtime.sendMessage({
                    type: 'PROXY_REQUEST',
                    url: `https://api-neo.bullx.io/secure/api/order/${orderResponse.data.orderId}/status`,
                    method: 'GET'
                });

                if (statusResponse.success) {
                    const status = statusResponse.data?.status;
                    
                    if (status === 'COMPLETED' && statusResponse.data?.transaction?.signature) {
                        // Show success with transaction signature
                        const signature = statusResponse.data.transaction.signature;
                        alert(`Order successful! Transaction signature: ${signature}`);
                        
                        // Open transaction in Solana Explorer
                        const explorerUrl = `https://solscan.io/tx/${signature}`;
                        window.open(explorerUrl, '_blank');
                        return;
                    } else if (status === 'FAILED') {
                        throw new Error(statusResponse.data?.error || 'Transaction failed');
                    } else if (status === 'PENDING' || status === 'PROCESSING') {
                        attempts++;
                        // Exponential backoff with max of 3 seconds
                        setTimeout(pollStatus, Math.min(1000 * Math.pow(1.5, attempts), 3000));
                    } else {
                        throw new Error(`Unknown status: ${status}`);
                    }
                } else {
                    attempts++;
                    setTimeout(pollStatus, Math.min(1000 * Math.pow(1.5, attempts), 3000));
                }
            };

            await pollStatus();

        } catch (error) {
            console.error('Error placing order:', error);
            alert('Error placing order: ' + error.message);
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