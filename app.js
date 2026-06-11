
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, 
    collection, query, where, addDoc, serverTimestamp, increment, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your verified Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// App Constants
const CYCLE_SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const CYCLE_TOTAL_EARNINGS = 0.05; // 0.05 PHP per flower
const EARNINGS_PER_MS = CYCLE_TOTAL_EARNINGS / CYCLE_SEVEN_DAYS_MS;
const EARNINGS_PER_SEC = EARNINGS_PER_MS * 1000;

// Generate or Retrieve Permanent Local Device UID
let myUid = localStorage.getItem('samp_miner_uid');
if (!myUid) {
    myUid = "SG-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('samp_miner_uid', myUid);
}

let myData = { balance: 0, plants: [], adLimit: 0, lastAdReset: Date.now() };
let localAdWatchTimestamps = JSON.parse(localStorage.getItem('ad_watch_logs') || "[]");

// --- HELPER PARSER ---
// Safely convert raw Firestore properties (Numbers, Timestamps, Strings) into standard JS timestamps
const getMs = (val) => {
    if (!val) return Date.now();
    if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val === 'object' && val.seconds) return val.seconds * 1000;
    return Number(val);
};

// --- RANDOM AD DISPATCHER ENGINE ---
// Randomly selects and executes one of the two active ad zones upon request
async function dispatchRandomRewardedAd() {
    const activeAds = [
        { id: "Zone-10555663", run: () => typeof window.show_10555663 === 'function' ? window.show_10555663() : Promise.resolve(true) },
        { id: "Zone-10555746", run: () => typeof window.show_10555746 === 'function' ? window.show_10555746() : Promise.resolve(true) }
    ];
    
    // Pick randomly from the array
    const chosenAd = activeAds[Math.floor(Math.random() * activeAds.length)];
    console.log(`[Ad Dispatcher] Triggering: ${chosenAd.id}`);

    try {
        await chosenAd.run();
        return true;
    } catch (e) {
        console.warn(`[Ad Dispatcher] Warning: ${chosenAd.id} script was unavailable/skipped. Fallback bypassed.`);
        return true; // Resolves true to prevent locking out active users in cases of strict network blocks
    }
}

// Hourly ad limit validator
function processHourlyAdLimiter() {
    const now = Date.now();
    localAdWatchTimestamps = localAdWatchTimestamps.filter(t => now - t < 3600000);
    localStorage.setItem('ad_watch_logs', JSON.stringify(localAdWatchTimestamps));

    if (localAdWatchTimestamps.length >= 10) {
        const earliestTime = localAdWatchTimestamps[0];
        const msRemaining = 3600000 - (now - earliestTime);
        const minsRemaining = Math.ceil(msRemaining / 60000);
        alert(`Hourly limit hit! You can only watch 10 ads per hour. Please wait ${minsRemaining} minute(s).`);
        return false;
    }
    return true;
}

function registerAdWatch() {
    localAdWatchTimestamps.push(Date.now());
    localStorage.setItem('ad_watch_logs', JSON.stringify(localAdWatchTimestamps));
    document.getElementById('ad-counter').innerText = localAdWatchTimestamps.length;
}

// --- DATABASE SYNCHRONIZER ---
async function startApp() {
    const userRef = doc(db, "users", myUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        const freshReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await setDoc(userRef, {
            id: myUid,
            balance: 0,
            plants: [],
            refCode: freshReferralCode,
            inviter: null,
            referrals: 0,
            refEarnings: 0
        });
        
        const statsRef = doc(db, "global", "stats");
        await setDoc(statsRef, { totalUsers: increment(1) }, { merge: true });
    }

    // Bind real-time data sync listener
    onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
            myData = snapshot.data();
            renderStatsAndUI();
        }
    });

    onSnapshot(doc(db, "global", "stats"), (snapshot) => {
        if (snapshot.exists()) {
            document.getElementById('global-miners').innerText = snapshot.data().totalUsers || "1";
        }
    });

    // Run high frequency per-second mining calculator Loop (100ms updates)
    setInterval(updateMiningRatesPerSecond, 100);
    
    // Start In-App Interstitial Ad automatic rotation loop (runs every 4 minutes)
    initializePeriodicInterstitial();
}

