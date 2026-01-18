
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
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

let firebaseUserId = null;
let userData = {
    balance: 0,
    referredBy: "",
    inviteCount: 0,
    refEarnings: 0,
    username: telegramUsername,
    telegramId: telegramUserId
};
let currentTaskId = null;
let appInitialized = false;
let isAdminMode = false; // New global flag for admin mode

// Exchange rate: 1 PHP = PHP_TO_USDT_RATE USDT (approx 1 USDT = 55 PHP)
const PHP_TO_USDT_RATE = 0.018; // Example rate, adjust as needed

// --- Pagination Configuration ---
const PAGE_SIZE = 10;
const pagination = {
    // userHistory is for the *current user's* history in user mode.
    // In admin mode, adminPending and adminHistory are used.
    userHistory: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null },
    adminPending: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null },
    adminHistory: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null },
    globalStats: { unsubscribe: null } // To manage the stats listener
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
                telegramId: d.telegramId || firebaseUserId
            };
            console.log("User data synced from Firestore:", userData);
        } else {
            userData = {
                username: telegramUsername,
                balance: 0,
                referredBy: "",
                inviteCount: 0,
                refEarnings: 0,
                telegramId: firebaseUserId
            };
            await userDocRef.set(userData);
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

    // Update USDT equivalent whenever balance or input changes (relevant to withdrawal form)
    calculateUsdt();
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

    // Clean up any active listeners when leaving the unified withdrawal page
    if (id !== 'unifiedWithdrawalPage') {
        unsubscribeAllWithdrawalListeners();
        isAdminMode = false; // Reset admin mode when leaving
        document.body.classList.remove('admin-active'); // Remove admin class
        localStorage.removeItem('isAdmin'); // Ensure admin mode isn't persistent across non-withdrawal pages
    }
}

