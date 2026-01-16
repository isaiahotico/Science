
// FIREBASE INITIALIZATION
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

// TELEGRAM & USER DATA
const tg = window.Telegram?.WebApp;
const userId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "guest_user";
const username = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name) : "Guest";

let userData = { balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 };
let adState = {}; // Stores which ad is watched and ready to claim

// DATA SYNC
db.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
        userData = doc.data();
        updateHeaderUI();
    } else {
        db.collection("users").doc(userId).set({ username, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 });
    }
});

function updateHeaderUI() {
    document.getElementById("balanceDisplay").innerText = `💰 PHP ${userData.balance.toFixed(3)}`;
    document.getElementById("userBar").innerText = `👤 @${userData.username}`;
    document.getElementById("myRefCode").innerText = userData.username;
    document.getElementById("refCount").innerText = userData.inviteCount;
    document.getElementById("refEarned").innerText = userData.refEarnings.toFixed(3);
}

// FOOTER CLOCK
setInterval(() => {
    document.getElementById("footerClock").innerText = new Date().toLocaleString();
}, 1000);

// NAVIGATION
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns();
}

// AD LOGIC: Watch -> Claim -> Cooldown
function runTask(id, zone, reward, type = 'interstitial') {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        const p = (type === 'pop') ? adFn('pop') : adFn();
        p.then(() => {
            alert("Watch completed! You can now claim.");
            adState[id] = reward; // Ready to claim
            document.getElementById(`btn_${id}`).style.display = 'none';
            document.getElementById(`claim_${id}`).style.display = 'block';
        }).catch(() => alert("Ad failed or closed too early."));
    }
}

async function claimReward(id) {
    if (!adState[id]) return;
    const reward = adState[id];
    const comm = reward * 0.10;

    // 1. Update User
    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(reward) });

    // 2. Referral Commission
    if (userData.referredBy) {
        const refQuery = await db.collection("users").where("username", "==", userData.referredBy).get();
        if (!refQuery.empty) {
            await db.collection("users").doc(refQuery.docs[0].id).update({
                balance: firebase.firestore.FieldValue.increment(comm),
                refEarnings: firebase.firestore.FieldValue.increment(comm)
            });
        }
    }

    alert(`🎉 PHP ${reward} claimed!`);
    
    // 3. Set Cooldown & Reset UI
    localStorage.setItem(`cd_${id}`, Date.now() + (getCD(id) * 1000));
    delete adState[id];
    document.getElementById(`claim_${id}`).style.display = 'none';
    document.getElementById(`btn_${id}`).style.display = 'block';
    checkCooldowns();
}

function getCD(id) {
    if (String(id).startsWith('S')) return 10800; // 3h
    if (String(id).startsWith('G')) return 1200;  // 20m
    return 300; // 5m
}

// COOLDOWN SYSTEM
function checkCooldowns() {
    const ids = [1, 2, 3, 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4'];
    ids.forEach(id => {
        const end = localStorage.getItem(`cd_${id}`);
        const btn = document.getElementById(`btn_${id}`);
        const timer = document.getElementById(`timer_${id}`);
        if (!btn) return;
        if (adState[id]) return; // Don't show timer if claim is pending

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

// WITHDRAWAL & USER HISTORY
async function requestWithdraw(method) {
    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value;
    if (amount > userData.balance || amount < 1) return alert("Invalid amount/balance");

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
    await db.collection("withdrawals").add({
        userId, username, amount, info, method, status: "pending", 
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        dateStr: new Date().toLocaleString()
    });
    alert("Withdrawal submitted!");
    document.getElementById("wAmount").value = "";
    document.getElementById("wInfo").value = "";
}

db.collection("withdrawals").where("userId", "==", userId).orderBy("timestamp", "desc").limit(10).onSnapshot(snap => {
    let h = `<table><tr><th>Date</th><th>Method</th><th>Amt</th><th>Status</th></tr>`;
    snap.forEach(doc => {
        const d = doc.data();
        h += `<tr><td>${d.dateStr}</td><td>${d.method}</td><td>${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
    document.getElementById("historyTable").innerHTML = h + "</table>";
});

// ADMIN PANEL & OWNER HISTORY
function checkAdmin() {
    if (prompt("Owner Password:") === "Propetas6") {
        showPage('adminPage');
        
        db.collection("stats").doc("global").onSnapshot(d => {
            document.getElementById("globalStats").innerText = (d.data()?.totalApproved || 0).toFixed(2) + " PHP";
        });

        db.collection("withdrawals").where("status", "==", "pending").onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td>
                    <button onclick="adminAction('${doc.id}', 'paid', ${d.amount})">Approve</button>
                    <button style="background:red; color:white;" onclick="adminAction('${doc.id}', 'denied', 0)">Deny</button>
                </td></tr>`;
            });
            document.getElementById("adminPendingTable").innerHTML = h + "</table>";
        });

        db.collection("withdrawals").where("status", "!=", "pending").orderBy("timestamp", "desc").limit(50).onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Info</th><th>Status</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td>${d.info}</td><td class="status-${d.status}">${d.status}</td></tr>`;
            });
            document.getElementById("adminHistoryTable").innerHTML = h + "</table>";
        });
    }
}

async function adminAction(id, status, amount) {
    await db.collection("withdrawals").doc(id).update({ status: status });
    if (status === 'paid') {
        await db.collection("stats").doc("global").set({ totalApproved: firebase.firestore.FieldValue.increment(amount) }, { merge: true });
    } else if (status === 'denied') {
        const snap = await db.collection("withdrawals").doc(id).get();
        await db.collection("users").doc(snap.data().userId).update({ balance: firebase.firestore.FieldValue.increment(snap.data().amount) });
    }
}

async function linkReferral() {
    const inv = document.getElementById("inviterInput").value.trim().replace('@', '');
    if (inv === username || userData.referredBy) return alert("Error linking.");
    const snap = await db.collection("users").where("username", "==", inv).get();
    if (snap.empty) return alert("User not found.");
    await db.collection("users").doc(userId).update({ referredBy: inv });
    await db.collection("users").doc(snap.docs[0].id).update({ inviteCount: firebase.firestore.FieldValue.increment(1) });
    alert("Referral Linked!");
}
