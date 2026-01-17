
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
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "dev_telegram_id";
const telegramUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || "User") : "Guest";

let firebaseUserId = null; // This will be the actual Firestore document ID (Firebase UID)
let userData = { 
    balance: 0, 
    referredBy: "", 
    inviteCount: 0, 
    refEarnings: 0, 
    username: telegramUsername, 
    telegramId: telegramUserId 
};
let currentTaskId = null; // To prevent multiple claims for a single ad view
let appInitialized = false; // Flag to ensure initAppFeatures runs only once

// --- UI LOADING & ERROR HANDLING ---
function showLoading(message) {
    document.getElementById("loadingMessage").innerText = message;
    document.getElementById("loadingOverlay").style.display = 'flex';
}

function hideLoading() {
    document.getElementById("loadingOverlay").style.display = 'none';
}

function displayError(message) {
    alert("Error: " + message + "\nPlease restart the app.");
    console.error("Critical error:", message);
    showLoading("A critical error occurred. Please restart the app.");
}

// --- FIREBASE AUTHENTICATION & USER DATA MANAGEMENT ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        firebaseUserId = user.uid;
        console.log("Firebase Authenticated. UID:", firebaseUserId);
        showLoading("Loading user data...");

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
            } else {
                // Create new user document for this Firebase UID
                userData = {
                    username: telegramUsername,
                    balance: 0,
                    referredBy: "",
                    inviteCount: 0,
                    refEarnings: 0,
                    telegramId: telegramUserId
                };
                await userDocRef.set(userData); // Use the prepared userData object
                console.log("New user profile created for Firebase UID:", firebaseUserId);
            }
            
            // Set up real-time listener for user data AFTER initial load/creation
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
                    updateUI(); // Update UI on any change
                } else {
                    // This scenario should be rare if doc.set() worked, but handle defensively
                    console.warn("User document disappeared during snapshot listener, attempting to re-create.");
                    userDocRef.set({
                        username: telegramUsername, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0, telegramId: telegramUserId
                    }).catch(e => console.error("Failed to re-create user doc:", e));
                }
            }, err => console.error("Error syncing user data via snapshot:", err));

            updateUI();
            if (!appInitialized) {
                initAppFeatures(); // Initialize other features only once
                appInitialized = true;
                hideLoading();
            }

        } catch (e) {
            displayError("Failed to load user data: " + e.message);
        }

    } else {
        // Not authenticated, try to sign in anonymously
        console.log("Not authenticated, signing in anonymously...");
        showLoading("Authenticating...");
        try {
            await auth.signInAnonymously();
        } catch (error) {
            displayError("Anonymous authentication failed. Check internet connection.");
        }
    }
});

function updateUI() {
    document.getElementById("mainBalance").innerText = userData.balance.toFixed(3);
    document.getElementById("userBar").innerText = `👤 @${userData.username}`;
    document.getElementById("myUser").innerText = userData.username;
    document.getElementById("invCount").innerText = userData.inviteCount;
    document.getElementById("invEarned").innerText = userData.refEarnings.toFixed(3);
}

function initAppFeatures() {
    console.log("Initializing app features...");
    // Start auto-ads and other functionalities only after authentication and data loaded
    setInterval(showRandomInAppInterstitial, 120 * 1000); // Every 2 minutes
    
    // Set up withdrawal history listener specific to the authenticated user
    db.collection("withdrawals").where("userId", "==", firebaseUserId).orderBy("timestamp", "desc").limit(8).onSnapshot(snap => {
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
}


// --- AUTOMATIC IN-APP INTERSTITIAL ADS (No Reward) ---
function showRandomInAppInterstitial() {
    if (!firebaseUserId) return; // Only show if user is authenticated

    const zones = [10276123, 10337795, 10337853];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const adFn = window[`show_${randomZone}`];

    if (typeof adFn === 'function') {
        adFn({
            type: 'inApp',
            inAppSettings: {
                frequency: 2,
                capping: 0.1, // 0.1 hours = 6 minutes
                interval: 30, // seconds
                timeout: 5,   // seconds
                everyPage: false // Session saved across page transitions
            }
        }).catch(() => {
            console.log(`In-App Interstitial ad for zone ${randomZone} failed to show.`);
        });
    }
}

// --- PAGE NAVIGATION ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns(); // Re-check cooldowns when page changes
}

// --- AD WATCHING & CLAIMING LOGIC ---
function runTask(id, zone, type = 'interstitial') {
    if (!firebaseUserId) {
        alert("Please wait for connection to complete.");
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
            alert("Ad is not ready or blocked. Please try again.");
            console.error(`Ad task for ID ${id} failed:`, e);
        });
    } else {
        alert("Ad provider not loaded. Check internet or adblock.");
    }
}

