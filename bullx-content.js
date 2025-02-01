// Listen for token requests from the Twitter tab
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_BULLX_TOKEN") {
        // Get the Bearer token from localStorage or wherever BullX stores it
        const token = localStorage.getItem('bullx-token') || '';
        sendResponse({token});
    }
    else if (request.type === "GET_CS_TOKEN") {
        // Get the CS token from cookies
        const csToken = document.cookie.split('; ')
            .find(row => row.startsWith('bullx-cs-token='))
            ?.split('=')[1] || '';
        sendResponse({token: csToken});
    }
}); 