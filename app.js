
// --- DATABASE CONFIGURATION (PAPERHOUSE WEB APP) ---
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    databaseURL: "https://paper-house-inc-default-rtdb.firebaseio.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- MINING SYSTEM PARAMETERS ---
const INCOME_7_DAYS = 0.05; // 0.05 PHP per plant
const DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days in Milliseconds
const MINING_SPEED_SEC = INCOME_7_DAYS / (DURATION_MS / 1000); // Amount mined per second
const MAX_PLANTS_LIMIT = 500; // Max allowed plants

// --- CORE SYSTEM STATES ---
let UID = localStorage.getItem('samp_uid') || generateUID();
let userData = { balance: 0, plants: {}, adsCount: 0, lastAdHour: 0, referredBy: "", referralEarnings: 0, totalReferrals: 0 };
let currentTab = 'home';

function generateUID() {
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('samp_uid', newId);
    return newId;
}

// --- INITIAL ENGINE START ---
window.onload = () => {
    document.getElementById('user-id-display').innerText = `UID: ${UID}`;
    
    // Auto-load monetization scripts safely
    runInterstitialLoop();

    syncDatabase();
    setInterval(updateTimers, 1000);
};

function runInterstitialLoop() {
    showInterstitialAd();
    setInterval(() => {
        showInterstitialAd();
    }, 240000); // Runs every 4 minutes
}

function showInterstitialAd() {
    if (typeof show_10555746 === 'function') {
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

// --- SYNCHRONIZE DATA WITH FIREBASE (FIXED RACE CONDITION) ---
function syncDatabase() {
    const userRef = db.ref('users/' + UID);

    // Guard: Verify if profile exists first on startup so we NEVER overwrite active transactions
    userRef.once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            return userRef.set({
                balance: 0,
                adsCount: 0,
                lastAdHour: Date.now(),
                referralCode: UID,
                totalReferrals: 0,
                referralEarnings: 0,
                plants: {}
            });
        }
    }).then(() => {
        // Once the user verification structure is ready, initialize live synchronization
        userRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                userData = {
                    balance: data.balance || 0,
                    plants: data.plants || {},
                    adsCount: data.adsCount || 0,
                    lastAdHour: data.lastAdHour || Date.now(),
                    referredBy: data.referredBy || "",
                    referralEarnings: data.referralEarnings || 0,
                    totalReferrals: data.totalReferrals || 0
                };
                
                // Update Global Counters
                document.getElementById('main-balance').innerText = (userData.balance).toFixed(5);
                document.getElementById('ad-limit-counter').innerText = `${userData.adsCount} / 10 Used`;
                
                const totalPlants = Object.keys(userData.plants).length;
                document.getElementById('capacity-counter').innerText = `${totalPlants} / ${MAX_PLANTS_LIMIT} Plants`;

                if (currentTab === 'home') renderPlants();
            }
        });
    });

    // Monitor global registration stats
    db.ref('global/totalUsers').on('value', s => {
        document.getElementById('global-count').innerText = `${s.val() || 0} Users`;
    });
}

// --- PURCHASE SAMPAGUITA SYSTEM ---
function buySampaguita() {
    const activePlants = Object.keys(userData.plants || {}).length;
    
    // Check maximum plant capacity
    if (activePlants >= MAX_PLANTS_LIMIT) {
        alert(`Your garden is full! You can hold up to ${MAX_PLANTS_LIMIT} plants.`);
        return;
    }

    const now = Date.now();
    // Hourly reset limits checker
    if (now - userData.lastAdHour > 3600000) {
        db.ref(`users/${UID}`).update({ adsCount: 0, lastAdHour: now });
        userData.adsCount = 0;
    }

    if (userData.adsCount >= 10) {
        alert("Hourly limits reached! You can purchase a maximum of 10 plants per hour.");
        return;
    }

    // Load AD and callback securely
    if (typeof show_10555663 === 'function') {
        try {
            show_10555663().then(() => {
                executePlantPurchase();
            }).catch(() => {
                executePlantPurchase(); // Fallback for ad blocks or runtime load failures
            });
        } catch(e) {
            executePlantPurchase();
        }
    } else {
        executePlantPurchase();
    }
}