async function claimReward(id) {
    if (!firebaseUserId) {
        alert("User not authenticated. Please reload the app.");
        return;
    }
    if (currentTaskId !== id) {
        alert("Please watch an ad first, or claim the correct ad.");
        return;
    }
    
    const reward = 0.02;
    const refComm = reward * 0.10; // 10% referral commission

    try {
        // 1. Credit User's balance (This update will pass security rules)
        await db.collection("users").doc(firebaseUserId).update({
            balance: firebase.firestore.FieldValue.increment(reward)
        });

        // 2. Attempt to credit Referrer's balance if applicable
        // --- IMPORTANT: This client-side update to another user's document will FAIL with advanced security rules ---
        // For secure cross-user updates (like crediting a referrer), a Firebase Cloud Function is REQUIRED.
        if (userData.referredBy) {
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).limit(1).get();
            if (!refSnap.empty) {
                // This call will likely result in "Permission Denied" with the provided security rules
                // because `request.auth.uid` (current user) != `refSnap.docs[0].id` (referrer's user ID).
                await db.collection("users").doc(refSnap.docs[0].id).update({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm)
                });
                console.warn("Attempted client-side referrer credit. This operation will be blocked by security rules in a secure setup. Use a Cloud Function.");
            }
        }

        // 3. Set Cooldown Timer
        let cooldownSeconds = 300; // Default: 5 minutes
        if (id.toString().startsWith('G')) cooldownSeconds = 3600; // Gift Ads: 1 hour
        if (id.toString().startsWith('S')) cooldownSeconds = 1200; // Sign-in Ads: 20 minutes
        
        localStorage.setItem(`cd_${id}_${firebaseUserId}`, Date.now() + (cooldownSeconds * 1000));
        
        // Reset UI
        document.getElementById(`claim_${id}`).style.display = 'none';
        document.getElementById(`btn_${id}`).style.display = 'block';
        currentTaskId = null; 
        checkCooldowns(); 
    } catch (e) {
        alert("Failed to claim reward. Error: " + e.message + "\n(Note: Referral credit may require admin rights)");
        console.error("Claim reward error:", e);
    }
}

