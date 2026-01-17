
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
const auth = firebase.auth();

const tg = window.Telegram?.WebApp;
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : null;
const telegramUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || `User_${telegramUserId}`) : `Guest_${Date.now()}`;

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
    userHistory: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null },
    adminPending: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null },
    adminHistory: { currentPage: 1, lastVisibleDoc: null, history: [null], unsubscribe: null }
};

function handleError(message) {
    alert("Error: " + message + "\nPlease check your internet connection.");
    console.error("Application error:", message);
}

// --- Firebase Authentication State Listener ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        firebaseUserId = user.uid; 
        console.log("Firebase Authenticated. UID:", firebaseUserId);
        
        try {
            const userDocRef = db.collection("users").doc(firebaseUserId);
            const doc = await userDocRef.get();

            if (doc.exists) {
                const d = doc.data();
                userData = {
                    username: d.username || telegramUsername, 
                    balance: Number(d.balance) || 0,
                    referredBy: d.referredBy || "",
                    inviteCount: Number(d.inviteCount) || 0,
                    refEarnings: Number(d.refEarnings) || 0,
                    telegramId: d.telegramId || telegramUserId 
                };
                console.log("User data loaded:", userData);
            } else {
                if (!telegramUserId) {
                    throw new Error("Telegram User ID not available for profile creation.");
                }
                userData = {
                    username: telegramUsername, 
                    balance: 0,
                    referredBy: "",
                    inviteCount: 0,
                    refEarnings: 0,
                    telegramId: telegramUserId 
                };
                await userDocRef.set(userData); 
                console.log("New user profile created for Firebase UID:", firebaseUserId, "with data:", userData);
            }
            
            updateUI(); // Update UI immediately with loaded/created data
            
            // Set up real-time listener for user data updates
            userDocRef.onSnapshot(snapshot => {
                if (snapshot.exists) {
                    const d = snapshot.data();
                    userData = {
                        username: d.username || telegramUsername,
                        balance: Number(d.balance) || 0,
                        referredBy: d.referredBy || "",
                        inviteCount: Number(d.inviteCount) || 0,
                        refEarnings: Number(d.refEarnings) || 0,
                        telegramId: d.telegramId || telegramUserId
                    };
                    updateUI(); 
                }
            }, err => console.error("Error syncing user data:", err));

            if (!appInitialized) {
                initAppFeatures(); 
                appInitialized = true;
            }

        } catch (e) {
            handleError("Failed to load user data: " + e.message);
        }

    } else {
        console.log("Not authenticated, signing in anonymously...");
        try {
            // Check if telegramUserId is available before attempting anonymous sign-in
            // This ensures a stable UID to map to the user's Firestore doc.
            if (telegramUserId) {
                 // For anonymous auth, we use the Telegram user ID as a custom token to link
                 // This requires a Cloud Function to mint the custom token based on Telegram initData
                 // For client-side anonymous auth, the UID is random, hence the need for `replace("anon-", "")` rule
                 // Assuming here that anonymous auth is sufficient and linked in rules
                await auth.signInAnonymously();
            } else {
                console.warn("Telegram User ID not available. Running in guest mode without Firebase authentication.");
                // Update UI for guest mode if no Telegram ID
                document.getElementById("userBar").innerText = "👤 Guest User";
                document.getElementById("myTelegramId").innerText = "N/A";
            }
        } catch (error) {
            handleError("Anonymous authentication failed. Check internet connection.");
        }
    }
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

    // Refresh pagination whenever UI updates to ensure correct state/buttons
    if (appInitialized) { // Only call after full app features are initialized
        updatePaginationUI('userHistory');
    }
}

// --- Initialize App Features After Auth ---
function initAppFeatures() {
    console.log("Initializing app features...");
    setInterval(showRandomInAppInterstitial, 120 * 1000); // Every 2 minutes
    
    // Initial load for user withdrawal history
    loadUserWithdrawalHistory();
    
    fetchLeaderboard();
}

// --- Automatic In-App Interstitial Ads (No Reward) ---
function showRandomInAppInterstitial() {
    if (!firebaseUserId) return; 

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

    // Special handling for pages with pagination
    if (id === 'withdrawPage') {
        loadUserWithdrawalHistory();
    }
    // Admin dashboard specific load is handled by checkAdmin()
}

