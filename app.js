
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

// --- APP CONSTANTS ---
const MINING_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const INCOME_PER_PLANT = 0.05;
const INCOME_PER_MS = INCOME_PER_PLANT / MINING_PERIOD_MS;
const MIN_WITHDRAW = 1.00;

let userId = localStorage.getItem('samp_uid_v2') || "U-" + Math.random().toString(36).substring(2, 8).toUpperCase();
localStorage.setItem('samp_uid_v2', userId);

let userData = { balance: 0, plants: [], adLimit: 0 };

// --- RANDOM AD DISPATCHER ---
// Randomly selects between your two zone IDs
async function showRandomAd() {
    const ads = [show_10555746, show_10555663];
    const pick = ads[Math.floor(Math.random() * ads.length)];
    
    try {
        await pick();
        return true;
    } catch (e) {
        console.error("Ad failed", e);
        return true; // Still allow credit if script fails
    }
}

// --- INITIALIZATION ---
async function init() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            id: userId, balance: 0, plants: [], adLimit: 0, lastAdReset: Date.now(),
            refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referrals: 0, refEarnings: 0, joined: serverTimestamp()
        });
        await updateDoc(doc(db, "global", "stats"), { totalUsers: increment(1) }, { merge: true });
    }

    onSnapshot(userRef, (d) => {
        userData = d.data();
        renderUI();
        renderHistory();
    });

    onSnapshot(doc(db, "global", "stats"), (d) => {
        document.getElementById('total-users').innerText = d.data()?.totalUsers || "100+";
    });

    // High-speed UI update loop (every 100ms for smooth counters)
    setInterval(() => {
        const now = Date.now();
        userData.plants?.forEach((plant, index) => {
            const elapsed = Math.min(now - plant.startTime, MINING_PERIOD_MS);
            const currentTotal = elapsed * INCOME_PER_MS;
            const claimable = Math.max(0, currentTotal - (plant.claimed || 0));
            
            const counterEl = document.getElementById(`acc-${index}`);
            if (counterEl) counterEl.innerText = claimable.toFixed(8);
        });
        document.getElementById('footer-time').innerText = new Date().toLocaleString();
    }, 100);
}

// --- ACTIONS ---

window.buyPlant = async () => {
    if (userData.plants.length >= 500) return alert("Garden full!");
    
    // Ad Limit Check (10 per hour)
    const hourElapsed = Date.now() - userData.lastAdReset > 3600000;
    if (!hourElapsed && userData.adLimit >= 10) return alert("Limit: 10 ads per hour. Wait a while!");

    if (await showRandomAd()) {
        const newPlant = { startTime: Date.now(), claimed: 0 };
        await updateDoc(doc(db, "users", userId), {
            plants: [...userData.plants, newPlant],
            adLimit: hourElapsed ? 1 : increment(1),
            lastAdReset: hourElapsed ? Date.now() : userData.lastAdReset
        });
    }
};

window.claimPlant = async (index) => {
    // Show random ad immediately
    if (await showRandomAd()) {
        const plant = userData.plants[index];
        const now = Date.now();
        const elapsed = Math.min(now - plant.startTime, MINING_PERIOD_MS);
        const totalGenerated = elapsed * INCOME_PER_MS;
        const claimable = totalGenerated - (plant.claimed || 0);

        if (claimable <= 0) return alert("Mining just started, wait a second!");

        let updatedPlants = [...userData.plants];
        updatedPlants[index].claimed = totalGenerated;

        // Auto-remove if contract expired (7 days)
        if (elapsed >= MINING_PERIOD_MS) {
            updatedPlants.splice(index, 1);
            alert("Contract finished! Sampaguita fully harvested.");
        }

        await updateDoc(doc(db, "users", userId), {
            balance: increment(claimable),
            plants: updatedPlants
        });

        // Referral Commission (5%)
        if (userData.referrer) {
            await updateDoc(doc(db, "users", userData.referrer), {
                balance: increment(claimable * 0.05),
                refEarnings: increment(claimable * 0.05)
            });
        }
    }
};