// Helper to unsubscribe all active withdrawal listeners
function unsubscribeAllWithdrawalListeners() {
    if (pagination.userHistory.unsubscribe) {
        pagination.userHistory.unsubscribe();
        pagination.userHistory.unsubscribe = null;
    }
    if (pagination.adminPending.unsubscribe) {
        pagination.adminPending.unsubscribe();
        pagination.adminPending.unsubscribe = null;
    }
    if (pagination.adminHistory.unsubscribe) {
        pagination.adminHistory.unsubscribe();
        pagination.adminHistory.unsubscribe = null;
    }
    if (pagination.globalStats.unsubscribe) {
        pagination.globalStats.unsubscribe();
        pagination.globalStats.unsubscribe = null;
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
        await db.collection("users").doc(firebaseUserId).set({ balance: firebase.firestore.FieldValue.increment(reward) }, { merge: true });

        if (userData.referredBy) {
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).limit(1).get();
            if (!refSnap.empty) {
                const inviterDocId = refSnap.docs[0].id;
                await db.collection("users").doc(inviterDocId).set({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm)
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
    const phpAmount = parseFloat(document.getElementById("wAmount").value) || 0;
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
        await db.collection("users").doc(firebaseUserId).set({ balance: firebase.firestore.FieldValue.increment(-amountPHP) }, { merge: true });

        await db.collection("withdrawals").add({
            userId: firebaseUserId,
            username: userData.username,
            amountPHP: amountPHP,
            amountUSDT: amountUSDT, // Store converted USDT amount
            info,
            method,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            timeStr: new Date().toLocaleString()
        });

        alert(`Withdrawal request for ${amountPHP.toFixed(3)} PHP (${amountUSDT.toFixed(4)} USDT) submitted successfully!`);
        document.getElementById("wAmount").value = "";
        document.getElementById("wInfo").value = "";
        calculateUsdt(); // Reset USDT display
    } catch (e) {
        handleError("Failed to submit withdrawal", e.message);
        // Attempt to return funds if the Firestore write failed
        await db.collection("users").doc(firebaseUserId).set({ balance: firebase.firestore.FieldValue.increment(amountPHP) }, { merge: true });
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
        await db.collection("users").doc(firebaseUserId).set({ username: newUsername }, { merge: true });
        userData.username = newUsername;
        updateUI();
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

// Universal pagination navigation logic
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

    if (section === 'userHistory') { // This is always for the current user's history
        loadUserWithdrawalHistory();
    }
    else if (section === 'adminPending') loadAdminPendingRequests();
    else if (section === 'adminHistory') loadAdminHistoryRequests();

    updatePaginationUI(section);
}


// --- Show Unified Withdrawal Page (User or Admin Mode) ---
async function showUnifiedWithdrawalPage() {
    // Before showing the page, clean up any previous listeners
    unsubscribeAllWithdrawalListeners();

    // Check for admin mode persistence or prompt
    let shouldPrompt = true;
    if (localStorage.getItem('isAdmin') === 'true') {
        isAdminMode = true; // Assume admin mode if previously set
        shouldPrompt = false;
    } else {
        isAdminMode = false; // Default to user mode
    }

    if (shouldPrompt) {
        const confirmAdmin = confirm("Enter admin password to view all withdrawals, or click Cancel for personal view.");
        if (confirmAdmin) {
            const password = prompt("Admin Password:");
            if (password === "Propetas6") {
                isAdminMode = true;
                localStorage.setItem('isAdmin', 'true'); // Persist admin mode for session
            } else {
                alert("Incorrect password. Showing personal withdrawal view.");
                localStorage.removeItem('isAdmin'); // Ensure incorrect attempt doesn't persist
                isAdminMode = false;
            }
        } else {
            localStorage.removeItem('isAdmin'); // Ensure canceled prompt doesn't persist admin state
            isAdminMode = false;
        }
    }


    showPage('unifiedWithdrawalPage'); // Show the page content

    // Apply/remove admin-active class to body for CSS styling
    if (isAdminMode) {
        document.body.classList.add('admin-active');
        document.getElementById("withdrawalPageTitle").innerText = "🛠 Admin Withdrawal Dashboard";
    } else {
        document.body.classList.remove('admin-active');
        document.getElementById("withdrawalPageTitle").innerText = "💰 Withdrawal Section";
    }

    // Reset all pagination states for a fresh load
    const resetPagination = (section) => {
        pagination[section].currentPage = 1;
        pagination[section].currentStartDoc = null;
        pagination[section].historyStack = [];
        pagination[section].lastFetchedDoc = null;
        pagination[section].isEndOfList = false;
        if (pagination[section].unsubscribe) {
            pagination[section].unsubscribe();
            pagination[section].unsubscribe = null;
        }
    };

    resetPagination('userHistory');
    resetPagination('adminPending');
    resetPagination('adminHistory');

    // Load data based on admin mode
    if (isAdminMode) {
        // Listener for global stats
        if (pagination.globalStats.unsubscribe) pagination.globalStats.unsubscribe(); // Clean up if already existing
        pagination.globalStats.unsubscribe = db.collection("stats").doc("global").onSnapshot(d => {
            const data = d.data() || {};
            document.getElementById("statPHP").innerText = (data.paid || 0).toFixed(2);
            document.getElementById("statApprovedCount").innerText = data.approvedCount || 0;
            document.getElementById("statApprovedAmount").innerText = (data.approvedAmount || 0).toFixed(2);
        }, err => {
            console.error("Error fetching global stats:", err);
            handleError("Failed to load dashboard stats", err.message);
        });

        loadAdminPendingRequests();
        loadAdminHistoryRequests();
    } else {
        loadUserWithdrawalHistory(); // Load user's own withdrawal history
    }
}


// --- Load User's Personal Withdrawal History with Pagination and Real-time Sync ---
function loadUserWithdrawalHistory() {
    if (!firebaseUserId) return; // User must be established

    const pageData = pagination.userHistory;
    let query = db.collection("withdrawals")
        .where("userId", "==", firebaseUserId) // Filter by current user
        .orderBy("timestamp", "desc");

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

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


// --- Load Admin Pending Requests with Pagination and Real-time Sync ---
function loadAdminPendingRequests() {
    if (!isAdminMode) return; // Only load if in admin mode

    const pageData = pagination.adminPending;
    let query = db.collection("withdrawals")
        .where("status", "==", "pending")
        .orderBy("timestamp", "asc"); // Oldest first for pending

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>User</th><th>Amount (PHP/USDT)</th><th>Account Info</th><th>Actions</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No more pending requests.' : 'No pending requests.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.username || 'Unknown'}</td>
                        <td>${d.amountPHP ? d.amountPHP.toFixed(3) : '0.000'} PHP (${d.amountUSDT ? d.amountUSDT.toFixed(4) : '0.0000'} USDT)</td>
                        <td>${d.method || 'N/A'}: ${d.info || 'N/A'}</td>
                        <td>
                            <button onclick="admProcess('${doc.id}','paid',${d.amountPHP})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--success')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer;">Pay</button>
                            <button onclick="admProcess('${doc.id}','denied',${d.amountPHP})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--danger')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer; margin-left:5px;">Deny</button>
                        </td>
                      </tr>`;
            });
        }
        document.getElementById("adminPending").innerHTML = h + "</table>";

        pageData.lastFetchedDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        updatePaginationUI('adminPending');

    }, err => {
        console.error("Sync admin pending requests:", err);
        handleError("Failed to load pending withdrawal requests", err.message);
    });
}

// --- Load Admin History Requests (Approved/Denied) with Pagination and Real-time Sync ---
function loadAdminHistoryRequests() {
    if (!isAdminMode) return; // Only load if in admin mode

    const pageData = pagination.adminHistory; // This now corresponds to admin's history table
    let query = db.collection("withdrawals")
        .where("status", "!=", "pending") // Show paid or denied
        .orderBy("timestamp", "desc"); // Newest first for history

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>User</th><th>Amount (PHP/USDT)</th><th>Account Info</th><th>Status</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No more approved/denied history.' : 'No approved/denied history.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.username || 'Unknown'}</td>
                        <td>${d.amountPHP ? d.amountPHP.toFixed(3) : '0.000'} PHP (${d.amountUSDT ? d.amountUSDT.toFixed(4) : '0.0000'} USDT)</td>
                        <td>${d.method || 'N/A'}: ${d.info || 'N/A'}</td>
                        <td class="status-${d.status}">${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</td>
                      </tr>`;
            });
        }
        document.getElementById("adminHistory").innerHTML = h + "</table>"; // Ensure this targets the right ID

        pageData.lastFetchedDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        updatePaginationUI('adminHistory'); // Update pagination for admin history

    }, err => {
        console.error("Sync admin history:", err);
        handleError("Failed to load approved/denied withdrawal history", err.message);
    });
}


