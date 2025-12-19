
// Access Firebase objects exposed globally by index.html
const db = window.firebaseDB;
const doc = window.doc;
const getDoc = window.getDoc;
const setDoc = window.setDoc;
const updateDoc = window.updateDoc;

let userId = null;
let userWalletBalance = 0;
let lastWatchedAdsTime = 0;
let lastDailyGiftITime = 0;
let lastDailyGiftIItime = 0;
let lastDailyGiftIIITime = 0;
let lastOnPageLoadAdTime = 0;

const WATCHED_ADS_REWARD = 0.04;
const WATCHED_ADS_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const DAILY_GIFT_REWARD = 0.015;
const DAILY_GIFT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const ON_PAGE_LOAD_AD_REWARD = 0.01;
const ON_PAGE_LOAD_AD_COOLDOWN_MS = 1 * 60 * 1000; // 1 minute cooldown for browse-and-earn

const telegramBotLinks = [
    "https://t.me/RicreatorCoinbot?startapp=cad587",
    "https://t.me/Dollar_EarningBot?start=7398171299",
    "https://t.me/TheOnlyFunds_Bot?start=187632",
    "https://t.me/Stars_Miner_bot?start=33861",
    "https://t.me/core_xbot?start=2074039",
    "https://t.me/ProfitHubMining_Bot?start=511555"
];

const watchedAdsCooldownDisplay = document.getElementById('watchedAdsCooldown');
const dailyGiftICooldownDisplay = document.getElementById('dailyGiftICooldown');
const dailyGiftIICooldownDisplay = document.getElementById('dailyGiftIICooldown');
const dailyGiftIIICooldownDisplay = document.getElementById('dailyGiftIIICooldown');


// --- Telegram Web App and User Initialization ---
async function initializeUser() {
    const telegramUsernameEl = document.getElementById('telegramUsername');
    // const walletBalanceEl = document.getElementById('walletBalance'); // Not strictly needed here, updated by updateWalletDisplay

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        if (user) {
            userId = user.id.toString(); // Firebase doc IDs are strings
            telegramUsernameEl.textContent = user.username || `ID: ${user.id}`;
            window.Telegram.WebApp.ready(); // Signal that the app is ready

            // Fetch user data from Firebase
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                userWalletBalance = userData.walletBalance || 0;
                lastWatchedAdsTime = userData.lastWatchedAdsTime || 0;
                lastDailyGiftITime = userData.lastDailyGiftITime || 0;
                lastDailyGiftIItime = userData.lastDailyGiftIItime || 0;
                lastDailyGiftIIITime = userData.lastDailyGiftIIITime || 0;
                lastOnPageLoadAdTime = userData.lastOnPageLoadAdTime || 0;
            } else {
                // Create new user document if not exists
                await setDoc(userRef, {
                    walletBalance: 0,
                    lastWatchedAdsTime: 0,
                    lastDailyGiftITime: 0,
                    lastDailyGiftIItime: 0,
                    lastDailyGiftIIITime: 0,
                    lastOnPageLoadAdTime: 0,
                    telegramUsername: user.username || `ID: ${user.id}`,
                    createdAt: new Date().toISOString()
                });
            }
            updateWalletDisplay();
            startCooldownTimers();
            triggerOnPageLoadAd(); // Trigger the browse-and-earn ad on initial load
        } else {
            telegramUsernameEl.textContent = "Not in Telegram Web App or user data missing.";
        }
    } else {
        telegramUsernameEl.textContent = "Not running as a Telegram Web App.";
        // --- FOR DEVELOPMENT/TESTING ONLY OUTSIDE TWA ---
        // Provide a dummy user ID if not running as a TWA
        userId = "testUser123_github_dev"; // A consistent ID for local testing
        telegramUsernameEl.textContent = "Test User (Dev Mode)";
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            userWalletBalance = userData.walletBalance || 0;
            lastWatchedAdsTime = userData.lastWatchedAdsTime || 0;
            lastDailyGiftITime = userData.lastDailyGiftITime || 0;
            lastDailyGiftIItime = userData.lastDailyGiftIItime || 0;
            lastDailyGiftIIITime = userData.lastDailyGiftIIITime || 0;
            lastOnPageLoadAdTime = userData.lastOnPageLoadAdTime || 0;
        } else {
             await setDoc(userRef, {
                walletBalance: 0,
                lastWatchedAdsTime: 0,
                lastDailyGiftITime: 0,
                lastDailyGiftIItime: 0,
                lastDailyGiftIIITime: 0,
                lastOnPageLoadAdTime: 0,
                telegramUsername: "Test User (Dev Mode)",
                createdAt: new Date().toISOString()
            });
        }
        updateWalletDisplay();
        startCooldownTimers();
        triggerOnPageLoadAd(); // Trigger the browse-and-earn ad on initial load
    }
}

