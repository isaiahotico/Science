
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- User Logic ---
let userId = localStorage.getItem('mine_uid') || "UID-" + Math.random().toString(36).substring(2, 8).toUpperCase();
localStorage.setItem('mine_uid', userId);

let userData = { balance: 0, adLimit: 0, lastAdReset: Date.now(), plants: [], refEarnings: 0 };

// Real-time listener for current user
onSnapshot(doc(db, "users", userId), (docSnap) => {
    if (docSnap.exists()) {
        userData = docSnap.data();
        updateUI();
    } else {
        // Create new user
        setDoc(doc(db, "users", userId), {
            id: userId,
            balance: 0,
            adLimit: 0,
            lastAdReset: Date.now(),
            plants: [],
            refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referrals: 0,
            refEarnings: 0,
            joined: serverTimestamp()
        });
    }
});

// Update UI
function updateUI() {
    document.getElementById('balance').innerText = userData.balance.toFixed(4);
    document.getElementById('user-id-display').innerText = `ID: ${userId}`;
    document.getElementById('ad-count').innerText = userData.adLimit;
    document.getElementById('active-plants').innerText = userData.plants.length;
    document.getElementById('my-referral-code').innerText = userData.refCode;
    document.getElementById('ref-count').innerText = userData.referrals || 0;
    document.getElementById('ref-earnings').innerText = (userData.refEarnings || 0).toFixed(2);
    
    renderGarden();
}

// Mining Garden Logic
function renderGarden() {
    const container = document.getElementById('garden-grid');
    container.innerHTML = '';
    const now = Date.now();

    userData.plants.forEach((plant, index) => {
        const lifespan = 7 * 24 * 60 * 60 * 1000; // 7 days
        const elapsed = now - plant.boughtAt;
        const remaining = lifespan - elapsed;
        
        if (remaining > 0) {
            const progress = (elapsed / lifespan) * 100;
            const plantDiv = document.createElement('div');
            plantDiv.className = "bg-white p-4 rounded-2xl shadow-sm border border-l-4 border-l-green-500 flex justify-between items-center";
            plantDiv.innerHTML = `
                <div>
                    <p class="font-bold text-sm">Sampaguita #${index + 1}</p>
                    <p class="text-[10px] text-gray-400">Expires in: ${Math.ceil(remaining / (1000 * 60 * 60))} hrs</p>
                    <div class="w-32 bg-gray-100 h-1 rounded-full mt-2">
                        <div class="bg-green-500 h-1 rounded-full" style="width: ${progress}%"></div>
                    </div>
                </div>
                <button onclick="claimMining(${index})" class="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-xl text-xs font-black mining-animate">CLAIM</button>
            `;
            container.appendChild(plantDiv);
        }
    });
}

// --- Actions ---

window.buySampaguita = async () => {
    if (userData.plants.length >= 500) return alert("Garden full!");
    if (userData.adLimit >= 10 && (Date.now() - userData.lastAdReset < 3600000)) return alert("Ad limit reached. Try again in 1 hour.");

    show_10555663().then(async () => {
        const newPlant = { boughtAt: Date.now(), totalIncome: 0.05, claimed: 0 };
        const newAdLimit = (Date.now() - userData.lastAdReset > 3600000) ? 1 : userData.adLimit + 1;
        
        await updateDoc(doc(db, "users", userId), {
            plants: [...userData.plants, newPlant],
            adLimit: newAdLimit,
            lastAdReset: (newAdLimit === 1) ? Date.now() : userData.lastAdReset
        });
        alert("Sampaguita planted! It will mine for 7 days.");
    });
};

window.claimMining = async (index) => {
    show_10555746().then(async () => {
        const plant = userData.plants[index];
        const lifespan = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const elapsed = Math.min(now - plant.boughtAt, lifespan);
        
        // Income = (0.05 PHP / 7 days) * elapsed time
        const totalPossibleEarnings = (elapsed / lifespan) * 0.05;
        const claimable = totalPossibleEarnings - plant.claimed;

        if (claimable <= 0) return alert("Nothing to claim yet.");

        let updatedPlants = [...userData.plants];
        updatedPlants[index].claimed = totalPossibleEarnings;

        // Auto remove if finished
        if (elapsed >= lifespan) {
            updatedPlants.splice(index, 1);
            alert("Contract finished! Flower expired.");
        }

        await updateDoc(doc(db, "users", userId), {
            balance: increment(claimable),
            plants: updatedPlants
        });
    });
};

// Tabs
window.switchTab = (tab) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${tab}`).classList.remove('hidden-section');
};

// In-App Ad Cooldown (4 mins)
setInterval(() => {
    show_10555746({
        type: 'inApp',
        inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
}, 240000);

// Admin & Time
setInterval(() => {
    document.getElementById('footer-clock').innerText = new Date().toLocaleString();
}, 1000);

window.adminLogin = () => {
    const pass = prompt("Admin Password:");
    if (pass === "Propetas12") switchTab('admin');
};

// Note: Additional functions like applyReferral, requestWithdrawal, 
// and Admin Approval need to be mapped to addDoc(collection(db, "withdrawals")) 
// and similar Firestore queries.
