
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

// --- Pagination Configuration ---
const PAGE_SIZE = 10;
const pagination = {
    userHistory: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null },
    adminPending: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null },
    adminHistory: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null }
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

    if (id === 'withdrawPage') {
        const pageData = pagination.userHistory;
        pageData.currentPage = 1;
        pageData.currentStartDoc = null;
        pageData.historyStack = [];
        pageData.lastFetchedDoc = null;
        pageData.isEndOfList = false;
        if (pageData.unsubscribe) pageData.unsubscribe(); // Unsubscribe old listener
        loadUserWithdrawalHistory();
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

// --- Withdrawal Logic ---
async function submitWithdraw() {
    if (!firebaseUserId) {
        handleError("User not established", "Cannot submit withdrawal.");
        return;
    }

    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();
    const method = document.getElementById("wMethod").value;

    if (!amount || amount < 0.05 || !info) {
        alert("Minimum withdrawal is 0.05 PHP. Please fill all fields correctly.");
        return;
    }
    if (amount > userData.balance) {
        alert("Insufficient balance.");
        return;
    }

    try {
        await db.collection("users").doc(firebaseUserId).set({ balance: firebase.firestore.FieldValue.increment(-amount) }, { merge: true });

        await db.collection("withdrawals").add({
            userId: firebaseUserId,
            username: userData.username,
            amount,
            info,
            method,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            timeStr: new Date().toLocaleString()
        });

        alert("Withdrawal request submitted successfully!");
        document.getElementById("wAmount").value = "";
        document.getElementById("wInfo").value = "";
    } catch (e) {
        handleError("Failed to submit withdrawal", e.message);
        // Attempt to return funds if the Firestore write failed
        await db.collection("users").doc(firebaseUserId).set({ balance: firebase.firestore.FieldValue.increment(amount) }, { merge: true });
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
    document.getElementById(`${section}CurrentPage`).innerText = pageData.currentPage;
    document.getElementById(`${section}Prev`).disabled = pageData.currentPage === 1;
    document.getElementById(`${section}Next`).disabled = pageData.isEndOfList;
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

    // *** FIX: Unsubscribe the previous listener BEFORE creating a new query ***
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null; // Clear the reference
    }

    if (section === 'userHistory') loadUserWithdrawalHistory();
    else if (section === 'adminPending') loadAdminPendingRequests();
    else if (section === 'adminHistory') loadAdminHistoryRequests();

    updatePaginationUI(section);
}


// --- Load User Withdrawal History with Pagination and Real-time Sync ---
function loadUserWithdrawalHistory() {
    if (!firebaseUserId) return;

    const pageData = pagination.userHistory;
    let query = db.collection("withdrawals")
        .where("userId", "==", firebaseUserId)
        .orderBy("timestamp", "desc");

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    // *** FIX: Ensure any existing listener is unsubscribed before setting up a new one ***
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>Name</th><th>Amount</th><th>Method & Account</th><th>Status</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No withdrawal history for this page.' : 'No withdrawal history.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.username || 'Unknown'}</td>
                        <td>${d.amount ? d.amount.toFixed(3) : 0} PHP</td>
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
        handleError("Failed to load withdrawal history", err.message);
    });
}