// --- Ad Task Logic ---
async function runTask(id, zone, type = 'interstitial') { 
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        try {
            const promise = (type === 'pop') ? adFn('pop') : adFn();
            await promise; 

            if (firebaseUserId) {
                currentTaskId = id; 
                document.getElementById(`btn_${id}`).style.display = 'none';
                document.getElementById(`claim_${id}`).style.display = 'block';
            } else {
                alert("Account not fully connected. Rewards cannot be claimed yet. Please wait a moment and try again.");
                document.getElementById(`btn_${id}`).style.display = 'block';
                document.getElementById(`claim_${id}`).style.display = 'none';
                currentTaskId = null; 
            }
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
        alert("User not authenticated. Please reload the app.");
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
        await db.collection("users").doc(firebaseUserId).update({
            balance: firebase.firestore.FieldValue.increment(reward)
        });

        // Client-side referrer crediting is insecure and will be blocked by Firestore rules.
        // This functionality needs to be moved to a secure Cloud Function.
        if (userData.referredBy) {
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).limit(1).get();
            if (!refSnap.empty) {
                await db.collection("users").doc(refSnap.docs[0].id).update({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm)
                });
                console.warn("Client-side referrer credit attempted. This will be blocked by security rules and is a potential exploit.");
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
        alert("Failed to claim reward. Error: " + e.message + "\n(Referral credits require server-side processing)");
        console.error("Claim reward error:", e);
    }
}

