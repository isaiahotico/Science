
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
// Firebase Authentication is explicitly removed as per request.
// const auth = firebase.auth(); 

const tg = window.Telegram?.WebApp;
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : null;
const telegramUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || `User_${telegramUserId}`) : `Guest`;

let firebaseUserId = null; // This will hold the unique ID for Firestore document (Telegram ID or Guest ID)
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
    // history[0] = null (start for page 1), history[1] = last_doc_page_1 (start for page 2), etc.
    userHistory: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null, isEndOfList: false },
    adminPending: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null, isEndOfList: false },
    adminHistory: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null, isEndOfList: false }
};

function handleError(message) {
    alert("Error: " + message + "\nPlease check your internet connection.");
    console.error("Application error:", message);
}

// --- Initialize User Identity and Data Sync ---
async function initializeUserAndData() {
    // 1. Determine firebaseUserId: Use Telegram ID if available, otherwise a persistent guest ID
    if (telegramUserId) {
        firebaseUserId = telegramUserId;
        console.log("Using Telegram User ID:", firebaseUserId);
    } else {
        let guestId = localStorage.getItem('guestFirebaseId');
        if (!guestId) {
            guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`; // Unique random string
            localStorage.setItem('guestFirebaseId', guestId);
        }
        firebaseUserId = guestId;
        console.log("Using persistent Guest User ID:", firebaseUserId);
    }

    // 2. Set up real-time listener for user data
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
                telegramId: d.telegramId || firebaseUserId // Ensure telegramId is consistent
            };
            console.log("User data synced from Firestore:", userData);
        } else {
            // User document doesn't exist, create it (e.g., new Telegram user or new guest)
            userData = {
                username: telegramUsername, // Use Telegram username or default "Guest"
                balance: 0,
                referredBy: "",
                inviteCount: 0,
                refEarnings: 0,
                telegramId: firebaseUserId // Store the determined unique ID
            };
            await userDocRef.set(userData); // Create the document
            console.log("New user profile created for ID:", firebaseUserId, "with data:", userData);
        }
        updateUI(); // Always update UI after data sync
        if (!appInitialized) {
            initAppFeatures(); // Initialize other features only once
            appInitialized = true;
        }
    }, err => handleError("Error syncing user data: " + err.message));
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

    if (appInitialized) {
        // Ensure user history pagination UI is updated if user is on withdrawPage
        const withdrawPage = document.getElementById('withdrawPage');
        if (withdrawPage && withdrawPage.classList.contains('active')) {
            updatePaginationUI('userHistory');
        }
    }
}

// --- Initialize App Features ---
function initAppFeatures() {
    console.log("Initializing app features...");
    setInterval(showRandomInAppInterstitial, 120 * 1000); // Every 2 minutes
    
    // Initial loads for relevant pages (only if not already on them or for background data)
    // For userHistory, it's called when 'withdrawPage' is shown.
    fetchLeaderboard();
}

// --- Automatic In-App Interstitial Ads (No Reward) ---
function showRandomInAppInterstitial() {
    const zones = [10276123, 10337795, 10337853];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const adFn = window[`show_${randomZone}`];

    if (typeof adFn === 'function') {
        adFn({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        }).catch(e => {/* console.log(`In-App Interstitial ad failed.`, e); */});
    }
}

// --- Page Navigation ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns(); 

    if (id === 'withdrawPage') {
        // Reset and load user withdrawal history for the first page
        pagination.userHistory.currentPage = 1;
        pagination.userHistory.history = [null]; // Start history from null for page 1
        pagination.userHistory.lastVisibleDoc = null; // Reset lastVisibleDoc
        loadUserWithdrawalHistory(); 
    }
    // Admin page specific loads are handled in checkAdmin
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
            alert("Ad failed to load or was blocked. Please try again.");
            console.error(`Ad task for ID ${id} failed:`, e);
        }
    } else {
        alert("Ad provider not loaded. Check your internet connection or ad blocker.");
    }
}

// --- Claim Reward Logic ---
async function claimReward(id) {
    if (!firebaseUserId) {
        alert("User identifier not established. Please reload the app.");
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
        // Update user's balance
        await db.collection("users").doc(firebaseUserId).set({ 
            balance: firebase.firestore.FieldValue.increment(reward)
        }, { merge: true });

        // Update referrer's balance and invite count if applicable
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
        alert("Failed to claim reward. Error: " + e.message);
        console.error("Claim reward error:", e);
    }
}

// --- Withdrawal Logic ---
async function submitWithdraw() {
    if (!firebaseUserId) {
        alert("User identifier not established. Cannot submit withdrawal.");
        return;
    }

    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();
    const method = document.getElementById("wMethod").value;

    // Updated minimum withdrawal to 0.05 PHP
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
        // No explicit reload for user history, onSnapshot will handle it.
    } catch (e) {
        alert("Failed to submit withdrawal. Error: " + e.message);
        console.error("Withdrawal submission error:", e);
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
        console.error("Failed to fetch leaderboard:", e);
        document.getElementById("leaderboardContent").innerHTML = "<p>Error loading leaderboard.</p>";
    }
}

// --- Update Username ---
async function updateUsername() {
    if (!firebaseUserId) {
        alert("User identifier not established. Cannot update username.");
        return;
    }
    const newUsername = document.getElementById("editUsername").value.trim();
    if (!newUsername || newUsername === "User" || newUsername.startsWith("User_") || newUsername === "Guest") {
        alert("Invalid username. Please choose a unique name.");
        return;
    }

    try {
        await db.collection("users").doc(firebaseUserId).set({
            username: newUsername
        }, { merge: true });
        
        userData.username = newUsername; // Update local state immediately
        updateUI(); // Reflect changes in the UI
        alert("Username updated successfully!");
    } catch (e) {
        alert("Failed to update username. Error: " + e.message);
        console.error("Update username error:", e);
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
        alert("User identifier not established. Cannot navigate pages.");
        return;
    }

    const pageData = pagination[section];
    let newPageNum = pageData.currentPage + direction;

    if (newPageNum < 1) return; // Cannot go before page 1

    if (direction === 1 && pageData.isEndOfList) {
        // If trying to go "next" and we're already at the end, do nothing.
        return;
    }

    // Unsubscribe from the current listener to avoid multiple listeners
    if (pageData.unsubscribe) {
        pageData.unsubscribe();
    }

    pageData.currentPage = newPageNum;
    
    // When navigating backward, retrieve the lastVisibleDoc from history
    // for the page *before* the one we're navigating to.
    // e.g., if newPageNum is 2, we need history[1] (last doc of page 1).
    // If newPageNum is 1, we need history[0] (which is null).
    pageData.lastVisibleDoc = pageData.history[newPageNum - 1];
    
    // If navigating backward, prune history to avoid stale entries for 'future' pages
    if (direction === -1) {
        pageData.history.splice(newPageNum); // Keep history up to newPageNum (0-indexed array element)
    } else { // If navigating forward, ensure history has a slot for the upcoming page's lastVisibleDoc
        while (pageData.history.length < newPageNum + 1) { // +1 because we need history[currentPage] for *this* page's end
            pageData.history.push(null); 
        }
    }

    // Trigger the appropriate load function
    if (section === 'userHistory') {
        loadUserWithdrawalHistory();
    } else if (section === 'adminPending') {
        loadAdminPendingRequests();
    } else if (section === 'adminHistory') {
        loadAdminHistoryRequests();
    }
    updatePaginationUI(section); // Update button states immediately
}


// --- Load User Withdrawal History with Pagination and Real-time Sync ---
function loadUserWithdrawalHistory() {
    if (!firebaseUserId) return;

    const pageData = pagination.userHistory;
    let query = db.collection("withdrawals")
        .where("userId", "==", firebaseUserId)
        .orderBy("timestamp", "desc");

    if (pageData.lastVisibleDoc) { // pageData.lastVisibleDoc is the last doc of the *previous* page
        query = query.startAfter(pageData.lastVisibleDoc);
    }
    query = query.limit(PAGE_SIZE + 1); // Fetch one extra to check for next page

    if (pageData.unsubscribe) {
        pageData.unsubscribe(); 
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>Name</th><th>Amount</th><th>Account</th><th>Method</th><th>Status</th></tr>`;
        const docsToDisplay = snap.docs.slice(0, PAGE_SIZE);
        
        pageData.isEndOfList = snap.docs.length <= PAGE_SIZE; // True if current page has <= PAGE_SIZE docs (no more next)

        if (docsToDisplay.length === 0 && pageData.currentPage > 1) {
            console.log(`User history page ${pageData.currentPage} returned empty, navigating back.`);
            navigatePagination('userHistory', -1); // Go back one page
            return; 
        } else if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="6">No withdrawal history.</td></tr>`;
        }

        docsToDisplay.forEach(doc => {
            const d = doc.data();
            h += `<tr>
                    <td>${d.timeStr}</td><td>${d.username}</td><td>${d.amount} PHP</td><td>${d.info}</td><td>${d.method}</td>
                    <td class="status-${d.status}">${d.status}</td>
                  </tr>`;
        });
        document.getElementById("userHistory").innerHTML = h + "</table>";

        // Store the last document of the *currently displayed page* into history for the *next* navigation
        if (docsToDisplay.length > 0) {
            pageData.history[pageData.currentPage] = docsToDisplay[docsToDisplay.length - 1];
        } else {
            pageData.history[pageData.currentPage] = null; // No docs on this page
        }
        
        updatePaginationUI('userHistory');

    }, err => console.error("Error syncing user withdrawal history:", err));
}


// --- Owner Dashboard Logic ---
function checkAdmin() {
    const password = prompt("Owner Password:");
    if (password === "Propetas6") { 
        showPage('adminPage');
        
        // Stats listener for total paid, approved count, and approved amount
        db.collection("stats").doc("global").onSnapshot(d => {
            const data = d.data();
            document.getElementById("statPHP").innerText = (data?.paid || 0).toFixed(2);
            document.getElementById("statApprovedCount").innerText = (data?.approvedCount || 0);
            document.getElementById("statApprovedAmount").innerText = (data?.approvedAmount || 0).toFixed(2);

        }, err => console.error("Error fetching stats:", err));
        
        // Initialize and load admin tables
        // Reset and load pending requests for the first page
        pagination.adminPending.currentPage = 1;
        pagination.adminPending.history = [null];
        pagination.adminPending.lastVisibleDoc = null;
        loadAdminPendingRequests();

        // Reset and load approved history for the first page
        pagination.adminHistory.currentPage = 1;
        pagination.adminHistory.history = [null];
        pagination.adminHistory.lastVisibleDoc = null;
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
        .orderBy("timestamp", "asc"); // Oldest first for pending

    if (pageData.lastVisibleDoc) {
        query = query.startAfter(pageData.lastVisibleDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Actions</th></tr>`;
        const docsToDisplay = snap.docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = snap.docs.length <= PAGE_SIZE;

        if (docsToDisplay.length === 0 && pageData.currentPage > 1) {
            console.log(`Admin pending page ${pageData.currentPage} returned empty, navigating back.`);
            navigatePagination('adminPending', -1);
            return;
        } else if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">No pending requests.</td></tr>`;
        }

        docsToDisplay.forEach(doc => {
            const d = doc.data();
            h += `<tr>
                    <td>${d.timeStr}</td><td>${d.username}</td><td>${d.amount} PHP</td><td>${d.method}: ${d.info}</td>
                    <td>
                        <button onclick="admProcess('${doc.id}','paid',${d.amount})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--success')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer;">Pay</button>
                        <button onclick="admProcess('${doc.id}','denied',${d.amount})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--danger')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer; margin-left:5px;">Deny</button>
                    </td>
                  </tr>`;
        });
        document.getElementById("adminPending").innerHTML = h + "</table>";

        if (docsToDisplay.length > 0) {
            pageData.history[pageData.currentPage] = docsToDisplay[docsToDisplay.length - 1];
        } else {
            pageData.history[pageData.currentPage] = null;
        }
        
        updatePaginationUI('adminPending');

    }, err => console.error("Sync admin pending requests:", err));
}

