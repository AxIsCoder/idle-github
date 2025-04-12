class Game {
    constructor() {
        this.commits = 0;
        this.commitsPerSecond = 0;
        this.xpPerSecond = 0;
        this.level = 1;
        this.clickPower = this.level;
        this.clickMultiplier = 1; // Base multiplier for click power
        this.xp = 0;
        this.xpToNextLevel = 100;
        
        // Track active multipliers
        this.activeMultipliers = [];
        
        this.upgrades = {
            intern: { count: 0, cost: 10, rate: 0.1, xpRate: 0.1, levelRequired: 1 },
            juniorDev: { count: 0, cost: 100, rate: 1, xpRate: 0.5, levelRequired: 3 },
            seniorDev: { count: 0, cost: 1000, rate: 5, xpRate: 2, levelRequired: 5 },
            ciBot: { count: 0, cost: 5000, rate: 10, xpRate: 5, levelRequired: 7 }
        };
        
        // Click power upgrades
        this.clickUpgrades = {
            betterIDE: { 
                count: 0, 
                cost: 50, 
                multiplier: 0.2, // +20% per upgrade
                description: "Better IDE",
                levelRequired: 2
            },
            coffeeBoost: { 
                count: 0, 
                cost: 500, 
                multiplier: 0.5, // +50% per upgrade
                description: "Coffee Boost",
                levelRequired: 4
            },
            ergonomicKeyboard: { 
                count: 0, 
                cost: 2000, 
                multiplier: 1.0, // +100% per upgrade
                description: "Ergonomic Keyboard",
                levelRequired: 6
            }
        };
        
        // Temporary multipliers (time-based)
        this.tempMultipliers = {
            hackathon: { 
                duration: 30, // seconds
                multiplier: 2, // 2x
                cost: 200,
                description: "Hackathon Sprint",
                levelRequired: 3,
                onCooldown: false,
                cooldownTime: 120 // 2 minutes cooldown
            },
            codeReview: { 
                duration: 20, // seconds
                multiplier: 3, // 3x
                cost: 1000,
                description: "Code Review Session",
                levelRequired: 5,
                onCooldown: false,
                cooldownTime: 180 // 3 minutes cooldown
            },
            allNighter: { 
                duration: 60, // seconds
                multiplier: 5, // 5x
                cost: 5000,
                description: "Pull an All-Nighter",
                levelRequired: 8,
                onCooldown: false,
                cooldownTime: 300 // 5 minutes cooldown
            }
        };
        
        // Add a flag to track if we're resetting (initialized as false)
        this.isResetting = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupNotifications();
        
        // Check browser storage before loading
        const storageAvailable = this.checkStorageAvailability();
        if (storageAvailable) {
            this.loadGame();
        }
        
        this.updateDisplay();
        this.startGameLoop();
        
        // Listen for resetGame event
        window.addEventListener('game-reset', () => {
            console.log('Game reset event detected');
            this.isResetting = true;
        });
        
        // Listen for visibility change to detect tab switching
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // Save when switching away
                this.saveGame();
            } else {
                // Show offline gains when coming back
                this.calculateOfflineProgress();
            }
        });
    }

    initializeElements() {
        this.commitDisplay = document.getElementById('commits');
        this.cpsDisplay = document.getElementById('commits-per-second');
        this.xpsDisplay = document.getElementById('xp-per-second');
        this.clickPowerDisplay = document.getElementById('click-power');
        this.clickButton = document.getElementById('click-button');
        this.levelDisplay = document.getElementById('level');
        this.xpDisplay = document.getElementById('xp');
        this.xpBar = document.getElementById('xp-bar');
        
        // Initialize upgrade buttons
        this.upgradeButtons = {
            intern: document.querySelector('#intern .buy-button'),
            juniorDev: document.querySelector('#junior-dev .buy-button'),
            seniorDev: document.querySelector('#senior-dev .buy-button'),
            ciBot: document.querySelector('#ci-bot .buy-button')
        };
        
        // Initialize click upgrade buttons
        this.clickUpgradeButtons = {};
        Object.keys(this.clickUpgrades).forEach(upgrade => {
            const button = document.querySelector(`#${upgrade} .buy-button`);
            if (button) {
                this.clickUpgradeButtons[upgrade] = button;
            }
        });
        
        // Initialize temp multiplier buttons
        this.tempMultiplierButtons = {};
        Object.keys(this.tempMultipliers).forEach(multiplier => {
            const button = document.querySelector(`#${multiplier} .buy-button`);
            if (button) {
                this.tempMultiplierButtons[multiplier] = button;
            }
        });
        
        // Multipliers container
        this.multipliersContainer = document.getElementById('active-multipliers');
    }

    setupEventListeners() {
        this.clickButton.addEventListener('click', () => this.handleClick());
        
        // Setup upgrade button listeners - now all buttons are always clickable
        Object.keys(this.upgrades).forEach(upgrade => {
            // Add click event to the button only, since it's now always enabled
            this.upgradeButtons[upgrade].addEventListener('click', () => {
                this.buyUpgrade(upgrade);
            });
        });
        
        // Setup click upgrade button listeners
        Object.keys(this.clickUpgrades).forEach(upgrade => {
            const button = this.clickUpgradeButtons[upgrade];
            if (button) {
                button.addEventListener('click', () => {
                    this.buyClickUpgrade(upgrade);
                });
            }
        });
        
        // Setup temp multiplier button listeners
        Object.keys(this.tempMultipliers).forEach(multiplier => {
            const button = this.tempMultiplierButtons[multiplier];
            if (button) {
                button.addEventListener('click', () => {
                    this.activateTempMultiplier(multiplier);
                });
            }
        });
    }

    // Helper method to get element ID from upgrade key
    getElementIdFromUpgrade(upgrade) {
        // Convert camelCase to kebab-case
        return upgrade.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }

    // Get current effective click power with all multipliers
    getEffectiveClickPower() {
        let basePower = this.clickPower;
        let totalMultiplier = this.clickMultiplier;
        
        // Apply temporary multipliers if active
        this.activeMultipliers.forEach(m => {
            totalMultiplier *= m.multiplier;
        });
        
        return Math.floor(basePower * totalMultiplier);
    }

    handleClick() {
        // Apply all multipliers to the click
        const effectiveClickPower = this.getEffectiveClickPower();
        this.commits += effectiveClickPower;
        
        // XP gain now scales with level - base of 1-5 plus level bonus
        const baseXP = Math.floor(Math.random() * 5) + 1;
        const levelBonus = Math.floor(this.level * 0.5); // 0.5 XP per level
        const totalXP = baseXP + levelBonus;
        
        this.addXP(totalXP);
        this.updateDisplay();
        this.saveGame();
    }

    addXP(amount) {
        // Validate XP amount
        if (amount <= 0) {
            this.showNotification("Invalid XP amount", "error", "Cannot add negative or zero XP");
            return;
        }
        
        amount = Math.max(1, Math.floor(Number(amount)));
        this.xp = Number(this.xp) + amount;
        while (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
        this.updateDisplay();
    }

    setupNotifications() {
        // Create notifications container if it doesn't exist
        if (!document.querySelector('.notifications-container')) {
            const container = document.createElement('div');
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }
    }

    showNotification(message, type = 'default', details = null) {
        const container = document.querySelector('.notifications-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Create main message
        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = message;
        notification.appendChild(messageElement);
        
        // Add details if provided
        if (details) {
            const detailsElement = document.createElement('div');
            detailsElement.className = 'notification-details';
            
            // If details is an array, create a list
            if (Array.isArray(details)) {
                const list = document.createElement('ul');
                details.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.textContent = item;
                    list.appendChild(listItem);
                });
                detailsElement.appendChild(list);
            } else {
                detailsElement.textContent = details;
            }
            
            notification.appendChild(detailsElement);
        }
        
        container.appendChild(notification);

        // For non-level-up notifications, remove after a delay
        if (type !== 'level-up') {
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        } else {
            // For level-up notifications, add a close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'notification-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            });
            notification.appendChild(closeBtn);
        }
    }

    levelUp(silent = false) {
        this.level = Number(this.level) + 1;
        this.xp = Math.max(0, this.xp - this.xpToNextLevel);
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
        
        // Calculate improved click power - directly match level number
        const oldClickPower = this.clickPower;
        // Set click power to equal the level number
        this.clickPower = this.level;
        
        // Only show notification if not silent
        if (!silent) {
            // Check for unlocks at this level
            const unlocks = [];
            // Simpler format for click power increase, matching screenshot
            unlocks.push(`Click power: ${oldClickPower} → ${this.clickPower} commits per click`);
            
            Object.keys(this.upgrades).forEach(upgrade => {
                if (this.upgrades[upgrade].levelRequired === this.level) {
                    // Simpler format for upgrade unlocks, matching screenshot
                    unlocks.push(`New upgrade: ${upgrade.replace(/([A-Z])/g, ' $1').trim()}`);
                }
            });
            
            // Show level up notification with unlocks
            const message = `Level Up! You are now level ${this.level}`;
            this.showNotification(message, 'level-up', unlocks);
        }
        
        this.updateDisplay();
    }

    buyUpgrade(upgrade) {
        const upgradeData = this.upgrades[upgrade];
        const currentLevel = Number(this.level);
        const requiredLevel = Number(upgradeData.levelRequired);
        const canAfford = this.commits >= upgradeData.cost;
        const hasLevel = currentLevel >= requiredLevel;

        if (canAfford && hasLevel) {
            this.commits -= upgradeData.cost;
            upgradeData.count++;
            upgradeData.cost = Math.floor(upgradeData.cost * 1.15);
            this.commitsPerSecond += upgradeData.rate;
            this.xpPerSecond += upgradeData.xpRate; // Add XP per second
            
            // Show purchase notification with count
            this.showNotification(`Hired new ${upgrade.replace(/([A-Z])/g, ' $1').trim()}! (${upgradeData.count} total)`);
            
            this.updateDisplay();
            this.saveGame();
        } else {
            if (!canAfford && !hasLevel) {
                // Both issues: can't afford and level too low
                const shortfall = Math.ceil(upgradeData.cost - this.commits);
                const details = [
                    `You need ${shortfall} more commits`,
                    `Required level: ${requiredLevel} (you are ${currentLevel})`
                ];
                this.showNotification("Can't hire developer!", "error", details);
            } else if (!canAfford) {
                // Only afford issue
                const shortfall = Math.ceil(upgradeData.cost - this.commits);
                const percentComplete = Math.floor((this.commits / upgradeData.cost) * 100);
                this.showNotification("Not enough commits!", "error", `You need ${shortfall} more commits (${percentComplete}% of cost)`);
            } else if (!hasLevel) {
                // Only level issue
                const levelsNeeded = requiredLevel - currentLevel;
                const xpNeeded = this.calculateXPToLevel(requiredLevel);
                this.showNotification(`Level too low`, "error", `Need ${levelsNeeded} more levels (${xpNeeded} XP to reach level ${requiredLevel})`);
            }
        }
    }

    buyClickUpgrade(upgrade) {
        const upgradeData = this.clickUpgrades[upgrade];
        const currentLevel = Number(this.level);
        const requiredLevel = Number(upgradeData.levelRequired);
        const canAfford = this.commits >= upgradeData.cost;
        const hasLevel = currentLevel >= requiredLevel;

        if (canAfford && hasLevel) {
            this.commits -= upgradeData.cost;
            upgradeData.count++;
            upgradeData.cost = Math.floor(upgradeData.cost * 1.5); // Click upgrades are more expensive
            
            // Recalculate click multiplier
            this.recalculateClickMultiplier();
            
            // Show purchase notification
            this.showNotification(`Purchased ${upgradeData.description}! Click power improved.`);
            
            this.updateDisplay();
            this.saveGame();
        } else {
            // Error handling similar to buying regular upgrades
            if (!canAfford && !hasLevel) {
                // Both issues: can't afford and level too low
                const shortfall = Math.ceil(upgradeData.cost - this.commits);
                const details = [
                    `You need ${shortfall} more commits`,
                    `Required level: ${requiredLevel} (you are ${currentLevel})`
                ];
                this.showNotification(`Can't buy ${upgradeData.description}!`, "error", details);
            } else if (!canAfford) {
                // Only afford issue
                const shortfall = Math.ceil(upgradeData.cost - this.commits);
                const percentComplete = Math.floor((this.commits / upgradeData.cost) * 100);
                this.showNotification("Not enough commits!", "error", `You need ${shortfall} more commits (${percentComplete}% of cost)`);
            } else if (!hasLevel) {
                // Only level issue
                const levelsNeeded = requiredLevel - currentLevel;
                const xpNeeded = this.calculateXPToLevel(requiredLevel);
                this.showNotification(`Level too low`, "error", `Need ${levelsNeeded} more levels (${xpNeeded} XP to reach level ${requiredLevel})`);
            }
        }
    }

    activateTempMultiplier(multiplier) {
        const multiplierData = this.tempMultipliers[multiplier];
        const currentLevel = Number(this.level);
        const requiredLevel = Number(multiplierData.levelRequired);
        const canAfford = this.commits >= multiplierData.cost;
        const hasLevel = currentLevel >= requiredLevel;
        const isOnCooldown = multiplierData.onCooldown;

        if (isOnCooldown) {
            this.showNotification(`${multiplierData.description} is on cooldown!`, "error", `Please wait before using it again.`);
            return;
        }

        if (canAfford && hasLevel) {
            this.commits -= multiplierData.cost;
            
            // Create the multiplier and add to active multipliers
            const activeMultiplier = {
                id: multiplier,
                description: multiplierData.description,
                multiplier: multiplierData.multiplier,
                timeLeft: multiplierData.duration,
                originalDuration: multiplierData.duration
            };
            
            this.activeMultipliers.push(activeMultiplier);
            
            // Set to cooldown
            multiplierData.onCooldown = true;
            
            // Create a div to show the active multiplier
            this.updateActiveMultipliersDisplay();
            
            // Show notification
            this.showNotification(`Activated ${multiplierData.description}!`, "boost", 
                `${multiplierData.multiplier}x multiplier for ${multiplierData.duration} seconds.`);
            
            this.updateDisplay();
            this.saveGame();
            
            // Set up timer for cooldown
            setTimeout(() => {
                multiplierData.onCooldown = false;
                this.updateDisplay();
            }, multiplierData.cooldownTime * 1000);
            
        } else {
            // Error handling similar to buying regular upgrades
            if (!canAfford && !hasLevel) {
                // Both issues: can't afford and level too low
                const shortfall = Math.ceil(multiplierData.cost - this.commits);
                const details = [
                    `You need ${shortfall} more commits`,
                    `Required level: ${requiredLevel} (you are ${currentLevel})`
                ];
                this.showNotification(`Can't activate ${multiplierData.description}!`, "error", details);
            } else if (!canAfford) {
                // Only afford issue
                const shortfall = Math.ceil(multiplierData.cost - this.commits);
                const percentComplete = Math.floor((this.commits / multiplierData.cost) * 100);
                this.showNotification("Not enough commits!", "error", `You need ${shortfall} more commits (${percentComplete}% of cost)`);
            } else if (!hasLevel) {
                // Only level issue
                const levelsNeeded = requiredLevel - currentLevel;
                const xpNeeded = this.calculateXPToLevel(requiredLevel);
                this.showNotification(`Level too low`, "error", `Need ${levelsNeeded} more levels (${xpNeeded} XP to reach level ${requiredLevel})`);
            }
        }
    }

    recalculateClickMultiplier() {
        // Base multiplier is 1
        let multiplier = 1;
        
        // Add effect from each click upgrade
        Object.keys(this.clickUpgrades).forEach(upgrade => {
            const upgradeData = this.clickUpgrades[upgrade];
            multiplier += upgradeData.count * upgradeData.multiplier;
        });
        
        this.clickMultiplier = multiplier;
    }

    updateActiveMultipliersDisplay() {
        // Update multipliers display if container exists
        if (this.multipliersContainer) {
            // Clear container
            this.multipliersContainer.innerHTML = '';
            
            // Add each active multiplier
            this.activeMultipliers.forEach(m => {
                const multiplierElement = document.createElement('div');
                multiplierElement.className = 'active-multiplier';
                
                const descriptionElement = document.createElement('div');
                descriptionElement.className = 'multiplier-description';
                descriptionElement.textContent = `${m.description}: ${m.multiplier}x`;
                
                const timerElement = document.createElement('div');
                timerElement.className = 'multiplier-timer';
                const progressBar = document.createElement('div');
                progressBar.className = 'multiplier-progress';
                progressBar.style.width = `${(m.timeLeft / m.originalDuration) * 100}%`;
                timerElement.appendChild(progressBar);
                
                const timeLeftElement = document.createElement('div');
                timeLeftElement.className = 'multiplier-time-left';
                timeLeftElement.textContent = `${m.timeLeft}s`;
                
                multiplierElement.appendChild(descriptionElement);
                multiplierElement.appendChild(timerElement);
                multiplierElement.appendChild(timeLeftElement);
                
                this.multipliersContainer.appendChild(multiplierElement);
            });
        }
    }

    updateDisplay() {
        // Update basic stats
        this.commitDisplay.textContent = Math.floor(this.commits).toLocaleString();
        this.cpsDisplay.textContent = this.commitsPerSecond.toFixed(1);
        
        // Update XP per second display
        if (this.xpsDisplay) {
            this.xpsDisplay.textContent = this.xpPerSecond.toFixed(1);
        }
        
        // Update click power with special styling
        const effectiveClickPower = this.getEffectiveClickPower();
        this.clickPowerDisplay.textContent = effectiveClickPower;
        
        // Add a brief highlight effect when click power changes
        this.clickPowerDisplay.classList.add('highlight');
        setTimeout(() => {
            this.clickPowerDisplay.classList.remove('highlight');
        }, 1000);
        
        this.levelDisplay.textContent = this.level.toString();
        
        // Update XP display
        const currentXP = Math.floor(Number(this.xp));
        const nextLevelXP = Math.floor(Number(this.xpToNextLevel));
        this.xpDisplay.textContent = `${currentXP.toLocaleString()}/${nextLevelXP.toLocaleString()}`;
        
        // Update XP bar
        const xpPercentage = Math.min((currentXP / nextLevelXP) * 100, 100);
        this.xpBar.style.width = `${xpPercentage}%`;

        // Update regular upgrades
        Object.keys(this.upgrades).forEach(upgrade => {
            const button = this.upgradeButtons[upgrade];
            const upgradeData = this.upgrades[upgrade];
            const upgradeElement = document.getElementById(this.getElementIdFromUpgrade(upgrade));
            
            // Update button state and cost
            const currentLevel = Number(this.level);
            const requiredLevel = Number(upgradeData.levelRequired);
            const canAfford = this.commits >= upgradeData.cost;
            const hasLevel = currentLevel >= requiredLevel;
            
            // Use visual class instead of disabling
            button.disabled = false;
            if (!canAfford || !hasLevel) {
                button.classList.add('visually-disabled');
            } else {
                button.classList.remove('visually-disabled');
            }
            
            // Update cost and count displays
            const costElement = upgradeElement.querySelector('.cost');
            if (costElement) {
                costElement.textContent = Math.floor(upgradeData.cost).toLocaleString();
                if (!canAfford) {
                    costElement.classList.add('cost-too-high');
                } else {
                    costElement.classList.remove('cost-too-high');
                }
            }
            
            const countElement = upgradeElement.querySelector('.count');
            if (countElement) {
                countElement.textContent = upgradeData.count.toString();
            }
            
            // Update level requirement
            const levelReqElement = upgradeElement.querySelector('.level-required');
            if (levelReqElement) {
                levelReqElement.textContent = `Level ${requiredLevel} required`;
                if (!hasLevel) {
                    levelReqElement.classList.add('level-too-low');
                } else {
                    levelReqElement.classList.remove('level-too-low');
                }
            }
            
            // Update locked state
            if (!hasLevel) {
                upgradeElement.classList.add('locked');
            } else {
                upgradeElement.classList.remove('locked');
            }
        });
        
        // Update click upgrades
        Object.keys(this.clickUpgrades).forEach(upgrade => {
            const button = this.clickUpgradeButtons[upgrade];
            if (button) {
                const upgradeData = this.clickUpgrades[upgrade];
                const upgradeElement = document.getElementById(upgrade);
                
                if (upgradeElement) {
                    // Update button state and cost
                    const currentLevel = Number(this.level);
                    const requiredLevel = Number(upgradeData.levelRequired);
                    const canAfford = this.commits >= upgradeData.cost;
                    const hasLevel = currentLevel >= requiredLevel;
                    
                    // Use visual class instead of disabling
                    button.disabled = false;
                    if (!canAfford || !hasLevel) {
                        button.classList.add('visually-disabled');
                    } else {
                        button.classList.remove('visually-disabled');
                    }
                    
                    // Update cost and count displays
                    const costElement = upgradeElement.querySelector('.cost');
                    if (costElement) {
                        costElement.textContent = Math.floor(upgradeData.cost).toLocaleString();
                        if (!canAfford) {
                            costElement.classList.add('cost-too-high');
                        } else {
                            costElement.classList.remove('cost-too-high');
                        }
                    }
                    
                    const countElement = upgradeElement.querySelector('.count');
                    if (countElement) {
                        countElement.textContent = upgradeData.count.toString();
                    }
                    
                    // Update level requirement
                    const levelReqElement = upgradeElement.querySelector('.level-required');
                    if (levelReqElement) {
                        levelReqElement.textContent = `Level ${requiredLevel} required`;
                        if (!hasLevel) {
                            levelReqElement.classList.add('level-too-low');
                        } else {
                            levelReqElement.classList.remove('level-too-low');
                        }
                    }
                    
                    // Update locked state
                    if (!hasLevel) {
                        upgradeElement.classList.add('locked');
                    } else {
                        upgradeElement.classList.remove('locked');
                    }
                }
            }
        });
        
        // Update temp multipliers
        Object.keys(this.tempMultipliers).forEach(multiplier => {
            const button = this.tempMultiplierButtons[multiplier];
            if (button) {
                const multiplierData = this.tempMultipliers[multiplier];
                const multiplierElement = document.getElementById(multiplier);
                
                if (multiplierElement) {
                    // Update button state based on cooldown, level and affordability
                    const currentLevel = Number(this.level);
                    const requiredLevel = Number(multiplierData.levelRequired);
                    const canAfford = this.commits >= multiplierData.cost;
                    const hasLevel = currentLevel >= requiredLevel;
                    const isOnCooldown = multiplierData.onCooldown;
                    
                    // Use visual class instead of disabling
                    button.disabled = false;
                    
                    if (isOnCooldown) {
                        button.classList.add('on-cooldown');
                        button.textContent = 'On Cooldown';
                    } else {
                        button.classList.remove('on-cooldown');
                        button.textContent = 'Activate';
                        
                        if (!canAfford || !hasLevel) {
                            button.classList.add('visually-disabled');
                        } else {
                            button.classList.remove('visually-disabled');
                        }
                    }
                    
                    // Update cost display
                    const costElement = multiplierElement.querySelector('.cost');
                    if (costElement) {
                        costElement.textContent = Math.floor(multiplierData.cost).toLocaleString();
                        if (!canAfford) {
                            costElement.classList.add('cost-too-high');
                        } else {
                            costElement.classList.remove('cost-too-high');
                        }
                    }
                    
                    // Update level requirement
                    const levelReqElement = multiplierElement.querySelector('.level-required');
                    if (levelReqElement) {
                        levelReqElement.textContent = `Level ${requiredLevel} required`;
                        if (!hasLevel) {
                            levelReqElement.classList.add('level-too-low');
                        } else {
                            levelReqElement.classList.remove('level-too-low');
                        }
                    }
                    
                    // Update locked state
                    if (!hasLevel) {
                        multiplierElement.classList.add('locked');
                    } else {
                        multiplierElement.classList.remove('locked');
                    }
                }
            }
        });
        
        // Update active multipliers display
        this.updateActiveMultipliersDisplay();
    }

    startGameLoop() {
        setInterval(() => {
            // Update commits and XP
            this.commits += this.commitsPerSecond / 10;
            if (this.xpPerSecond > 0) {
                this.addXP(this.xpPerSecond / 10);
            }
            
            // Update active multipliers timers
            for (let i = this.activeMultipliers.length - 1; i >= 0; i--) {
                const multiplier = this.activeMultipliers[i];
                multiplier.timeLeft -= 0.1; // Reduce by 0.1 seconds
                
                if (multiplier.timeLeft <= 0) {
                    // Remove expired multiplier
                    this.activeMultipliers.splice(i, 1);
                    this.showNotification(`${multiplier.description} effect has ended!`);
                }
            }
            
            this.updateActiveMultipliersDisplay();
            this.updateDisplay();
            this.saveGame();
        }, 100);
    }

    saveGame() {
        // Don't save if we're in the process of resetting
        if (this.isResetting) {
            console.log('Game is resetting, skipping save');
            return;
        }
        
        try {
            const gameState = {
                commits: this.commits,
                commitsPerSecond: this.commitsPerSecond,
                xpPerSecond: this.xpPerSecond,
                clickPower: this.clickPower,
                clickMultiplier: this.clickMultiplier,
                level: this.level,
                xp: this.xp,
                xpToNextLevel: this.xpToNextLevel,
                upgrades: this.upgrades,
                clickUpgrades: this.clickUpgrades,
                tempMultipliers: this.tempMultipliers,
                activeMultipliers: this.activeMultipliers
            };
            localStorage.setItem('idleGitHub', JSON.stringify(gameState));
        } catch (error) {
            console.error("Error saving game:", error);
            this.showNotification("Error saving game", "error", "Storage quota might be exceeded or browser storage restricted");
        }
    }

    loadGame() {
        try {
            const savedGame = localStorage.getItem('idleGitHub');
            if (savedGame) {
                const gameState = JSON.parse(savedGame);
                this.commits = Number(gameState.commits) || 0;
                this.commitsPerSecond = Number(gameState.commitsPerSecond) || 0;
                this.xpPerSecond = Number(gameState.xpPerSecond) || 0;
                this.level = Number(gameState.level) || 1;
                this.clickPower = Math.max(Number(gameState.clickPower) || 1, this.level);
                this.clickMultiplier = Number(gameState.clickMultiplier) || 1;
                this.xp = Number(gameState.xp) || 0;
                this.xpToNextLevel = Number(gameState.xpToNextLevel) || 100;
                
                // Load upgrades
                if (gameState.upgrades) {
                    Object.keys(this.upgrades).forEach(key => {
                        if (gameState.upgrades[key]) {
                            const savedUpgrade = gameState.upgrades[key];
                            this.upgrades[key] = {
                                count: Number(savedUpgrade.count) || 0,
                                cost: Number(savedUpgrade.cost) || this.upgrades[key].cost,
                                rate: Number(savedUpgrade.rate) || this.upgrades[key].rate,
                                xpRate: this.upgrades[key].xpRate,
                                levelRequired: this.upgrades[key].levelRequired
                            };
                        }
                    });
                }
                
                // Load click upgrades
                if (gameState.clickUpgrades) {
                    Object.keys(this.clickUpgrades).forEach(key => {
                        if (gameState.clickUpgrades[key]) {
                            const savedUpgrade = gameState.clickUpgrades[key];
                            this.clickUpgrades[key] = {
                                count: Number(savedUpgrade.count) || 0,
                                cost: Number(savedUpgrade.cost) || this.clickUpgrades[key].cost,
                                multiplier: this.clickUpgrades[key].multiplier,
                                description: this.clickUpgrades[key].description,
                                levelRequired: this.clickUpgrades[key].levelRequired
                            };
                        }
                    });
                }
                
                // Load temp multipliers
                if (gameState.tempMultipliers) {
                    Object.keys(this.tempMultipliers).forEach(key => {
                        if (gameState.tempMultipliers[key]) {
                            const savedMultiplier = gameState.tempMultipliers[key];
                            this.tempMultipliers[key] = {
                                duration: this.tempMultipliers[key].duration,
                                multiplier: this.tempMultipliers[key].multiplier,
                                cost: Number(savedMultiplier.cost) || this.tempMultipliers[key].cost,
                                description: this.tempMultipliers[key].description,
                                levelRequired: this.tempMultipliers[key].levelRequired,
                                onCooldown: Boolean(savedMultiplier.onCooldown) || false,
                                cooldownTime: this.tempMultipliers[key].cooldownTime
                            };
                        }
                    });
                }
                
                // Load active multipliers
                if (gameState.activeMultipliers && Array.isArray(gameState.activeMultipliers)) {
                    this.activeMultipliers = gameState.activeMultipliers;
                } else {
                    this.activeMultipliers = [];
                }
                
                // Recalculate derived values
                this.recalculateXpPerSecond();
                this.recalculateClickMultiplier();
            }
        } catch (error) {
            console.error("Error loading game:", error);
            this.showNotification("Error loading game", "error", "Your save file may be corrupted");
        }
    }

    checkStorageAvailability() {
        try {
            const storageType = 'localStorage';
            const storage = window[storageType];
            const testKey = '__storage_test__';
            
            storage.setItem(testKey, testKey);
            storage.removeItem(testKey);
            return true;
        } catch (e) {
            this.showNotification("Storage Unavailable", "error", 
                "Your browser doesn't support local storage or it's disabled. Progress won't be saved.");
            return false;
        }
    }

    calculateOfflineProgress() {
        const lastSaveTime = localStorage.getItem('lastSaveTime');
        if (lastSaveTime) {
            const currentTime = new Date().getTime();
            const timeDiff = (currentTime - parseInt(lastSaveTime)) / 1000; // in seconds
            
            if (timeDiff > 60) { // Only show for absences > 1 minute
                const offlineCommits = Math.floor(this.commitsPerSecond * timeDiff);
                const offlineXP = Math.floor(this.xpPerSecond * timeDiff);
                
                if (offlineCommits > 0 || offlineXP > 0) {
                    this.commits += offlineCommits;
                    
                    // Add offline XP
                    if (offlineXP > 0) {
                        // Use a simple addition to avoid excessive level ups
                        this.xp += offlineXP;
                        
                        // Check if player leveled up while away
                        let levelsGained = 0;
                        let tempXP = this.xp;
                        let tempXPToNext = this.xpToNextLevel;
                        
                        while (tempXP >= tempXPToNext) {
                            levelsGained++;
                            tempXP -= tempXPToNext;
                            tempXPToNext = Math.floor(tempXPToNext * 1.5);
                        }
                        
                        // Apply level ups
                        if (levelsGained > 0) {
                            for (let i = 0; i < levelsGained; i++) {
                                this.levelUp(true); // Silent level up (no notification)
                            }
                        } else {
                            // Just update XP
                            this.xp = tempXP;
                        }
                    }
                    
                    this.saveGame();
                    
                    // Format time away nicely
                    let timeAway = '';
                    if (timeDiff > 3600) {
                        timeAway = `${Math.floor(timeDiff / 3600)} hours`;
                    } else {
                        timeAway = `${Math.floor(timeDiff / 60)} minutes`;
                    }
                    
                    // Show notification with both commit and XP gains
                    let message = `You earned ${offlineCommits.toLocaleString()} commits`;
                    if (offlineXP > 0) {
                        message += ` and ${offlineXP.toLocaleString()} XP`;
                    }
                    message += ` while away for ${timeAway}.`;
                    
                    this.showNotification("Welcome Back!", "default", message);
                }
            }
        }
        
        // Update last save time
        localStorage.setItem('lastSaveTime', new Date().getTime().toString());
    }

    calculateXPToLevel(targetLevel) {
        let currentLevel = this.level;
        let currentXPToNext = this.xpToNextLevel;
        let totalXPNeeded = 0;
        
        // Need to account for current XP progress
        totalXPNeeded -= this.xp;
        
        // Calculate XP needed for each level up
        while (currentLevel < targetLevel) {
            totalXPNeeded += currentXPToNext;
            currentLevel++;
            currentXPToNext = Math.floor(currentXPToNext * 1.5);
        }
        
        return totalXPNeeded > 0 ? totalXPNeeded.toLocaleString() : 0;
    }

    // Helper method to recalculate XP per second from upgrades
    recalculateXpPerSecond() {
        this.xpPerSecond = 0;
        Object.keys(this.upgrades).forEach(key => {
            const upgrade = this.upgrades[key];
            this.xpPerSecond += upgrade.count * upgrade.xpRate;
        });
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 