function executePlantPurchase() {
    const now = Date.now();
    const plantId = "PLANT_" + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const newPlantData = {
        id: plantId,
        startTime: now,
        expiry: now + DURATION_MS,
        lastClaim: now,
        totalMinedSoFar: 0
    };

    // Update variables sequentially to prevent asynchronous race overrides
    db.ref(`users/${UID}/plants/${plantId}`).set(newPlantData).then(() => {
        return db.ref(`users/${UID}`).update({
            adsCount: (userData.adsCount || 0) + 1,
            lastAdHour: now
        });
    }).then(() => {
        alert("🎉 Sampaguita successfully planted in your garden!");
        switchTab('home'); // Refresh tab to show newly planted item
    }).catch((err) => {
        alert("Error planting: " + err.message);
    });
}

// --- RENDER CURRENT GARDEN ---
function renderPlants() {
    const container = document.getElementById('content-area');
    const plantsList = Object.values(userData.plants || {});

    if (plantsList.length === 0) {
        container.innerHTML = `
        <div class="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/50 border-dashed">
            <i class="fas fa-seedling text-slate-700 text-5xl mb-3"></i>
            <p class="text-slate-400 font-bold text-sm">Your garden is empty</p>
            <p class="text-slate-600 text-[11px] mt-1">Click the BUY PLANT button above to start mining!</p>
        </div>`;
        document.getElementById('plant-stats').innerText = "0 Active Plants";
        return;
    }

    let html = "";
    let activeCounter = 0;
    const sortedPlants = plantsList.sort((a, b) => b.startTime - a.startTime);

    sortedPlants.forEach(p => {
        const now = Date.now();
        const isExpired = now >= p.expiry;
        const progress = Math.min(100, ((now - p.startTime) / DURATION_MS) * 100);
        
        // Accurate offline calculations
        const timeDeltaSeconds = !isExpired ? (now - p.lastClaim) / 1000 : (p.expiry - p.lastClaim) / 1000;
        const currentMined = Math.max(0, timeDeltaSeconds * MINING_SPEED_SEC);

        if (!isExpired) activeCounter++;

        html += `
        <div class="p-5 rounded-3xl border border-slate-800/80 plant-card relative overflow-hidden">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <span class="text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${isExpired ? 'bg-red-950/40 text-red-400 border border-red-800/30' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'}">
                        ${isExpired ? 'CONTRACT FINISHED' : 'MINING ACTIVE'}
                    </span>
                    <h3 class="font-bold text-slate-100 mt-2 text-sm">Sampaguita Orchid Plant</h3>
                    <p class="text-[9px] text-slate-500 font-mono mt-0.5">${p.id}</p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] text-slate-500 uppercase font-black">Contract Yield</p>
                    <p class="text-xs font-bold text-emerald-400">₱${MINING_SPEED_SEC.toFixed(8)}/s</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 my-4">
                <div class="bg-slate-950/50 p-2.5 rounded-2xl border border-slate-800/20">
                    <p class="text-[9px] text-slate-500 uppercase font-bold">Unclaimed Value</p>
                    <p class="text-sm font-black text-slate-200">₱${currentMined.toFixed(6)}</p>
                </div>
                <div class="bg-slate-950/50 p-2.5 rounded-2xl border border-slate-800/20">
                    <p class="text-[9px] text-slate-400 uppercase font-bold">Expiry Clock</p>
                    <p class="text-xs font-bold text-slate-200">${isExpired ? 'Expired' : formatTime(p.expiry - now)}</p>
                </div>
            </div>

            <div class="w-full bg-slate-950 rounded-full h-1.5 mb-4 overflow-hidden">
                <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full" style="width: ${progress}%"></div>
            </div>

            <button onclick="claimSpecificPlant('${p.id}')" ${currentMined < 0.00001 ? 'disabled' : ''} 
                class="w-full py-2.5 rounded-2xl text-xs font-black transition tracking-wider 
                ${currentMined < 0.00001 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 active:scale-95 shadow-md shadow-emerald-400/10'}">
                ${isExpired && currentMined <= 0 ? 'COMPLETED & ARCHIVED' : 'CLAIM ACCRUED YIELD'}
            </button>
        </div>`;
    });

    container.innerHTML = html;
    document.getElementById('plant-stats').innerText = `${activeCounter} Active Contracts`;
}