function updateWalletDisplay() {
    document.getElementById('walletBalance').textContent = userWalletBalance.toFixed(2);
}

// Function to update wallet and cooldown in Firebase
async function addRewardToWallet(amount, lastRewardTimeField, cooldownDuration, statusElement) {
    if (!userId) {
        showPopup("Error: User not identified. Please open in Telegram Web App.");
        return false;
    }
    const userRef = doc(db, 'users', userId);
    try {
        // Get current user data to check cooldown and update atomically
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentBalance = userData.walletBalance || 0;
            const currentTime = Date.now();
            const lastRewardTime = userData[lastRewardTimeField] || 0;

            // Re-check cooldown on the server-side logic (here simulated client-side)
            if (currentTime - lastRewardTime < cooldownDuration) {
                if (statusElement) statusElement.textContent = "Error: Cooldown not finished yet!";
                showPopup("Error: Cooldown not finished yet!");
                return false;
            }

            const newBalance = currentBalance + amount;
            await updateDoc(userRef, {
                walletBalance: newBalance,
                [lastRewardTimeField]: currentTime
            });

            // Update local state
            userWalletBalance = newBalance;
            switch(lastRewardTimeField) {
                case 'lastWatchedAdsTime': lastWatchedAdsTime = currentTime; break;
                case 'lastDailyGiftITime': lastDailyGiftITime = currentTime; break;
                case 'lastDailyGiftIItime': lastDailyGiftIItime = currentTime; break;
                case 'lastDailyGiftIIITime': lastDailyGiftIIITime = currentTime; break;
                case 'lastOnPageLoadAdTime': lastOnPageLoadAdTime = currentTime; break;
            }

            updateWalletDisplay();
            return true;
        }
    } catch (error) {
        console.error("Error adding reward to wallet:", error);
        if (statusElement) statusElement.textContent = "An error occurred while adding reward.";
        showPopup("An error occurred while adding reward.");
        return false;
    }
    return false;
}

// --- Cooldown Logic ---
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateCooldownDisplay(lastTime, cooldownMs, displayElement, buttonElement = null) {
    const now = Date.now();
    const timeElapsed = now - lastTime;
    const timeLeft = cooldownMs - timeElapsed;

    if (timeLeft > 0) {
        displayElement.textContent = formatTime(timeLeft);
        if (buttonElement) buttonElement.disabled = true;
        return true; // Still on cooldown
    } else {
        displayElement.textContent = "Ready!";
        if (buttonElement) buttonElement.disabled = false;
        return false; // Cooldown finished
    }
}

function startCooldownTimers() {
    setInterval(() => {
        updateCooldownDisplay(lastWatchedAdsTime, WATCHED_ADS_COOLDOWN_MS, watchedAdsCooldownDisplay, document.getElementById('watchAdsButton'));
        updateCooldownDisplay(lastDailyGiftITime, DAILY_GIFT_COOLDOWN_MS, dailyGiftICooldownDisplay, document.getElementById('dailyGiftIButton'));
        updateCooldownDisplay(lastDailyGiftIItime, DAILY_GIFT_COOLDOWN_MS, dailyGiftIICooldownDisplay, document.getElementById('dailyGiftIIButton'));
        updateCooldownDisplay(lastDailyGiftIIITime, DAILY_GIFT_COOLDOWN_MS, dailyGiftIIICooldownDisplay, document.getElementById('dailyGiftIIIButton'));
        // No button for on-page-load ad cooldown, it triggers automatically
    }, 1000);
}

