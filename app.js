import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = { /* Paste your config here */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Ad logic: 10 per hour
let adCount = 0;
let lastReset = Date.now();

async function watchAd(adFunc) {
    if (adCount >= 10) {
        if (Date.now() - lastReset > 3600000) { adCount = 0; lastReset = Date.now(); }
        else { alert("Cooldown: 10 ads per hour limit reached."); return; }
    }
    
    adFunc().then(async () => {
        adCount++;
        await addBalance(0.05); // Credit logic
        alert('Reward credited!');
    });
}

// Mining Logic
async function claimMining(plantId) {
    // 1. Check if 7 days passed
    // 2. show_10555663()
    // 3. update Firebase balance
    // 4. Set plant to finished
}

// Cooldown Ads (In-App)
setInterval(() => {
    if(typeof show_10555746 !== 'undefined') {
        show_10555746({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5 } });
    }
}, 240000); // 4 minutes

// Admin Section
function checkAdmin(pass) {
    if(pass === "Propetas12") {
        // Show Admin Panel
    }
}

// Footer Date
document.getElementById('footer-date').innerText = new Date().toLocaleString();