// --- Load Admin History Requests with Pagination and Real-time Sync ---
function loadAdminHistoryRequests() {
    const pageData = pagination.adminHistory;
    let query = db.collection("withdrawals")
        .where("status", "!=", "pending") // Show paid or denied
        .orderBy("timestamp", "desc"); // Newest first for history
    
    if (pageData.lastVisibleDoc) {
        query = query.startAfter(pageData.lastVisibleDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Status</th></tr>`;
        const docsToDisplay = snap.docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = snap.docs.length <= PAGE_SIZE;
        
        if (docsToDisplay.length === 0 && pageData.currentPage > 1) {
            console.log(`Admin history page ${pageData.currentPage} returned empty, navigating back.`);
            navigatePagination('adminHistory', -1);
            return;
        } else if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">No approved/denied history.</td></tr>`;
        }
        
        docsToDisplay.forEach(doc => {
            const d = doc.data();
            h += `<tr><td>${d.timeStr}</td><td>${d.username}</td><td>${d.amount} PHP</td><td>${d.method}: ${d.info}</td><td class="status-${d.status}">${d.status}</td></tr>`;
        });
        document.getElementById("adminHistory").innerHTML = h + "</table>";

        if (docsToDisplay.length > 0) {
            pageData.history[pageData.currentPage] = docsToDisplay[docsToDisplay.length - 1];
        } else {
            pageData.history[pageData.currentPage] = null;
        }
        
        updatePaginationUI('adminHistory');

    }, err => console.error("Sync admin history:", err));
}