// --- UI Navigation ---
const mainMenu = document.querySelector('.main-menu');
const watchedAdsRoom = document.getElementById('watchedAdsRoom');
const dailyGiftRoom = document.getElementById('dailyGiftRoom');

function showSection(sectionId) {
    mainMenu.style.display = 'none';
    watchedAdsRoom.classList.remove('active');
    dailyGiftRoom.classList.remove('active');
    document.getElementById(sectionId).classList.add('active');
}

window.goBackToMain = function() { // Made global for onclick in HTML
    watchedAdsRoom.classList.remove('active');
    dailyGiftRoom.classList.remove('active');
    mainMenu.style.display = 'block';
    document.getElementById('watchedAdsStatus').textContent = ''; // Clear status
    document.getElementById('dailyGiftIStatus').textContent = '';
    document.getElementById('dailyGiftIIStatus').textContent = '';
    document.getElementById('dailyGiftIIIStatus').textContent = '';
}

document.getElementById('watchedAdsRoomBtn').addEventListener('click', () => showSection('watchedAdsRoom'));
document.getElementById('dailyGiftRoomBtn').addEventListener('click', () => showSection('dailyGiftRoom'));

// --- Popup Logic ---
const rewardPopup = document.getElementById('rewardPopup');
const rewardMessage = document.getElementById('rewardMessage');

function showPopup(message) {
    rewardMessage.textContent = message;
    rewardPopup.style.display = 'block';
}

window.hidePopup = function() { // Made global for onclick in HTML
    rewardPopup.style.display = 'none';
}

// --- Ad Monetization Logic ---

// Function to display a Monetag interstitial ad and return a promise
async function displayMonetagInterstitial(sdkFn, adIndex, statusElement) {
    if (statusElement) statusElement.textContent = `Loading ad ${adIndex} of 3...`;
    return new Promise((resolve) => {
        if (typeof sdkFn === 'function') {
            sdkFn().then(() => {
                console.log(`Monetag interstitial ad ${adIndex} finished.`);
                resolve();
            }).catch(e => {
                console.error(`Error displaying Monetag interstitial ad ${adIndex}:`, e);
                resolve(); // Resolve even on error to allow the ad sequence to continue
            });
        } else {
            console.warn(`Monetag SDK function not found for ad ${adIndex}. Skipping.`);
            if (statusElement) statusElement.textContent = `Ad ${adIndex} skipped (SDK not loaded).`;
            resolve();
        }
    });
}

// Function to display a Monetag rewarded popup and return a promise
async function displayMonetagRewardedPopup(sdkFn, statusElement) {
    if (statusElement) statusElement.textContent = `Loading rewarded ad...`;
    return new Promise((resolve) => {
        if (typeof sdkFn === 'function') {
            sdkFn('pop').then(() => {
                console.log("Monetag rewarded popup finished.");
                resolve(true); // Indicate success for rewarding
            }).catch(e => {
                console.error("Error displaying Monetag rewarded popup:", e);
                resolve(false); // Indicate failure or user closed early
            });
        } else {
            console.warn("Monetag Rewarded Popup SDK function not found. Skipping.");
            if (statusElement) statusElement.textContent = "Rewarded ad skipped (SDK not loaded).";
            resolve(false);
        }
    });
}