// --- WITHDRAWAL LOGIC (Min 1 PHP) ---
async function submitWithdraw() {
    if (!firebaseUserId) {
        alert("User not authenticated. Please reload the app.");
        return;
    }

    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();
    const method = document.getElementById("wMethod").value;

    if (!amount || amount < 1 || !info) {
        alert("Minimum withdrawal is 1 PHP. Please fill all fields.");
        return;
    }
    if (amount > userData.balance) {
        alert("Insufficient balance.");
        return;
    }

    try {
        // Deduct from user balance
        await db.collection("users").doc(firebaseUserId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
        
        // Record withdrawal request
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

// --- OWNER DASHBOARD LOGIC ---
function checkAdmin() {
    if (prompt("Owner Password:") === "Propetas6") { 
        showPage('adminPage');
        
        // Sync Total Paid
        db.collection("stats").doc("global").onSnapshot(d => {
            document.getElementById("statPHP").innerText = (d.data()?.paid || 0).toFixed(2);
        });
        
        // Pending Requests Table (Real-time sync)
        db.collection("withdrawals").where("status", "==", "pending").orderBy("timestamp", "asc").onSnapshot(snap => {
            let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Actions</th></tr>`;
            if (snap.empty) {
                h += `<tr><td colspan="5">No pending requests.</td></tr>`;
            }
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr}</td>
                        <td>${d.username}</td>
                        <td>${d.amount} PHP</td>
                        <td>${d.method}: ${d.info}</td>
                        <td>
                            <button onclick="admProcess('${doc.id}','paid',${d.amount})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--success')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer;">Pay</button>
                            <button onclick="admProcess('${doc.id}','denied',${d.amount})" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--danger')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer; margin-left:5px;">Deny</button>
                        </td>
                      </tr>`;
            });
            document.getElementById("adminPending").innerHTML = h + "</table>";
        }, err => console.error("Error syncing admin pending requests:", err));

        // Approved History Table (Real-time sync)
        db.collection("withdrawals").where("status", "!=", "pending").orderBy("timestamp", "desc").limit(20).onSnapshot(snap => {
            let h = `<table><tr><th>Date</th><th>User</th><th>Amount</th><th>Account Info</th><th>Status</th></tr>`;
            if (snap.empty) {
                h += `<tr><td colspan="5">No approved/denied history.</td></tr>`;
            }
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr}</td>
                        <td>${d.username}</td>
                        <td>${d.amount} PHP</td>
                        <td>${d.method}: ${d.info}</td>
                        <td class="status-${d.status}">${d.status}</td>
                      </tr>`;
            });
            document.getElementById("adminHistory").innerHTML = h + "</table>";
        }, err => console.error("Error syncing admin history:", err));

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
            // Revert funds to user if denied
            const deniedWithdrawal = (await db.collection("withdrawals").doc(id).get()).data();
            await db.collection("users").doc(deniedWithdrawal.userId).update({ 
                balance: firebase.firestore.FieldValue.increment(deniedWithdrawal.amount) 
            });
            alert(`Withdrawal for ${deniedWithdrawal.username} denied. Funds returned.`);
        }
    } catch (e) {
        alert("Failed to process withdrawal. Error: " + e.message);
        console.error("Admin process error:", e);
    }
}

// --- REFERRAL LINKING ---
async function setReferrer() {
    if (!firebaseUserId) {
        alert("User not authenticated. Please reload the app.");
        return;
    }

    const inviterUsername = document.getElementById("refInput").value.trim();
    if (!inviterUsername) {
        alert("Please enter a username.");
        return;
    }
    if (inviterUsername === userData.username) {
        alert("You cannot refer yourself.");
        return;
    }
    if (userData.referredBy) {
        alert("You are already referred by someone.");
        return;
    }

    try {
        // Find inviter by their Telegram username (stored as 'username' field)
        const snap = await db.collection("users").where("username", "==", inviterUsername).limit(1).get();
        if (snap.empty) {
            alert("Inviter username not found.");
            return;
        }
        
        const inviterDoc = snap.docs[0];
        
        // Update current user's referredBy field (this update will pass security rules)
        await db.collection("users").doc(firebaseUserId).update({ referredBy: inviterUsername });

        // Attempt to increment inviter's count (This cross-user update will FAIL with security rules)
        // A Cloud Function is needed here for a secure and working solution.
        await db.collection("users").doc(inviterDoc.id).update({
            inviteCount: firebase.firestore.FieldValue.increment(1)
        });
        alert(`Successfully linked to inviter @${inviterUsername}! (Inviter count update may require admin rights)`);
        console.warn("Referrer count update attempted directly from client. This will be denied by security rules. A Cloud Function is needed for a secure implementation.");
    } catch (e) {
        alert("Failed to link referrer. Error: " + e.message);
        console.error("Referral linking error:", e);
    }
}

// --- COOLDOWNS & CLOCK DISPLAY ---
function checkCooldowns() {
    if (!firebaseUserId) return; // Don't check cooldowns until authenticated

    const ids = [1, 2, 3, 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4'];
    ids.forEach(id => {
        const endTime = localStorage.getItem(`cd_${id}_${firebaseUserId}`); // Use Firebase UID for localStorage key
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
        }
    });
}
setInterval(checkCooldowns, 1000); // Update cooldowns every second

setInterval(() => { 
    document.getElementById("clock").innerText = new Date().toLocaleString(); 
}, 1000); // Update clock every second