// --- Withdrawal Logic ---
async function submitWithdraw() {
    if (!firebaseUserId) {
        alert("User not authenticated. Please reload.");
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
        await db.collection("users").doc(firebaseUserId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
        
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
        alert("User not authenticated. Please reload.");
        return;
    }
    const newUsername = document.getElementById("editUsername").value.trim();
    if (!newUsername || newUsername === "User" || newUsername.startsWith("User_") || newUsername === "Guest" || newUsername.startsWith("Guest_")) {
        alert("Invalid username. Please choose a unique name.");
        return;
    }

    try {
        await db.collection("users").doc(firebaseUserId).update({
            username: newUsername
        });
        alert("Username updated successfully!");
    } catch (e) {
        if (e.code === 'permission-denied') { 
            alert("Username cannot be changed after it's set. Your current username is: " + userData.username);
        } else {
            alert("Failed to update username. Error: " + e.message);
        }
        console.error("Update username error:", e);
    }
}

// --- Pagination Helper Functions ---
function updatePaginationUI(section) {
    const pageData = pagination[section];
    document.getElementById(`${section}CurrentPage`).innerText = pageData.currentPage;
    document.getElementById(`${section}Prev`).disabled = pageData.currentPage === 1;
    // Next button disabled if the last fetched page had fewer than PAGE_SIZE items
    // This requires knowing the last query's result size, which is handled in the listener
}

async function navigatePagination(section, direction) {
    if (!firebaseUserId) {
        alert("User not authenticated.");
        return;
    }

    const pageData = pagination[section];
    const newPage = pageData.currentPage + direction;

    if (newPage < 1) return; // Prevent going below page 1

    if (pageData.unsubscribe) {
        pageData.unsubscribe(); // Unsubscribe from current listener
    }

    pageData.currentPage = newPage;

    if (direction === 1) { // Moving to next page
        if (pageData.lastVisibleDoc) { // Store current lastVisibleDoc for "back" navigation
            pageData.history.push(pageData.lastVisibleDoc);
        }
        // Firestore query will use pageData.lastVisibleDoc (which is the last from the previous page)
        // This is updated within the listener
    } else if (direction === -1) { // Moving to previous page
        if (pageData.history.length > 1) {
            pageData.history.pop(); // Remove current page's lastVisibleDoc
            pageData.lastVisibleDoc = pageData.history[pageData.history.length - 1]; // Set to previous page's lastVisibleDoc
        } else {
            pageData.lastVisibleDoc = null; // Back to page 1
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


// --- Load User Withdrawal History with Pagination ---
function loadUserWithdrawalHistory() {
    if (!firebaseUserId) return;

    const pageData = pagination.userHistory;
    let query = db.collection("withdrawals")
        .where("userId", "==", firebaseUserId)
        .orderBy("timestamp", "desc");

    if (pageData.lastVisibleDoc) {
        query = query.startAfter(pageData.lastVisibleDoc);
    }
    query = query.limit(PAGE_SIZE + 1); // Fetch one more to check if "Next" button should be enabled

    if (pageData.unsubscribe) {
        pageData.unsubscribe(); // Unsubscribe from previous listener
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>Name</th><th>Amount</th><th>Account</th><th>Method</th><th>Status</th></tr>`;
        const docsToDisplay = snap.docs.slice(0, PAGE_SIZE);
        
        if (docsToDisplay.length === 0 && pageData.currentPage > 1) {
            // No results for this page, means we've gone too far. Go back one page.
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

        // Update lastVisibleDoc for next page, and enable/disable Next button
        pageData.lastVisibleDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        document.getElementById("userHistoryNext").disabled = snap.docs.length <= PAGE_SIZE;
        updatePaginationUI('userHistory');

    }, err => console.error("Error syncing user withdrawal history:", err));
}


// --- Owner Dashboard Logic ---
function checkAdmin() {
    if (prompt("Owner Password:") === "Propetas6") { 
        showPage('adminPage');
        
        db.collection("stats").doc("global").onSnapshot(d => {
            document.getElementById("statPHP").innerText = (d.data()?.paid || 0).toFixed(2);
        });
        
        // Initial load for admin tables
        loadAdminPendingRequests();
        loadAdminHistoryRequests();

    } else {
        alert("Access Denied!");
    }
}

// --- Load Admin Pending Requests with Pagination ---
function loadAdminPendingRequests() {
    if (!firebaseUserId) return; // Admin should be authenticated

    const pageData = pagination.adminPending;
    let query = db.collection("withdrawals")
        .where("status", "==", "pending")
        .orderBy("timestamp", "asc");
    
    if (pageData.lastVisibleDoc) {
        query = query.startAfter(pageData.lastVisibleDoc);
    }
    query = query.limit(PAGE_SIZE + 1); // Fetch one more to check if "Next" button should be enabled

    if (pageData.unsubscribe) {
        pageData.unsubscribe(); // Unsubscribe from previous listener
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Actions</th></tr>`;
        const docsToDisplay = snap.docs.slice(0, PAGE_SIZE);

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

        pageData.lastVisibleDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        document.getElementById("adminPendingNext").disabled = snap.docs.length <= PAGE_SIZE;
        updatePaginationUI('adminPending');

    }, err => console.error("Sync admin pending requests:", err));
}

// --- Load Admin History Requests with Pagination ---
function loadAdminHistoryRequests() {
    if (!firebaseUserId) return; // Admin should be authenticated

    const pageData = pagination.adminHistory;
    let query = db.collection("withdrawals")
        .where("status", "!=", "pending")
        .orderBy("timestamp", "desc");
    
    if (pageData.lastVisibleDoc) {
        query = query.startAfter(pageData.lastVisibleDoc);
    }
    query = query.limit(PAGE_SIZE + 1); // Fetch one more to check if "Next" button should be enabled

    if (pageData.unsubscribe) {
        pageData.unsubscribe(); // Unsubscribe from previous listener
    }

    pageData.unsubscribe = query.onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Status</th></tr>`;
        const docsToDisplay = snap.docs.slice(0, PAGE_SIZE);

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

        pageData.lastVisibleDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        document.getElementById("adminHistoryNext").disabled = snap.docs.length <= PAGE_SIZE;
        updatePaginationUI('adminHistory');

    }, err => console.error("Sync admin history:", err));
}


async function admProcess(id, status, amount) {
    try {
        await db.collection("withdrawals").doc(id).update({ status: status });
        if (status === 'paid') {
            await db.collection("stats").doc("global").set({ paid: firebase.firestore.FieldValue.increment(amount) }, { merge: true });
        } else if (status === 'denied') {
            const deniedWithdrawal = (await db.collection("withdrawals").doc(id).get()).data();
            await db.collection("users").doc(deniedWithdrawal.userId).update({ balance: firebase.firestore.FieldValue.increment(deniedWithdrawal.amount) });
            alert(`Withdrawal for ${deniedWithdrawal.username} denied. Funds returned.`);
        }
    } catch (e) {
        alert("Failed to process withdrawal. Error: " + e.message);
        console.error("Admin process error:", e);
    }
}

// --- Referral Linking ---
async function setReferrer() {
    if (!firebaseUserId) {
        alert("User not authenticated. Please reload.");
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
    if (userData.referredBy) {
        alert("You are already linked to an inviter.");
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
        
        await db.collection("users").doc(firebaseUserId).update({ referredBy: inviterUsername });

        // Client-side referrer count increment is insecure and will be blocked by Firestore rules.
        // This functionality needs to be moved to a secure Cloud Function.
        await db.collection("users").doc(inviterDoc.id).update({
            inviteCount: firebase.firestore.FieldValue.increment(1)
        });
        alert(`Successfully linked to inviter @${inviterUsername}! (Inviter count update requires server-side processing)`);
        console.warn("Referrer count update attempted directly from client. This will be blocked by security rules and is a potential exploit.");
    } catch (e) {
        alert("Failed to link referrer. Error: " + e.message);
        console.error("Referral linking error:", e);
    }
}

// --- Cooldowns & Clock Display ---
function checkCooldowns() {
    if (!firebaseUserId) return; 

    const ids = ['1', '2', '3', 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4', 'D1']; 
    ids.forEach(id => {
        const endTime = localStorage.getItem(`cd_${id}_${firebaseUserId}`); 
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
                localStorage.removeItem(`cd_${id}_${firebaseUserId}`); // Clean up expired timers
            }
        }
    });
}

// --- Initial Callbacks ---
setInterval(checkCooldowns, 1000); 
setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);

// Update header immediately on DOM load based on available Telegram info
document.addEventListener('DOMContentLoaded', () => {
    if (tg?.initDataUnsafe?.user) {
        document.getElementById("userBar").innerText = `👤 @${telegramUsername}`;
    } else {
        document.getElementById("userBar").innerText = "👤 Guest User"; 
    }
});
