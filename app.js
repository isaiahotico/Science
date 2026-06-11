
// --- DATABASE CONFIGURATION ---
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

// --- CONSTANTS ---
const INCOME_7_DAYS = 0.05;
const DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MINING_SPEED_SEC = INCOME_7_DAYS / (7 * 24 * 60 * 60); // PHP per second

// --- USER STATE ---
let UID = localStorage.getItem('samp_uid') || generateUID();
let userData = { balance: 0, plants: {}, adsCount: 0, lastAdHour: 0 };
let currentTab = 'home';

function generateUID() {
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('samp_uid', newId);
    return newId;
}

// --- INITIALIZATION ---
window.onload = () => {
    document.getElementById('user-id-display').innerText = `UID: ${UID}`;
    
    // Auto-Interstitial logic
    show_10555746({
        type: 'inApp',
        inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });

    syncData();
    setInterval(updateTimers, 1000);
};

function syncData() {
    db.ref('users/' + UID).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            userData = data;
            document.getElementById('main-balance').innerText = (data.balance || 0).toFixed(4);
            document.getElementById('ad-limit-counter').innerText = `${data.adsCount || 0} / 10`;
            if (currentTab === 'home') renderPlants();
        } else {
            db.ref('users/' + UID).set({ balance: 0, adsCount: 0, lastAdHour: Date.now(), referralCode: UID });
        }
    });

    db.ref('global/totalUsers').on('value', s => document.getElementById('global-count').innerText = s.val() || 0);
}

// --- CORE FUNCTIONS ---

function buySampaguita() {
    const now = Date.now();
    if (now - userData.lastAdHour > 3600000) {
        db.ref(`users/${UID}`).update({ adsCount: 0, lastAdHour: now });
    } else if (userData.adsCount >= 10) {
        return alert("Hourly ad limit reached! Come back in an hour.");
    }

    show_10555663().then(() => {
        const plantId = "P" + Date.now();
        const newPlant = {
            id: plantId,
            startTime: now,
            expiry: now + DURATION_MS,
            lastClaim: now,
            totalMinedSoFar: 0
        };
        
        db.ref(`users/${UID}/plants/${plantId}`).set(newPlant);
        db.ref(`users/${UID}/adsCount`).transaction(c => (c || 0) + 1);
        alert("Sampaguita Bought Successfully!");
    });
}

function renderPlants() {
    const container = document.getElementById('content-area');
    if (!userData.plants) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400">Empty garden. Buy your first Sampaguita!</div>`;
        document.getElementById('plant-stats').innerText = "0 Active Contracts";
        return;
    }

    let html = "";
    let count = 0;
    const sortedPlants = Object.values(userData.plants).sort((a, b) => b.startTime - a.startTime);

    sortedPlants.forEach(p => {
        const now = Date.now();
        const isExpired = now > p.expiry;
        const progress = Math.min(100, ((now - p.startTime) / DURATION_MS) * 100);
        const currentMined = !isExpired ? ((now - p.lastClaim) / 1000 * MINING_SPEED_SEC) : 0;
        
        count++;
        html += `
        <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 sampaguita-card relative overflow-hidden">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <span class="status-badge ${isExpired ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}">
                        ${isExpired ? 'Expired' : 'Mining'}
                    </span>
                    <h3 class="font-bold text-slate-800 mt-1">Sampaguita Flower</h3>
                    <p class="text-[10px] text-slate-400 font-mono">${p.id}</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-slate-400 uppercase font-bold">Speed</p>
                    <p class="text-xs font-bold text-emerald-500">₱${MINING_SPEED_SEC.toFixed(8)}/s</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="bg-slate-50 p-2 rounded-xl">
                    <p class="text-[10px] text-slate-400">Unclaimed</p>
                    <p class="text-sm font-black text-slate-700">₱${currentMined.toFixed(6)}</p>
                </div>
                <div class="bg-slate-50 p-2 rounded-xl">
                    <p class="text-[10px] text-slate-400">Expires In</p>
                    <p class="text-sm font-bold text-slate-700">${isExpired ? '---' : formatTime(p.expiry - now)}</p>
                </div>
            </div>

            <div class="w-full bg-slate-100 h-1.5 rounded-full mb-4">
                <div class="bg-emerald-500 h-full rounded-full" style="width: ${progress}%"></div>
            </div>

            <button onclick="claimSpecificPlant('${p.id}')" ${isExpired || currentMined < 0.0001 ? 'disabled' : ''} 
                class="w-full py-2 rounded-xl text-xs font-bold transition 
                ${isExpired || currentMined < 0.0001 ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-white active:scale-95 shadow-md'}">
                ${isExpired ? 'CONTRACT FINISHED' : 'CLAIM THIS PLANT'}
            </button>
        </div>`;
    });

    container.innerHTML = html;
    document.getElementById('plant-stats').innerText = `${count} Active Contracts`;
}

