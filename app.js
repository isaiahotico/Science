
// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Get or Create User ID (In Telegram, you'd use Telegram.WebApp.initDataUnsafe.user.id)
let userId = localStorage.getItem('paperhouse_uid') || 'USER_' + Math.floor(Math.random() * 1000000);
localStorage.setItem('paperhouse_uid', userId);

let userData = { balance: 0, cooldowns: {} };

// --- INITIALIZE ---
function initApp() {
    db.ref('users/' + userId).on('value', (snapshot) => {
        if (snapshot.exists()) {
            userData = snapshot.val();
        } else {
            db.ref('users/' + userId).set(userData);
        }
        document.getElementById('user-balance').innerText = `₱${userData.balance.toFixed(4)}`;
    });
    loadWithdrawalHistory();
}

// --- NAVIGATION ---
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'withdraw') loadWithdrawalHistory();
}

// --- ADS LOGIC ---
function checkCooldown(adKey, seconds) {
    const last = userData.cooldowns ? userData.cooldowns[adKey] || 0 : 0;
    const now = Date.now();
    if (now - last < seconds * 1000) {
        const remaining = Math.ceil((seconds * 1000 - (now - last)) / 1000);
        alert(`Cooldown active! Wait ${remaining}s`);
        return false;
    }
    return true;
}

function rewardUser(amount, adKey) {
    const now = Date.now();
    db.ref('users/' + userId).update({
        balance: userData.balance + amount,
        [`cooldowns/${adKey}`]: now
    });
    alert(`Success! ₱${amount} added to balance.`);
}

// Monetag Login Ads (Standard)
function handleAd(adKey, reward, cooldown, zone) {
    if (!checkCooldown(adKey, cooldown)) return;
    
    const adFunc = window['show_' + zone];
    if (adFunc) {
        adFunc().then(() => rewardUser(reward, adKey)).catch(() => alert("Ad failed to load."));
    }
}

// Monetag Gift Ads (Popup/Rewarded)
function handlePopupAd(adKey, reward, cooldown, zone) {
    if (!checkCooldown(adKey, cooldown)) return;

    const adFunc = window['show_' + zone];
    if (adFunc) {
        adFunc('pop').then(() => rewardUser(reward, adKey)).catch(() => alert("Ad failed to load."));
    }
}

// VIP Ads (3 Combined)
function handleVipAds() {
    if (!checkCooldown('VIP', 300)) return;
    
    // Logic to show combined ads. In standard SDK, this triggers them sequentially
    show_10276123();
    show_10337795();
    show_10337853();
    rewardUser(0.022, 'VIP');
}

// Premium Ads (3 Rewarded Interstitial)
function handlePremiumAds() {
    if (!checkCooldown('PREMIUM', 300)) return;

    Promise.all([show_10276123(), show_10337795(), show_10337853()])
    .then(() => {
        rewardUser(0.022, 'PREMIUM');
        alert('All ads watched!');
    }).catch(e => alert("Ad stream interrupted"));
}

// --- WITHDRAWAL LOGIC ---
function requestWithdrawal() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const name = document.getElementById('gcash-name').value;
    const num = document.getElementById('gcash-number').value;

    if (amount < 1) return alert("Minimum withdrawal is ₱1");
    if (amount > userData.balance) return alert("Insufficient balance");
    if (!name || !num) return alert("Fill all fields");

    const request = {
        uid: userId,
        amount: amount,
        gcashName: name,
        gcashNumber: num,
        status: 'pending',
        timestamp: Date.now()
    };

    db.ref('withdrawals/pending').push(request);
    db.ref('users/' + userId).update({ balance: userData.balance - amount });
    alert("Request Sent! Awaiting approval.");
}

function loadWithdrawalHistory() {
    db.ref('withdrawals/pending').orderByChild('uid').equalTo(userId).once('value', snapshot => {
        let html = '';
        snapshot.forEach(child => {
            const val = child.val();
            html += `<tr><td>${new Date(val.timestamp).toLocaleDateString()}</td><td>₱${val.amount}</td><td>${val.status}</td></tr>`;
        });
        document.getElementById('user-history-table').innerHTML = html;
    });
}

// --- OWNER DASHBOARD ---
function checkAdmin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        loadAdminPanel();
    } else {
        alert("Wrong Password");
    }
}

function loadAdminPanel() {
    // Load Pendings
    db.ref('withdrawals/pending').on('value', snapshot => {
        let html = '';
        snapshot.forEach(child => {
            const val = child.val();
            html += `<div class="balance-card">
                <p>User: ${val.uid}<br>Amount: ₱${val.amount}<br>GCash: ${val.gcashNumber}</p>
                <button onclick="approveWithdrawal('${child.key}')">APPROVE</button>
            </div>`;
        });
        document.getElementById('pending-list').innerHTML = html;
    });

    // Load Approved History
    db.ref('withdrawals/approved').limitToLast(10).on('value', snapshot => {
        let html = '';
        snapshot.forEach(child => {
            const val = child.val();
            html += `<tr><td>${val.uid}</td><td>₱${val.amount}</td><td>PAID</td></tr>`;
        });
        document.getElementById('admin-history-table').innerHTML = html;
    });
}

function approveWithdrawal(key) {
    db.ref('withdrawals/pending/' + key).once('value', snapshot => {
        const data = snapshot.val();
        data.status = 'approved';
        db.ref('withdrawals/approved').push(data);
        db.ref('withdrawals/pending/' + key).remove();
        alert("Approved successfully!");
    });
}

// Start
initApp();
