
/* ================= FIREBASE CONFIG ================= */
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

/* ================= TG USER INIT ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const userId = tgUser ? String(tgUser.id) : "guest_user";
const username = tgUser ? `${tgUser.username || tgUser.first_name}` : "Guest";

document.getElementById("userBar").innerText = "👤 User: @" + username;
document.getElementById("myReferralCode").innerText = username;

let userData = { balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 };
let currentReward = 0;

/* ================= DATA SYNC ================= */
db.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
        userData = doc.data();
        document.getElementById("balanceDisplay").innerText = `💰 PHP ${userData.balance.toFixed(3)}`;
        document.getElementById("refCount").innerText = userData.inviteCount || 0;
        document.getElementById("refEarned").innerText = (userData.refEarnings || 0).toFixed(3);
    } else {
        db.collection("users").doc(userId).set({ 
            username, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 
        });
    }
});

/* ================= NAVIGATION & AUTO ADS ================= */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // Auto Interstitials
    if(pageId === 'adsAreaPage') triggerAuto(10337853);
    if(pageId === 'signInPage') triggerAuto(10276123);
    if(pageId === 'giftPage') triggerAuto(10337795);
    
    checkCooldowns();
}

function triggerAuto(zone) {
    if (typeof window[`show_${zone}`] === 'function') {
        window[`show_${zone}`]({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

/* ================= ADS & REWARDS ================= */
function runTask(id, zone, reward, type = 'interstitial') {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        const p = (type === 'pop') ? adFn('pop') : adFn();
        p.then(() => {
            alert("Ad watched!");
            document.getElementById(`btn_task${id}`).style.display = 'none';
            document.getElementById(`claim_task${id}`).style.display = 'block';
            currentReward = reward;
        }).catch(() => alert("Ad error or closed early."));
    }
}

async function claimReward(id) {
    const reward = currentReward;
    const commission = reward * 0.10;

    // Update User
    await db.collection("users").doc(userId).update({
        balance: firebase.firestore.FieldValue.increment(reward)
    });

    // Commission logic
    if (userData.referredBy) {
        const refSnap = await db.collection("users").where("username", "==", userData.referredBy).get();
        if (!refSnap.empty) {
            await db.collection("users").doc(refSnap.docs[0].id).update({
                balance: firebase.firestore.FieldValue.increment(commission),
                refEarnings: firebase.firestore.FieldValue.increment(commission)
            });
        }
    }

    alert("🎉Congratulations🎉 you earned money!!😍🍍");
    localStorage.setItem(`cd_${id}`, Date.now() + (getCD(id) * 1000));
    document.getElementById(`claim_task${id}`).style.display = 'none';
    document.getElementById(`btn_task${id}`).style.display = 'block';
    currentReward = 0;
    checkCooldowns();
}

function getCD(id) {
    if(id.startsWith('S')) return 10800; // 3h
    if(id.startsWith('G')) return 1200;  // 20m
    return 300; // 5m
}

/* ================= REFERRAL & WITHDRAW ================= */
async function linkReferral() {
    const code = document.getElementById("inviterInput").value.trim().replace('@', '');
    if (code === username || userData.referredBy) return alert("Invalid or already linked.");
    
    const snap = await db.collection("users").where("username", "==", code).get();
    if (snap.empty) return alert("User not found.");

    await db.collection("users").doc(userId).update({ referredBy: code });
    await db.collection("users").doc(snap.docs[0].id).update({ 
        inviteCount: firebase.firestore.FieldValue.increment(1) 
    });
    alert("Referral activated!");
}

async function requestWithdraw(method) {
    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value;
    if (amount > userData.balance || amount <= 0) return alert("Check balance/amount.");

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
    await db.collection("withdrawals").add({
        userId, username, amount, info, method, status: "pending", timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Request sent!");
}

/* ================= ADMIN & HISTORY ================= */
db.collection("withdrawals").orderBy("timestamp", "desc").limit(10).onSnapshot(snap => {
    let h = `<table><tr><th>Amt</th><th>Status</th></tr>`;
    snap.forEach(doc => {
        const d = doc.data();
        if(d.userId === userId) h += `<tr><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
    document.getElementById("historyTable").innerHTML = h + "</table>";
});

function checkAdmin() {
    if (prompt("Owner Password:") === "Propetas6") {
        showPage('adminPage');
        db.collection("stats").doc("global").onSnapshot(d => document.getElementById("globalStats").innerText = (d.data()?.totalWithdrawn || 0).toFixed(2) + " PHP");
        db.collection("withdrawals").where("status","==","pending").limit(10).onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td><button onclick="admUpd('${doc.id}', ${d.amount})">Approve</button></td></tr>`;
            });
            document.getElementById("adminTable").innerHTML = h + "</table>";
        });
    }
}

async function admUpd(id, amt) {
    await db.collection("withdrawals").doc(id).update({ status: 'paid' });
    await db.collection("stats").doc("global").set({ totalWithdrawn: firebase.firestore.FieldValue.increment(amt) }, { merge: true });
}

function checkCooldowns() {
    const tasks = [1,2,3,'S1','S2','S3','G1','G2','G3'];
    tasks.forEach(id => {
        const end = localStorage.getItem(`cd_${id}`);
        const btn = document.getElementById(`btn_task${id}`);
        const lbl = document.getElementById(`timer_task${id}`);
        if(btn && end && Date.now() < end) {
            btn.disabled = true;
            const diff = Math.floor((end - Date.now())/1000);
            lbl.innerText = `Wait: ${Math.floor(diff/60)}m ${diff%60}s`;
        } else if(btn) {
            btn.disabled = false;
            if(lbl) lbl.innerText = "";
        }
    });
}
setInterval(checkCooldowns, 1000);
