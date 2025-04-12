// Settings Modal
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeButton = document.getElementById('close-modal');
const resetGameButton = document.getElementById('reset-game');
const exportButton = document.getElementById('export-game');

// Log elements to ensure they're being found correctly
console.log('Settings Button:', settingsButton);
console.log('Close Button:', closeButton);
console.log('Reset Game Button:', resetGameButton);
console.log('Export Button:', exportButton);

// Check local storage on page load
console.log('Current localStorage idleGitHub value:', localStorage.getItem('idleGitHub'));

settingsButton.addEventListener('click', () => {
    settingsModal.classList.add('show');
});

closeButton.addEventListener('click', () => {
    settingsModal.classList.remove('show');
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('show');
    }
});

// Reset game data
resetGameButton.addEventListener('click', () => {
    console.log('Reset button clicked!');
    if (confirm('Are you sure you want to reset all game data? This action cannot be undone.')) {
        console.log('Dispatching game-reset event');
        // Dispatch a custom event that game.js can listen for
        window.dispatchEvent(new Event('game-reset'));
        
        console.log('Removing localStorage idleGitHub...');
        localStorage.removeItem('idleGitHub');
        console.log('LocalStorage after removal:', localStorage.getItem('idleGitHub'));
        console.log('Reloading page...');
        
        // Give a slight delay before reloading to ensure event is processed
        setTimeout(() => {
            location.reload();
        }, 100);
    }
});

// Export game data
exportButton.addEventListener('click', () => {
    console.log('Export button clicked!');
    const gameData = localStorage.getItem('idleGitHub');
    if (gameData) {
        // Add animation class
        exportButton.classList.add('active');
        
        const formattedGameData = JSON.stringify(JSON.parse(gameData), null, 2);
        const blob = new Blob([formattedGameData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'idle-github-save.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Remove animation class after download completes
        setTimeout(() => {
            exportButton.classList.remove('active');
        }, 1500);
    } else {
        alert('No game data found to export!');
    }
}); 