// --- SECURE CLAIM TRANSACTION ---
function claimSpecificPlant(pid) {
    const plant = userData.plants[pid];
    if (!plant) return;

    const now = Date.now();
    const isExpired = now >= plant.expiry;
    const finalClaimTime = isExpired ? plant.expiry : now;
    
    const timeDeltaSeconds = (finalClaimTime - plant.lastClaim) / 1000;
    const earnings = Math.max(0, timeDeltaSeconds * MINING_SPEED_SEC);

    if (earnings <= 0) {
        alert("Insufficient accrued yields to claim.");
        return;
    }

    // Require Ad-viewing action prior to processing the transaction
    if (typeof show_10555746 === 'function') {
        try {
            show_10555746().then(() => {
                processClaimCredit(pid, earnings, finalClaimTime, isExpired);
            }).catch(() => {
                processClaimCredit(pid, earnings, finalClaimTime, isExpired);
            });
        } catch(e) {
            processClaimCredit(pid, earnings, finalClaimTime, isExpired);
        }
    } else {
        processClaimCredit(pid, earnings, finalClaimTime, isExpired);
    }
}

function processClaimCredit(pid, earnings, finalClaimTime, isExpired) {
    const userRef = db.ref(`users/${UID}`);
    
    userRef.child('balance').transaction(currentBal => {
        return (currentBal || 0) + earnings;
    }, (error, committed) => {
        if (committed) {
            if (isExpired) {
                // Delete the contract block upon finishing expired run to reclaim capacity memory
                db.ref(`users/${UID}/plants/${pid}`).remove();
            } else {
                db.ref(`users/${UID}/plants/${pid}`).update({
                    lastClaim: finalClaimTime,
                    totalMinedSoFar: (userData.plants[pid].totalMinedSoFar || 0) + earnings
                });
            }

            // Pay Referrer 5% Commission if set
            if (userData.referredBy) {
                const commission = earnings * 0.05;
                db.ref(`users/${userData.referredBy}`).transaction(refData => {
                    if (refData) {
                        refData.balance = (refData.balance || 0) + commission;
                        refData.referralEarnings = (refData.referralEarnings || 0) + commission;
                    }
                    return refData;
                });
            }

            alert(`🎉 Success! Added ₱${earnings.toFixed(5)} directly to your balance.`);
        } else {
            alert("Security collision: Double-entry blocked. Please try again.");
        }
    });
}

