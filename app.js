
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
const userId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : "user_pc_dev";
const username = tg?.initDataUnsafe?.user ? (tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name) : "Guest";

// Use Number() and || 0 to prevent NaN balance issues
let userData = { balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 };
let currentTaskId = null;

// SYNC DATA REAL-TIME
db.collection("users").doc(userId).onSnapshot(doc => {
    if (doc.exists) {
        const data = doc.data();
        userData = {
            username: data.username || "User",
            balance: Number(data.balance) || 0,
            referredBy: data.referredBy || "",
            inviteCount: Number(data.inviteCount) || 0,
            refEarnings: Number(data.refEarnings) || 0
        };
        document.getElementById("mainBalance").innerText = userData.balance.toFixed(3);
        document.getElementById("userBar").innerText = `👤 @${userData.username}`;
        document.getElementById("myUser").innerText = userData.username;
        document.getElementById("invCount").innerText = userData.inviteCount;
        document.getElementById("invEarned").innerText = userData.refEarnings.toFixed(2);
    } else {
        db.collection("users").doc(userId).set({ username, balance: 0, referredBy: "", inviteCount: 0, refEarnings: 0 });
    }
}, err => console.log("NaN Fix sync error:", err));

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    checkCooldowns();
}

// AD REWARD SYSTEM
function runTask(id, zone, type = 'interstitial') {
    const adFn = window[`show_${zone}`];
    if (typeof adFn === 'function') {
        const p = (type === 'pop') ? adFn('pop') : adFn();
        p.then(() => {
            currentTaskId = id; // Lock current ID
            document.getElementById(`btn_${id}`).style.display = 'none';
            document.getElementById(`claim_${id}`).style.display = 'block';
        }).catch(e => alert("Ad CPM Load Error. Please try again."));
    }
}

async function claimReward(id) {
    // Safety check to ensure the ID clicked matches the ad watched
    if (currentTaskId !== id) return;
    
    const reward = 0.02;
    const comm = reward * 0.10;

    try {
        await db.collection("users").doc(userId).update({
            balance: firebase.firestore.FieldValue.increment(reward)
        });

        if (userData.referredBy) {
            const snap = await db.collection("users").where("username", "==", userData.referredBy).get();
            if (!snap.empty) {
                await db.collection("users").doc(snap.docs[0].id).update({
                    balance: firebase.firestore.FieldValue.increment(comm),
                    refEarnings: firebase.firestore.FieldValue.increment(comm)
                });
            }
        }

        // Timer logic
        const cd = id.toString().startsWith('S') ? 10800 : (id.toString().startsWith('G') ? 1200 : 300);
        localStorage.setItem(`cd_${id}_${userId}`, Date.now() + (cd * 1000));
        
        document.getElementById(`claim_${id}`).style.display = 'none';
        document.getElementById(`btn_${id}`).style.display = 'block';
        currentTaskId = null;
        checkCooldowns();
    } catch (e) {
        alert("Sync error. Check connection.");
    }
}

// WITHDRAWAL SYSTEM (Min 1 PHP)
async function submitWithdraw() {
    const amount = parseFloat(document.getElementById("wAmount").value);
    const info = document.getElementById("wInfo").value.trim();
    const method = document.getElementById("wMethod").value;

    if (!amount || amount < 1 || !info) return alert("Min withdrawal is 1 PHP.");
    if (amount > userData.balance) return alert("Insufficient balance.");

    await db.collection("users").doc(userId).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
    
    await db.collection("withdrawals").add({
        userId, 
        username: userData.username, 
        amount, 
        info, 
        method, 
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        time: new Date().toLocaleString()
    });
    alert("Request Sent!");
    document.getElementById("wAmount").value = "";
    document.getElementById("wInfo").value = "";
}

// REAL-TIME TABLES
db.collection("withdrawals").where("userId", "==", userId).orderBy("timestamp", "desc").limit(8).onSnapshot(snap => {
    let h = `<table><tr><th>Time</th><th>PHP</th><th>Info</th><th>Status</th></tr>`;
    snap.forEach(doc => {
        const d = doc.data();
        h += `<tr><td>${d.time}</td><td>${d.amount}</td><td>${d.info}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
    document.getElementById("userHistory").innerHTML = h + "</table>";
});

// OWNER DASHBOARD
function checkAdmin() {
    if (prompt("Owner Pass:") === "Propetas6") {
        showPage('adminPage');
        db.collection("stats").doc("global").onSnapshot(d => document.getElementById("statPHP").innerText = (d.data()?.paid || 0).toFixed(2));
        
        db.collection("withdrawals").where("status", "==", "pending").onSnapshot(snap => {
            let h = `<table><tr><th>User</th><th>Amt</th><th>Details</th><th>Action</th></tr>`;
            snap.forEach(doc => {
                const d = doc.data();
                h += `<tr><td>${d.username}</td><td>${d.amount}</td><td>${d.method}: ${d.info}</td>
                <td><button onclick="admPay('${doc.id}', ${d.amount})">Paid</button></td></tr>`;
            });
            document.getElementById("adminPending").innerHTML = h + "</table>";
        });
    }
}

async function admPay(id, a) {
    await db.collection("withdrawals").doc(id).update({ status: 'paid' });
    await db.collection("stats").doc("global").set({ paid: firebase.firestore.FieldValue.increment(a) }, { merge: true });
}

// REFERRAL LINKING
async function setReferrer() {
    const inv = document.getElementById("refInput").value.trim();
    if (inv === userData.username || userData.referredBy) return alert("Action Not Allowed.");
    const snap = await db.collection("users").where("username", "==", inv).get();
    if (snap.empty) return alert("Inviter not found.");
    
    await db.collection("users").doc(userId).update({ referredBy: inv });
    await db.collection("users").doc(snap.docs[0].id).update({ inviteCount: firebase.firestore.FieldValue.increment(1) });
    alert("Referral successfully linked!");
}

// COOLDOWNS
function checkCooldowns() {
    const ids = [1, 2, 3, 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3', 'G4'];
    ids.forEach(id => {
        const end = localStorage.getItem(`cd_${id}_${userId}`);
        const btn = document.getElementById(`btn_${id}`);
        const lbl = document.getElementById(`timer_${id}`);
        if (btn && end && Date.now() < end) {
            btn.disabled = true;
            const rem = Math.floor((end - Date.now()) / 1000);
            lbl.innerText = `${Math.floor(rem/60)}m ${rem%60}s`;
        } else if (btn) {
            btn.disabled = false;
            if (lbl) lbl.innerText = "";
        }
    });
}
setInterval(checkCooldowns, 1000);
setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);
