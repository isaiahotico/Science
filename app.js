
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

let userId = localStorage.getItem('sampaguita_uid') || "USER-" + Math.random().toString(36).substring(2, 8).toUpperCase();
localStorage.setItem('sampaguita_uid', userId);

let userData = {};

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
            totalMined: 0
        });
        // Update global user count
        await updateDoc(doc(db, "global", "stats"), { totalUsers: increment(1) });
    }

    onSnapshot(userRef, (d) => {
        userData = d.data();
        renderUI();
    });

    onSnapshot(doc(db, "global", "stats"), (d) => {
        document.getElementById('total-users').innerText = d.data().totalUsers;
    });

    startMiningEngine();
}

// --- Mining Engine (UI Animation) ---
function startMiningEngine() {
    setInterval(() => {
        const now = Date.now();
        let totalCurrentAccumulated = 0;

        userData.plants?.forEach((plant, index) => {
            const elapsed = Math.min(now - plant.startTime, MINING_PERIOD);
            const generated = elapsed * INCOME_PER_MS;
            const currentAccumulation = generated - plant.claimed;
            
            const el = document.getElementById(`acc-${index}`);
            if (el) el.innerText = currentAccumulation.toFixed(6);
            
            totalCurrentAccumulated += currentAccumulation;
        });

        document.getElementById('footer-time').innerText = new Date().toLocaleString();
    }, 1000);
}

// --- UI Rendering ---
function renderUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(6);
    document.getElementById('uid-card').innerText = `ID: ${userId}`;
    document.getElementById('ad-count').innerText = userData.adLimit;
    document.getElementById('plant-limit').innerText = `(${userData.plants.length}/500)`;
    document.getElementById('my-ref-code').innerText = userData.refCode;
    document.getElementById('ref-count').innerText = userData.referrals;
    document.getElementById('ref-earnings').innerText = userData.refEarnings.toFixed(2);

    const grid = document.getElementById('garden-grid');
    grid.innerHTML = '';

    userData.plants.forEach((plant, index) => {
        const now = Date.now();
        const progress = Math.min(((now - plant.startTime) / MINING_PERIOD) * 100, 100);
        
        const card = document.createElement('div');
        card.className = "glass p-4 rounded-3xl flex justify-between items-center float-anim";
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="bg-green-100 p-3 rounded-2xl text-green-600">
                    <i class="fa-solid fa-seedling text-xl"></i>
                </div>
                <div>
                    <p class="text-xs font-black">SAMPAGUITA #${index + 1}</p>
                    <p class="text-[10px] text-gray-400">Rate: 0.05 PHP / 7 Days</p>
                    <div class="w-24 bg-gray-100 h-1 rounded-full mt-1">
                        <div class="bg-green-500 h-1 rounded-full" style="width: ${progress}%"></div>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <p class="text-xs font-mono font-bold text-green-600">₱<span id="acc-${index}">0.000000</span></p>
                <button onclick="claimPlant(${index})" class="bg-slate-800 text-white text-[10px] px-3 py-1 rounded-lg font-bold mt-1">CLAIM</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- Action Logic ---
window.buyPlant = async () => {
    if (userData.plants.length >= 500) return alert("Garden full!");
    
    // Ad Limit Logic (10 per hour)
    if (userData.adLimit >= 10 && (Date.now() - userData.lastAdReset < 3600000)) {
        return alert("Hourly Ad Limit reached! Wait or come back later.");
    }

    show_10555663().then(async () => {
        const newPlant = { startTime: Date.now(), claimed: 0 };
        const resetAd = (Date.now() - userData.lastAdReset > 3600000);
        
        await updateDoc(doc(db, "users", userId), {
            plants: [...userData.plants, newPlant],
            adLimit: resetAd ? 1 : increment(1),
            lastAdReset: resetAd ? Date.now() : userData.lastAdReset
        });
    });
};

window.claimPlant = async (index) => {
    // Show Ad before claim
    show_10555746().then(async () => {
        const plant = userData.plants[index];
        const now = Date.now();
        const elapsed = Math.min(now - plant.startTime, MINING_PERIOD);
        const totalGenerated = elapsed * INCOME_PER_MS;
        const claimable = totalGenerated - plant.claimed;

        if (claimable <= 0.000001) return alert("Mining too low to claim yet!");

        let updatedPlants = [...userData.plants];
        updatedPlants[index].claimed = totalGenerated;

        // Contract Finished Logic
        if (elapsed >= MINING_PERIOD) {
            updatedPlants.splice(index, 1);
            alert("Flower cycle finished! It has been removed from garden.");
        }

        await updateDoc(doc(db, "users", userId), {
            balance: increment(claimable),
            totalMined: increment(claimable),
            plants: updatedPlants
        });

        // 5% Referral Commission
        if (userData.referrer) {
            await updateDoc(doc(db, "users", userData.referrer), {
                balance: increment(claimable * 0.05),
                refEarnings: increment(claimable * 0.05)
            });
        }
    });
};

// --- In-App Auto Ad ---
setInterval(() => {
    show_10555746({
        type: 'inApp',
        inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
}, 240000);

// --- Navigation ---
window.tab = (t) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${t}`).classList.remove('hidden-section');
    document.querySelectorAll('nav button').forEach(b => b.classList.replace('text-green-600', 'text-gray-400'));
    event.currentTarget.classList.replace('text-gray-400', 'text-green-600');
};

window.adminAuth = () => {
    const p = prompt("Admin Key:");
    if (p === "Propetas12") {
        tab('admin');
        loadAdminPanel();
    }
};

// Start
init();
