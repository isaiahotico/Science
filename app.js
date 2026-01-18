
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTN7c", // Your Firebase API Key
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const tg = window.Telegram?.WebApp;
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : null;
const telegramUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || `User_${telegramUserId}`) : `Guest`;

let firebaseUserId = null; // This will be the user's unique identifier for Firestore documents
let userData = {
    balance: 0,
    referredBy: "",
    inviteCount: 0,
    refEarnings: 0,
    username: telegramUsername,
    telegramId: telegramUserId // Stored in user doc for direct lookup
};
let currentTaskId = null;
let appInitialized = false;

// Exchange rate: 1 PHP = PHP_TO_USDT_RATE USDT (approx 1 USDT = 55 PHP)
// Adjust this rate based on current market conditions or your preferred fixed rate.
const PHP_TO_USDT_RATE = 0.018; // Example: 1 PHP = 0.018 USDT (approx 1 USDT = 55.5 PHP)

// --- Pagination Configuration (User-specific only) ---
const PAGE_SIZE = 10;
const pagination = {
    userHistory: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null }
};

function handleError(message, details = '') {
    alert("Operation failed: " + message + "\nDetails: " + details);
    console.error("Application error:", message, details);
}

// --- Initialize User Identity and Data Sync ---
async function initializeUserAndData() {
    if (telegramUserId) {
        firebaseUserId = telegramUserId;
        console.log("Using Telegram User ID:", firebaseUserId);
    } else {
        let guestId = localStorage.getItem('guestFirebaseId');
        if (!guestId) {
            guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem('guestFirebaseId', guestId);
        }
        firebaseUserId = guestId;
        console.log("Using persistent Guest User ID:", firebaseUserId);
    }

    const userDocRef = db.collection("users").doc(firebaseUserId);
    userDocRef.onSnapshot(async (doc) => {
        if (doc.exists) {
            const d = doc.data();
            userData = {
                username: d.username || telegramUsername,
                balance: Number(d.balance) || 0,
                referredBy: d.referredBy || "",
                inviteCount: Number(d.inviteCount) || 0,
                refEarnings: Number(d.refEarnings) || 0,
                telegramId: d.telegramId || firebaseUserId // Ensure telegramId is always in userData
            };
            console.log("User data synced from Firestore:", userData);
        } else {
            userData = {
                username: telegramUsername,
                balance: 0,
                referredBy: "",
                inviteCount: 0,
                refEarnings: 0,
                telegramId: firebaseUserId // Set telegramId for new users
            };
            // IMPORTANT: Include requesterId for security rules to validate creation
            await userDocRef.set({ ...userData, requesterId: firebaseUserId });
            console.log("New user profile created for ID:", firebaseUserId, "with data:", userData);
        }
        updateUI();
        if (!appInitialized) {
            initAppFeatures();
            appInitialized = true;
        }
    }, err => handleError("Error syncing user data", err.message));
}

// --- UI Update Function ---
function updateUI() {
    document.getElementById("mainBalance").innerText = userData.balance.toFixed(3);
    document.getElementById("userBar").innerText = `👤 @${userData.username}`;
    document.getElementById("myUser").innerText = userData.username;
    document.getElementById("myTelegramId").innerText = userData.telegramId || "N/A";
    document.getElementById("invCount").innerText = userData.inviteCount;
    document.getElementById("invEarned").innerText = userData.refEarnings.toFixed(3);
    document.getElementById("editUsername").value = (userData.username === "User" || userData.username.startsWith("User_") || userData.username === "Guest") ? "" : userData.username;

    calculateUsdt(); // Update USDT equivalent whenever balance or input changes
}

// --- Initialize App Features ---
function initAppFeatures() {
    console.log("Initializing app features...");
    setInterval(showRandomInAppInterstitial, 120 * 1000);
    fetchLeaderboard();
}

// --- Automatic In-App Interstitial Ads (No Reward) ---
function showRandomInAppInterstitial() {
    const zones = [10276123, 10337795, 10337853];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const adFn = window[`show_${randomZone}`];

    if (typeof adFn === 'function') {
        adFn({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } })
            .catch(e => { /* console.log("In-App Interstitial ad failed.", e); */ });
    }
}