async function admProcess(id, status, amount) {
    try {
        await db.collection("withdrawals").doc(id).set({ status: status }, { merge: true });
        
        if (status === 'paid') {
            // Increment total paid for general stats AND new approved stats
            await db.collection("stats").doc("global").set({ 
                paid: firebase.firestore.FieldValue.increment(amount),
                approvedCount: firebase.firestore.FieldValue.increment(1), // New stat: count of approved withdrawals
                approvedAmount: firebase.firestore.FieldValue.increment(amount) // New stat: total amount approved
            }, { merge: true });
        } else if (status === 'denied') {
            const deniedWithdrawal = (await db.collection("withdrawals").doc(id).get()).data();
            // Ensure funds are returned to the correct user identified by their userId in the withdrawal document
            if (deniedWithdrawal && deniedWithdrawal.userId && deniedWithdrawal.amount) {
                await db.collection("users").doc(deniedWithdrawal.userId).set({ 
                    balance: firebase.firestore.FieldValue.increment(deniedWithdrawal.amount)
                }, { merge: true });
                alert(`Withdrawal for ${deniedWithdrawal.username} denied. Funds returned.`);
            } else {
                 console.error("Could not find withdrawal data or user ID for denied request:", id);
                 alert("Could not return funds for denied request. Data missing.");
            }
        }
    } catch (e) {
        alert("Failed to process withdrawal. Error: " + e.message);
        console.error("Admin process error:", e);
    }
}

