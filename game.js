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
        
        // Repository System
        this.repositories = [];
        this.maxRepoSlots = 1;
        this.baseRepoCreationTime = 30; // seconds
        this.baseRepoOutput = 10; // commits per completed repo
        this.repoUpgrades = {
            repoSpeed: { count: 0, cost: 300, effect: 0.2, levelRequired: 4 }, // 20% faster creation time per upgrade
            repoOutput: { count: 0, cost: 800, effect: 0.5, levelRequired: 5 }, // 50% more commits per repo
            repoAutomation: { count: 0, cost: 2500, levelRequired: 7 }, // Auto creates repositories
            repoSlots: { count: 0, cost: 5000, effect: 1, levelRequired: 9 } // +1 slot per upgrade
        };
        this.autoRepoTimer = null;
        this.lastAutoRepoTime = Date.now();
        
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
        
        // Repository elements
        this.reposCountDisplay = document.getElementById('repos-count');
        this.commitsPerRepoDisplay = document.getElementById('commits-per-repo');
        this.repoCreationTimeDisplay = document.getElementById('repo-creation-time');
        this.repoProgressBarsContainer = document.getElementById('repo-progress-bars');
        this.createRepoButton = document.getElementById('create-repo-button');
        
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
        
        // Initialize repository upgrade buttons
        this.repoUpgradeButtons = {};
        Object.keys(this.repoUpgrades).forEach(upgrade => {
            const button = document.querySelector(`#${upgrade.replace(/([A-Z])/g, '-$1').toLowerCase()} .buy-button`);
            if (button) {
                this.repoUpgradeButtons[upgrade] = button;
            }
        });
        
        // Multipliers container
        this.multipliersContainer = document.getElementById('active-multipliers');
    }

    setupEventListeners() {
        this.clickButton.addEventListener('click', () => this.handleClick());
        
        // Setup repository button
        this.createRepoButton.addEventListener('click', () => this.createRepository());
        
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
        
        // Setup repository upgrade button listeners
        Object.keys(this.repoUpgradeButtons).forEach(upgrade => {
            const button = this.repoUpgradeButtons[upgrade];
            if (button) {
                button.addEventListener('click', () => {
                    this.buyRepoUpgrade(upgrade);
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
            // Only show error message if it's a significant negative or zero value
            // Small floating point errors shouldn't trigger notifications
            if (amount < -0.001) {
                console.log("Invalid XP amount:", amount);
                // Don't show notification for small calculation errors
                // this.showNotification("Invalid XP amount", "error", "Cannot add negative or zero XP");
            }
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
        
        // Update repository upgrades
        Object.keys(this.repoUpgrades).forEach(upgrade => {
            const button = this.repoUpgradeButtons[upgrade];
            if (button) {
                const upgradeInfo = this.repoUpgrades[upgrade];
                const upgradeElement = document.querySelector(`#${upgrade.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
                
                if (upgradeElement) {
                    // Update button state based on level requirement and affordability
                    const currentLevel = Number(this.level);
                    const requiredLevel = Number(upgradeInfo.levelRequired);
                    const canAfford = this.commits >= upgradeInfo.cost;
                    const hasLevel = currentLevel >= requiredLevel;
                    
                    // Use visual class instead of disabling
                    button.disabled = false;
                    if (!canAfford || !hasLevel) {
                        button.classList.add('visually-disabled');
                    } else {
                        button.classList.remove('visually-disabled');
                    }
                    
                    // Update cost display
                    const costElement = upgradeElement.querySelector('.cost');
                    if (costElement) {
                        costElement.textContent = Math.floor(upgradeInfo.cost).toLocaleString();
                        if (!canAfford) {
                            costElement.classList.add('cost-too-high');
                        } else {
                            costElement.classList.remove('cost-too-high');
                        }
                    }
                    
                    // Update upgrade count
                    const countElement = upgradeElement.querySelector('.count');
                    if (countElement) {
                        countElement.textContent = upgradeInfo.count.toString();
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
        
        // Update active multipliers display
        this.updateActiveMultipliersDisplay();
    }

    startGameLoop() {
        setInterval(() => {
            // Calculate commits earned since last tick
            const baseCommitsPerTick = this.commitsPerSecond / 10; // Per 100ms
            
            // Apply active multipliers
            let totalMultiplier = 1;
            this.activeMultipliers.forEach(m => {
                totalMultiplier *= m.multiplier;
            });
            
            const commitsEarned = baseCommitsPerTick * totalMultiplier;
            this.commits += commitsEarned;
            
            // Add XP
            const xpEarned = this.xpPerSecond / 10; // Per 100ms
            this.addXP(xpEarned);
            
            // Update repository progress
            this.updateRepoProgress();
            
            // Update displays
            this.updateDisplay();
            
            // Update active multipliers
            this.updateActiveMultipliersDisplay();
            
            // Save game every 30 seconds (every 300 ticks as the loop runs at 100ms)
            if (Math.random() < 0.0033) { // Roughly once every 30 seconds
                this.saveGame();
            }
        }, 100);
    }

    saveGame() {
        // Skip saving if we're resetting
        if (this.isResetting) {
            return;
        }
        
        // Don't save if storage not available
        if (!this.checkStorageAvailability()) {
            return;
        }
        
        const currentTime = new Date().getTime();
        
        const gameData = {
            commits: this.commits,
            level: this.level,
            xp: this.xp,
            xpToNextLevel: this.xpToNextLevel,
            upgrades: this.upgrades,
            clickUpgrades: this.clickUpgrades,
            tempMultipliers: this.tempMultipliers,
            // Save repositories state
            repositories: this.repositories,
            maxRepoSlots: this.maxRepoSlots,
            baseRepoCreationTime: this.baseRepoCreationTime,
            baseRepoOutput: this.baseRepoOutput,
            repoUpgrades: this.repoUpgrades,
            lastAutoRepoTime: this.lastAutoRepoTime,
            // Save last update time
            lastUpdate: currentTime
        };
        
        localStorage.setItem('idleGitHubGame', JSON.stringify(gameData));
    }

    loadGame() {
        // Don't load if storage not available
        if (!this.checkStorageAvailability()) {
            return;
        }
        
        const savedData = localStorage.getItem('idleGitHubGame');
        if (savedData) {
            try {
                const gameData = JSON.parse(savedData);
                
                // Load basic game states
                this.commits = gameData.commits || 0;
                this.level = gameData.level || 1;
                this.xp = gameData.xp || 0;
                this.xpToNextLevel = gameData.xpToNextLevel || 100;
                
                // Load upgrades
                if (gameData.upgrades) {
                    Object.keys(gameData.upgrades).forEach(upgrade => {
                        if (this.upgrades[upgrade]) {
                            this.upgrades[upgrade].count = gameData.upgrades[upgrade].count || 0;
                            this.upgrades[upgrade].cost = gameData.upgrades[upgrade].cost || this.upgrades[upgrade].cost;
                        }
                    });
                }
                
                // Load click upgrades
                if (gameData.clickUpgrades) {
                    Object.keys(gameData.clickUpgrades).forEach(upgrade => {
                        if (this.clickUpgrades[upgrade]) {
                            this.clickUpgrades[upgrade].count = gameData.clickUpgrades[upgrade].count || 0;
                            this.clickUpgrades[upgrade].cost = gameData.clickUpgrades[upgrade].cost || this.clickUpgrades[upgrade].cost;
                        }
                    });
                }
                
                // Load temp multipliers cooldowns
                if (gameData.tempMultipliers) {
                    Object.keys(gameData.tempMultipliers).forEach(multiplier => {
                        if (this.tempMultipliers[multiplier]) {
                            this.tempMultipliers[multiplier].onCooldown = gameData.tempMultipliers[multiplier].onCooldown || false;
                            this.tempMultipliers[multiplier].cooldownEnd = gameData.tempMultipliers[multiplier].cooldownEnd || 0;
                        }
                    });
                }
                
                // Load repository system data
                if (gameData.repositories) {
                    this.repositories = gameData.repositories || [];
                    this.maxRepoSlots = gameData.maxRepoSlots || 1;
                    this.baseRepoCreationTime = gameData.baseRepoCreationTime || 30;
                    this.baseRepoOutput = gameData.baseRepoOutput || 10;
                    
                    // Load repository upgrades
                    if (gameData.repoUpgrades) {
                        Object.keys(gameData.repoUpgrades).forEach(upgrade => {
                            if (this.repoUpgrades[upgrade]) {
                                this.repoUpgrades[upgrade].count = gameData.repoUpgrades[upgrade].count || 0;
                                this.repoUpgrades[upgrade].cost = gameData.repoUpgrades[upgrade].cost || this.repoUpgrades[upgrade].cost;
                            }
                        });
                    }
                    
                    this.lastAutoRepoTime = gameData.lastAutoRepoTime || Date.now();
                    
                    // Setup auto repository if purchased
                    if (this.repoUpgrades.repoAutomation.count > 0) {
                        this.setupAutoRepository();
                    }
                    
                    // Recreate repository progress bars
                    this.repositories.forEach(repo => {
                        this.createRepoProgressBar(repo);
                    });
                }
                
                // Recalculate click multiplier
                this.recalculateClickMultiplier();
                
                // Update all displays
                this.updateRepoStats();
                this.updateDisplay();
                
                // Calculate offline progress
                if (gameData.lastUpdate) {
                    const currentTime = new Date().getTime();
                    const offlineTime = (currentTime - gameData.lastUpdate) / 1000; // seconds
                    this.calculateOfflineProgress(offlineTime);
                }
                
            } catch (e) {
                console.error("Error loading saved game:", e);
            }
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

    calculateOfflineProgress(offlineTime) {
        const lastSaveTime = localStorage.getItem('lastSaveTime');
        if (lastSaveTime) {
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - parseInt(lastSaveTime);
            
            // If less than 5 seconds, don't bother with offline calculation
            if (timeDiff < 5000) return;
            
            // Calculate offline time in seconds (capped at 24 hours to prevent excessive gains)
            const offlineSeconds = Math.min(timeDiff / 1000, 86400);
            
            // Calculate commits earned while offline
            const baseCommits = this.commitsPerSecond * offlineSeconds;
            
            // Get any active multipliers at the time of closing
            let totalMultiplier = 1;
            
            // Add the commits
            const totalCommitsEarned = baseCommits * totalMultiplier;
            this.commits += totalCommitsEarned;
            
            // Add XP earned while offline from passive gains
            const xpEarned = this.xpPerSecond * offlineSeconds;
            this.addXP(xpEarned);
            
            // Process repositories that would have been completed while offline
            const completedOfflineRepos = [];
            let completedRepoCommits = 0;
            let completedRepoXP = 0;
            
            this.repositories.forEach(repo => {
                if (repo.completed) return;
                
                const elapsedBeforeOffline = (repo.progress / 100) * repo.duration;
                const totalElapsed = elapsedBeforeOffline + (offlineSeconds * 1000);
                
                if (totalElapsed >= repo.duration) {
                    repo.progress = 100;
                    repo.completed = true;
                    completedOfflineRepos.push(repo);
                    
                    // Add rewards to the offline totals
                    completedRepoCommits += this.getRepoOutput();
                    completedRepoXP += this.getRepoXPOutput();
                } else {
                    repo.progress = (totalElapsed / repo.duration) * 100;
                    // Update the visual progress
                    const progressElement = document.querySelector(`.repo-progress[data-repo-id="${repo.id}"]`);
                    if (progressElement) {
                        const barElement = progressElement.querySelector('.repo-bar');
                        barElement.style.width = `${repo.progress}%`;
                        
                        const timeElement = progressElement.querySelector('.repo-time');
                        const remainingTime = Math.max(0, Math.ceil((repo.duration - totalElapsed) / 1000));
                        timeElement.textContent = `${remainingTime}s`;
                    }
                }
            });
            
            // Process repositories that would have been created by automation
            if (this.repoUpgrades.repoAutomation.count > 0) {
                const autoInterval = 2 * 60; // 2 minutes in seconds
                const timeSinceLastAuto = offlineSeconds + (Date.now() - this.lastAutoRepoTime) / 1000;
                const autoRepoPotential = Math.floor(timeSinceLastAuto / autoInterval);
                
                // If we had auto repos that could have been created, generate them retrospectively
                // But limit based on slots available
                const autoReposToCreate = Math.min(autoRepoPotential, this.maxRepoSlots - this.repositories.length);
                
                for (let i = 0; i < autoReposToCreate; i++) {
                    const repoId = Date.now() + i; // Generate unique ID
                    const repoName = this.generateRepoName();
                    const creationTime = this.getRepoCreationTime();
                    
                    // Calculate how far along this repo would be
                    const remainingAutoTime = timeSinceLastAuto - (autoInterval * (i + 1));
                    const progressPercent = Math.min(100, (remainingAutoTime / creationTime) * 100);
                    
                    const newRepo = {
                        id: repoId,
                        name: repoName,
                        startTime: Date.now() - (remainingAutoTime * 1000),
                        duration: creationTime * 1000,
                        progress: progressPercent,
                        completed: progressPercent >= 100
                    };
                    
                    if (newRepo.completed) {
                        completedOfflineRepos.push(newRepo);
                    } else {
                        this.repositories.push(newRepo);
                        this.createRepoProgressBar(newRepo);
                    }
                }
                
                // Update last auto repo time
                this.lastAutoRepoTime = Date.now() - (timeSinceLastAuto % autoInterval) * 1000;
            }
            
            // Process completed repos
            if (completedOfflineRepos.length > 0) {
                // No need to call processCompletedRepositories because we already calculated the rewards
                // Just update the repositories array and visual elements
                completedOfflineRepos.forEach(repo => {
                    const progressElement = document.querySelector(`.repo-progress[data-repo-id="${repo.id}"]`);
                    if (progressElement) {
                        progressElement.remove();
                    }
                });
                
                // Add the repo rewards directly
                this.commits += completedRepoCommits;
                this.addXP(completedRepoXP);
                
                // Remove completed repos from the array
                this.repositories = this.repositories.filter(repo => !completedOfflineRepos.includes(repo));
            }
            
            // Update button state
            this.createRepoButton.disabled = this.repositories.length >= this.maxRepoSlots;
            
            // Show notification about offline progress
            const message = `Welcome back! You earned while away:`;
            const details = [
                `+${Math.floor(totalCommitsEarned + completedRepoCommits)} commits`,
                `+${Math.floor(xpEarned + completedRepoXP)} XP`
            ];
            
            if (completedOfflineRepos.length > 0) {
                details.push(`+${completedOfflineRepos.length} repositories completed`);
            }
            
            this.showNotification(message, 'default', details);
            
            // Update repository stats
            this.updateRepoStats();
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

    // Get actual repo creation time with upgrades
    getRepoCreationTime() {
        let time = this.baseRepoCreationTime;
        const speedReduction = this.repoUpgrades.repoSpeed.count * this.repoUpgrades.repoSpeed.effect;
        // Cap reduction at 80% to avoid instant repos
        const maxReduction = 0.8;
        const reduction = Math.min(speedReduction, maxReduction);
        return time * (1 - reduction);
    }
    
    // Get actual repo output with upgrades
    getRepoOutput() {
        let output = this.baseRepoOutput;
        const outputIncrease = this.repoUpgrades.repoOutput.count * this.repoUpgrades.repoOutput.effect;
        return Math.floor(output * (1 + outputIncrease));
    }
    
    // Get XP output for repos
    getRepoXPOutput() {
        // Base XP is half of the commit output
        const baseOutput = this.getRepoOutput() * 0.5;
        return Math.max(1, Math.floor(baseOutput));
    }
    
    // Create a new repository
    createRepository() {
        // Check if we have free slots
        if (this.repositories.length >= this.maxRepoSlots) {
            this.showNotification('No free repository slots available!', 'error');
            return;
        }
        
        const repoId = Date.now(); // Unique ID for this repo
        const repoName = this.generateRepoName();
        const creationTime = this.getRepoCreationTime();
        
        // Create new repository
        const newRepo = {
            id: repoId,
            name: repoName,
            startTime: Date.now(),
            duration: creationTime * 1000, // Convert to milliseconds
            progress: 0,
            completed: false
        };
        
        this.repositories.push(newRepo);
        this.createRepoProgressBar(newRepo);
        this.updateRepoStats();
        
        // Disable button if no more slots
        if (this.repositories.length >= this.maxRepoSlots) {
            this.createRepoButton.disabled = true;
        }
    }
    
    // Generate a random repository name
    generateRepoName() {
        const prefixes = ['awesome', 'cool', 'super', 'mega', 'ultra', 'epic', 'fancy'];
        const topics = ['app', 'tool', 'lib', 'api', 'ui', 'framework', 'project', 'kit'];
        const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        return `${randomPrefix}-${randomTopic}`;
    }
    
    // Create visual progress bar for a repository
    createRepoProgressBar(repo) {
        const progressElement = document.createElement('div');
        progressElement.className = 'repo-progress';
        progressElement.dataset.repoId = repo.id;
        
        const nameElement = document.createElement('div');
        nameElement.className = 'repo-name';
        nameElement.textContent = repo.name;
        
        const barContainerElement = document.createElement('div');
        barContainerElement.className = 'repo-bar-container';
        
        const barElement = document.createElement('div');
        barElement.className = 'repo-bar';
        barElement.style.width = '0%';
        
        const timeElement = document.createElement('div');
        timeElement.className = 'repo-time';
        const seconds = Math.ceil(repo.duration / 1000);
        timeElement.textContent = `${seconds}s`;
        
        barContainerElement.appendChild(barElement);
        progressElement.appendChild(nameElement);
        progressElement.appendChild(barContainerElement);
        progressElement.appendChild(timeElement);
        
        this.repoProgressBarsContainer.appendChild(progressElement);
    }
    
    // Update progress bars for all repositories
    updateRepoProgress() {
        const currentTime = Date.now();
        let completedRepos = [];
        
        // Update each repository
        this.repositories.forEach(repo => {
            if (repo.completed) return;
            
            const elapsed = currentTime - repo.startTime;
            const progressPercent = Math.min(100, (elapsed / repo.duration) * 100);
            repo.progress = progressPercent;
            
            // Find the progress bar
            const progressElement = document.querySelector(`.repo-progress[data-repo-id="${repo.id}"]`);
            if (progressElement) {
                const barElement = progressElement.querySelector('.repo-bar');
                barElement.style.width = `${progressPercent}%`;
                
                const timeElement = progressElement.querySelector('.repo-time');
                const remainingTime = Math.max(0, Math.ceil((repo.duration - elapsed) / 1000));
                timeElement.textContent = `${remainingTime}s`;
            }
            
            // Check if completed
            if (progressPercent >= 100) {
                repo.completed = true;
                completedRepos.push(repo);
            }
        });
        
        // Handle completed repositories
        if (completedRepos.length > 0) {
            this.processCompletedRepositories(completedRepos);
        }
    }
    
    // Process completed repositories
    processCompletedRepositories(completedRepos) {
        let totalCommits = 0;
        let totalXP = 0;
        let repoNames = [];
        
        completedRepos.forEach(repo => {
            const commitOutput = this.getRepoOutput();
            const xpOutput = this.getRepoXPOutput();
            
            totalCommits += commitOutput;
            totalXP += xpOutput;
            repoNames.push(repo.name);
            
            // Remove visual element
            const progressElement = document.querySelector(`.repo-progress[data-repo-id="${repo.id}"]`);
            if (progressElement) {
                progressElement.remove();
            }
        });
        
        // Add commits
        this.commits += totalCommits;
        
        // Add XP
        this.addXP(totalXP);
        
        // Remove from repositories array
        this.repositories = this.repositories.filter(repo => !completedRepos.includes(repo));
        
        // Enable create button if slots available
        if (this.repositories.length < this.maxRepoSlots) {
            this.createRepoButton.disabled = false;
        }
        
        // Show notification
        if (repoNames.length > 0) {
            const notification = `Repository ${repoNames.join(', ')} completed!`;
            const details = [
                `+${totalCommits} commits`,
                `+${totalXP} XP`
            ];
            this.showNotification(notification, 'default', details);
        }
        
        this.updateRepoStats();
        this.updateDisplay();
    }
    
    // Update repository statistics
    updateRepoStats() {
        const completedRepos = this.repositories.filter(repo => repo.completed).length;
        const totalRepos = this.repositories.length;
        
        if (this.reposCountDisplay) {
            this.reposCountDisplay.textContent = totalRepos;
        }
        
        if (this.commitsPerRepoDisplay) {
            this.commitsPerRepoDisplay.textContent = this.getRepoOutput();
        }
        
        const xpPerRepoDisplay = document.getElementById('xp-per-repo');
        if (xpPerRepoDisplay) {
            xpPerRepoDisplay.textContent = this.getRepoXPOutput();
        }
        
        if (this.repoCreationTimeDisplay) {
            this.repoCreationTimeDisplay.textContent = `${this.getRepoCreationTime()}s`;
        }
    }
    
    // Buy repository upgrade
    buyRepoUpgrade(upgrade) {
        const upgradeInfo = this.repoUpgrades[upgrade];
        
        // Check if player has enough commits
        if (this.commits < upgradeInfo.cost) {
            this.showNotification(`Not enough commits for ${upgrade}!`, 'error');
            return;
        }
        
        // Check if player meets level requirement
        if (this.level < upgradeInfo.levelRequired) {
            this.showNotification(`Level ${upgradeInfo.levelRequired} required for ${upgrade}!`, 'error');
            return;
        }
        
        // Purchase the upgrade
        this.commits -= upgradeInfo.cost;
        upgradeInfo.count++;
        upgradeInfo.cost = Math.floor(upgradeInfo.cost * 1.5); // Increase cost
        
        // Update display costs
        const upgradeCostElement = document.querySelector(`#${upgrade.replace(/([A-Z])/g, '-$1').toLowerCase()} .cost`);
        if (upgradeCostElement) {
            upgradeCostElement.textContent = upgradeInfo.cost;
        }
        
        // Update upgrade count
        const upgradeCountElement = document.querySelector(`#${upgrade.replace(/([A-Z])/g, '-$1').toLowerCase()} .count`);
        if (upgradeCountElement) {
            upgradeCountElement.textContent = upgradeInfo.count;
        }
        
        // Special handling for different upgrades
        if (upgrade === 'repoSlots') {
            this.maxRepoSlots += upgradeInfo.effect;
            // Enable button if slots available
            if (this.repositories.length < this.maxRepoSlots) {
                this.createRepoButton.disabled = false;
            }
        } else if (upgrade === 'repoAutomation') {
            // Start auto repository timer if first purchase
            if (upgradeInfo.count === 1) {
                this.setupAutoRepository();
            }
        }
        
        this.updateRepoStats();
        this.updateDisplay();
        
        // Show notification
        const notification = `Purchased ${upgrade.replace(/([A-Z])/g, ' $1').toLowerCase()} upgrade!`;
        this.showNotification(notification);
    }
    
    // Setup auto repository creation
    setupAutoRepository() {
        if (this.repoUpgrades.repoAutomation.count > 0) {
            const interval = 2 * 60 * 1000; // 2 minutes in milliseconds
            this.lastAutoRepoTime = Date.now();
            
            // Clear existing timer if any
            if (this.autoRepoTimer) {
                clearInterval(this.autoRepoTimer);
            }
            
            // Set up interval to create repositories automatically
            this.autoRepoTimer = setInterval(() => {
                if (this.repositories.length < this.maxRepoSlots) {
                    this.createRepository();
                }
            }, interval);
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 