// --- TAB SWITCHING SYSTEM ---
function switchTab(tab) {
    currentTab = tab;
    const container = document.getElementById('content-area');
    const title = document.getElementById('dynamic-title');
    
    // Reset Navigation Styles
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.replace('text-emerald-400', 'text-slate-500'));
    
    if (tab === 'withdraw') {
        title.innerHTML = `<h2 class="font-extrabold text-slate-200 text-lg">Secure Withdrawal</h2>`;
        container.innerHTML = `
            <div class="glass-panel p-6 rounded-[2rem] space-y-4">
                <div>
                    <label class="text-[10px] font-bold text-slate-400 uppercase">Input Amount (Min ₱1)</label>
                    <input id="wd-amount" type="number" placeholder="₱0.00" class="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl mt-1 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-400 uppercase">Payout Gateway</label>
                    <select id="wd-method" onchange="updateWithdrawPlaceholder()" class="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl mt-1 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="GCash">GCash</option>
                        <option value="FaucetPay">FaucetPay</option>
                        <option value="PayPal">PayPal</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-400 uppercase" id="recipient-label">GCash Phone Number</label>
                    <input id="wd-recipient" type="text" placeholder="e.g. 09123456789" class="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl mt-1 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                </div>
                <button onclick="requestWithdrawal()" class="w-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 py-4 rounded-2xl font-bold transition">SUBMIT WITHDRAWAL</button>
                <div id="history-box" class="pt-4 border-t border-slate-800/85 space-y-2 text-xs"></div>
            </div>`;
        loadHistory();
    } else if (tab === 'refer') {
        title.innerHTML = `<h2 class="font-extrabold text-slate-200 text-lg">Partner Referrals</h2>`;
        container.innerHTML = `
            <div class="glass-panel p-6 rounded-[2rem] text-center space-y-4">
                <p class="text-xs text-slate-400 leading-relaxed">Invite partners and receive a <span class="text-emerald-400 font-bold">5% commission</span> instantly when they claim yields!</p>
                <div class="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 tracking-widest font-mono text-emerald-400 text-xl font-bold">${UID}</div>
                
                <div>
                    <input id="ref-input" type="text" placeholder="Paste 6-character partner code" class="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                </div>
                <button onclick="linkReferrer()" class="w-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 py-4 rounded-2xl font-bold transition">LINK CODE</button>
                
                <div class="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 mt-4">
                    <div>
                        <p class="text-[10px] text-slate-500 uppercase font-black">Registered Partners</p>
                        <p class="text-lg font-bold text-white">${userData.totalReferrals || 0}</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-500 uppercase font-black">Total Earned</p>
                        <p class="text-lg font-bold text-emerald-400">₱${(userData.referralEarnings || 0).toFixed(4)}</p>
                    </div>
                </div>
            </div>`;
    } else {
        title.innerHTML = `
            <div>
                <h2 class="font-extrabold text-slate-200 text-lg">My Greenhouse</h2>
                <p class="text-xs text-slate-400" id="plant-stats">Updating...</p>
            </div>`;
        renderPlants();
    }
}

function updateWithdrawPlaceholder() {
    const method = document.getElementById('wd-method').value;
    const label = document.getElementById('recipient-label');
    const input = document.getElementById('wd-recipient');
    
    if (method === 'GCash') {
        label.innerText = 'GCash Phone Number';
        input.placeholder = 'e.g. 09123456789';
        input.type = 'tel';
    } else {
        label.innerText = `${method} Email Address`;
        input.placeholder = 'e.g. username@domain.com';
        input.type = 'email';
    }
}

// --- SECURE WITHDRAWAL TRANSACTIONS ---
function requestWithdrawal() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const recipient = document.getElementById('wd-recipient').value.trim();
    const method = document.getElementById('wd-method').value;

    if (isNaN(amt) || amt < 1) {
        alert("Minimum withdrawal limit threshold is ₱1");
        return;
    }
    if (amt > userData.balance) {
        alert("Insufficient account balance.");
        return;
    }
    if (recipient === "") {
        alert(`You must specify valid destination ${method} details.`);
        return;
    }

    db.ref(`users/${UID}/balance`).transaction(current => current - amt, (error, committed) => {
        if (committed) {
            db.ref('withdrawals').push({
                uid: UID,
                amount: amt,
                status: 'pending',
                method: method,
                recipient: recipient,
                time: Date.now()
            });
            alert("Withdrawal requested successfully!");
            switchTab('withdraw');
        } else {
            alert("Process failed. Please try again.");
        }
    });
}