// --- Referral Linking ---
async function setReferrer() {
    if (!firebaseUserId) {
        alert("User identifier not established. Cannot link referrer.");
        return;
    }

    const inviterTelegramId = document.getElementById("refInput").value.trim();
    if (!inviterTelegramId) {
        alert("Please enter the inviter's Telegram ID.");
        return;
    }
    if (inviterTelegramId === firebaseUserId) { // Use firebaseUserId for self-referral check
        alert("You cannot refer yourself.");
        return;
    }
    // With open rules, we are not enforcing "set once" here.
    // Client-side can technically set/change referrer multiple times.

    try {
        const snap = await db.collection("users").where("telegramId", "==", inviterTelegramId).limit(1).get();
        if (snap.empty) {
            alert("Inviter with that Telegram ID not found.");
            return;
        }
        
        const inviterDoc = snap.docs[0];
        const inviterUsername = inviterDoc.data().username; 
        
        // Update current user's referredBy field
        await db.collection("users").doc(firebaseUserId).set({ 
            referredBy: inviterUsername 
        }, { merge: true });

        // Increment invite count for the inviter
        await db.collection("users").doc(inviterDoc.id).set({
            inviteCount: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });
        
        alert(`Successfully linked to inviter @${inviterUsername}!`);
        // The local userData will be updated by the onSnapshot listener shortly
    } catch (e) {
        alert("Failed to link referrer. Error: " + e.message);
        console.error("Referral linking error:", e);
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
                localStorage.removeItem(`cd_${id}_${currentFirebaseUserId}`); // Clean up expired timers
            }
        }
    });
}

// --- Initial Callbacks ---
setInterval(checkCooldowns, 1000); 
setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);

// Initialize user and data on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Initial display for user bar before full data sync
    document.getElementById("userBar").innerText = `👤 @${telegramUsername}`;
    initializeUserAndData(); 
});
