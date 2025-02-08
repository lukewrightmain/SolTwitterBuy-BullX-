// First line of the file
console.log('🔵 SCRIPT LOAD CHECK - URL:', window.location.href);
console.log('🔵 SCRIPT LOAD CHECK - HOSTNAME:', window.location.hostname);

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

// Add near the top of file, after existing logging setup
const DEBUG_PRO = true;
function logPro(...args) {
    if (DEBUG_PRO) {
        console.log('🔷 [Pro.X.com Debug]:', ...args);
    }
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

// Match both prefixed and raw Solana addresses
const solanaAddressRegex = /(?:(?:CA:|contract:|address:)\s*)?([1-9A-HJ-NP-Za-km-z]{32,44})\b/i;

// Function to create buttons container
function createButtons(contractAddress) {
    const container = document.createElement('div');
    const isPro = window.location.href.includes('pro.x.com');
    
    container.style.cssText = `
        display: flex;
        gap: ${isPro ? '8px' : '12px'};
        margin: 12px 0;
        align-items: center;
        background: transparent;
        ${isPro ? `
            width: 100%;
            justify-content: space-between;
            flex-wrap: wrap;
        ` : ''}
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

    // Now define buttonStyles here
    const buttonStyles = `
        .bullx-btn {
            background: linear-gradient(135deg, #1da1f2 0%, #1a91da 100%);
            color: white;
            border: none;
            border-radius: 9999px;
            padding: ${isPro ? '6px 12px' : '8px 16px'};
            cursor: pointer;
            font-size: ${isPro ? '13px' : '14px'};
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: all 0.3s ease;
            box-shadow: 0 2px 5px rgba(29, 161, 242, 0.2);
            position: relative;
            overflow: hidden;
            ${isPro ? `
                flex: 1;
                min-width: calc(50% - 4px);
                max-width: 150px;
                white-space: nowrap;
                text-overflow: ellipsis;
            ` : ''}
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

        ${isPro ? `
            @media (max-width: 480px) {
                .bullx-btn {
                    font-size: 12px;
                    padding: 5px 10px;
                }
            }
        ` : ''}
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
        
        // Save original button text and style
        const originalText = buyButton.innerHTML;
        const originalClass = buyButton.className;
        
        try {
            // Update button to show processing state
            buyButton.innerHTML = '⏳ Processing...';
            buyButton.className = 'bullx-btn buy-btn processing';
            buyButton.disabled = true;

            // Get settings first
            const settings = await new Promise((resolve) => {
                chrome.storage.local.get({
                    defaultSolAmount: 0.5,
                    priorityFee: 0.0001,
                    bribeFee: 0.0001,
                    slippage: 30
                }, resolve);
            });

            // Step 1: Get technical data
            const technicalResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                url: 'https://api-neo.bullx.io/v2/api/getTechnicalsV2',
                method: 'POST',
                contentType: 'application/json',
                body: {
                    name: "getTechnicalsV2",
                    data: {
                        tokenAddress: contractAddress,
                        chainId: 1399811149
                    }
                }
            });

            if (!technicalResponse.success) {
                throw new Error('Failed to get technical data');
            }

            // After getting technical response, let's log it to see the structure
            console.log('Technical response:', technicalResponse);

            // Extract wallet addresses from technical data
            const walletAddresses = [
                "63oeKsNhezg8D3EMKbcCsNTZFNDE2oaEu8KJcGRa5nQZ",
                "Hcu21cnEDSzeoAqJs2uLe1cwbPTFbQ8yaKzUXA6Paj79",
                "J2YQDyA8PhMdDVztcLKd8jaBrWmHuyQSRFe3h28PkiYK",
                "Aj3SjJC5H4ZTQRGSTX4E673NkTsnjniSrJc9hcUQFSKt",
                "8Sq3ofUzv2uefjPMLadZr4ZCHCXbAoqXFAXc653mSbW8",
                "3ghNocXNLK6ZWRC51SGUjUpUjHW7Ybe8VqDWM7vgXEgY"
            ];

            // Step 2: Get native balances
            const balancesResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                url: 'https://api-neo.bullx.io/v2/api/nativeBalances',
                method: 'POST',
                contentType: 'application/json',
                body: {
                    name: "nativeBalances",
                    data: {
                        walletAddresses: [
                            "0xcc7e3c5c64d81a8eec4922ba5c55cee1775c50ef",
                            "0x4d28850e085da2bc6ee410bfa223a124042d868f"
                        ]
                    }
                }
            });

            // Step 3: Get approval status
            const approvalResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                url: 'https://api-neo.bullx.io/v2/api/getApprovalStatusV3',
                method: 'POST',
                contentType: 'application/json',
                body: {
                    name: "getApprovalStatusV3",
                    data: {
                        chainId: 1399811149,
                        tokenAddress: contractAddress,
                        protocol: null,
                        walletAddresses: walletAddresses
                    }
                }
            });

            // Step 4: Place order
            const orderResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_REQUEST',
                url: 'https://api-neo.bullx.io/secure/api/order',
                method: 'POST',
                contentType: 'text/plain',
                body: {
                    name: "placeOrderV3",
                    data: {
                        chainId: 1399811149,
                        baseToken: {
                            address: contractAddress,
                            decimals: technicalResponse.data.decimals || 5,
                            protocol: "RAYDIUM",
                            price: technicalResponse.data.price,
                            priceUSD: technicalResponse.data.priceUSD,
                            name: technicalResponse.data.tokenInfo?.name || technicalResponse.data.name || "Kansas",
                            symbol: technicalResponse.data.tokenInfo?.symbol || technicalResponse.data.symbol || "Kansas",
                            image: `https://image.bullx.io/1399811149/${contractAddress}`,
                            liquidityPool: technicalResponse.data.liquidityPool
                        },
                        quoteToken: {
                            address: "So11111111111111111111111111111111111111112",
                            decimals: 9,
                            name: "Wrapped SOL",
                            symbol: "WSOL",
                            image: `https://image.bullx.io/1399811149/So11111111111111111111111111111111111111112`
                        },
                        orderType: "BUY_MARKET_ORDER_V1",
                        amounts: {
                            "Hcu21cnEDSzeoAqJs2uLe1cwbPTFbQ8yaKzUXA6Paj79": Math.floor(settings.defaultSolAmount * 1e9).toString()
                        },
                        wallets: ["Hcu21cnEDSzeoAqJs2uLe1cwbPTFbQ8yaKzUXA6Paj79"],
                        direction: "BUY",
                        slippage: settings.slippage,
                        priorityFee: settings.priorityFee,
                        bribe: settings.bribeFee,
                        isMEVOnly: true,
                        burstable: false,
                        maxBurstChunks: 40,
                        language: "en"
                    }
                }
            });

            if (!orderResponse.success) {
                throw new Error(orderResponse.data?.message || 'Failed to place order');
            }

            // On successful order
            const tokenSymbol = technicalResponse.data?.symbol || 
                               technicalResponse.data?.baseToken?.symbol || 
                               'token'; // Fallback to generic term if no symbol found
            buyButton.innerHTML = `✅ Success!`;
            buyButton.className = 'bullx-btn buy-btn success';
            
            // Reset button after 3 seconds
            setTimeout(() => {
                buyButton.innerHTML = originalText;
                buyButton.className = originalClass;
                buyButton.disabled = false;
            }, 3000);

        } catch (error) {
            // Show error state
            buyButton.innerHTML = '❌ Failed';
            buyButton.className = 'bullx-btn buy-btn error';
            console.error('Error placing order:', error);
            
            // Reset button after 3 seconds
            setTimeout(() => {
                buyButton.innerHTML = originalText;
                buyButton.className = originalClass;
                buyButton.disabled = false;
            }, 3000);
            
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
            logPro('Text being checked:', text);
            logPro('Regex used:', solanaAddressRegex);
            logPro('Regex matches:', matches);
            if (matches) {
                logPro('Full match:', matches[0]);
                logPro('Captured address:', matches[1] || matches[0]);
                contractAddress = matches[1] || matches[0];
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
            
            // Remove any existing grey bar
            const existingGreyBar = element.querySelector('div[style*="background-color: rgb(83, 100, 113)"]');
            if (existingGreyBar) {
                existingGreyBar.remove();
            }
        } else if (tweetActions) {
            tweetActions.insertAdjacentElement('beforebegin', buttons);
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

// Add these styles to your existing button styles
const additionalStyles = `
    .bullx-btn.processing {
        background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);
        cursor: not-allowed;
        opacity: 0.8;
    }

    .bullx-btn.success {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        cursor: default;
    }

    .bullx-btn.error {
        background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
        cursor: default;
    }

    .bullx-btn:disabled {
        cursor: not-allowed;
        opacity: 0.8;
    }
`;

// Function to handle pro.x.com tweets
function processProTweet(element) {
    logPro('=== Processing Pro Tweet ===');
    
    if (!isEnabled) {
        logPro('Skipping - extension disabled');
        return;
    }

    if (element.getAttribute('data-bullx-processed') === 'true') {
        logPro('Skipping - already processed');
        return;
    }

    // Try multiple selectors for tweet text
    const tweetText = element.querySelector([
        '[data-testid="tweetText"]',
        '.css-146c3p1[dir="auto"][lang]',
        'div[lang="en"]',
        'div[dir="auto"]'
    ].join(','));

    logPro('Tweet text element found:', !!tweetText);
    
    if (tweetText) {
        const text = tweetText.textContent;
        logPro('Tweet text content:', text);
        
        // Look for contract address
        const matches = text.match(solanaAddressRegex);
        logPro('Text being checked:', text);
        logPro('Regex used:', solanaAddressRegex);
        logPro('Regex matches:', matches);
        if (matches) {
            logPro('Full match:', matches[0]);
            logPro('Captured address:', matches[1] || matches[0]);
            const contractAddress = matches[1] || matches[0]; // Get capture group if exists
            logPro('Found contract address:', contractAddress);
            
            // Create and add buttons
            const buttons = createButtons(contractAddress);
            
            // Try to find the best insertion point
            const insertionPoint = element.querySelector([
                '[role="group"]',  // Try tweet actions first
                '[data-testid="tweetText"]', // Then tweet text
                'div[lang="en"]'  // Finally any text container
            ].join(','));
            
            if (insertionPoint) {
                logPro('Found insertion point, adding buttons');
                insertionPoint.insertAdjacentElement('afterend', buttons);
                element.setAttribute('data-bullx-processed', 'true');
                logPro('✅ Successfully processed pro tweet');
            } else {
                logPro('❌ No suitable insertion point found');
            }
        }
    }
}

// Function to scan pro.x.com columns
function scanProColumns() {
    console.log('🔄 Checking if should scan pro columns:', {
        isEnabled,
        hostname: window.location.hostname,
        shouldScan: isEnabled && window.location.hostname === 'pro.x.com'
    });

    logPro('=== Starting Pro Column Scan ===');
    logPro('Current URL:', window.location.href);
    logPro('Extension state:', isEnabled);
    logPro('Document readyState:', document.readyState);

    if (!isEnabled || window.location.hostname !== 'pro.x.com') {
        logPro('Scan skipped - Extension disabled or wrong hostname');
        return;
    }

    logPro('Looking for main content...');
    const mainContent = document.querySelector('[role="main"]');
    logPro('Main content found:', !!mainContent);

    const proTweets = document.querySelectorAll('[data-testid="cellInnerDiv"]:not([data-bullx-processed="true"])');
    console.log('📱 Found pro tweets:', proTweets.length);
    logPro('Tweet elements:', Array.from(proTweets).map(el => ({
        html: el.innerHTML.substring(0, 100) + '...',
        hasText: !!el.querySelector('[data-testid="tweetText"]'),
        processed: el.getAttribute('data-bullx-processed')
    })));

    proTweets.forEach((tweet, index) => {
        console.log(`🔄 Processing pro tweet ${index + 1}/${proTweets.length}`);
        processProTweet(tweet);
    });
}

// Modify the hostname check
function isProXDomain() {
    const hostname = window.location.hostname;
    const href = window.location.href;
    console.log('🔵 Checking domain:', { hostname, href });
    return hostname.includes('prox.com') || href.includes('prox.com');
}

// Update the initialization check
if (window.location.href.includes('pro.x.com')) {
    console.log('🔵 Pro X detected, starting initialization');
    // Start initialization after a short delay
    setTimeout(initializeProX, 500);

    // Also set up a periodic check
    setInterval(scanProColumns, 5000);
}

// Add at the top of the file
const RETRY_INTERVAL = 1000; // 1 second
const MAX_RETRIES = 30; // 30 seconds max
let retryCount = 0;

function initializeProX() {
    console.log('🔵 Attempting to initialize Pro X...', window.location.href);
    
    const mainContent = document.querySelector('[role="main"]');
    if (!mainContent && retryCount < MAX_RETRIES) {
        console.log('🔵 Main content not found, retrying...', retryCount);
        retryCount++;
        setTimeout(initializeProX, RETRY_INTERVAL);
        return;
    }
    
    if (mainContent) {
        console.log('🔵 Main content found, setting up observer');
        const proObserver = new MutationObserver(() => {
            console.log('🔵 Mutation detected');
            scanProColumns();
        });
        
        proObserver.observe(mainContent, {
            childList: true,
            subtree: true
        });
        
        // Initial scan
        scanProColumns();
    }
}

function findTweetElements() {
  // Look for both old and new selectors
  const tweetContainers = document.querySelectorAll([
    '[data-testid="cellInnerDiv"]',
    '[data-testid="tweet"]',
    'article[role="article"]'
  ].join(','));

  tweetContainers.forEach(container => {
    // Skip if already processed
    if (container.getAttribute('data-bullx-processed')) return;

    // Find tweet text using multiple possible selectors
    const tweetText = container.querySelector([
      '[data-testid="tweetText"]',
      '.css-146c3p1[dir="auto"][lang]', // New pro.x.com selector
      '[data-testid="tweet"] div[lang]'
    ].join(','));

    if (tweetText) {
      processTweet(container, tweetText);
    }

    // Mark as processed
    container.setAttribute('data-bullx-processed', 'true');
  });
}

// Modify the observer to watch for both immediate and nested changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      // Check both added nodes and their descendants
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // Element node
          findTweetElements();
          // Also check children after a short delay to handle dynamic loading
          setTimeout(findTweetElements, 500);
        }
      });
    }
  });
});

// Observe with subtree option to catch nested changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Add near the top of the file, after the existing logging setup
console.log('🌟 Domain:', window.location.hostname); 