// Function to display an Adexium interstitial (note: not directly rewarded by Adexium's client API here)
async function displayAdexiumInterstitial(statusElement) {
    if (statusElement) statusElement.textContent = `Loading Adexium ad...`;
    return new Promise((resolve) => {
        try {
            // Instantiate AdexiumWidget explicitly for manual display
            const adexiumManualWidget = new AdexiumWidget({wid: '0f0f814f-d491-4578-9343-531b503ff453', adFormat: 'interstitial'});
            if (typeof adexiumManualWidget.showAd === 'function') {
                adexiumManualWidget.showAd();
                // Adexium doesn't provide a direct callback for rewarded interstitial completion,
                // so we simulate a delay. The reward is tied to Monetag's completion.
                setTimeout(() => {
                    console.log("Adexium interstitial displayed (simulated completion).");
                    resolve(true);
                }, 3000); // Simulate 3 seconds for the ad to be seen
            } else {
                console.warn("Adexium widget.showAd() not found or not callable. Skipping Adexium interstitial.");
                if (statusElement) statusElement.textContent = "Adexium ad skipped (API missing).";
                resolve(false);
            }
        } catch (e) {
            console.error("Error initializing or showing Adexium ad:", e);
            if (statusElement) statusElement.textContent = "Adexium ad failed to load.";
            resolve(false);
        }
    });
}


// --- Watched Ads Room Logic ---
document.getElementById('watchAdsButton').addEventListener('click', async () => {
    const statusEl = document.getElementById('watchedAdsStatus');
    if (!userId) {
        showPopup("Please wait, user data is loading or not available. Ensure you're in a TWA.");
        return;
    }

    const now = Date.now();
    if (now - lastWatchedAdsTime < WATCHED_ADS_COOLDOWN_MS) {
        const timeLeft = formatTime(WATCHED_ADS_COOLDOWN_MS - (now - lastWatchedAdsTime));
        statusEl.textContent = `Cooldown active. Try again in ${timeLeft}.`;
        return;
    }

    document.getElementById('watchAdsButton').disabled = true;
    statusEl.textContent = "Starting ads sequence...";

    try {
        // Sequence of 3 rewarded interstitial ads
        await displayMonetagInterstitial(window.show_10276123, 1, statusEl); // Monetag #1
        await displayMonetagInterstitial(window.show_10337795, 2, statusEl); // Monetag #2
        await displayMonetagInterstitial(window.show_10337853, 3, statusEl); // Monetag #3

        const rewarded = await addRewardToWallet(WATCHED_ADS_REWARD, 'lastWatchedAdsTime', WATCHED_ADS_COOLDOWN_MS, statusEl);
        if (rewarded) {
            showPopup(`Gained ${WATCHED_ADS_REWARD.toFixed(2)} peso 🎉`);
            statusEl.textContent = "";
        } else {
            statusEl.textContent = "Failed to add reward. Cooldown might have reset or an error occurred.";
        }
    } catch (error) {
        console.error("Error during ad sequence:", error);
        statusEl.textContent = "An unexpected error occurred during ads. Please try again.";
    } finally {
        document.getElementById('watchAdsButton').disabled = false;
    }
});

// --- Daily Gift Room Logic (3 Buttons) ---
async function handleDailyGift(buttonId, statusId, monetagSdkFn, lastGiftTimeField) {
    const statusEl = document.getElementById(statusId);
    const buttonEl = document.getElementById(buttonId);

    if (!userId) {
        showPopup("Please wait, user data is loading or not available. Ensure you're in a TWA.");
        return;
    }

    const now = Date.now();
    let lastTime;
    switch(lastGiftTimeField) {
        case 'lastDailyGiftITime': lastTime = lastDailyGiftITime; break;
        case 'lastDailyGiftIItime': lastTime = lastDailyGiftIItime; break;
        case 'lastDailyGiftIIITime': lastTime = lastDailyGiftIIITime; break;
    }

    if (now - lastTime < DAILY_GIFT_COOLDOWN_MS) {
        const timeLeft = formatTime(DAILY_GIFT_COOLDOWN_MS - (now - lastTime));
        statusEl.textContent = `Cooldown active. Try again in ${timeLeft}.`;
        return;
    }

    buttonEl.disabled = true;
    statusEl.textContent = "Loading daily gift ads...";

    try {
        // 1. Show Monetag Rewarded Popup
        const monetagRewarded = await displayMonetagRewardedPopup(monetagSdkFn, statusEl);

        // 2. Show Adexium Interstitial (reward tied to Monetag completion)
        // This Adexium call is now part of the required ad sequence.
        await displayAdexiumInterstitial(statusEl);

        if (monetagRewarded) { // Only reward if Monetag's rewarded ad completed successfully
            const rewarded = await addRewardToWallet(DAILY_GIFT_REWARD, lastGiftTimeField, DAILY_GIFT_COOLDOWN_MS, statusEl);
            if (rewarded) {
                showPopup(`Congratulations here is your ${DAILY_GIFT_REWARD.toFixed(2)} peso 🎉`);
                statusEl.textContent = "";
            } else {
                statusEl.textContent = "Failed to add reward. Cooldown might have reset or an error occurred.";
            }
        } else {
            statusEl.textContent = "Ad not watched completely or an error occurred. No reward.";
        }

    } catch (error) {
        console.error("Error during daily gift ad sequence:", error);
        statusEl.textContent = "An unexpected error occurred during daily gift. Please try again.";
    } finally {
        buttonEl.disabled = false;
    }
}

