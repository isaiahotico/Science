
// INITIALIZE FIREBASE
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

// TELEGRAM USER DATA
const tg = window.Telegram?.WebApp;
tg?.ready();
const userId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "guest_account";
const currentUsername = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name) : "Guest";

let userData = { balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 };
let adState = {}; 

// STICKY USER LISTENER (Prevents account leakage)
db.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
        userData = doc.data();
    } else {
        // Create new account if not exists
        const newData = { username: currentUsername, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 };
        db.collection("users").doc(userId).set(newData);
        userData = newData;
    }
    updateUI();
});

function updateUI() {
    document.getElementById("balanceDisplay").innerText = `💰 PHP ${userData.balance.toFixed(3)}`;
    document.getElementById("userBar").innerText = `👤 @${userData.username}`;
    document.getElementById("myRefCode").innerText = userData.username;
    document.getElementById("refCount").innerText = userData.inviteCount || 0;
    document.getElementById("refEarned").innerText = (userData.refEarnings || 0).toFixed(3);
}

// NAVIGATION
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns();
}

// AD LOGIC
function runTask(id, zone, reward, type = 'interstitial') {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        const p = (type === 'pop') ? adFn('pop') : adFn();
        p.then(() => {
            adState[id] = reward; 
            document.getElementById(`btn_${id}`).style.display = 'none';
            document.getElementById(`claim_${id}`).style.display = 'block';
        });
    }
}

async function claimReward(id) {
    const reward = adState[id];
    const comm = reward * 0.10;

    // 1. Credit User
    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(reward) });

    // 2. Referral Commission (Lifetime 10%)
    if (userData.referredBy) {
        const refSnap = await db.collection("users").where("username", "==", userData.referredBy).get();
        if (!refSnap.empty) {
            await db.collection("users").doc(refSnap.docs[0].id).update({
                balance: firebase.firestore.FieldValue.increment(comm),
                refEarnings: firebase.firestore.FieldValue.increment(comm)
            });
        }
    }

    // 3. Set Cooldown & Reset Buttons
    localStorage.setItem(`cd_${id}_${userId}`, Date.now() + (getCD(id) * 1000));
    delete adState[id];
    document.getElementById(`claim_${id}`).style.display = 'none';
    document.getElementById(`btn_${id}`).style.display = 'block';
    checkCooldowns();
}

function getCD(id) {
    if (String(id).startsWith('S')) return 10800; 
    if (String(id).startsWith('G')) return 1200;  
    return 300; 
}

// COOLDOWN ENGINE
function checkCooldowns() {
    const ids = [1, 2, 3, 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4'];
    ids.forEach(id => {
        const end = localStorage.getItem(`cd_${id}_${userId}`);
        const btn = document.getElementById(`btn_${id}`);
        const timer = document.getElementById(`timer_${id}`);
        if (!btn) return;
        if (adState[id]) return;

        if (end && Date.now() < end) {
            btn.disabled = true;
            const diff = Math.floor((end - Date.now()) / 1000);
            timer.innerText = `Wait: ${Math.floor(diff / 60)}m ${diff % 60}s`;
        } else {
            btn.disabled = false;
            timer.innerText = "";
        }
    });
}
setInterval(checkCooldowns, 1000);

// REFERRAL LINKING FIX
async function linkReferral() {
    const inv = document.getElementById("inviterInput").value.trim().replace('@', '');
    
    if (inv === userData.username) return alert("You cannot invite yourself!");
    if (userData.referredBy) return alert("You are already referred!");

    try {
        const snap = await db.collection("users").where("username", "==", inv).get();
        if (snap.empty) return alert("Inviter not found. Check spelling!");

        const inviterDoc = snap.docs[0];
        await db.collection("users").doc(userId).update({ referredBy: inv });
        await db.collection("users").doc(inviterDoc.id).update({ 
            inviteCount: firebase.firestore.FieldValue.increment(1) 
        });
        alert("Referral Linked Successfully!");
    } catch (e) {
        alert("Connection Error. Try again.");
    }
}

// WITHDRAWAL
async function requestWithdraw(method) {
    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value;
    if (amount > userData.balance || amount < 1) return alert("Error in amount/balance");

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
    await db.collection("withdrawals").add({
        userId, username: userData.username, amount, info, method, status: "pending", 
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        dateStr: new Date().toLocaleString()
    });
    alert("Submitted!");
}

// HISTORY TABLES
db.collection("withdrawals").where("userId", "==", userId).orderBy("timestamp", "desc").limit(10).onSnapshot(snap => {
    let h = `<table><tr><th>Date</th><th>Amt</th><th>Status</th></tr>`;
    snap.forEach(doc => {
        const d = doc.data();
        h += `<tr><td>${d.dateStr}</td><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
    document.getElementById("historyTable").innerHTML = h + "</table>";
});

// ADMIN LOGIC
function checkAdmin() {
    if (prompt("Owner Pass:") === "Propetas6") {
        showPage('adminPage');
        db.collection("stats").doc("global").onSnapshot(d => document.getElementById("globalStats").innerText = (d.data()?.totalPaid || 0).toFixed(2));
        
        db.collection("withdrawals").where("status", "==", "pending").onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td><button onclick="admUpd('${doc.id}','paid',${d.amount})">Paid</button></td></tr>`;
            });
            document.getElementById("adminPendingTable").innerHTML = h + "</table>";
        });

        db.collection("withdrawals").where("status", "!=", "pending").limit(50).onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Stat</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
            });
            document.getElementById("adminHistoryTable").innerHTML = h + "</table>";
        });
    }
}

async function admUpd(id, s, a) {
    await db.collection("withdrawals").doc(id).update({ status: s });
    if (s === 'paid') await db.collection("stats").doc("global").set({ totalPaid: firebase.firestore.FieldValue.increment(a) }, { merge: true });
}

// FOOTER CLOCK
setInterval(() => { document.getElementById("footerClock").innerText = new Date().toLocaleString(); }, 1000);
