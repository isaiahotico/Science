
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, increment, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- Configuration & Constants ---
const MINING_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 Days in ms
const TOTAL_INCOME_PER_PLANT = 0.05;
const INCOME_PER_MS = TOTAL_INCOME_PER_PLANT / MINING_PERIOD;
const MIN_CLAIMABLE_THRESHOLD = 0.000001; // Minimum amount to trigger a claim
const MIN_WITHDRAWAL_AMOUNT = 1.00;

let userId = localStorage.getItem('sampaguita_uid') || "USER-" + Math.random().toString(36).substring(2, 8).toUpperCase();
localStorage.setItem('sampaguita_uid', userId);

let userData = {}; // Holds current user data from Firestore

// --- Core Initialization ---
async function init() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            id: userId,
            balance: 0,
            plants: [],
            adLimit: 0,
            lastAdReset: Date.now(),
            refCode: Math.random().toString(36).substring(2, 7).toUpperCase(),
            referrals: 0,
            refEarnings: 0,
            totalMined: 0,
            referrer: null, // New field to store referrer ID
            withdrawalHistory: [] // To store user's withdrawal requests
        });
        // Ensure global stats exist and update
        const globalStatsRef = doc(db, "global", "stats");
        await setDoc(globalStatsRef, { totalUsers: increment(1), totalMined: 0 }, { merge: true });
    }

    // Real-time listener for current user data
    onSnapshot(userRef, (d) => {
        userData = d.data();
        renderUI();
        renderWithdrawalHistory();
    });

    // Real-time listener for global stats
    onSnapshot(doc(db, "global", "stats"), (d) => {
        const stats = d.data();
        document.getElementById('total-users').innerText = stats.totalUsers || 0;
        document.getElementById('total-mined-all').innerText = (stats.totalMined || 0).toFixed(2);
    });

    startMiningEngine(); // Start the UI update loop for mining progress
    
    // Default to home tab
    tab('home', document.getElementById('nav-home'));
}

