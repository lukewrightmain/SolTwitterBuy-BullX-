// Get saved state
chrome.storage.local.get(['enabled'], function(result) {
    const toggleButton = document.getElementById('toggleButton');
    const status = document.getElementById('status');
    
    // Set initial state
    toggleButton.checked = result.enabled ?? false;
    status.textContent = toggleButton.checked ? 'Extension is enabled' : 'Extension is disabled';
    
    // Handle toggle
    toggleButton.addEventListener('change', function() {
        const enabled = toggleButton.checked;
        status.textContent = enabled ? 'Extension is enabled' : 'Extension is disabled';
        
        // Save state
        chrome.storage.local.set({ enabled: enabled });
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { enabled: enabled });
            }
        });
    });
}); 