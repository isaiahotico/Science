
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
const userId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "guest";
const username = tg?.initDataUnsafe?.user ? tg.initDataUnsafe.user.username : "Guest";

let userData = {};
let activeTaskReward = 0;

// Initialize User
db.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
        userData = doc.data();
        updateUI();
    } else {
        db.collection("users").doc(userId).set({ username, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 });
    }
});

function updateUI() {
    document.getElementById("balanceDisplay").innerText = `💰 PHP ${userData.balance.toFixed(3)}`;
    document.getElementById("userBar").innerText = `👤 @${userData.username}`;
    document.getElementById("myRefId").innerText = userData.username;
    document.getElementById("refCount").innerText = userData.inviteCount;
    document.getElementById("refEarned").innerText = userData.refEarnings.toFixed(3);
}

// ADS & CLAIM LOGIC
function runTask(id, zone, reward) {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        adFn().then(() => {
            activeTaskReward = reward;
            document.getElementById(`btn_task${id}`).style.display = 'none';
            document.getElementById(`claim_task${id}`).style.display = 'block';
        });
    }
}

async function claimReward(id) {
    if (activeTaskReward <= 0) return;
    const reward = activeTaskReward;
    const commission = reward * 0.10;

    // Update User
    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(reward) });

    // Lifetime Referral Logic
    if (userData.referredBy) {
        const refQuery = await db.collection("users").where("username", "==", userData.referredBy).get();
        if (!refQuery.empty) {
            await db.collection("users").doc(refQuery.docs[0].id).update({
                balance: firebase.firestore.FieldValue.increment(commission),
                refEarnings: firebase.firestore.FieldValue.increment(commission)
            });
        }
    }

    alert("Reward Claimed!");
    activeTaskReward = 0;
    localStorage.setItem(`cd_${id}`, Date.now() + (getCD(id) * 1000));
    document.getElementById(`claim_task${id}`).style.display = 'none';
    document.getElementById(`btn_task${id}`).style.display = 'block';
    checkCooldowns();
}

function getCD(id) {
    if (String(id).startsWith('S')) return 10800; // 3h
    if (String(id).startsWith('G')) return 1200;  // 20m
    return 300; // 5m
}

// REFERRAL
async function linkReferral() {
    const inviter = document.getElementById("inviterInput").value.trim();
    if (inviter === userData.username || userData.referredBy) return alert("Invalid Action");
    const snap = await db.collection("users").where("username", "==", inviter).get();
    if (snap.empty) return alert("User not found");

    await db.collection("users").doc(userId).update({ referredBy: inviter });
    await db.collection("users").doc(snap.docs[0].id).update({ inviteCount: firebase.firestore.FieldValue.increment(1) });
    alert("Linked!");
}

// WITHDRAWAL
async function handleWithdraw() {
    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value;
    if (amount > userData.balance || amount < 1) return alert("Check amount");

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
    await db.collection("withdrawals").add({
        userId, username: userData.username, amount, info, status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        timeLabel: new Date().toLocaleString()
    });
    alert("Submitted");
}

// ADMIN DASHBOARD
function checkAdmin() {
    if (prompt("Pass:") === "Propetas6") {
        showPage('adminPage');
        db.collection("stats").doc("global").onSnapshot(d => document.getElementById("globalStats").innerText = d.data()?.totalWithdrawn.toFixed(2));
        
        // Pending
        db.collection("withdrawals").where("status", "==", "pending").onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td><button onclick="approve('${doc.id}', ${d.amount})">Paid</button></td></tr>`;
            });
            document.getElementById("adminPending").innerHTML = h + "</table>";
        });

        // History (Last 100)
        db.collection("withdrawals").where("status", "!=", "pending").limit(100).onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Stat</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
            });
            document.getElementById("adminHistory").innerHTML = h + "</table>";
        });
    }
}

async function approve(id, amt) {
    await db.collection("withdrawals").doc(id).update({ status: 'paid' });
    await db.collection("stats").doc("global").set({ totalWithdrawn: firebase.firestore.FieldValue.increment(amt) }, { merge: true });
}

// COOLDOWNS & NAVIGATION
function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(p).classList.add('active');
    checkCooldowns();
}

function checkCooldowns() {
    const ids = [1, 'S1', 'G1']; // Add all your task IDs here
    ids.forEach(id => {
        const end = localStorage.getItem(`cd_${id}`);
        const btn = document.getElementById(`btn_task${id}`);
        const timer = document.getElementById(`timer_task${id}`);
        if (!btn) return;
        if (end && Date.now() < end) {
            btn.disabled = true;
            const rem = Math.floor((end - Date.now()) / 1000);
            timer.innerText = `${Math.floor(rem / 60)}m ${rem % 60}s`;
        } else {
            btn.disabled = false;
            timer.innerText = "";
        }
    });
}
setInterval(checkCooldowns, 1000);

// Auto History for User
db.collection("withdrawals").where("userId", "==", userId).limit(10).onSnapshot(snap => {
    let h = `<table><tr><th>Date</th><th>Amt</th><th>Stat</th></tr>`;
    snap.forEach(doc => {
        const d = doc.data();
        h += `<tr><td>${d.timeLabel}</td><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
    document.getElementById("historyTable").innerHTML = h + "</table>";
});
