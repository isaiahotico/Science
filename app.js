
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
const auth = firebase.auth(); // Initialize Firebase Auth

const tg = window.Telegram?.WebApp;
// Retrieve Telegram user info. This is NOT Firebase Auth UID.
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "dev_telegram_id";
const telegramUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || "User") : "Guest";

let firebaseUserId = null; // This will be the actual Firestore document ID after Firebase Auth
let userData = { balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0, username: telegramUsername, telegramId: telegramUserId };
let currentTaskId = null; // To ensure only one claim for one ad view

// --- FIREBASE AUTHENTICATION & USER DATA MANAGEMENT ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        firebaseUserId = user.uid; // Set the Firebase UID as the document ID
        console.log("Firebase Authenticated. UID:", firebaseUserId);

        // Fetch or Create user document using Firebase UID
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
                telegramId: d.telegramId || telegramUserId // Store Telegram ID if not already there
            };
        } else {
            // Create new user document with initial data
            await userDocRef.set({
                username: telegramUsername,
                balance: 0,
                referredBy: "",
                inviteCount: 0,
                refEarnings: 0,
                telegramId: telegramUserId // Store the Telegram ID for lookup
            });
            userData.username = telegramUsername;
            userData.telegramId = telegramUserId;
        }
        
        // Listen for real-time updates to the user's document
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
            } else {
                // If document somehow disappears, re-create or handle
                console.warn("User document disappeared, attempting to re-create.");
                userDocRef.set({
                    username: telegramUsername,
                    balance: 0,
                    referredBy: "",
                    inviteCount: 0,
                    refEarnings: 0,
                    telegramId: telegramUserId
                });
            }
        }, err => console.error("Error syncing user data:", err));

        // Update UI initially
        updateUI();
        // Start other app functionalities that depend on authenticated user
        initAppFeatures(); 

    } else {
        // Not authenticated, sign in anonymously
        console.log("Not authenticated, signing in anonymously...");
        auth.signInAnonymously().catch(error => {
            console.error("Anonymous authentication failed:", error);
            alert("Failed to connect. Please check your internet or try again.");
        });
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
    // Start auto-ads and other functionalities only after authentication
    setInterval(showRandomInAppInterstitial, 120 * 1000); // Every 2 minutes
    setInterval(checkCooldowns, 1000); // Check cooldowns every second
    setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);
}

// --- AUTOMATIC IN-APP INTERSTITIAL ADS (No Reward) ---
function showRandomInAppInterstitial() {
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
    checkCooldowns(); 
}

// --- AD WATCHING & CLAIMING LOGIC ---
function runTask(id, zone, type = 'interstitial') {
    if (!firebaseUserId) {
        alert("Please wait, connecting to server...");
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

        // 2. Credit Referrer's balance if applicable
        // --- IMPORTANT: This client-side update will FAIL with advanced security rules ---
        // For security, cross-user updates (like crediting a referrer) should be handled
        // by a Firebase Cloud Function that runs with admin privileges, NOT directly from the client.
        if (userData.referredBy) {
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).limit(1).get();
            if (!refSnap.empty) {
                // This line will likely cause "insufficient permission" with the provided rules
                // because request.auth.uid (current user) != referrer's userId.
                await db.collection("users").doc(refSnap.docs[0].id).update({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm)
                });
                console.log("Attempted to credit referrer. Check security rules/Cloud Functions for actual success.");
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
        alert("Failed to claim reward. Error: " + e.message + "\n(Referral credit might require admin privileges)");
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
            userId: firebaseUserId, // Use Firebase UID for withdrawal record
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

// --- USER WITHDRAWAL HISTORY TABLE ---
// Listen to current user's withdrawals
db.collection("withdrawals").where("userId", "==", firebaseUserId || "temp").orderBy("timestamp", "desc").limit(8).onSnapshot(snap => {
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
});

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

        // Increment inviter's count (This cross-user update will likely FAIL with security rules)
        // A Cloud Function is needed here for a secure and working solution.
        await db.collection("users").doc(inviterDoc.id).update({
            inviteCount: firebase.firestore.FieldValue.increment(1)
        });
        alert(`Successfully linked to inviter @${inviterUsername}! (Inviter count update may require admin rights)`);
        console.warn("Referrer count update attempted directly from client. This will likely be denied by security rules. Consider a Cloud Function.");
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