async function admProcess(id, status, amountPHP) { // amountPHP is passed here
    try {
        await db.collection("withdrawals").doc(id).set({ status: status }, { merge: true });

        if (status === 'paid') {
            await db.collection("stats").doc("global").set({
                paid: firebase.firestore.FieldValue.increment(amountPHP), // Use PHP amount for total paid
                approvedCount: firebase.firestore.FieldValue.increment(1),
                approvedAmount: firebase.firestore.FieldValue.increment(amountPHP)
            }, { merge: true });
            alert(`Withdrawal for ID ${id} marked as paid.`);
        } else if (status === 'denied') {
            const deniedWithdrawalSnap = await db.collection("withdrawals").doc(id).get();
            const deniedWithdrawalData = deniedWithdrawalSnap.data();

            if (deniedWithdrawalData && deniedWithdrawalData.userId && deniedWithdrawalData.amountPHP) {
                // Return the funds to the user's balance in PHP
                await db.collection("users").doc(deniedWithdrawalData.userId).set({
                    balance: firebase.firestore.FieldValue.increment(deniedWithdrawalData.amountPHP)
                }, { merge: true });
                alert(`Withdrawal for ID ${id} denied. Funds (${deniedWithdrawalData.amountPHP.toFixed(3)} PHP) returned to user.`);
            } else {
                 console.error("Could not find withdrawal data or user ID for denied request:", id);
                 alert("Could not return funds for denied request. Data missing.");
            }
        }
    } catch (e) {
        handleError("Failed to process withdrawal", e.message);
    }
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

        await db.collection("users").doc(firebaseUserId).set({ referredBy: inviterUsername }, { merge: true });
        await db.collection("users").doc(inviterDocId).set({ inviteCount: firebase.firestore.FieldValue.increment(1) }, { merge: true });

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
    document.getElementById("userBar").innerText = `👤 @${telegramUsername}`;
    initializeUserAndData();
});