function loadHistory() {
    db.ref('withdrawals').orderByChild('uid').equalTo(UID).once('value', s => {
        let h = "<strong class='text-slate-400 block mb-2'>Payout Logs</strong>";
        let count = 0;
        s.forEach(child => {
            const w = child.val();
            count++;
            h += `<div class="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                <div class="flex justify-between font-bold">
                    <span class="text-white">₱${w.amount.toFixed(2)} (${w.method})</span>
                    <span class="capitalize ${w.status === 'pending' ? 'text-amber-400' : w.status === 'approved' ? 'text-emerald-400' : 'text-rose-500'}">${w.status}</span>
                </div>
                <div class="text-[10px] text-slate-500 truncate font-mono">Receiver Details: ${w.recipient}</div>
                <div class="text-[9px] text-slate-600">${new Date(w.time).toLocaleString()}</div>
            </div>`;
        });
        document.getElementById('history-box').innerHTML = count > 0 ? h : "<p class='text-slate-500 italic text-center py-2'>No payouts logged yet.</p>";
    });
}

// --- ADMIN PANEL AUDITING ---
function adminLogin() {
    const p = prompt("Enter Administration Password:");
    if (p === "Propetas12") {
        currentTab = 'admin';
        document.getElementById('dynamic-title').innerHTML = `<h2 class="font-extrabold text-slate-200 text-lg">Admin Audit Portal</h2>`;
        document.getElementById('content-area').innerHTML = `<div id="admin-reqs" class="space-y-3">Analyzing ledger entries...</div>`;
        
        db.ref('withdrawals').orderByChild('status').equalTo('pending').on('value', s => {
            let h = "";
            s.forEach(child => {
                const w = child.val();
                h += `
                <div class="glass-panel p-5 rounded-3xl space-y-3 border border-slate-800">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-[10px] font-bold text-slate-500 uppercase">AUDIT TARGET</span>
                            <p class="font-mono text-sm text-slate-200 font-bold">${w.uid}</p>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-bold text-slate-500 uppercase font-black">LIQUIDITY AT RISK</span>
                            <p class="text-md font-bold text-emerald-400">₱${w.amount.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        <div class="text-[9px] font-bold text-slate-500 uppercase">DESTINATION (${w.method})</div>
                        <div class="text-sm font-bold text-emerald-400 select-all font-mono">${w.recipient}</div>
                    </div>

                    <div class="flex gap-2 pt-1">
                        <button onclick="updateStatus('${child.key}', 'approved')" class="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black py-2.5 rounded-xl transition">APPROVE PAYOUT</button>
                        <button onclick="updateStatus('${child.key}', 'denied', '${w.uid}', ${w.amount})" class="flex-1 bg-rose-500 hover:bg-rose-400 text-white text-xs font-black py-2.5 rounded-xl transition">REJECT & REFUND</button>
                    </div>
                </div>`;
            });
            document.getElementById('admin-reqs').innerHTML = h || `<div class="text-center py-10 text-slate-500">Clear! No pending transactions in the audit ledger.</div>`;
        });
    } else if (p !== null) {
        alert("Unauthorized transaction code!");
    }
}

function updateStatus(id, status, userUid = null, refundAmt = 0) {
    if (status === 'denied' && userUid) {
        db.ref(`users/${userUid}/balance`).transaction(c => (c || 0) + refundAmt);
    }
    db.ref(`withdrawals/${id}/status`).set(status).then(() => {
        alert(`Record update completed.`);
    });
}

// --- PARTNER LINKING (REFERRAL) ---
function linkReferrer() {
    const code = document.getElementById('ref-input').value.trim().toUpperCase();
    if (code === UID) {
        alert("You cannot input your own identifier.");
        return;
    }
    if (userData.referredBy) {
        alert("Your account is already linked to a partner.");
        return;
    }

    db.ref('users/' + code).once('value', snap => {
        if (snap.exists()) {
            db.ref(`users/${UID}/referredBy`).set(code);
            db.ref(`users/${code}/totalReferrals`).transaction(c => (c || 0) + 1);
            alert("Partner linked successfully!");
            switchTab('refer');
        } else {
            alert("Invalid invitation code.");
        }
    });
}

// --- HELPER TIME PARSERS ---
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
