
// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tg = window.Telegram.WebApp;
tg.expand();

// User State
let userId = tg.initDataUnsafe?.user?.id || "DEBUG_USER";
let userName = tg.initDataUnsafe?.user?.first_name || "Guest";
let currentBalance = 0;

// Initialize User
function initUser() {
    db.ref('users/' + userId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentBalance = data.balance || 0;
            document.getElementById('balance').innerText = currentBalance.toFixed(3);
            checkCooldowns(data);
        } else {
            db.ref('users/' + userId).set({
                name: userName,
                balance: 0,
                lastGift1: 0,
                lastGift2: 0,
                lastGift3: 0,
                lastPremium: 0
            });
        }
    });
    loadUserHistory();
}

// --- NAVIGATION ---
function showView(view) {
    ['ads', 'withdraw', 'admin'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
    });
    document.getElementById(`view-${view}`).classList.remove('hidden');
}

// --- AD LOGIC ---
async function handleAd(type) {
    const now = Date.now();
    const userRef = db.ref('users/' + userId);

    userRef.get().then(async (snap) => {
        const data = snap.val();
        
        if (type === 'gift1' && now - (data.lastGift1 || 0) < 900000) return alert("Cooldown: 15 mins");
        if (type === 'gift2' && now - (data.lastGift2 || 0) < 900000) return alert("Cooldown: 15 mins");
        if (type === 'gift3' && now - (data.lastGift3 || 0) < 900000) return alert("Cooldown: 15 mins");
        if (type === 'premium' && now - (data.lastPremium || 0) < 300000) return alert("Cooldown: 5 mins");

        // ADS TRIGGERING
        try {
            if (type === 'gift1') {
                show_10276123('pop').then(() => rewardUser(0.075, 'lastGift1'));
            } else if (type === 'gift2') {
                show_10337795('pop').then(() => rewardUser(0.075, 'lastGift2'));
            } else if (type === 'gift3') {
                show_10337853('pop').then(() => rewardUser(0.075, 'lastGift3'));
            } else if (type === 'premium') {
                // Sequential execution for Premium Ads
                await show_10276123();
                await show_10337795();
                await show_10337853();
                rewardUser(0.022, 'lastPremium');
            }
        } catch (e) {
            alert("Ad failed to load. Please try again later.");
        }
    });
}

function rewardUser(amt, cooldownKey) {
    const updates = {};
    updates['balance'] = firebase.database.ServerValue.increment(amt);
    updates[cooldownKey] = Date.now();
    db.ref('users/' + userId).update(updates);
    tg.HapticFeedback.notificationOccurred('success');
}

function checkCooldowns(data) {
    const now = Date.now();
    updateBtnTimer('btn-gift1', data.lastGift1, 900000);
    updateBtnTimer('btn-gift2', data.lastGift2, 900000);
    updateBtnTimer('btn-gift3', data.lastGift3, 900000);
    updateBtnTimer('btn-premium', data.lastPremium, 300000);
}

function updateBtnTimer(id, lastTime, duration) {
    const btn = document.getElementById(id);
    const timeLeft = Math.ceil(( (lastTime || 0) + duration - Date.now() ) / 1000);
    if (timeLeft > 0) {
        btn.disabled = true;
        btn.innerText = `Wait ${Math.floor(timeLeft/60)}m ${timeLeft%60}s`;
    } else {
        btn.disabled = false;
        // Reset text logic here based on ID if needed
    }
}

// --- WITHDRAWAL LOGIC ---
function requestWithdrawal() {
    const amt = parseFloat(document.getElementById('withdraw-amount').value);
    const num = document.getElementById('gcash-num').value;

    if (amt < 1) return alert("Min withdraw ₱1.00");
    if (amt > currentBalance) return alert("Insufficient balance");
    if (num.length < 10) return alert("Invalid GCash number");

    const reqId = db.ref('withdrawals/pending').push().key;
    const request = {
        uid: userId,
        name: userName,
        amount: amt,
        gcash: num,
        status: 'PENDING',
        timestamp: Date.now()
    };

    const updates = {};
    updates['users/' + userId + '/balance'] = firebase.database.ServerValue.increment(-amt);
    updates['withdrawals/pending/' + reqId] = request;

    db.ref().update(updates).then(() => {
        alert("Withdrawal Requested!");
        document.getElementById('withdraw-amount').value = "";
    });
}

function loadUserHistory() {
    // Listen to both pending and completed for this specific user
    db.ref('withdrawals/pending').orderByChild('uid').equalTo(userId.toString()).on('value', renderHistory);
    db.ref('withdrawals/completed').orderByChild('uid').equalTo(userId.toString()).on('value', renderHistory);
}

function renderHistory() {
    const tbody = document.getElementById('user-history-body');
    tbody.innerHTML = "";
    
    db.ref('withdrawals').once('value', (snap) => {
        const categories = snap.val();
        if(!categories) return;

        Object.keys(categories).forEach(status => {
            const items = categories[status];
            Object.keys(items).forEach(id => {
                const item = items[id];
                if(item.uid == userId) {
                    const date = new Date(item.timestamp).toLocaleDateString();
                    tbody.innerHTML += `
                        <tr class="border-b border-gray-800">
                            <td class="p-2">${date}</td>
                            <td class="p-2">₱${item.amount}</td>
                            <td class="p-2 ${status === 'pending' ? 'text-yellow-500' : 'text-green-500'}">${status.toUpperCase()}</td>
                        </tr>
                    `;
                }
            });
        });
    });
}

// --- ADMIN DASHBOARD ---
function loginAdmin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Unauthorized Access!");
    }
}

function loadAdminData() {
    // Load Pending
    db.ref('withdrawals/pending').on('value', (snap) => {
        const list = document.getElementById('pending-list');
        list.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(id => {
                const req = data[id];
                list.innerHTML += `
                    <div class="card p-3 border border-yellow-600">
                        <p>User: ${req.name} (${req.uid})</p>
                        <p>GCash: <b>${req.gcash}</b></p>
                        <p>Amount: <b>₱${req.amount}</b></p>
                        <button onclick="approveWithdrawal('${id}')" class="bg-green-600 px-4 py-1 mt-2 rounded">APPROVE</button>
                    </div>
                `;
            });
        }
    });

    // Load Approved History
    db.ref('withdrawals/completed').limitToLast(20).on('value', (snap) => {
        const tbody = document.getElementById('admin-approved-body');
        tbody.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(id => {
                const req = data[id];
                tbody.innerHTML += `
                    <tr class="border-b border-gray-800 text-gray-400">
                        <td class="p-2">${req.name}</td>
                        <td class="p-2">₱${req.amount}</td>
                        <td class="p-2 text-green-500 font-bold">PAID</td>
                    </tr>
                `;
            });
        }
    });
}

function approveWithdrawal(id) {
    db.ref('withdrawals/pending/' + id).once('value', (snap) => {
        const data = snap.val();
        data.status = "COMPLETED";
        data.approvedAt = Date.now();
        
        const updates = {};
        updates['withdrawals/pending/' + id] = null;
        updates['withdrawals/completed/' + id] = data;
        
        db.ref().update(updates).then(() => alert("Request Approved & Moved to History"));
    });
}

// Start
initUser();
setInterval(() => {
    db.ref('users/' + userId).once('value', snap => {
        if(snap.val()) checkCooldowns(snap.val());
    });
}, 1000);