// --- Page Navigation ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns();

    // Clean up userHistory listener when leaving the withdrawal page
    if (id !== 'withdrawalPage') {
        if (pagination.userHistory.unsubscribe) {
            pagination.userHistory.unsubscribe();
            pagination.userHistory.unsubscribe = null;
        }
    }
}

// --- Ad Task Logic ---
async function runTask(id, zone, type = 'interstitial') {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        try {
            const promise = (type === 'pop') ? adFn('pop') : adFn();
            await promise;
            currentTaskId = id;
            document.getElementById(`btn_${id}`).style.display = 'none';
            document.getElementById(`claim_${id}`).style.display = 'block';
        } catch (e) {
            handleError(`Ad task for ID ${id} failed`, e.message);
        }
    } else {
        handleError("Ad provider not loaded", "Check your internet connection or ad blocker.");
    }
}

// --- Claim Reward Logic ---
async function claimReward(id) {
    if (!firebaseUserId) {
        handleError("User not established", "Please reload the app.");
        return;
    }
    if (currentTaskId !== id) {
        alert("Please claim the correct ad you just watched.");
        return;
    }

    let reward = 0.02;
    let refComm = reward * 0.10;
    if (id === 'D1') {
        reward = 0.10;
        refComm = reward * 0.10;
    }

    try {
        // Update user balance, including requesterId for security rules
        await db.collection("users").doc(firebaseUserId).set({
            balance: firebase.firestore.FieldValue.increment(reward),
            requesterId: firebaseUserId // For security rules
        }, { merge: true });

        // Update referrer's earnings if applicable
        if (userData.referredBy) {
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).limit(1).get();
            if (!refSnap.empty) {
                const inviterDocId = refSnap.docs[0].id;
                // Update referrer balance and earnings, including requesterId
                await db.collection("users").doc(inviterDocId).set({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm),
                    requesterId: firebaseUserId // For security rules (current user is the requester)
                }, { merge: true });
            }
        }

        let cooldownSeconds = 300; // 5 minutes
        if (id.toString().startsWith('G')) cooldownSeconds = 3600; // 1 hour
        if (id.toString().startsWith('S')) cooldownSeconds = 1200; // 20 minutes
        if (id === 'D1') cooldownSeconds = 86400; // 24 hours

        localStorage.setItem(`cd_${id}_${firebaseUserId}`, Date.now() + (cooldownSeconds * 1000));

        document.getElementById(`claim_${id}`).style.display = 'none';
        document.getElementById(`btn_${id}`).style.display = 'block';
        currentTaskId = null;
        checkCooldowns();
    } catch (e) {
        handleError("Failed to claim reward", e.message);
    }
}

// --- USDT Conversion Display ---
function calculateUsdt() {
    const phpAmountInput = document.getElementById("wAmount");
    if (!phpAmountInput) return; // Ensure the element exists

    const phpAmount = parseFloat(phpAmountInput.value) || 0;
    const usdtAmount = phpAmount * PHP_TO_USDT_RATE;
    document.getElementById("usdtEquivalent").innerText = usdtAmount.toFixed(4);
}

// --- Withdrawal Logic ---
async function submitWithdraw() {
    if (!firebaseUserId) {
        handleError("User not established", "Cannot submit withdrawal.");
        return;
    }

    const amountPHP = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();
    const method = document.getElementById("wMethod").value;
    const amountUSDT = amountPHP * PHP_TO_USDT_RATE;

    if (!amountPHP || amountPHP < 0.05 || !info) {
        alert("Minimum withdrawal is 0.05 PHP. Please fill all fields correctly.");
        return;
    }
    if (amountPHP > userData.balance) {
        alert("Insufficient balance.");
        return;
    }

    try {
        // Decrease user balance, including requesterId for security rules
        await db.collection("users").doc(firebaseUserId).set({
            balance: firebase.firestore.FieldValue.increment(-amountPHP),
            requesterId: firebaseUserId // For security rules
        }, { merge: true });

        // Add withdrawal request, including requesterId for security rules
        await db.collection("withdrawals").add({
            userId: firebaseUserId, // The ID of the user requesting withdrawal
            username: userData.username,
            amountPHP: amountPHP,
            amountUSDT: amountUSDT,
            info,
            method,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            timeStr: new Date().toLocaleString(),
            requesterId: firebaseUserId // For security rules: identifies who initiated this request
        });

        alert(`Withdrawal request for ${amountPHP.toFixed(3)} PHP (${amountUSDT.toFixed(4)} USDT) submitted successfully!`);
        document.getElementById("wAmount").value = "";
        document.getElementById("wInfo").value = "";
        calculateUsdt(); // Reset USDT display
    } catch (e) {
        handleError("Failed to submit withdrawal", e.message);
        // Attempt to return funds if the Firestore write failed, including requesterId
        await db.collection("users").doc(firebaseUserId).set({
            balance: firebase.firestore.FieldValue.increment(amountPHP),
            requesterId: firebaseUserId
        }, { merge: true });
    }
}

