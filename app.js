
// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE MANAGEMENT ---
let UID = localStorage.getItem('mine_uid');
let userData = { balance: 0, plants: [], adsThisHour: 0, lastAdTime: 0 };
const MINING_TOTAL_PHP = 0.05;
const DURATION_DAYS = 7;
const DURATION_MS = DURATION_DAYS * 24 * 60 * 60 * 1000;

// --- INITIALIZATION ---
window.onload = () => {
    if (!UID) {
        UID = Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem('mine_uid', UID);
    }
    document.getElementById('user-id-tag').innerText = `ID: ${UID}`;
    
    // In-App Interstitial Ad Cooldown logic (Provided)
    show_10555746({
        type: 'inApp',
        inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });

    syncData();
    startClocks();
};

function syncData() {
    db.ref('users/' + UID).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            userData = data;
            document.getElementById('balance').innerText = (data.balance || 0).toFixed(4);
            updateMiningUI();
        } else {
            // New user registration
            db.ref('users/' + UID).set({
                balance: 0,
                referralCode: UID,
                totalReferrals: 0,
                referralEarnings: 0,
                adsThisHour: 0,
                lastAdHour: Date.now()
            });
        }
    });

    db.ref('global/totalUsers').transaction(curr => (curr || 0) + 1);
    db.ref('global/totalUsers').on('value', snap => {
        document.getElementById('total-users').innerText = snap.val() || 0;
    });
}

// --- MINING LOGIC ---
function buySampaguita() {
    const now = Date.now();
    // Reset hour counter if 1 hour passed
    if (now - userData.lastAdHour > 3600000) {
        userData.adsThisHour = 0;
    }

    if (userData.adsThisHour >= 10) {
        alert("Hourly ad limit (10) reached! Please wait.");
        return;
    }

    show_10555663().then(() => {
        const newPlant = {
            id: Date.now(),
            startTime: Date.now(),
            expiry: Date.now() + DURATION_MS,
            lastClaim: Date.now()
        };

        db.ref(`users/${UID}/plants`).push(newPlant);
        db.ref(`users/${UID}`).update({
            adsThisHour: (userData.adsThisHour || 0) + 1,
            lastAdHour: now
        });
        alert("Sampaguita Planted! 7 days contract started.");
    });
}

