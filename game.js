class Game {
    constructor() {
        this.commits = 0;
        this.commitsPerSecond = 0;
        this.clickPower = 1;
        this.upgrades = {
            intern: { count: 0, cost: 10, rate: 0.1 },
            juniorDev: { count: 0, cost: 100, rate: 1 },
            seniorDev: { count: 0, cost: 1000, rate: 5 },
            ciBot: { count: 0, cost: 5000, rate: 10 }
        };
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadGame();
        this.startGameLoop();
    }

    initializeElements() {
        this.commitDisplay = document.getElementById('commits');
        this.cpsDisplay = document.getElementById('commits-per-second');
        this.clickPowerDisplay = document.getElementById('click-power');
        this.clickButton = document.getElementById('click-button');
        
        // Initialize upgrade buttons
        this.upgradeButtons = {
            intern: document.querySelector('#intern .buy-button'),
            juniorDev: document.querySelector('#junior-dev .buy-button'),
            seniorDev: document.querySelector('#senior-dev .buy-button'),
            ciBot: document.querySelector('#ci-bot .buy-button')
        };
    }

    setupEventListeners() {
        this.clickButton.addEventListener('click', () => this.handleClick());
        
        // Setup upgrade button listeners
        Object.keys(this.upgrades).forEach(upgrade => {
            this.upgradeButtons[upgrade].addEventListener('click', () => this.buyUpgrade(upgrade));
        });
    }

    handleClick() {
        this.commits += this.clickPower;
        this.updateDisplay();
        this.saveGame();
    }

    buyUpgrade(upgrade) {
        const upgradeData = this.upgrades[upgrade];
        if (this.commits >= upgradeData.cost) {
            this.commits -= upgradeData.cost;
            upgradeData.count++;
            upgradeData.cost = Math.floor(upgradeData.cost * 1.15); // Increase cost by 15%
            this.commitsPerSecond += upgradeData.rate;
            this.updateDisplay();
            this.saveGame();
        }
    }

    updateDisplay() {
        this.commitDisplay.textContent = Math.floor(this.commits);
        this.cpsDisplay.textContent = this.commitsPerSecond.toFixed(1);
        this.clickPowerDisplay.textContent = this.clickPower;

        // Update upgrade buttons
        Object.keys(this.upgrades).forEach(upgrade => {
            const button = this.upgradeButtons[upgrade];
            const upgradeData = this.upgrades[upgrade];
            button.disabled = this.commits < upgradeData.cost;
            button.parentElement.querySelector('.cost').textContent = upgradeData.cost;
        });
    }

    startGameLoop() {
        setInterval(() => {
            this.commits += this.commitsPerSecond / 10; // Update 10 times per second
            this.updateDisplay();
            this.saveGame();
        }, 100);
    }

    saveGame() {
        const gameState = {
            commits: this.commits,
            commitsPerSecond: this.commitsPerSecond,
            clickPower: this.clickPower,
            upgrades: this.upgrades
        };
        localStorage.setItem('idleGitHub', JSON.stringify(gameState));
    }

    loadGame() {
        const savedGame = localStorage.getItem('idleGitHub');
        if (savedGame) {
            const gameState = JSON.parse(savedGame);
            this.commits = gameState.commits;
            this.commitsPerSecond = gameState.commitsPerSecond;
            this.clickPower = gameState.clickPower;
            this.upgrades = gameState.upgrades;
            this.updateDisplay();
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 