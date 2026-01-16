
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
const userId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "guest_user";
const username = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || "User") : "Guest";
const USDT_RATE = 0.018; 
const AD_REWARD = 0.02; // FIXED REWARD FOR ALL ADS

let userData = { balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 };
let claimReady = false;

// DATA SYNC
db.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
        userData = doc.data();
        document.getElementById("mainBalance").innerText = userData.balance.toFixed(3);
        document.getElementById("usdtEquiv").innerText = (userData.balance * USDT_RATE).toFixed(4);
        document.getElementById("userBar").innerText = `👤 @${userData.username}`;
        document.getElementById("myUser").innerText = userData.username;
        document.getElementById("invCount").innerText = userData.inviteCount || 0;
        document.getElementById("invEarned").innerText = (userData.refEarnings || 0).toFixed(2);
    } else {
        db.collection("users").doc(userId).set({ username, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 });
    }
});

// NAVIGATION
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns();
}

// ADS LOGIC
function runTask(id, zone, type = 'interstitial') {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        const p = (type === 'pop') ? adFn('pop') : adFn();
        p.then(() => {
            claimReady = true;
            document.getElementById(`btn_${id}`).style.display = 'none';
            document.getElementById(`claim_${id}`).style.display = 'block';
        }).catch(() => alert("Ad not ready."));
    }
}

async function claimReward(id) {
    if (!claimReady) return;
    const comm = AD_REWARD * 0.10;

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(AD_REWARD) });

    if (userData.referredBy) {
        const snap = await db.collection("users").where("username", "==", userData.referredBy).get();
        if (!snap.empty) {
            await db.collection("users").doc(snap.docs[0].id).update({
                balance: firebase.firestore.FieldValue.increment(comm),
                refEarnings: firebase.firestore.FieldValue.increment(comm)
            });
        }
    }

    localStorage.setItem(`cd_${id}_${userId}`, Date.now() + (getCDTime(id) * 1000));
    document.getElementById(`claim_${id}`).style.display = 'none';
    document.getElementById(`btn_${id}`).style.display = 'block';
    claimReady = false;
    checkCooldowns();
}

function getCDTime(id) {
    if (String(id).startsWith('S')) return 10800; // 3h Sign-in
    if (String(id).startsWith('G')) return 1200;  // 20m Gift
    return 300; // 5m Normal Ad
}

// WITHDRAWAL
function updateWithdrawUI() {
    const method = document.getElementById("wMethod").value;
    const amount = parseFloat(document.getElementById("wAmount").value) || 0;
    const infoBox = document.getElementById("conversionInfo");
    if (method === "FaucetPay") {
        infoBox.innerText = `Receive ≈ ${(amount * USDT_RATE).toFixed(4)} USDT`;
    } else { infoBox.innerText = ""; }
}
document.getElementById("wAmount").addEventListener("input", updateWithdrawUI);

async function submitWithdraw() {
    const method = document.getElementById("wMethod").value;
    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();

    if (!amount || amount < 5 || !info) return alert("Min withdrawal 5 PHP.");
    if (amount > userData.balance) return alert("Insufficient Balance!");

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
    await db.collection("withdrawals").add({
        userId, username, amount, info, method, 
        usdtAmount: (method === "FaucetPay" ? (amount * USDT_RATE).toFixed(4) : "N/A"),
        status: "pending", timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        date: new Date().toLocaleString()
    });
    alert("Request Sent!");
}

// USER HISTORY
db.collection("withdrawals").where("userId", "==", userId).orderBy("timestamp", "desc").limit(5).onSnapshot(snap => {
    let h = `<table><tr><th>Date</th><th>PHP</th><th>Status</th></tr>`;
    snap.forEach(doc => {
        const d = doc.data();
        h += `<tr><td>${d.date}</td><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
    document.getElementById("userHistory").innerHTML = h + "</table>";
});

// ADMIN DASHBOARD
function checkAdmin() {
    if (prompt("Owner Pass:") === "Propetas6") {
        showPage('adminPage');
        db.collection("stats").doc("global").onSnapshot(d => document.getElementById("statPHP").innerText = (d.data()?.paid || 0).toFixed(2));
        
        db.collection("withdrawals").where("status", "==", "pending").onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Method</th><th>Info</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                const val = d.method === "FaucetPay" ? `${d.usdtAmount} USDT` : `${d.amount} PHP`;
                h += `<tr><td>${d.username}</td><td>${val}</td><td>${d.info}</td>
                <td><button onclick="admUpd('${doc.id}','paid',${d.amount})">Paid</button></td></tr>`;
            });
            document.getElementById("adminPending").innerHTML = h + "</table>";
        });

        db.collection("withdrawals").where("status", "!=", "pending").limit(20).onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>PHP</th><th>Status</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
            });
            document.getElementById("adminHistory").innerHTML = h + "</table>";
        });
    }
}

async function admUpd(id, s, a) {
    await db.collection("withdrawals").doc(id).update({ status: s });
    if (s === 'paid') await db.collection("stats").doc("global").set({ paid: firebase.firestore.FieldValue.increment(a) }, { merge: true });
}

// SYSTEM
function checkCooldowns() {
    const ids = [1, 2, 3, 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4'];
    ids.forEach(id => {
        const end = localStorage.getItem(`cd_${id}_${userId}`);
        const btn = document.getElementById(`btn_${id}`);
        const lbl = document.getElementById(`timer_${id}`);
        if (btn && end && Date.now() < end) {
            btn.disabled = true;
            const rem = Math.floor((end - Date.now()) / 1000);
            lbl.innerText = `Wait: ${Math.floor(rem/60)}m ${rem%60}s`;
        } else if (btn) {
            btn.disabled = false;
            if (lbl) lbl.innerText = "";
        }
    });
}
setInterval(checkCooldowns, 1000);
setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);