function claimSpecificPlant(pid) {
    const plant = userData.plants[pid];
    const now = Date.now();
    const earnings = ((now - plant.lastClaim) / 1000 * MINING_SPEED_SEC);

    if (earnings <= 0) return;

    show_10555746().then(() => {
        db.ref(`users/${UID}/balance`).transaction(curr => (curr || 0) + earnings);
        db.ref(`users/${UID}/plants/${pid}`).update({
            lastClaim: now,
            totalMinedSoFar: (plant.totalMinedSoFar || 0) + earnings
        });
        alert(`₱${earnings.toFixed(5)} added to balance!`);
    });
}

// --- TABS & UI LOGIC ---

function switchTab(tab) {
    currentTab = tab;
    const container = document.getElementById('content-area');
    const title = document.getElementById('dynamic-title');
    
    if (tab === 'withdraw') {
        title.innerHTML = `<h2 class="font-black text-slate-800 text-xl">Withdrawal</h2>`;
        container.innerHTML = `
            <div class="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Amount (Min ₱1)</label>
                    <input id="wd-amount" type="number" placeholder="0.00" class="w-full bg-slate-50 border-none p-4 rounded-2xl mt-1 focus:ring-2 focus:ring-emerald-500">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Payment Option</label>
                    <select id="wd-method" onchange="updateWithdrawPlaceholder()" class="w-full bg-slate-50 border-none p-4 rounded-2xl mt-1 focus:ring-2 focus:ring-emerald-500">
                        <option value="GCash">GCash</option>
                        <option value="FaucetPay">FaucetPay</option>
                        <option value="PayPal">PayPal</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase" id="recipient-label">GCash Number</label>
                    <input id="wd-recipient" type="text" placeholder="e.g., 09123456789" class="w-full bg-slate-50 border-none p-4 rounded-2xl mt-1 focus:ring-2 focus:ring-emerald-500">
                </div>
                <button onclick="requestWithdrawal()" class="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 active:scale-95 transition mt-2 shadow-lg shadow-emerald-100">Submit Request</button>
                <div id="history-box" class="pt-4 border-t space-y-2 text-xs"></div>
            </div>`;
        loadHistory();
    } else if (tab === 'refer') {
        title.innerHTML = `<h2 class="font-black text-slate-800 text-xl">Referrals</h2>`;
        container.innerHTML = `
            <div class="bg-white p-6 rounded-[2rem] shadow-sm text-center">
                <p class="text-sm text-slate-400 mb-2">Your Invite Code</p>
                <div class="text-2xl font-black text-emerald-600 tracking-widest mb-4">${UID}</div>
                <input id="ref-input" type="text" placeholder="Paste 6-letter code" class="w-full bg-slate-50 border-none p-4 rounded-2xl text-center mb-2">
                <button onclick="linkReferrer()" class="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold">Apply Code</button>
            </div>`;
    } else {
        title.innerHTML = `<h2 class="font-black text-slate-800 text-xl">My Garden</h2><p class="text-xs text-slate-400" id="plant-stats">Updating...</p>`;
        renderPlants();
    }
}

function updateWithdrawPlaceholder() {
    const method = document.getElementById('wd-method').value;
    const label = document.getElementById('recipient-label');
    const input = document.getElementById('wd-recipient');
    
    if (method === 'GCash') {
        label.innerText = 'GCash Number';
        input.placeholder = 'e.g., 09123456789';
        input.type = 'tel';
    } else {
        label.innerText = `${method} Email Address`;
        input.placeholder = 'e.g., username@domain.com';
        input.type = 'email';
    }
}