// --- Mining Engine (UI Animation & Calculation Display) ---
function startMiningEngine() {
    setInterval(() => {
        const now = Date.now();
        
        // Update accumulated earnings for each plant in the UI
        userData.plants?.forEach((plant, index) => {
            const elapsed = Math.min(now - plant.startTime, MINING_PERIOD);
            const generated = elapsed * INCOME_PER_MS;
            const currentAccumulation = generated - plant.claimed; // What's accumulated since last claim

            const el = document.getElementById(`acc-${index}`);
            if (el) el.innerText = currentAccumulation.toFixed(6);

            // Update claim button state dynamically
            const claimButton = document.querySelector(`#plant-card-${index} button`);
            if (claimButton) {
                if (currentAccumulation < MIN_CLAIMABLE_THRESHOLD) {
                    claimButton.disabled = true;
                    claimButton.classList.remove('bg-slate-800', 'text-white', 'hover:bg-slate-700');
                    claimButton.classList.add('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
                    claimButton.innerText = 'MINING...';
                } else {
                    claimButton.disabled = false;
                    claimButton.classList.add('bg-slate-800', 'text-white', 'hover:bg-slate-700');
                    claimButton.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
                    claimButton.innerText = 'CLAIM';
                }
            }
        });

        document.getElementById('footer-time').innerText = new Date().toLocaleString();
    }, 1000); // Update every second
}

// --- UI Rendering ---
function renderUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(6);
    document.getElementById('uid-card').innerText = `ID: ${userId}`;
    document.getElementById('ad-count').innerText = userData.adLimit;
    document.getElementById('plant-limit').innerText = `(${userData.plants.length}/500)`;
    
    // Referral section updates
    document.getElementById('my-ref-code').innerText = userData.refCode;
    document.getElementById('ref-count').innerText = userData.referrals || 0;
    document.getElementById('ref-earnings').innerText = (userData.refEarnings || 0).toFixed(2);

    const grid = document.getElementById('garden-grid');
    grid.innerHTML = ''; // Clear existing plants

    userData.plants.forEach((plant, index) => {
        const now = Date.now();
        const progress = Math.min(((now - plant.startTime) / MINING_PERIOD) * 100, 100);
        
        const card = document.createElement('div');
        card.id = `plant-card-${index}`; // Unique ID for each plant card
        card.className = "glass p-4 rounded-3xl flex justify-between items-center float-anim";
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="bg-green-100 p-3 rounded-2xl text-green-600">
                    <i class="fa-solid fa-seedling text-xl"></i>
                </div>
                <div>
                    <p class="text-xs font-black">SAMPAGUITA #${index + 1}</p>
                    <p class="text-[10px] text-gray-400">Rate: 0.05 PHP / 7 Days</p>
                    <p class="text-[10px] text-gray-400">Expires: ${new Date(plant.startTime + MINING_PERIOD).toLocaleDateString()}</p>
                    <div class="w-24 bg-gray-100 h-1 rounded-full mt-1">
                        <div class="bg-green-500 h-1 rounded-full" style="width: ${progress}%"></div>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <p class="text-xs font-mono font-bold text-green-600">₱<span id="acc-${index}">0.000000</span></p>
                <button onclick="claimPlant(${index})" class="bg-gray-300 text-gray-500 text-[10px] px-3 py-1 rounded-lg font-bold mt-1 cursor-not-allowed" disabled>MINING...</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- Action Logic: Buy Plant (Watch Ad) ---
window.buyPlant = async () => {
    if (userData.plants.length >= 500) {
        return alert("Your Sampaguita Garden is full! Max 500 plants.");
    }
    
    // Ad Limit Logic (10 per hour)
    if (userData.adLimit >= 10 && (Date.now() - userData.lastAdReset < 3600000)) {
        return alert("Hourly Ad Limit reached! Please wait for some time (max 10 ads per hour).");
    }

    alert("Watching an ad to buy a Sampaguita flower...");
    // show_10555663 is typically a regular interstitial/rewarded ad for general purposes
    show_10555663().then(async () => {
        const newPlant = { startTime: Date.now(), claimed: 0 };
        const resetAd = (Date.now() - userData.lastAdReset > 3600000); // Check if 1 hour has passed since last reset
        
        await updateDoc(doc(db, "users", userId), {
            plants: [...userData.plants, newPlant],
            adLimit: resetAd ? 1 : increment(1),
            lastAdReset: resetAd ? Date.now() : userData.lastAdReset // Reset lastAdReset only if a new hour started
        });
        alert("A new Sampaguita flower has been planted!");
    }).catch(error => {
        console.error("Ad failed or user skipped:", error);
        alert("Failed to show ad or ad was skipped. Please try again.");
    });
};

// --- Action Logic: Claim Mining Progress (Watch Ad) ---
window.claimPlant = async (index) => {
    alert("Watching an ad to claim your mining rewards...");
    // show_10555746 is specifically mentioned as a "Rewarded interstitial"
    show_10555746().then(async () => {
        const plant = userData.plants[index];
        const now = Date.now();
        const elapsed = Math.min(now - plant.startTime, MINING_PERIOD);
        const totalGenerated = elapsed * INCOME_PER_MS;
        const claimable = totalGenerated - plant.claimed;

        if (claimable < MIN_CLAIMABLE_THRESHOLD) {
            return alert("Mining rewards are too low to claim right now. Please wait for more accumulation.");
        }

        let updatedPlants = [...userData.plants];
        updatedPlants[index].claimed = totalGenerated; // Mark all generated up to now as claimed

        let finalClaimAmount = claimable; // The actual amount to credit

        // Contract Finished Logic: Remove plant if its time is up
        if (elapsed >= MINING_PERIOD) {
            updatedPlants.splice(index, 1); // Remove the plant
            alert("Flower cycle finished! It has been removed from your garden.");
        }

        // Update user's balance and total mined
        await updateDoc(doc(db, "users", userId), {
            balance: increment(finalClaimAmount),
            totalMined: increment(finalClaimAmount),
            plants: updatedPlants
        });

        // Update global total mined (for public display)
        await updateDoc(doc(db, "global", "stats"), { totalMined: increment(finalClaimAmount) });

        // 5% Referral Commission (if applicable)
        if (userData.referrer) {
            await updateDoc(doc(db, "users", userData.referrer), {
                balance: increment(finalClaimAmount * 0.05),
                refEarnings: increment(finalClaimAmount * 0.05)
            });
        }
        alert(`₱${finalClaimAmount.toFixed(6)} credited to your balance!`);
    }).catch(error => {
        console.error("Ad failed or user skipped:", error);
        alert("Failed to show ad or ad was skipped. Please try again.");
    });
};

// --- Referral System Actions ---
window.copyRef = () => {
    const refCode = document.getElementById('my-ref-code').innerText;
    navigator.clipboard.writeText(refCode).then(() => {
        alert("Referral code copied!");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert("Failed to copy code. Please manually copy.");
    });
};

window.submitRef = async () => {
    const inputCode = document.getElementById('input-ref').value.trim().toUpperCase();
    if (!inputCode) return alert("Please enter a referral code.");
    if (inputCode === userData.refCode) return alert("You cannot refer yourself.");
    if (userData.referrer) return alert("You already have a referrer.");

    const referrerQuery = query(collection(db, "users"), where("refCode", "==", inputCode));
    const referrerSnap = await getDocs(referrerQuery);

    if (referrerSnap.empty) {
        return alert("Referral code not found.");
    }

    const referrerDoc = referrerSnap.docs[0];
    const referrerId = referrerDoc.id;

    await updateDoc(doc(db, "users", userId), {
        referrer: referrerId
    });
    await updateDoc(doc(db, "users", referrerId), {
        referrals: increment(1)
    });
    alert("Referral applied successfully!");
};

// --- Withdrawal System Actions ---
window.processWithdraw = async () => {
    const method = document.getElementById('wd-method').value;
    const address = document.getElementById('wd-address').value.trim();
    const amount = parseFloat(document.getElementById('wd-amount').value);

    if (!address || isNaN(amount) || amount <= 0) {
        return alert("Please fill in all withdrawal details correctly.");
    }
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
        return alert(`Minimum withdrawal amount is ₱${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.`);
    }
    if (userData.balance < amount) {
        return alert("Insufficient balance for this withdrawal request.");
    }

    const withdrawalRequest = {
        userId: userId,
        method: method,
        address: address,
        amount: amount,
        status: "pending",
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "withdrawals"), withdrawalRequest);
        await updateDoc(doc(db, "users", userId), {
            balance: increment(-amount), // Deduct balance immediately
            withdrawalHistory: [...(userData.withdrawalHistory || []), withdrawalRequest] // Add to user's history
        });
        alert("Withdrawal request submitted successfully! It will be reviewed by admin.");
        document.getElementById('wd-address').value = '';
        document.getElementById('wd-amount').value = '';
    } catch (error) {
        console.error("Error submitting withdrawal:", error);
        alert("Failed to submit withdrawal request. Please try again.");
    }
};

