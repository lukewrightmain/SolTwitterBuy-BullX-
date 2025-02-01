// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTokens") {
        // Get all required tokens
        const tokens = {
            sessionToken: localStorage.getItem('_sessionToken'),
            bullxToken: document.cookie.split('; ').find(row => row.startsWith('bullx-token'))?.split('=')[1],
            bullxNonceId: document.cookie.split('; ').find(row => row.startsWith('bullx-nonce-id'))?.split('=')[1],
            bullxVisitorId: document.cookie.split('; ').find(row => row.startsWith('bullx-visitor-id'))?.split('=')[1],
            bullxCsToken: document.cookie.split('; ').find(row => row.startsWith('bullx-cs-token'))?.split('=')[1],
            bullxSessionToken: document.cookie.split('; ').find(row => row.startsWith('bullx-session-token'))?.split('=')[1]
        };
        
        console.log("Tokens found:", tokens);
        sendResponse(tokens);
    }
}); 