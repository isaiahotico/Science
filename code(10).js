
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
// Safely get Telegram user info
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : null;
const telegramUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || `User_${telegramUserId}`) : `Guest_${Date.now()}`;

let firebaseUserId = null; // Will hold the Firebase Authentication UID
let userData = { 
    balance: 0, 
    referredBy: "", 
    inviteCount: 0, 
    refEarnings: 0, 
    username: telegramUsername, // Initial username from Telegram
    telegramId: telegramUserId  // Initial Telegram ID
};
let currentTaskId = null; // Track the current ad task for claiming
let appInitialized = false; // Flag to prevent re-initialization

// --- UI Loading & Error Handling Functions ---
function showLoading(message) {
    document.getElementById("loadingMessage").innerText = message;
    document.getElementById("loadingOverlay").style.display = 'flex';
}

function hideLoading() {
    document.getElementById("loadingOverlay").style.display = 'none';
}

function displayError(message) {
    alert("Error: " + message + "\nPlease check your internet connection.");
    console.error("Error during app initialization:", message);
    showLoading("Failed to connect. Please check internet.");
}

// --- Firebase Authentication State Listener ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        firebaseUserId = user.uid; // This is the key for Firestore document IDs
        console.log("Firebase Authenticated. UID:", firebaseUserId);
        
        try {
            const userDocRef = db.collection("users").doc(firebaseUserId);
            const doc = await userDocRef.get();

            if (doc.exists) {
                // User exists, load their data and update local userData
                const d = doc.data();
                userData = {
                    username: d.username || telegramUsername, // Use existing or fallback from Telegram
                    balance: Number(d.balance) || 0,
                    referredBy: d.referredBy || "",
                    inviteCount: Number(d.inviteCount) || 0,
                    refEarnings: Number(d.refEarnings) || 0,
                    telegramId: d.telegramId || telegramUserId // Ensure telegramId is stored
                };
                console.log("User data loaded:", userData);
            } else {
                // User does not exist, create a new profile with initial Telegram data
                if (!telegramUserId) {
                    throw new Error("Telegram User ID not found. Cannot create account.");
                }
                userData = {
                    username: telegramUsername, // Use Telegram username
                    balance: 0,
                    referredBy: "",
                    inviteCount: 0,
                    refEarnings: 0,
                    telegramId: telegramUserId // Store Telegram ID
                };
                await userDocRef.set(userData); // Create the document
                console.log("New user profile created for Firebase UID:", firebaseUserId, "with data:", userData);
            }
            
            // Update UI immediately with whatever data is available
            updateUI();
            
            // Set up real-time listener for user data updates AFTER initial load/creation
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
                    updateUI(); // Update UI on any real-time change
                }
            }, err => console.error("Error syncing user data:", err));

            // Initialize other features only once
            if (!appInitialized) {
                initAppFeatures(); 
                appInitialized = true;
                hideLoading(); // Hide loading overlay once auth and basic UI are ready
            }

        } catch (e) {
            displayError("Failed to load user data: " + e.message);
        }

    } else {
        // User is not signed in, attempt anonymous authentication
        console.log("Not authenticated, signing in anonymously...");
        showLoading("Authenticating...");
        try {
            await auth.signInAnonymously();
        } catch (error) {
            displayError("Anonymous authentication failed. Check internet connection.");
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
    document.getElementById("editUsername").value = userData.username === "User" || userData.username.startsWith("User_") || userData.username === "Guest" || userData.username.startsWith("Guest_") ? "" : userData.username; // Pre-fill edit field if not default
}

// --- Initialize App Features After Auth ---
function initAppFeatures() {
    console.log("Initializing app features...");
    // Start automatic interstitial ads
    setInterval(showRandomInAppInterstitial, 120 * 1000); // Every 2 minutes
    
    // Set up real-time listener for user's withdrawal history
    // Use firebaseUserId which is now guaranteed to be set after auth.onAuthStateChanged
    db.collection("withdrawals").where("userId", "==", firebaseUserId).orderBy("timestamp", "desc").limit(15).onSnapshot(snap => {
        let h = `<table><tr><th>Date</th><th>Name</th><th>Amount</th><th>Account</th><th>Method</th><th>Status</th></tr>`;
        if (snap.empty) {
            h += `<tr><td colspan="6">No withdrawal history.</td></tr>`;
        }
        snap.forEach(doc => {
            const d = doc.data();
            h += `<tr>
                    <td>${d.timeStr}</td>
                    <td>${d.username}</td>
                    <td>${d.amount} PHP</td>
                    <td>${d.info}</td>
                    <td>${d.method}</td>
                    <td class="status-${d.status}">${d.status}</td>
                  </tr>`;
        });
        document.getElementById("userHistory").innerHTML = h + "</table>";
    }, err => console.error("Error syncing user withdrawal history:", err));

    // Fetch leaderboard data once on initialization
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
}

// --- Ad Task Logic ---
function runTask(id, zone, type = 'interstitial') {
    if (!firebaseUserId) {
        alert("Please wait for the app to fully load.");
        return;
    }

    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        const promise = (type === 'pop') ? adFn('pop') : adFn();
        promise.then(() => {
            currentTaskId = id; 
            document.getElementById(`btn_${id}`).style.display = 'none';
            document.getElementById(`claim_${id}`).style.display = 'block';
        }).catch(e => {
            alert("Ad failed to load or was blocked. Please try again.");
            console.error(`Ad task for ID ${id} failed:`, e);
        });
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
    if (id === 'D1') { // Daily Bonus
        reward = 0.10;
        refComm = reward * 0.10;
    }

    try {
        // 1. Credit User's balance (This update will pass security rules)
        await db.collection("users").doc(firebaseUserId).update({
            balance: firebase.firestore.FieldValue.increment(reward)
        });

        // 2. Attempt to credit Referrer's balance if applicable
        // *** SECURITY NOTE: Client-side referrer crediting is insecure and WILL FAIL with advanced rules. ***
        // Use a Cloud Function for this.
        if (userData.referredBy) {
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).limit(1).get();
            if (!refSnap.empty) {
                // This cross-user update is intentionally blocked by security rules.
                await db.collection("users").doc(refSnap.docs[0].id).update({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm)
                });
                console.warn("Client-side referrer credit attempted. This will be blocked by security rules.");
            }
        }

        // 3. Set Cooldown Timer
        let cooldownSeconds = 300; // 5 minutes
        if (id.toString().startsWith('G')) cooldownSeconds = 3600; // 1 hour
        if (id.toString().startsWith('S')) cooldownSeconds = 1200; // 20 minutes
        if (id === 'D1') cooldownSeconds = 86400; // 24 hours
        
        localStorage.setItem(`cd_${id}_${firebaseUserId}`, Date.now() + (cooldownSeconds * 1000));
        
        // Reset UI states
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
        // Deduct from user balance immediately
        await db.collection("users").doc(firebaseUserId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
        
        // Record withdrawal request
        await db.collection("withdrawals").add({
            userId: firebaseUserId, 
            username: userData.username, 
            amount, 
            info, 
            method, 
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Use server timestamp
            timeStr: new Date().toLocaleString() // Client-side readable string
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
                    h += `<tr>
                            <td>${index + 1}</td>
                            <td>${entry.username}</td>
                            <td>${entry.earnings.toFixed(3)} PHP</td>
                          </tr>`;
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
    // Prevent setting default/placeholder names or empty names
    if (!newUsername || newUsername === "User" || newUsername.startsWith("User_") || newUsername === "Guest" || newUsername.startsWith("Guest_")) {
        alert("Invalid username. Please choose a unique name.");
        return;
    }

    try {
        // Attempt to update username - security rules will prevent if already set
        await db.collection("users").doc(firebaseUserId).update({
            username: newUsername
        });
        alert("Username updated successfully!");
    } catch (e) {
        if (e.code === 7 || e.message.includes("permission denied")) { 
            alert("Username cannot be changed after it's set. Your current username is: " + userData.username);
        } else {
            alert("Failed to update username. Error: " + e.message);
        }
        console.error("Update username error:", e);
    }
}


// --- Owner Dashboard Logic ---
function checkAdmin() {
    if (prompt("Owner Password:") === "Propetas6") { 
        showPage('adminPage');
        
        db.collection("stats").doc("global").onSnapshot(d => {
            document.getElementById("statPHP").innerText = (d.data()?.paid || 0).toFixed(2);
        });
        
        db.collection("withdrawals").where("status", "==", "pending").orderBy("timestamp", "asc").onSnapshot(snap => {
            let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Actions</th></tr>`;
            if (snap.empty) h += `<tr><td colspan="5">No pending requests.</td></tr>`;
            snap.forEach(doc => {
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
        }, err => console.error("Sync admin pending requests:", err));

        db.collection("withdrawals").where("status", "!=", "pending").orderBy("timestamp", "desc").limit(20).onSnapshot(snap => {
            let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Status</th></tr>`;
            if (snap.empty) h += `<tr><td colspan="5">No approved/denied history.</td></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.timeStr}</td><td>${d.username}</td><td>${d.amount} PHP</td><td>${d.method}: ${d.info}</td><td class="status-${d.status}">${d.status}</td></tr>`;
            });
            document.getElementById("adminHistory").innerHTML = h + "</table>";
        }, err => console.error("Sync admin history:", err));

    } else {
        alert("Access Denied!");
    }
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

        // Attempt to increment inviter's inviteCount (will be blocked by security rules)
        await db.collection("users").doc(inviterDoc.id).update({
            inviteCount: firebase.firestore.FieldValue.increment(1)
        });
        alert(`Successfully linked to inviter @${inviterUsername}! (Inviter count update requires server-side processing)`);
        console.warn("Referrer count update attempted directly from client. This will be blocked by security rules.");
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

// Ensure loading overlay is visible on initial load and hides only after auth
document.addEventListener('DOMContentLoaded', () => {
    showLoading("Connecting...");
});

// Ensure the loading overlay is hidden when authentication is handled
auth.onAuthStateChanged(user => {
    if (user) {
        // Delay hiding slightly to allow initial messages to be seen if needed
        setTimeout(hideLoading, 500); 
    } else {
        // Show loading message again if auth fails or is pending
        showLoading("Authenticating...");
    }
});