function renderWithdrawalHistory() {
    const historyContainer = document.getElementById('wd-history');
    historyContainer.innerHTML = '';
    
    if (!userData.withdrawalHistory || userData.withdrawalHistory.length === 0) {
        historyContainer.innerHTML = '<p class="text-gray-500 text-sm text-center">No withdrawal history yet.</p>';
        return;
    }

    userData.withdrawalHistory.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0)).forEach(req => {
        const item = document.createElement('div');
        item.className = "glass p-3 rounded-xl flex justify-between items-center text-sm";
        const statusColor = req.status === 'approved' ? 'text-green-600' : (req.status === 'denied' ? 'text-red-600' : 'text-blue-500');
        item.innerHTML = `
            <div>
                <p class="font-bold">₱${req.amount.toFixed(2)} (${req.method})</p>
                <p class="text-xs text-gray-500">${req.address}</p>
                <p class="text-[10px] text-gray-400">${req.timestamp ? new Date(req.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
            </div>
            <div class="font-bold ${statusColor}">${req.status.toUpperCase()}</div>
        `;
        historyContainer.appendChild(item);
    });
}


// --- Admin Panel Logic ---
window.adminAuth = () => {
    const p = prompt("Enter Admin Password:");
    if (p === "Propetas12") {
        tab('admin', document.getElementById('nav-admin')); // Switch to admin tab
        loadAdminPanel();
    } else if (p !== null) {
        alert("Incorrect password.");
    }
};