function requestWithdrawal() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const recipient = document.getElementById('wd-recipient').value.trim();
    const method = document.getElementById('wd-method').value;

    if (amt < 1 || isNaN(amt)) return alert("Minimum withdrawal is ₱1");
    if (amt > userData.balance) return alert("Insufficient balance");
    if (!recipient) return alert(`Please enter your valid ${method} details.`);

    db.ref(`users/${UID}/balance`).transaction(c => c - amt);
    db.ref('withdrawals').push({ 
        uid: UID, 
        amount: amt, 
        status: 'pending', 
        method: method, 
        recipient: recipient,
        time: Date.now() 
    });
    alert("Request submitted successfully!");
    switchTab('withdraw');
}

function loadHistory() {
    db.ref('withdrawals').orderByChild('uid').equalTo(UID).once('value', s => {
        let h = "<strong class='text-slate-600 block mb-2'>Recent History</strong>";
        let count = 0;
        s.forEach(child => {
            const w = child.val();
            count++;
            h += `<div class="p-3 bg-slate-50 rounded-xl space-y-1">
                <div class="flex justify-between font-semibold">
                    <span>₱${w.amount.toFixed(2)} (${w.method})</span>
                    <span class="capitalize ${w.status === 'pending' ? 'text-amber-500' : w.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'}">${w.status}</span>
                </div>
                <div class="text-[10px] text-slate-400 truncate">Account: ${w.recipient}</div>
                <div class="text-[9px] text-slate-300">${new Date(w.time).toLocaleString()}</div>
            </div>`;
        });
        document.getElementById('history-box').innerHTML = count > 0 ? h : "<p class='text-slate-400 italic text-center py-2'>No withdrawal requests yet.</p>";
    });
}

function adminLogin() {
    const p = prompt("Admin Password:");
    if (p === "Propetas12") {
        currentTab = 'admin';
        document.getElementById('dynamic-title').innerHTML = `<h2 class="font-black text-slate-800 text-xl">Admin Panel</h2><p class="text-xs text-slate-400">Processing Pending Payouts</p>`;
        document.getElementById('content-area').innerHTML = `<div id="admin-reqs" class="space-y-3">Loading requests...</div>`;
        
        db.ref('withdrawals').orderByChild('status').equalTo('pending').on('value', s => {
            let h = "";
            s.forEach(child => {
                const w = child.val();
                h += `
                <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-xs font-bold text-slate-400 uppercase">User UID</span>
                            <p class="font-mono text-sm text-slate-800 font-bold">${w.uid}</p>
                        </div>
                        <div class="text-right">
                            <span class="text-xs font-bold text-slate-400 uppercase">Payout Amount</span>
                            <p class="text-lg font-black text-emerald-600">₱${w.amount.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <div class="bg-slate-50 p-3 rounded-2xl">
                        <div class="text-[10px] font-bold text-slate-400 uppercase">Destination (${w.method})</div>
                        <div class="text-sm font-bold text-slate-800 select-all">${w.recipient}</div>
                    </div>

                    <div class="flex gap-2">
                        <button onclick="updateStatus('${child.key}', 'approved')" class="flex-1 bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-600 transition">Approve & Paid</button>
                        <button onclick="updateStatus('${child.key}', 'denied', '${w.uid}', ${w.amount})" class="flex-1 bg-rose-500 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-rose-600 transition">Reject / Refund</button>
                    </div>
                </div>`;
            });
            document.getElementById('admin-reqs').innerHTML = h || `<div class="text-center py-10 text-slate-400">No pending withdrawal requests found.</div>`;
        });
    }
}

function updateStatus(id, status, userUid = null, refundAmt = 0) {
    if (status === 'denied' && userUid) {
        // Refund back to balance on reject
        db.ref(`users/${userUid}/balance`).transaction(c => (c || 0) + refundAmt);
    }
    db.ref(`withdrawals/${id}/status`).set(status).then(() => {
        alert(`Request was marked as ${status}.`);
    });
}

// --- UTILS ---
function formatTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
}

function updateTimers() {
    document.getElementById('realtime-clock').innerText = new Date().toLocaleString();
    if (currentTab === 'home') renderPlants();
}