// --- Owner Dashboard Logic ---
function checkAdmin() {
    const password = prompt("Owner Password:");
    if (password === "Propetas6") {
        showPage('adminPage');

        // Listener for global stats
        if (pagination.adminPending.statsUnsubscribe) pagination.adminPending.statsUnsubscribe(); // Clean up if already existing
        pagination.adminPending.statsUnsubscribe = db.collection("stats").doc("global").onSnapshot(d => {
            const data = d.data() || {};
            document.getElementById("statPHP").innerText = (data.paid || 0).toFixed(2);
            document.getElementById("statApprovedCount").innerText = data.approvedCount || 0;
            document.getElementById("statApprovedAmount").innerText = (data.approvedAmount || 0).toFixed(2);
        }, err => {
            console.error("Error fetching global stats:", err);
            handleError("Failed to load dashboard stats", err.message);
        });

        // Reset and load admin tables
        let pageDataPending = pagination.adminPending;
        pageDataPending.currentPage = 1;
        pageDataPending.currentStartDoc = null;
        pageDataPending.historyStack = [];
        pageDataPending.lastFetchedDoc = null;
        pageDataPending.isEndOfList = false;
        if (pageDataPending.unsubscribe) pageDataPending.unsubscribe(); // Unsubscribe old listener
        loadAdminPendingRequests();

        let pageDataHistory = pagination.adminHistory;
        pageDataHistory.currentPage = 1;
        pageDataHistory.currentStartDoc = null;
        pageDataHistory.historyStack = [];
        pageDataHistory.lastFetchedDoc = null;
        pageDataHistory.isEndOfList = false;
        if (pageDataHistory.unsubscribe) pageDataHistory.unsubscribe(); // Unsubscribe old listener
        loadAdminHistoryRequests();

    } else {
        alert("Access Denied!");
    }
}

// --- Load Admin Pending Requests with Pagination and Real-time Sync ---
function loadAdminPendingRequests() {
    const pageData = pagination.adminPending;
    let query = db.collection("withdrawals")
        .where("status", "==", "pending")
        .orderBy("timestamp", "asc");

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    // *** FIX: Unsubscribe the previous listener BEFORE creating a new query ***
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Actions</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No pending requests for this page.' : 'No pending requests.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.username || 'Unknown'}</td>
                        <td>${d.amount ? d.amount.toFixed(3) : 0} PHP</td>
                        <td>${d.method || 'N/A'}: ${d.info || 'N/A'}</td>
                        <td>
                            <button onclick="admProcess('${doc.id}','paid',${d.amount})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--success')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer;">Pay</button>
                            <button onclick="admProcess('${doc.id}','denied',${d.amount})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--danger')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer; margin-left:5px;">Deny</button>
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

// --- Load Admin History Requests with Pagination and Real-time Sync ---
function loadAdminHistoryRequests() {
    const pageData = pagination.adminHistory;
    let query = db.collection("withdrawals")
        .where("status", "!=", "pending")
        .orderBy("timestamp", "desc");

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    // *** FIX: Unsubscribe the previous listener BEFORE creating a new query ***
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Status</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No approved/denied history for this page.' : 'No approved/denied history.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.username || 'Unknown'}</td>
                        <td>${d.amount ? d.amount.toFixed(3) : 0} PHP</td>
                        <td>${d.method || 'N/A'}: ${d.info || 'N/A'}</td>
                        <td class="status-${d.status}">${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</td>
                      </tr>`;
            });
        }
        document.getElementById("adminHistory").innerHTML = h + "</table>";

        pageData.lastFetchedDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        updatePaginationUI('adminHistory');

    }, err => {
        console.error("Sync admin history:", err);
        handleError("Failed to load withdrawal history", err.message);
    });
}


async function admProcess(id, status, amount) {
    try {
        await db.collection("withdrawals").doc(id).set({ status: status }, { merge: true });

        if (status === 'paid') {
            await db.collection("stats").doc("global").set({
                paid: firebase.firestore.FieldValue.increment(amount),
                approvedCount: firebase.firestore.FieldValue.increment(1),
                approvedAmount: firebase.firestore.FieldValue.increment(amount)
            }, { merge: true });
            alert(`Withdrawal for ID ${id} marked as paid.`);
        } else if (status === 'denied') {
            const deniedWithdrawalSnap = await db.collection("withdrawals").doc(id).get();
            const deniedWithdrawalData = deniedWithdrawalSnap.data();

            if (deniedWithdrawalData && deniedWithdrawalData.userId && deniedWithdrawalData.amount) {
                await db.collection("users").doc(deniedWithdrawalData.userId).set({
                    balance: firebase.firestore.FieldValue.increment(deniedWithdrawalData.amount)
                }, { merge: true });
                alert(`Withdrawal for ID ${id} denied. Funds returned to user.`);
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