document.getElementById('dailyGiftIButton').addEventListener('click', () =>
    handleDailyGift('dailyGiftIButton', 'dailyGiftIStatus', window.show_10276123, 'lastDailyGiftITime')
);

document.getElementById('dailyGiftIIButton').addEventListener('click', () =>
    handleDailyGift('dailyGiftIIButton', 'dailyGiftIIStatus', window.show_10337795, 'lastDailyGiftIItime')
);

document.getElementById('dailyGiftIIIButton').addEventListener('click', () =>
    handleDailyGift('dailyGiftIIIButton', 'dailyGiftIIIStatus', window.show_10337853, 'lastDailyGiftIIITime')
);

// --- Browse and Earn (On Page Load) Logic ---
async function triggerOnPageLoadAd() {
    if (!userId) {
        console.log("User not initialized for On Page Load Ad. Skipping for now.");
        return;
    }

    const now = Date.now();
    if (now - lastOnPageLoadAdTime < ON_PAGE_LOAD_AD_COOLDOWN_MS) {
        console.log("On Page Load Ad cooldown active. Skipping.");
        return;
    }

    // Monetag In-App Interstitial
    if (typeof window.show_10276123 === 'function') {
        console.log("Triggering On Page Load Ad...");
        try {
            const adDisplayed = await new Promise((resolve) => {
                window.show_10276123({
                    type: 'inApp',
                    inAppSettings: {
                        frequency: 1, // Set to 1 to fire on first "page" load (our app load) if cooldown allows
                        capping: 0.1, // Capping 0.1 means 1 ad per 10 page views. Adjust as needed.
                        interval: 30, // 30 seconds interval between ads
                        timeout: 5, // 5 seconds ad timeout
                        everyPage: false // As per your snippet. For SPA, this applies to initial load or "virtual page changes"
                    }
                }).then(() => {
                    console.log("On Page Load Ad finished.");
                    resolve(true);
                }).catch(e => {
                    console.error("Error displaying On Page Load Ad:", e);
                    resolve(false); // Ad failed or user closed
                });
            });

            if (adDisplayed) { // Only reward if ad displayed/completed
                const rewarded = await addRewardToWallet(ON_PAGE_LOAD_AD_REWARD, 'lastOnPageLoadAdTime', ON_PAGE_LOAD_AD_COOLDOWN_MS, null);
                if (rewarded) {
                    showPopup(`Congratulations Earn ${ON_PAGE_LOAD_AD_REWARD.toFixed(2)} peso 🎉`);
                    // Open random site after reward
                    const randomLink = telegramBotLinks[Math.floor(Math.random() * telegramBotLinks.length)];
                    console.log("Opening random link:", randomLink);
                    window.open(randomLink, '_blank');
                }
            }
        } catch (error) {
            console.error("Error with On Page Load Ad logic:", error);
        }
    } else {
        console.warn("Monetag SDK function (show_10276123) for In-App Interstitial not found. Skipping On Page Load Ad.");
    }
}


// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeUser);

