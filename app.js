
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
// Removed auth object import as it's no longer used for security rules or sign-in logic
// const auth = firebase.auth(); 

const tg = window.Telegram?.WebApp;
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : null;
const telegramUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || `User_${telegramUserId}`) : `Guest_${Date.now()}`;

let firebaseUserId = null; // This is now just a placeholder for logic, no actual auth needed for DB ops
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
    userHistory: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null, isEndOfList: false },
    adminPending: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null, isEndOfList: false },
    adminHistory: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null, isEndOfList: false }
};

function handleError(message) {
    alert("Error: " + message + "\nPlease check your internet connection.");
    console.error("Application error:", message);
}

// --- Initial Setup (No Firebase Auth Listener for security rules) ---
document.addEventListener('DOMContentLoaded', () => {
    if (tg?.initDataUnsafe?.user) {
        document.getElementById("userBar").innerText = `👤 @${telegramUsername}`;
        // For simplicity, we'll just use telegramUserId as a pseudo-ID for user data operations
        // as there's no Firebase auth to link to.
        firebaseUserId = telegramUserId; 
    } else {
        document.getElementById("userBar").innerText = "👤 Guest User"; 
        firebaseUserId = `guest_${Date.now()}`; // Fallback for non-Telegram users
    }
    console.log("App loaded. Using identifier:", firebaseUserId);
    
    // Initialize UI elements that don't depend on async data fetching
    updateUI(); // Update with initial values from Telegram or guest
    
    // Now, proceed to initialize app features that fetch data
    initAppFeatures(); 
    appInitialized = true;
});

// --- UI Update Function ---
function updateUI() {
    document.getElementById("mainBalance").innerText = userData.balance.toFixed(3);
    document.getElementById("userBar").innerText = `👤 @${userData.username}`;
    document.getElementById("myUser").innerText = userData.username;
    document.getElementById("myTelegramId").innerText = userData.telegramId || "N/A";
    document.getElementById("invCount").innerText = userData.inviteCount;
    document.getElementById("invEarned").innerText = userData.refEarnings.toFixed(3);
    document.getElementById("editUsername").value = (userData.username === "User" || userData.username.startsWith("User_") || userData.username === "Guest" || userData.username.startsWith("Guest_")) ? "" : userData.username;

    if (appInitialized) {
        updatePaginationUI('userHistory');
    }
}

// --- Initialize App Features ---
function initAppFeatures() {
    console.log("Initializing app features...");
    setInterval(showRandomInAppInterstitial, 120 * 1000); // Every 2 minutes
    
    // Load data for relevant pages
    loadUserWithdrawalHistory();
    fetchLeaderboard();
}

// --- Automatic In-App Interstitial Ads (No Reward) ---
function showRandomInAppInterstitial() {
    // No auth check needed for showing ads
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
        loadUserWithdrawalHistory(); // Ensure history is loaded/refreshed when entering page
    }
}