function updateMiningUI() {
    const container = document.getElementById('tab-content');
    if (currentTab !== 'home') return;
    
    let html = `<h4 class="font-bold text-sm text-slate-500 uppercase tracking-widest">Active Plants</h4>`;
    let activeCount = 0;

    if (userData.plants) {
        Object.keys(userData.plants).forEach(key => {
            const p = userData.plants[key];
            const now = Date.now();
            const remains = p.expiry - now;

            if (remains > 0) {
                activeCount++;
                const progress = ((now - p.startTime) / DURATION_MS * 100).toFixed(2);
                html += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div class="flex justify-between text-xs mb-2">
                        <span class="font-bold text-indigo-600">SAMPAGUITA #${key.slice(-4)}</span>
                        <span class="text-slate-400">Ends in: ${formatTime(remains)}</span>
                    </div>
                    <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div class="bg-indigo-500 h-full" style="width: ${progress}%"></div>
                    </div>
                </div>`;
            } else {
                // Auto-cleanup expired
                db.ref(`users/${UID}/plants/${key}`).remove();
            }
        });
    }
    
    document.getElementById('active-count').innerText = activeCount;
    container.innerHTML = activeCount > 0 ? html : `<div class="text-center py-10 opacity-50">No active plants. Watch an ad to start!</div>`;
}

function claimMining() {
    if (!userData.plants) return alert("No active mining");

    show_10555746().then(() => {
        let totalToClaim = 0;
        const now = Date.now();

        Object.keys(userData.plants).forEach(key => {
            const p = userData.plants[key];
            const claimLimit = Math.min(now, p.expiry);
            const timeDiff = claimLimit - (p.lastClaim || p.startTime);
            
            if (timeDiff > 0) {
                const earnings = (timeDiff / DURATION_MS) * MINING_TOTAL_PHP;
                totalToClaim += earnings;
                db.ref(`users/${UID}/plants/${key}`).update({ lastClaim: claimLimit });
            }
        });

        if (totalToClaim > 0) {
            db.ref(`users/${UID}/balance`).transaction(curr => (curr || 0) + totalToClaim);
            alert(`Successfully claimed ₱${totalToClaim.toFixed(5)}`);
        } else {
            alert("Nothing to claim yet. Wait a few minutes.");
        }
    });
}

// --- NAVIGATION & TABS ---
let currentTab = 'home';
function switchTab(tab) {
    currentTab = tab;
    const container = document.getElementById('tab-content');
    
    if (tab === 'withdraw') {
        container.innerHTML = `
            <div class="bg-white p-6 rounded-3xl shadow-md space-y-4">
                <h3 class="font-bold text-lg">Withdrawal</h3>
                <input id="wd-amount" type="number" placeholder="Amount (Min ₱1)" class="w-full border p-3 rounded-xl">
                <select id="wd-method" class="w-full border p-3 rounded-xl">
                    <option>GCash</option>
                    <option>FaucetPay</option>
                    <option>PayPal</option>
                </select>
                <button onclick="processWithdrawal()" class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">Submit Request</button>
                <div id="wd-history" class="mt-4 text-xs space-y-2"></div>
            </div>`;
        loadWithdrawHistory();
    } else if (tab === 'refer') {
        container.innerHTML = `
            <div class="bg-white p-6 rounded-3xl shadow-md text-center">
                <h3 class="font-bold text-lg">Referral Program</h3>
                <p class="text-sm text-slate-500 mb-4">Earn 5% from your invite's earnings</p>
                <div class="bg-slate-100 p-3 rounded-xl font-mono text-lg mb-4">${UID}</div>
                <input id="ref-input" type="text" placeholder="Enter Invite Code" class="w-full border p-3 rounded-xl mb-2 text-center">
                <button onclick="applyReferral()" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Link Referrer</button>
                <div class="mt-6 flex justify-around border-t pt-4">
                    <div><p class="text-xs text-slate-400">Total Invites</p><p class="font-bold">${userData.totalReferrals || 0}</p></div>
                    <div><p class="text-xs text-slate-400">Total Earned</p><p class="font-bold">₱${(userData.referralEarnings || 0).toFixed(2)}</p></div>
                </div>
            </div>`;
    } else {
        updateMiningUI();
    }
}

// --- WITHDRAWAL LOGIC ---
function processWithdrawal() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const method = document.getElementById('wd-method').value;

    if (amt < 1) return alert("Minimum withdrawal is ₱1");
    if (amt > userData.balance) return alert("Insufficient balance");

    db.ref(`users/${UID}/balance`).transaction(curr => curr - amt);
    db.ref(`withdrawals`).push({
        uid: UID,
        amount: amt,
        method: method,
        status: 'pending',
        timestamp: Date.now()
    });
    alert("Request Sent!");
    switchTab('withdraw');
}

function loadWithdrawHistory() {
    db.ref('withdrawals').orderByChild('uid').equalTo(UID).once('value', snap => {
        let html = '<h4 class="font-bold border-t pt-4">History</h4>';
        snap.forEach(child => {
            const w = child.val();
            html += `<div class="flex justify-between p-2 bg-slate-50 rounded">
                <span>₱${w.amount} (${w.method})</span>
                <span class="${w.status === 'pending' ? 'text-orange-500' : 'text-green-500'} font-bold">${w.status.toUpperCase()}</span>
            </div>`;
        });
        document.getElementById('wd-history').innerHTML = html;
    });
}

// --- ADMIN SECTION ---
function showAdminPrompt() {
    const pass = prompt("Enter Admin Password:");
    if (pass === "Propetas12") {
        renderAdmin();
    } else {
        alert("Wrong Password");
    }
}

function renderAdmin() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `<div class="bg-white p-6 rounded-3xl shadow-md">
        <h3 class="font-bold mb-4">Pending Withdrawals</h3>
        <div id="admin-list" class="space-y-2"></div>
    </div>`;
    
    db.ref('withdrawals').orderByChild('status').equalTo('pending').on('value', snap => {
        let html = "";
        snap.forEach(child => {
            const w = child.val();
            html += `<div class="p-3 bg-slate-100 rounded-xl text-xs flex justify-between items-center">
                <div>User: ${w.uid}<br>Amount: ₱${w.amount} (${w.method})</div>
                <div class="flex gap-1">
                    <button onclick="adminAction('${child.key}', 'approved')" class="bg-green-500 text-white px-2 py-1 rounded">Approve</button>
                    <button onclick="adminAction('${child.key}', 'denied')" class="bg-red-500 text-white px-2 py-1 rounded">Deny</button>
                </div>
            </div>`;
        });
        document.getElementById('admin-list').innerHTML = html || "No pending requests.";
    });
}

function adminAction(id, status) {
    db.ref(`withdrawals/${id}`).update({ status: status });
}

// --- UTILS ---
function formatTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
}

function startClocks() {
    setInterval(() => {
        document.getElementById('footer-date').innerText = new Date().toLocaleString();
        if (currentTab === 'home') updateMiningUI();
    }, 1000);
}

function applyReferral() {
    const code = document.getElementById('ref-input').value.trim();
    if (code === UID) return alert("You cannot refer yourself");
    db.ref('users/' + code).once('value', snap => {
        if (snap.exists()) {
            db.ref('users/' + UID + '/referredBy').set(code);
            db.ref('users/' + code + '/totalReferrals').transaction(c => (c || 0) + 1);
            alert("Referrer linked!");
        } else {
            alert("Invalid Code");
        }
    });
}