// --- REAL-TIME CALCULATIONS & RENDERERS ---
function renderStatsAndUI() {
    document.getElementById('balance-display').innerText = myData.balance.toFixed(8);
    document.getElementById('uid-card').innerText = `ID: ${myUid}`;
    document.getElementById('garden-count').innerText = myData.plants.length;
    document.getElementById('ad-counter').innerText = localAdWatchTimestamps.length;

    // Referral page bindings
    document.getElementById('my-referral-code').innerText = myData.refCode || "------";
    document.getElementById('total-referrals').innerText = myData.referrals || 0;
    document.getElementById('referral-earnings').innerText = (myData.refEarnings || 0).toFixed(4);

    const gardenContainer = document.getElementById('garden-container');
    gardenContainer.innerHTML = '';

    if (!myData.plants || myData.plants.length === 0) {
        gardenContainer.innerHTML = `
            <div class="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200">
                <i class="fa-solid fa-leaf text-slate-300 text-3xl mb-2"></i>
                <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">Your Garden is Empty</p>
                <p class="text-[10px] text-slate-400">Buy and plant a Sampaguita flower to begin automatic mining.</p>
            </div>
        `;
        return;
    }

    myData.plants.forEach((plant, index) => {
        const item = document.createElement('div');
        item.className = "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden";
        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-lg shadow-sm">
                    <i class="fa-solid fa-seedling pulse-effect"></i>
                </div>
                <div>
                    <h4 class="text-xs font-black text-slate-800">SAMPAGUITA FLOWER #${index + 1}</h4>
                    <p class="text-[9px] text-slate-500 font-black tracking-tight">Rate: ₱${CYCLE_TOTAL_EARNINGS.toFixed(2)} / 7d (₱${EARNINGS_PER_SEC.toFixed(8)}/s)</p>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Expires in: <span id="time-left-${index}" class="text-slate-500">Calculating...</span></p>
                    <div class="w-28 bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                        <div id="progress-${index}" class="bg-emerald-500 h-1 rounded-full" style="width: 0%"></div>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <p class="text-[9px] font-bold text-slate-400">ACCUMULATED</p>
                <p class="text-xs font-mono font-black text-emerald-600">₱<span id="accumulated-display-${index}">0.00000000</span></p>
                <button onclick="claimPlantEarnings(${index})" class="mt-1 bg-slate-800 hover:bg-slate-900 text-white font-black text-[9px] px-3 py-1 rounded-md tracking-wider active:scale-95 transition uppercase">
                    CLAIM
                </button>
            </div>
        `;
        gardenContainer.appendChild(item);
    });

    renderWithdrawalHistory();
}

function updateMiningRatesPerSecond() {
    if (!myData.plants) return;
    const now = Date.now();

    myData.plants.forEach((plant, index) => {
        const startTimeMs = getMs(plant.startTime);
        const timePassed = now - startTimeMs;
        const remainingTime = Math.max(0, CYCLE_SEVEN_DAYS_MS - timePassed);

        // Update Remaining Duration Counter
        const timeDisplay = document.getElementById(`time-left-${index}`);
        if (timeDisplay) {
            if (remainingTime <= 0) {
                timeDisplay.innerText = "EXPIRED";
                timeDisplay.className = "text-red-500 font-bold";
            } else {
                const totalHours = Math.floor(remainingTime / (1000 * 60 * 60));
                const mins = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((remainingTime % (1000 * 60)) / 1000);
                timeDisplay.innerText = `${totalHours}h ${mins}m ${secs}s`;
            }
        }

        // Live Earnings Counter
        const earningsDisplay = document.getElementById(`accumulated-display-${index}`);
        if (earningsDisplay) {
            const calculatedTotal = Math.min(timePassed, CYCLE_SEVEN_DAYS_MS) * INCOME_PER_MS;
            const currentClaimable = Math.max(0, calculatedTotal - Number(plant.claimed || 0));
            earningsDisplay.innerText = currentClaimable.toFixed(8);
        }

        // Update Progress Indicator Bar
        const progressBar = document.getElementById(`progress-${index}`);
        if (progressBar) {
            const progressPercentage = Math.min(100, (timePassed / CYCLE_SEVEN_DAYS_MS) * 100);
            progressBar.style.width = `${progressPercentage}%`;
        }
    });

    // Update Footer Clock live time
    document.getElementById('live-footer-clock').innerText = new Date().toLocaleString();
}

// --- ACTIONS & OPERATIONS ---

// Purchase a new Sampaguita plant with randomized ads
window.buySampaguita = async () => {
    if (myData.plants.length >= 500) {
        return alert("Your garden is at maximum capacity! (Limit: 500 plants)");
    }
    if (!processHourlyAdLimiter()) return;

    alert("Preparing to plant. Enjoy this short random ad...");
    
    const success = await dispatchRandomRewardedAd();
    if (success) {
        registerAdWatch();
        const updatedPlants = [...myData.plants, { startTime: Date.now(), claimed: 0 }];
        await updateDoc(doc(db, "users", myUid), {
            plants: updatedPlants
        });
        alert("Sampaguita planted! Happy mining!");
    }
};

// Claim earnings for a specific plant with randomized ads
window.claimPlantEarnings = async (index) => {
    if (!processHourlyAdLimiter()) return;

    const plant = myData.plants[index];
    const now = Date.now();
    const startTimeMs = getMs(plant.startTime);
    const elapsed = Math.min(now - startTimeMs, CYCLE_SEVEN_DAYS_MS);
    const totalPotentialIncome = elapsed * INCOME_PER_MS;
    const claimableAmount = totalPotentialIncome - Number(plant.claimed || 0);

    if (claimableAmount <= 0) {
        return alert("This flower has not accumulated anything yet! Please wait.");
    }

    alert("Preparing your rewards. Enjoy this short random ad...");

    const success = await dispatchRandomRewardedAd();
    if (success) {
        registerAdWatch();

        let updatedPlants = [...myData.plants];
        
        if (elapsed >= CYCLE_SEVEN_DAYS_MS) {
            // Contract Completed, remove from database
            updatedPlants.splice(index, 1);
            alert("Contract successfully completed! Flower removed from garden.");
        } else {
            // Update accumulated state to prevent double claim exploit
            updatedPlants[index].claimed = totalPotentialIncome;
        }

        // Atomic update user balance
        await updateDoc(doc(db, "users", myUid), {
            balance: increment(claimableAmount),
            plants: updatedPlants
        });

        // Instant 5% Referral Commission execution
        if (myData.inviter) {
            const commission = claimableAmount * 0.05;
            await updateDoc(doc(db, "users", myData.inviter), {
                balance: increment(commission),
                refEarnings: increment(commission)
            });
        }

        alert(`Instant payout of ₱${claimableAmount.toFixed(8)} credited directly to your balance!`);
    }
};

// Bind Inviter Referral Code
window.bindInviter = async () => {
    const inputCode = document.getElementById('inviter-input').value.trim().toUpperCase();
    if (!inputCode) return alert("Please enter a valid referral code.");
    if (inputCode === myData.refCode) return alert("You cannot use your own referral code.");
    if (myData.inviter) return alert("You already have registered an inviter.");

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("refCode", "==", inputCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return alert("Referral code not found.");
    }

    const inviterDoc = querySnapshot.docs[0];
    const inviterId = inviterDoc.id;

    await updateDoc(doc(db, "users", myUid), { inviter: inviterId });
    await updateDoc(doc(db, "users", inviterId), { referrals: increment(1) });
    
    alert("Inviter linked successfully! You will now contribute 5% to your partner.");
    document.getElementById('inviter-input').value = "";
};

// Copy Referral code to clipboard
window.copyReferralCode = () => {
    const code = document.getElementById('my-referral-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Referral code successfully copied to clipboard!");
    });
};

// --- WITHDRAWAL MODULE ---
window.requestPayout = async () => {
    const method = document.getElementById('payout-method').value;
    const dest = document.getElementById('payout-destination').value.trim();
    const amount = parseFloat(document.getElementById('payout-amount').value);

    if (!dest) return alert("Please enter a valid payment destination details.");
    if (isNaN(amount) || amount < 1.00) return alert("Minimum withdrawal amount is ₱1.00.");
    
    // Insufficient Balance Prompt
    if (myData.balance < amount) {
        const deficit = amount - myData.balance;
        return alert(`Insufficient Balance!\n\nYou currently have: ₱${myData.balance.toFixed(4)}\nYou are missing: ₱${deficit.toFixed(4)} to make this transaction.`);
    }

    try {
        // Create withdrawal transaction
        const payoutRequest = {
            userId: myUid,
            method: method,
            destination: dest,
            amount: amount,
            status: "pending",
            createdAt: serverTimestamp()
        };

        // Instant balance deduction to prevent double spend exploit
        await updateDoc(doc(db, "users", myUid), {
            balance: increment(-amount)
        });

        await addDoc(collection(db, "payouts"), payoutRequest);

        alert("Withdrawal requested successfully! Balance has been temporarily held for review.");
        document.getElementById('payout-destination').value = "";
        document.getElementById('payout-amount').value = "";
    } catch (e) {
        console.error("Payout transaction failed:", e);
        alert("Server error. Transaction cancelled.");
    }
};

async function renderWithdrawalHistory() {
    const container = document.getElementById('payout-history');
    container.innerHTML = '';

    const q = query(collection(db, "payouts"), where("userId", "==", myUid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        container.innerHTML = `<p class="text-[10px] text-slate-400 font-bold text-center py-4 uppercase">No Withdrawal Activity</p>`;
        return;
    }

    snapshot.forEach(docSnap => {
        const item = docSnap.data();
        let statusBadge = `<span class="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Pending</span>`;
        if (item.status === 'approved') {
            statusBadge = `<span class="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Approved</span>`;
        } else if (item.status === 'denied') {
            statusBadge = `<span class="bg-rose-100 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Denied</span>`;
        }

        const listNode = document.createElement('div');
        listNode.className = "bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center";
        listNode.innerHTML = `
            <div>
                <p class="text-xs font-black text-slate-800">₱${item.amount.toFixed(2)} (${item.method})</p>
                <p class="text-[10px] text-slate-400 font-mono">${item.destination}</p>
            </div>
            ${statusBadge}
        `;
        container.appendChild(listNode);
    });
}