// --- Ad Task Logic ---
async function runTask(id, zone, type = 'interstitial') { 
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        try {
            const promise = (type === 'pop') ? adFn('pop') : adFn();
            await promise; 

            // Ad displayed/completed.
            // In this open-rule scenario, we enable claiming immediately.
            // The risk is that claims might not be tied to a real, verifiable user if telegramUserId is missing.
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
    // With open rules, we don't need firebaseUserId for *write* operations,
    // but it's good practice to still associate rewards with a user context.
    if (!telegramUserId && !firebaseUserId.startsWith('guest_')) { // If not logged in via Telegram or as a Guest
        alert("Cannot claim rewards without a user identifier. Please reload the app.");
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
        // Operations are now direct without auth checks
        // User balance update
        await db.collection("users").doc(firebaseUserId).set({ // Using SET as we don't know if doc exists without auth
            balance: firebase.firestore.FieldValue.increment(reward)
        }, { merge: true }); // Merge is crucial here to avoid overwriting other fields

        // Referral crediting (still relies on client-side logic which is insecure)
        if (userData.referredBy) {
            // Finding inviter by username requires querying the user collection by username
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).limit(1).get();
            if (!refSnap.empty) {
                const inviterDocId = refSnap.docs[0].id;
                await db.collection("users").doc(inviterDocId).set({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm)
                }, { merge: true });
                console.warn("Referral credit applied. Ensure this is intended with open security rules.");
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
    if (!telegramUserId && !firebaseUserId.startsWith('guest_')) {
        alert("Cannot submit withdrawal without a user identifier.");
        return;
    }

    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();
    const method = document.getElementById("wMethod").value;

    if (!amount || amount < 1 || !info) {
        alert("Minimum withdrawal is 1 PHP. Please fill all fields correctly.");
        return;
    }
    if (amount > userData.balance) {
        alert("Insufficient balance.");
        return;
    }

    try {
        // Update balance for the user
        await db.collection("users").doc(firebaseUserId).set({ 
            balance: firebase.firestore.FieldValue.increment(-amount)
        }, { merge: true });
        
        // Create withdrawal request
        await db.collection("withdrawals").add({
            userId: firebaseUserId, // This is now Telegram ID or guest ID
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
    if (!telegramUserId && !firebaseUserId.startsWith('guest_')) {
        alert("Cannot update username without a user identifier.");
        return;
    }
    const newUsername = document.getElementById("editUsername").value.trim();
    if (!newUsername || newUsername === "User" || newUsername.startsWith("User_") || newUsername === "Guest" || newUsername.startsWith("Guest_")) {
        alert("Invalid username. Please choose a unique name.");
        return;
    }

    try {
        // With open rules, we just set the username. No security check for "set once".
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
    document.getElementById(`${section}Next`).disabled = pageData.isEndOfList; // Use isEndOfList flag
}

async function navigatePagination(section, direction) {
    if (!telegramUserId && !firebaseUserId.startsWith('guest_')) {
        alert("Cannot navigate pages without a user identifier.");
        return;
    }

    const pageData = pagination[section];
    let newPage = pageData.currentPage + direction;
    
    if (newPage < 1) return; // Prevent going below page 1

    // Unsubscribe from the current listener to avoid multiple listeners
    if (pageData.unsubscribe) {
        pageData.unsubscribe(); 
    }

    // Reset for the new page navigation
    pageData.lastVisibleDoc = null; 
    pageData.isEndOfList = false; // Assume not end of list until proven otherwise

    if (direction === 1) { // Moving to next page
        if (pageData.history.length > 0) {
            // If we have history and are moving forward, the last doc for this new page
            // is the last recorded 'lastVisibleDoc' from the previous page that pushed history.
            // This logic needs to be refined based on how 'history' is structured.
            // For simplicity with 'startAfter', we just need the last doc of the PREVIOUS page.
            // The history array should store the lastVisibleDoc *before* the query was made for that page.

            // Let's simplify: Store the last visible doc *of the previous page*
            if (pageData.history.length > 0) {
                pageData.lastVisibleDoc = pageData.history[pageData.history.length - 1];
            } else {
                 pageData.lastVisibleDoc = null; // If history is empty, it means we are on page 1 or back to it
            }

        } else { // Moving from page 1 to page 2, or on page 1
            // The first query starts without lastVisibleDoc.
            // The history array will store the lastVisibleDoc from the *first* page after it's queried.
            pageData.lastVisibleDoc = null; 
        }
        
    } else if (direction === -1) { // Moving to previous page
        if (pageData.history.length > 1) { // Check if there's a previous page's lastVisibleDoc to go back to
            pageData.history.pop(); // Remove the current page's lastVisibleDoc
            pageData.lastVisibleDoc = pageData.history[pageData.history.length - 1]; // Set to the previous page's lastVisibleDoc
        } else {
            pageData.lastVisibleDoc = null; // Back to page 1
        }
    }
    
    pageData.currentPage = newPage; // Update the current page number

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


// --- Load User Withdrawal History with Pagination ---
function loadUserWithdrawalHistory() {
    if (!firebaseUserId) return;

    const pageData = pagination.userHistory;
    let query = db.collection("withdrawals")
        .where("userId", "==", firebaseUserId)
        .orderBy("timestamp", "desc");

    // Correctly use lastVisibleDoc for pagination.
    // If lastVisibleDoc is null, we are on the first page.
    if (pageData.lastVisibleDoc) {
        query = query.startAfter(pageData.lastVisibleDoc);
    }
    query = query.limit(PAGE_SIZE + 1); // Fetch one more document to determine if there's a next page

    if (pageData.unsubscribe) {
        pageData.unsubscribe(); // Unsubscribe from previous listener
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>Name</th><th>Amount</th><th>Account</th><th>Method</th><th>Status</th></tr>`;
        const docsToDisplay = snap.docs.slice(0, PAGE_SIZE);
        
        // Check if we've reached the end of the list
        pageData.isEndOfList = snap.docs.length <= PAGE_SIZE;

        if (docsToDisplay.length === 0 && pageData.currentPage > 1) {
            // If no documents are returned for a page greater than 1, it means we've gone past the last page.
            // Navigate back and re-fetch.
            navigatePagination('userHistory', -1);
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

        // Store the last visible document of the CURRENT page for future "next" navigation.
        if (docsToDisplay.length > 0) {
             // Add this last document to history if it's not already the last one in history
             // This logic is tricky. A simpler approach might be to only store when moving forward.
             if(pageData.lastVisibleDoc !== docsToDisplay[docsToDisplay.length - 1]) {
                if(pageData.currentPage > 1) { // Only push history if not on the very first query
                    pageData.history.push(docsToDisplay[docsToDisplay.length - 1]);
                }
             }
             pageData.lastVisibleDoc = docsToDisplay[docsToDisplay.length - 1];
        } else {
            pageData.lastVisibleDoc = null; // No docs on this page
        }
        
        updatePaginationUI('userHistory');

    }, err => console.error("Error syncing user withdrawal history:", err));
}


// --- Owner Dashboard Logic ---
function checkAdmin() {
    const password = prompt("Owner Password:");
    if (password === "Propetas6") { 
        showPage('adminPage');
        
        // Stats listener
        db.collection("stats").doc("global").onSnapshot(d => {
            document.getElementById("statPHP").innerText = (d.data()?.paid || 0).toFixed(2);
        }, err => console.error("Error fetching stats:", err));
        
        // Load initial data for admin tables
        loadAdminPendingRequests();
        loadAdminHistoryRequests();

    } else {
        alert("Access Denied!");
    }
}

// --- Load Admin Pending Requests with Pagination ---
function loadAdminPendingRequests() {
    const pageData = pagination.adminPending;
    let query = db.collection("withdrawals")
        .where("status", "==", "pending")
        .orderBy("timestamp", "asc");
    
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
            if(pageData.lastVisibleDoc !== docsToDisplay[docsToDisplay.length - 1]) {
                if(pageData.currentPage > 1) {
                    pageData.history.push(docsToDisplay[docsToDisplay.length - 1]);
                }
            }
            pageData.lastVisibleDoc = docsToDisplay[docsToDisplay.length - 1];
        } else {
            pageData.lastVisibleDoc = null;
        }
        
        updatePaginationUI('adminPending');

    }, err => console.error("Sync admin pending requests:", err));
}

// --- Load Admin History Requests with Pagination ---
function loadAdminHistoryRequests() {
    const pageData = pagination.adminHistory;
    let query = db.collection("withdrawals")
        .where("status", "!=", "pending")
        .orderBy("timestamp", "desc");
    
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
            if(pageData.lastVisibleDoc !== docsToDisplay[docsToDisplay.length - 1]) {
                if(pageData.currentPage > 1) {
                    pageData.history.push(docsToDisplay[docsToDisplay.length - 1]);
                }
            }
            pageData.lastVisibleDoc = docsToDisplay[docsToDisplay.length - 1];
        } else {
            pageData.lastVisibleDoc = null;
        }
        
        updatePaginationUI('adminHistory');

    }, err => console.error("Sync admin history:", err));
}


async function admProcess(id, status, amount) {
    try {
        // Direct update to Firestore without auth checks
        await db.collection("withdrawals").doc(id).set({ status: status }, { merge: true });
        
        if (status === 'paid') {
            // Update global stats
            await db.collection("stats").doc("global").set({ paid: firebase.firestore.FieldValue.increment(amount) }, { merge: true });
        } else if (status === 'denied') {
            // Fetch the denied withdrawal to get user info and amount
            const deniedWithdrawal = (await db.collection("withdrawals").doc(id).get()).data();
            // Return funds to user balance
            await db.collection("users").doc(deniedWithdrawal.userId).set({ 
                balance: firebase.firestore.FieldValue.increment(deniedWithdrawal.amount)
            }, { merge: true });
            alert(`Withdrawal for ${deniedWithdrawal.username} denied. Funds returned.`);
        }
        // No specific error handling for the stats/user update, assumes open rules allow it.
    } catch (e) {
        alert("Failed to process withdrawal. Error: " + e.message);
        console.error("Admin process error:", e);
    }
}

// --- Referral Linking ---
async function setReferrer() {
    if (!telegramUserId && !firebaseUserId.startsWith('guest_')) {
        alert("Cannot link referrer without a user identifier.");
        return;
    }

    const inviterTelegramId = document.getElementById("refInput").value.trim();
    if (!inviterTelegramId) {
        alert("Please enter the inviter's Telegram ID.");
        return;
    }
    if (inviterTelegramId === telegramUserId) {
        alert("You cannot refer yourself.");
        return;
    }
    // With open rules, we don't check userData.referredBy for existence,
    // but we can still overwrite it if desired. If you want it to be set only once,
    // you would need to implement that check here or in a Cloud Function.
    // For now, it will overwrite if called multiple times.

    try {
        // Find inviter by their Telegram ID
        const snap = await db.collection("users").where("telegramId", "==", inviterTelegramId).limit(1).get();
        if (snap.empty) {
            alert("Inviter with that Telegram ID not found.");
            return;
        }
        
        const inviterDoc = snap.docs[0];
        const inviterUsername = inviterDoc.data().username; 
        
        // Set the referredBy field for the current user (using Telegram ID or guest ID)
        await db.collection("users").doc(firebaseUserId).set({ 
            referredBy: inviterUsername 
        }, { merge: true });

        // Increment invite count for the inviter
        await db.collection("users").doc(inviterDoc.id).set({
            inviteCount: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });
        
        alert(`Successfully linked to inviter @${inviterUsername}!`);
        
        // Update local userData for immediate UI reflection
        userData.referredBy = inviterUsername;
        userData.inviteCount = (userData.inviteCount || 0) + 1; // This local count might not be accurate if not fetched
        updateUI();

    } catch (e) {
        alert("Failed to link referrer. Error: " + e.message);
        console.error("Referral linking error:", e);
    }
}

// --- Cooldowns & Clock Display ---
function checkCooldowns() {
    // Cooldowns are stored locally, so they don't strictly depend on firebaseUserId
    // but we use it to make them specific to the user.
    const currentFirebaseUserId = firebaseUserId; // Use the identifier available at the time of check
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