// --- Fetch Leaderboard Data ---
async function fetchLeaderboard() {
    try {
        const lbDoc = await db.collection("leaderboard").doc("topEarners").get();
        if (lbDoc.exists) {
            const earners = lbDoc.data().users || [];
            let h = `<table><tr><th>Rank</th><th>Username</th><th>Total Earned</th></tr>`;
            if (earners.length === 0) {
                h += `<tr><td colspan="3">Leaderboard is empty.</td></tr>`;
            } else {
                earners.forEach((entry, index) => {
                    h += `<tr><td>${index + 1}</td><td>${entry.username}</td><td>${entry.earnings.toFixed(3)} PHP</td></tr>`;
                });
            }
            document.getElementById("leaderboardContent").innerHTML = h + "</table>";
        } else {
            document.getElementById("leaderboardContent").innerHTML = "<p>Leaderboard is empty or not yet configured.</p>";
        }
    } catch (e) {
        handleError("Failed to fetch leaderboard", e.message);
        document.getElementById("leaderboardContent").innerHTML = "<p>Error loading leaderboard.</p>";
    }
}

// --- Update Username ---
async function updateUsername() {
    if (!firebaseUserId) {
        handleError("User not established", "Cannot update username.");
        return;
    }
    const newUsername = document.getElementById("editUsername").value.trim();
    if (!newUsername || newUsername === "User" || newUsername.startsWith("User_") || newUsername === "Guest") {
        alert("Invalid username. Please choose a unique name.");
        return;
    }

    try {
        // Update username in user's profile, including requesterId for security rules
        await db.collection("users").doc(firebaseUserId).set({
            username: newUsername,
            requesterId: firebaseUserId // For security rules
        }, { merge: true });
        userData.username = newUsername; // Update local state
        updateUI(); // Refresh UI with new username
        alert("Username updated successfully!");
    } catch (e) {
        handleError("Failed to update username", e.message);
    }
}

// --- Pagination Helper Functions ---
function updatePaginationUI(section) {
    const pageData = pagination[section];
    const currentPageSpan = document.getElementById(`${section}CurrentPage`);
    if (currentPageSpan) currentPageSpan.innerText = pageData.currentPage;
    const prevButton = document.getElementById(`${section}Prev`);
    if (prevButton) prevButton.disabled = pageData.currentPage === 1;
    const nextButton = document.getElementById(`${section}Next`);
    if (nextButton) nextButton.disabled = pageData.isEndOfList;
}

// Universal pagination navigation logic (user-specific only)
async function navigatePagination(section, direction) {
    if (!firebaseUserId) {
        handleError("User not established", "Cannot navigate pages.");
        return;
    }

    const pageData = pagination[section];

    if (direction === 1) { // Moving to next page
        if (pageData.isEndOfList) return;
        pageData.historyStack.push(pageData.lastFetchedDoc);
        pageData.currentPage++;
        pageData.currentStartDoc = pageData.historyStack.length > 0 ? pageData.historyStack[pageData.historyStack.length - 1] : null;
    } else if (direction === -1) { // Moving to previous page
        if (pageData.currentPage === 1) return;
        pageData.historyStack.pop();
        pageData.currentPage--;
        pageData.currentStartDoc = pageData.historyStack.length > 0 ? pageData.historyStack[pageData.historyStack.length - 1] : null;
    }

    // Unsubscribe the previous listener BEFORE creating a new query
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    // Reload the data for the new page
    if (section === 'userHistory') {
        loadUserWithdrawalHistory();
    }
    updatePaginationUI(section);
}


// --- Show User Withdrawal Page (User Mode Only) ---
async function showWithdrawalPage() {
    showPage('withdrawalPage'); // Show the page content

    // Reset userHistory pagination state for a fresh load
    const pageData = pagination.userHistory;
    pageData.currentPage = 1;
    pageData.currentStartDoc = null;
    pageData.historyStack = [];
    pageData.lastFetchedDoc = null;
    pageData.isEndOfList = false;
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    loadUserWithdrawalHistory(); // Load user's own withdrawal history
}


