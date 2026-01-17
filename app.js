
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
const userId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "dev_testing_99";
const username = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || "User") : "Guest";

let userData = { balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 };
let currentTaskId = null;

// SYNC ACCOUNT & FIX NaN
db.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
        const d = doc.data();
        userData = {
            username: d.username || "User",
            balance: Number(d.balance) || 0,
            referredBy: d.referredBy || "",
            inviteCount: Number(d.inviteCount) || 0,
            refEarnings: Number(d.refEarnings) || 0
        };
        document.getElementById("mainBalance").innerText = userData.balance.toFixed(3);
        document.getElementById("userBar").innerText = `👤 @${userData.username}`;
        document.getElementById("myUser").innerText = userData.username;
        document.getElementById("invCount").innerText = userData.inviteCount;
        document.getElementById("invEarned").innerText = userData.refEarnings.toFixed(3);
    } else {
        db.collection("users").doc(userId).set({ username, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 });
    }
});

// AUTO-SHOW ADS (No Reward Interstitial)
setInterval(() => {
    const zones = [10276123, 10337795, 10337853];
    const rand = zones[Math.floor(Math.random() * zones.length)];
    if (typeof window[`show_${rand}`] === 'function') {
        window[`show_${rand}`]().catch(() => {});
    }
}, 300000); // Every 5 minutes automatically

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns();
}

// AD LOGIC
function runTask(id, zone, type = 'interstitial') {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        const p = (type === 'pop') ? adFn('pop') : adFn();
        p.then(() => {
            currentTaskId = id; 
            document.getElementById(`btn_${id}`).style.display = 'none';
            document.getElementById(`claim_${id}`).style.display = 'block';
        }).catch(() => alert("Ad not available. Try again."));
    }
}

async function claimReward(id) {
    if (currentTaskId !== id) return;
    
    const reward = 0.02;
    const refComm = 0.002; // 10%

    try {
        // 1. Credit User
        await db.collection("users").doc(userId).update({
            balance: firebase.firestore.FieldValue.increment(reward)
        });

        // 2. Credit Referrer (Fix Logic)
        if (userData.referredBy) {
            const refSnap = await db.collection("users").where("username", "==", userData.referredBy).get();
            if (!refSnap.empty) {
                await db.collection("users").doc(refSnap.docs[0].id).update({
                    balance: firebase.firestore.FieldValue.increment(refComm),
                    refEarnings: firebase.firestore.FieldValue.increment(refComm)
                });
            }
        }

        // 3. Set Timers (Gift 1h, Sign-in 20m, Ads 5m)
        let cd = 300;
        if (id.toString().startsWith('G')) cd = 3600;
        if (id.toString().startsWith('S')) cd = 1200;
        
        localStorage.setItem(`cd_${id}_${userId}`, Date.now() + (cd * 1000));
        document.getElementById(`claim_${id}`).style.display = 'none';
        document.getElementById(`btn_${id}`).style.display = 'block';
        currentTaskId = null;
        checkCooldowns();
    } catch (e) {
        alert("Transaction Failed. Check connection.");
    }
}

// WITHDRAWAL
async function submitWithdraw() {
    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();
    const method = document.getElementById("wMethod").value;

    if (!amount || amount < 1 || !info) return alert("Min withdrawal 1 PHP.");
    if (amount > userData.balance) return alert("Insufficient balance.");

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
    
    await db.collection("withdrawals").add({
        userId, username: userData.username, amount, info, method, status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        timeStr: new Date().toLocaleString()
    });
    alert("Withdrawal submitted!");
}

// SYNC USER TABLE
db.collection("withdrawals").where("userId", "==", userId).orderBy("timestamp", "desc").limit(5).onSnapshot(snap => {
    let h = `<table><tr><th>Date</th><th>PHP</th><th>Method</th><th>Status</th></tr>`;
    snap.forEach(doc => {
        const d = doc.data();
        h += `<tr><td>${d.timeStr}</td><td>${d.amount}</td><td>${d.method}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
    document.getElementById("userHistory").innerHTML = h + "</table>";
});

// OWNER SYSTEM
function checkAdmin() {
    if (prompt("Owner Pass:") === "Propetas6") {
        showPage('adminPage');
        db.collection("stats").doc("global").onSnapshot(d => document.getElementById("statPHP").innerText = (d.data()?.paid || 0).toFixed(2));
        
        // Pending
        db.collection("withdrawals").where("status", "==", "pending").onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Info</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td>${d.method}: ${d.info}<br>${d.timeStr}</td>
                <td><button onclick="admProcess('${doc.id}','paid',${d.amount})">Pay</button>
                <button onclick="admProcess('${doc.id}','denied',0)" style="background:red; color:white;">X</button></td></tr>`;
            });
            document.getElementById("adminPending").innerHTML = h + "</table>";
        });

        // Global History
        db.collection("withdrawals").where("status", "!=", "pending").orderBy("timestamp", "desc").limit(20).onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Account</th><th>Status</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td>${d.info}</td><td class="status-${d.status}">${d.status}</td></tr>`;
            });
            document.getElementById("adminHistory").innerHTML = h + "</table>";
        });
    }
}

async function admProcess(id, s, a) {
    await db.collection("withdrawals").doc(id).update({ status: s });
    if (s === 'paid') await db.collection("stats").doc("global").set({ paid: firebase.firestore.FieldValue.increment(a) }, { merge: true });
    if (s === 'denied') {
        const wd = (await db.collection("withdrawals").doc(id).get()).data();
        await db.collection("users").doc(wd.userId).update({ balance: firebase.firestore.FieldValue.increment(wd.amount) });
    }
}

// REFERRAL LINKING
async function setReferrer() {
    const inv = document.getElementById("refInput").value.trim();
    if (!inv || inv === userData.username || userData.referredBy) return alert("Invalid Action.");
    const snap = await db.collection("users").where("username", "==", inv).get();
    if (snap.empty) return alert("Inviter not found.");
    await db.collection("users").doc(userId).update({ referredBy: inv });
    await db.collection("users").doc(snap.docs[0].id).update({ inviteCount: firebase.firestore.FieldValue.increment(1) });
    alert("Linked!");
}

// TIME DISPLAY & COOLDOWNS
function checkCooldowns() {
    const ids = [1, 2, 3, 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4'];
    ids.forEach(id => {
        const end = localStorage.getItem(`cd_${id}_${userId}`);
        const btn = document.getElementById(`btn_${id}`);
        const lbl = document.getElementById(`timer_${id}`);
        if (btn && end && Date.now() < end) {
            btn.disabled = true;
            const rem = Math.floor((end - Date.now()) / 1000);
            const h = Math.floor(rem / 3600);
            const m = Math.floor((rem % 3600) / 60);
            const s = rem % 60;
            lbl.innerText = `Wait: ${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
        } else if (btn) {
            btn.disabled = false;
            if (lbl) lbl.innerText = "";
        }
    });
}
setInterval(checkCooldowns, 1000);
setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);
