
// FIREBASE CONFIGURATION
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

// TELEGRAM INIT
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? (tgUser.username || tgUser.first_name) : "Guest_" + Math.floor(Math.random()*1000);

document.getElementById("userBar").innerText = "👤 " + username;

let currentUserData = null;
let currentHistoryPage = 1;
let currentAdminPage = 1;

// INITIALIZE USER
auth.signInAnonymously().then(() => {
    const userRef = db.collection("users").doc(username);
    userRef.onSnapshot((doc) => {
        if (!doc.exists()) {
            // New User & Referral Logic
            const urlParams = new URLSearchParams(window.location.search);
            const refBy = urlParams.get('ref');
            
            userRef.set({
                username: username,
                balance: 0,
                referredBy: refBy || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            currentUserData = doc.data();
            document.getElementById("balanceDisplay").innerText = "PHP " + currentUserData.balance.toFixed(3);
            document.getElementById("refLink").innerText = "Ref Link: https://t.me/YourBotName?start=" + username;
            checkCooldowns();
        }
    });
    loadHistory();
});

// VIEW NAVIGATION
function changeView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    // Auto Interstitial Logic
    if(viewId === 'view-tasks') {
        show_10337853({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
    } else if(viewId === 'view-gifts') {
        show_10337795({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
    }
}

// ADS & REWARDS
async function triggerAd(id, zone, type) {
    const btn = document.getElementById(`btn-${type}${id}`);
    const claimBtn = document.getElementById(`claim-${type}${id}`);
    
    btn.disabled = true;
    const adFunc = window['show_' + zone];
    
    const format = type === 'gift' ? 'pop' : null;

    adFunc(format).then(() => {
        btn.style.display = 'none';
        claimBtn.style.display = 'block';
    }).catch(e => {
        btn.disabled = false;
        alert("Ad not available yet.");
    });
}

async function claimReward(type, id, amount, cooldownMin) {
    const claimBtn = document.getElementById(`claim-${type}${id}`);
    const btn = document.getElementById(`btn-${type}${id}`);
    
    // Add Balance & Referral Bonus
    const batch = db.batch();
    const userRef = db.collection("users").doc(username);
    
    batch.update(userRef, {
        balance: firebase.firestore.FieldValue.increment(amount),
        [`last_${type}_${id}`]: Date.now()
    });

    // Referral 10%
    if(currentUserData.referredBy) {
        const refRef = db.collection("users").doc(currentUserData.referredBy);
        batch.update(refRef, { balance: firebase.firestore.FieldValue.increment(amount * 0.10) });
    }

    await batch.commit();
    alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
    
    claimBtn.style.display = 'none';
    btn.style.display = 'block';
    checkCooldowns();
}

// WITHDRAWAL LOGIC
async function requestWithdrawal(method) {
    const amtInput = document.getElementById(`withdraw-amount-${method === 'GCash' ? 'gcash' : 'fp'}`);
    const detailInput = document.getElementById(`withdraw-${method === 'GCash' ? 'number-gcash' : 'email-fp'}`);
    const amount = parseFloat(amtInput.value);

    if(amount > currentUserData.balance || amount <= 0) return alert("Invalid amount");

    await db.collection("withdrawals").add({
        username: username,
        amount: amount,
        method: method,
        details: detailInput.value,
        status: "Pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("users").doc(username).update({
        balance: firebase.firestore.FieldValue.increment(-amount)
    });

    alert("Withdrawal Requested!");
    amtInput.value = "";
    detailInput.value = "";
}

// HISTORY PAGINATION (10 per page)
function loadHistory() {
    db.collection("withdrawals")
      .where("username", "==", username)
      .orderBy("timestamp", "desc")
      .limit(10)
      .onSnapshot(snap => {
        const body = document.getElementById("history-body");
        body.innerHTML = "";
        snap.forEach(doc => {
            const data = doc.data();
            body.innerHTML += `<tr>
                <td>${data.timestamp?.toDate().toLocaleDateString() || '...'}</td>
                <td>${data.method}</td>
                <td>${data.amount}</td>
                <td class="status-${data.status}">${data.status}</td>
            </tr>`;
        });
    });
}

// COOLDOWN TIMER
function checkCooldowns() {
    const tasks = [
        {id: 1, type: 'task', cd: 5}, {id: 2, type: 'task', cd: 5}, {id: 3, type: 'task', cd: 5},
        {id: 1, type: 'gift', cd: 20}, {id: 2, type: 'gift', cd: 20}, {id: 3, type: 'gift', cd: 20}
    ];

    tasks.forEach(t => {
        const last = currentUserData[`last_${t.type}_${t.id}`] || 0;
        const now = Date.now();
        const diff = now - last;
        const cdMs = t.cd * 60 * 1000;
        const btn = document.getElementById(`btn-${t.type}${t.id}`);
        const text = document.getElementById(`cd-${t.type}${t.id}`);

        if(diff < cdMs) {
            btn.disabled = true;
            const rem = Math.ceil((cdMs - diff)/1000);
            text.innerText = `Wait ${Math.floor(rem/60)}m ${rem%60}s`;
            setTimeout(checkCooldowns, 1000);
        } else {
            btn.disabled = false;
            text.innerText = "";
        }
    });
}

// ADMIN DASHBOARD
function openAdmin() {
    const pass = prompt("Enter Admin Password:");
    if(pass === "Propetas6") {
        changeView('view-admin');
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
}

function loadAdminData() {
    db.collection("withdrawals").orderBy("timestamp", "desc").limit(50).onSnapshot(snap => {
        const body = document.getElementById("admin-body");
        let total = 0;
        body.innerHTML = "";
        snap.forEach(doc => {
            const data = doc.data();
            if(data.status === 'Paid') total += data.amount;
            body.innerHTML += `<tr>
                <td>${data.username}</td>
                <td>${data.method}: ${data.details}</td>
                <td>${data.amount}</td>
                <td>
                    ${data.status === 'Pending' ? `
                        <button onclick="updateStatus('${doc.id}', 'Paid')">✅</button>
                        <button onclick="updateStatus('${doc.id}', 'Denied')">❌</button>
                    ` : data.status}
                </td>
            </tr>`;
        });
        document.getElementById("admin-total-paid").innerText = total.toFixed(2);
    });
}

async function updateStatus(id, status) {
    await db.collection("withdrawals").doc(id).update({ status: status });
}