// --- Load User's Personal Withdrawal History with Pagination and Real-time Sync ---
function loadUserWithdrawalHistory() {
    if (!firebaseUserId) {
        handleError("User not identified", "Cannot load withdrawal history.");
        return;
    }

    const pageData = pagination.userHistory;
    // Query for withdrawals belonging to the current user, ordered by timestamp descending
    let query = db.collection("withdrawals")
        .where("userId", "==", firebaseUserId) // Filter by current user's ID
        .orderBy("timestamp", "desc");

    // Apply pagination
    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    // Ensure any existing listener is unsubscribed
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    // Set up the real-time listener
    // This will auto-sync status updates from admin dashboard
    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>Amount (PHP)</th><th>Amount (USDT)</th><th>Method & Account</th><th>Status</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No more records.' : 'No withdrawal history yet.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.amountPHP ? d.amountPHP.toFixed(3) : '0.000'} PHP</td>
                        <td>${d.amountUSDT ? d.amountUSDT.toFixed(4) : '0.0000'} USDT</td>
                        <td>${d.method || 'N/A'}: ${d.info || 'N/A'}</td>
                        <td class="status-${d.status}">${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</td>
                      </tr>`;
            });
        }
        document.getElementById("userHistory").innerHTML = h + "</table>";

        pageData.lastFetchedDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        updatePaginationUI('userHistory');

    }, err => {
        console.error("Error syncing user withdrawal history:", err);
        handleError("Failed to load your withdrawal history", err.message);
    });
}

// --- Referral Linking ---
async function setReferrer() {
    if (!firebaseUserId) {
        handleError("User not established", "Cannot link referrer.");
        return;
    }

    const inviterTelegramId = document.getElementById("refInput").value.trim();
    if (!inviterTelegramId) {
        alert("Please enter the inviter's Telegram ID.");
        return;
    }
    if (inviterTelegramId === firebaseUserId) {
        alert("You cannot refer yourself.");
        return;
    }

    try {
        const snap = await db.collection("users").where("telegramId", "==", inviterTelegramId).limit(1).get();
        if (snap.empty) {
            alert("Inviter with that Telegram ID not found.");
            return;
        }

        const inviterDoc = snap.docs[0];
        const inviterUsername = inviterDoc.data().username;
        const inviterDocId = inviterDoc.id;

        // Set the 'referredBy' field for the current user, including requesterId
        await db.collection("users").doc(firebaseUserId).set({
            referredBy: inviterUsername,
            requesterId: firebaseUserId // For security rules
        }, { merge: true });
        // Increment the invite count for the inviter, including requesterId
        await db.collection("users").doc(inviterDocId).set({
            inviteCount: firebase.firestore.FieldValue.increment(1),
            requesterId: firebaseUserId // For security rules
        }, { merge: true });

        alert(`Successfully linked to inviter @${inviterUsername}!`);
    } catch (e) {
        handleError("Failed to link referrer", e.message);
    }
}

// --- Cooldowns & Clock Display ---
function checkCooldowns() {
    const currentFirebaseUserId = firebaseUserId;
    if (!currentFirebaseUserId) return;

    const ids = ['1', '2', '3', 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4', 'D1'];
    ids.forEach(id => {
        const endTime = localStorage.getItem(`cd_${id}_${currentFirebaseUserId}`);
        const button = document.getElementById(`btn_${id}`);
        const label = document.getElementById(`timer_${id}`);

        if (button && endTime && Date.now() < endTime) {
            button.disabled = true;
            const remainingSeconds = Math.floor((endTime - Date.now()) / 1000);
            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            const seconds = remainingSeconds % 60;
            label.innerText = `Wait: ${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
        } else if (button) {
            button.disabled = false;
            if (label) label.innerText = "";
            if (endTime && Date.now() >= endTime) {
                localStorage.removeItem(`cd_${id}_${currentFirebaseUserId}`);
            }
        }
    });
}

// --- Initial Callbacks ---
setInterval(checkCooldowns, 1000);
setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("userBar").innerText = `👤 ${telegramUsername}`;
    initializeUserAndData();
});