// --- ADMIN CONTROL CENTRE ---
window.triggerAdminAuth = () => {
    const p = prompt("Access Console - Enter System Password:");
    if (p === "Propetas12") {
        switchSection('admin');
        loadAdminPayouts();
    } else if (p !== null) {
        alert("Access Denied! Incorrect administrator password.");
    }
};

window.exitAdmin = () => {
    switchSection('home');
};

async function loadAdminPayouts() {
    const container = document.getElementById('admin-payouts-container');
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Connecting console...</p>`;

    const q = query(collection(db, "payouts"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        container.innerHTML = `<p class="text-xs font-bold text-emerald-600 text-center py-6">No pending cashouts to review!</p>`;
        return;
    }

    container.innerHTML = '';
    snapshot.forEach(docSnap => {
        const item = docSnap.data();
        const docId = docSnap.id;

        const row = document.createElement('div');
        row.className = "bg-white p-4 rounded-xl border border-rose-100 shadow-sm space-y-2";
        row.innerHTML = `
            <div class="flex justify-between text-xs">
                <div>
                    <p class="font-black">User: ${item.userId}</p>
                    <p class="text-slate-400">Destination: ${item.destination} (${item.method})</p>
                </div>
                <p class="text-lg font-black text-emerald-600">₱${item.amount.toFixed(2)}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="resolvePayout('${docId}', 'approved', '${item.userId}', ${item.amount})" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black py-2 rounded-lg transition uppercase">Approve</button>
                <button onclick="resolvePayout('${docId}', 'denied', '${item.userId}', ${item.amount})" class="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black py-2 rounded-lg transition uppercase">Deny & Refund</button>
            </div>
        `;
        container.appendChild(row);
    });
}

window.resolvePayout = async (payoutId, status, targetUser, amt) => {
    if (!confirm(`Are you sure you want to change transaction status to: ${status.toUpperCase()}?`)) return;

    try {
        await updateDoc(doc(db, "payouts", payoutId), { status: status });
        
        // If denied, refund the deducted balance
        if (status === 'denied') {
            await updateDoc(doc(db, "users", targetUser), {
                balance: increment(amt)
            });
            alert("Payout request successfully denied. User balance refunded.");
        } else {
            alert("Payout successfully approved.");
        }
        
        loadAdminPayouts();
    } catch (e) {
        console.error("Resolve action failed:", e);
        alert("A technical error occurred while trying to process approval.");
    }
};

// --- GENERAL NAVIGATION ---
window.switchSection = (sectionId) => {
    // Switch Views
    document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden-section'));
    document.getElementById(`section-${sectionId}`).classList.remove('hidden-section');

    // Switch Tabs
    document.querySelectorAll('nav p').forEach(btn => btn.classList.remove('active-tab'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active-tab'));
    const clickedTab = document.getElementById(`tab-${sectionId}`);
    if (clickedTab) {
        clickedTab.classList.add('active-tab');
    }
};

// --- INITIALIZE INTERSTITIAL AD ROTATOR ---
function initializePeriodicInterstitial() {
    setInterval(() => {
        if (typeof window.show_10555746 === 'function') {
            window.show_10555746({
                type: 'inApp',
                inAppSettings: {
                    frequency: 2,
                    capping: 0.1,
                    interval: 30,
                    timeout: 5,
                    everyPage: false
                }
            });
        }
    }, 240000); // 4 Minutes
}

// Start Application
startApp();