async function loadAdminPanel() {
    const adminList = document.getElementById('admin-list');
    adminList.innerHTML = '<p class="text-gray-500 text-center">Loading requests...</p>';

    const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        adminList.innerHTML = '<p class="text-gray-500 text-center">No pending withdrawal requests.</p>';
        return;
    }

    adminList.innerHTML = ''; // Clear loading message

    querySnapshot.forEach((docSnap) => {
        const request = docSnap.data();
        const requestId = docSnap.id;

        const item = document.createElement('div');
        item.className = "glass p-4 rounded-xl shadow-sm border border-orange-200";
        item.innerHTML = `
            <p class="font-bold text-sm">User ID: ${request.userId}</p>
            <p>Amount: <span class="text-green-600 font-bold">₱${request.amount.toFixed(2)}</span></p>
            <p>Method: ${request.method}</p>
            <p>Address: ${request.address}</p>
            <p class="text-xs text-gray-500">Requested: ${request.timestamp ? new Date(request.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
            <div class="flex gap-2 mt-3">
                <button onclick="approveWithdrawal('${requestId}', '${request.userId}', ${request.amount})" class="flex-1 bg-green-500 text-white p-2 rounded-lg font-bold hover:bg-green-600 transition">Approve</button>
                <button onclick="denyWithdrawal('${requestId}', '${request.userId}', ${request.amount})" class="flex-1 bg-red-500 text-white p-2 rounded-lg font-bold hover:bg-red-600 transition">Deny</button>
            </div>
        `;
        adminList.appendChild(item);
    });
}

window.approveWithdrawal = async (requestId, userIdToUpdate, amount) => {
    if (!confirm("Are you sure you want to approve this withdrawal?")) return;

    try {
        await updateDoc(doc(db, "withdrawals", requestId), { status: "approved" });
        // Update the user's withdrawalHistory entry
        const userRef = doc(db, "users", userIdToUpdate);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const history = userSnap.data().withdrawalHistory || [];
            const updatedHistory = history.map(item => 
                (item.userId === userIdToUpdate && item.amount === amount && item.method === item.method && item.status === 'pending') ? { ...item, status: 'approved' } : item
            );
            await updateDoc(userRef, { withdrawalHistory: updatedHistory });
        }
        alert("Withdrawal approved!");
        loadAdminPanel(); // Refresh admin panel
    } catch (error) {
        console.error("Error approving withdrawal:", error);
        alert("Failed to approve withdrawal.");
    }
};

window.denyWithdrawal = async (requestId, userIdToUpdate, amount) => {
    if (!confirm("Are you sure you want to deny this withdrawal? The balance will be returned to the user.")) return;

    try {
        await updateDoc(doc(db, "withdrawals", requestId), { status: "denied" });
        // Return funds to user
        await updateDoc(doc(db, "users", userIdToUpdate), {
            balance: increment(amount)
        });
        // Update the user's withdrawalHistory entry
        const userRef = doc(db, "users", userIdToUpdate);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const history = userSnap.data().withdrawalHistory || [];
            const updatedHistory = history.map(item => 
                (item.userId === userIdToUpdate && item.amount === amount && item.method === item.method && item.status === 'pending') ? { ...item, status: 'denied' } : item
            );
            await updateDoc(userRef, { withdrawalHistory: updatedHistory });
        }
        alert("Withdrawal denied and funds returned to user.");
        loadAdminPanel(); // Refresh admin panel
    } catch (error) {
        console.error("Error denying withdrawal:", error);
        alert("Failed to deny withdrawal.");
    }
};

// --- In-App Auto Ad (Cooldown) ---
// This ad shows automatically every 4 minutes (240000ms)
setInterval(() => {
    if (typeof show_10555746 !== 'undefined') { // Check if ad SDK is loaded
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}, 240000); // 4 minutes

// --- Navigation ---
window.tab = (t, button) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${t}`).classList.remove('hidden-section');
    
    // Update active nav button styling
    document.querySelectorAll('nav button').forEach(b => b.classList.replace('text-green-600', 'text-gray-400'));
    if (button) {
        button.classList.replace('text-gray-400', 'text-green-600');
    }
};

// Start the application
init();
