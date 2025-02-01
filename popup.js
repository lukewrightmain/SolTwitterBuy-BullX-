// Load all saved settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
    // Load toggle state
    chrome.storage.local.get(['enabled'], function(result) {
        const toggleButton = document.getElementById('toggleButton');
        const status = document.getElementById('status');
        
        toggleButton.checked = result.enabled ?? false;
        status.textContent = toggleButton.checked ? 'Extension is enabled' : 'Extension is disabled';
    });

    // Load other settings
    chrome.storage.local.get({
        defaultSolAmount: 0.5,
        priorityFee: 0.0001,
        bribeFee: 0.0001,
        slippage: 30
    }, function(settings) {
        document.getElementById('defaultSolAmount').value = settings.defaultSolAmount;
        document.getElementById('priorityFee').value = settings.priorityFee;
        document.getElementById('bribeFee').value = settings.bribeFee;
        document.getElementById('slippage').value = settings.slippage;
    });
});

// Handle toggle button changes
document.getElementById('toggleButton').addEventListener('change', function() {
    const enabled = this.checked;
    const status = document.getElementById('status');
    status.textContent = enabled ? 'Extension is enabled' : 'Extension is disabled';
    
    // Save toggle state
    chrome.storage.local.set({ enabled: enabled });
    
    // Send message to content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { enabled: enabled });
        }
    });
});

// Handle settings save
document.getElementById('saveSettings').addEventListener('click', () => {
    const settings = {
        defaultSolAmount: parseFloat(document.getElementById('defaultSolAmount').value),
        priorityFee: parseFloat(document.getElementById('priorityFee').value),
        bribeFee: parseFloat(document.getElementById('bribeFee').value),
        slippage: parseInt(document.getElementById('slippage').value)
    };

    // Validate settings
    if (isNaN(settings.defaultSolAmount) || settings.defaultSolAmount <= 0) {
        alert('Please enter a valid SOL amount (must be greater than 0)');
        return;
    }
    if (isNaN(settings.priorityFee) || settings.priorityFee < 0) {
        alert('Please enter a valid priority fee');
        return;
    }
    if (isNaN(settings.bribeFee) || settings.bribeFee < 0) {
        alert('Please enter a valid bribe fee');
        return;
    }
    if (isNaN(settings.slippage) || settings.slippage < 1 || settings.slippage > 100) {
        alert('Please enter a valid slippage percentage (1-100)');
        return;
    }

    // Save settings
    chrome.storage.local.set(settings, () => {
        const saveStatus = document.getElementById('saveStatus');
        saveStatus.style.display = 'block';
        setTimeout(() => {
            saveStatus.style.display = 'none';
        }, 2000);
    });
}); 