window.processWithdraw = async () => {
    const method = document.getElementById('wd-method').value;
    const addr = document.getElementById('wd-address').value.trim();
    const amount = parseFloat(document.getElementById('wd-amount').value);

    if (!addr || isNaN(amount)) return alert("Fill all fields!");
    if (amount < MIN_WITHDRAW) return alert("Minimum withdrawal is ₱1.00");
    
    // INSUFFICIENT BALANCE PROMPT
    if (userData.balance < amount) {
        return alert(`Insufficient Balance! You need ₱${(amount - userData.balance).toFixed(2)} more.`);
    }

    const req = { userId, method, addr, amount, status: 'pending', time: serverTimestamp() };
    await addDoc(collection(db, "withdrawals"), req);
    await updateDoc(doc(db, "users", userId), { balance: increment(-amount) });
    alert("Request Sent! Pending admin approval.");
};

// --- UI HELPERS ---

function renderUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(8);
    document.getElementById('uid-display').innerText = `ID: ${userId}`;
    document.getElementById('ad-count').innerText = userData.adLimit || 0;
    document.getElementById('active-plants').innerText = `${userData.plants.length}/500`;
    document.getElementById('my-ref-code').innerText = userData.refCode;
    document.getElementById('ref-count').innerText = userData.referrals || 0;
    document.getElementById('ref-earnings').innerText = (userData.refEarnings || 0).toFixed(4);

    const grid = document.getElementById('garden-grid');
    grid.innerHTML = userData.plants.length === 0 ? `<div class="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">Your garden is empty.<br>Buy a flower to start mining!</div>` : '';

    userData.plants.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = "glass p-4 rounded-3xl flex justify-between items-center";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="mining-gradient p-3 rounded-2xl text-white"><i class="fa-solid fa-clover"></i></div>
                <div>
                    <p class="text-[10px] font-black text-slate-400">FLOWER #${i+1}</p>
                    <p class="text-xs font-bold text-slate-600">₱0.05 / 7 Days</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-sm font-mono font-black text-green-600">₱<span id="acc-${i}">0.00000000</span></p>
                <button onclick="claimPlant(${i})" class="claim-btn-active px-4 py-1.5 rounded-xl text-[10px] font-black mt-1 uppercase">Claim Now</button>
            </div>
        `;
        grid.appendChild(div);
    });
}

// Global Ad Interval (4 min)
setInterval(() => {
    show_10555746({
        type: 'inApp',
        inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
}, 240000);

window.tab = (t, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${t}`).classList.remove('hidden-section');
    document.querySelectorAll('nav button').forEach(b => b.classList.replace('text-green-600', 'text-slate-400'));
    btn.classList.replace('text-slate-400', 'text-green-600');
};

window.adminAuth = () => {
    if (prompt("Admin Password:") === "Propetas12") {
        tab('admin', event.currentTarget);
        loadAdmin();
    }
};

async function loadAdmin() {
    const list = document.getElementById('admin-list');
    list.innerHTML = 'Loading...';
    const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    list.innerHTML = snap.empty ? '<p class="text-center text-xs font-bold text-slate-400">No pending requests</p>' : '';
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const item = document.createElement('div');
        item.className = "glass p-4 rounded-2xl text-xs space-y-1";
        item.innerHTML = `
            <p><b>User:</b> ${d.userId}</p>
            <p><b>Amount:</b> ₱${d.amount.toFixed(2)}</p>
            <p><b>Method:</b> ${d.method} (${d.addr})</p>
            <div class="flex gap-2 mt-2">
                <button onclick="updateStatus('${docSnap.id}', 'approved')" class="bg-green-500 text-white p-2 rounded-lg font-bold flex-1">Approve</button>
                <button onclick="updateStatus('${docSnap.id}', 'denied', '${d.userId}', ${d.amount})" class="bg-red-500 text-white p-2 rounded-lg font-bold flex-1">Deny</button>
            </div>
        `;
        list.appendChild(item);
    });
}

window.updateStatus = async (id, status, uid, amt) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if (status === 'denied') await updateDoc(doc(db, "users", uid), { balance: increment(amt) });
    alert("Request " + status);
    loadAdmin();
};

init();
