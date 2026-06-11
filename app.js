const firebaseConfig = { /* Paste your config here */ };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let userId = localStorage.getItem('uid') || Math.random().toString(36).substr(2, 6).toUpperCase();
localStorage.setItem('uid', userId);
document.getElementById('uid').innerText = userId;

// Ads Cooldown Logic
setInterval(() => {
    show_10555746({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5 } });
}, 240000);

async function buySampaguita() {
    // 10 ads per hour logic
    const lastAd = localStorage.getItem('lastAd') || 0;
    if(Date.now() - lastAd < 3600000 && localStorage.getItem('adCount') >= 10) return alert("Wait for 1 hour");

    show_10555663().then(() => {
        const plants = JSON.parse(localStorage.getItem('plants') || "[]");
        if(plants.length < 1000) {
            plants.push({ start: Date.now(), claimed: false });
            localStorage.setItem('plants', JSON.stringify(plants));
            updateAdTracking();
        }
    });
}

function updateAdTracking() {
    let count = parseInt(localStorage.getItem('adCount') || 0) + 1;
    localStorage.setItem('adCount', count);
    localStorage.setItem('lastAd', Date.now());
}

function claimProgress() {
    // Logic: 0.05 pesos / 7 days
    // 1 week = 604,800,000ms
    // Income per ms = 0.05 / 604800000
    const plants = JSON.parse(localStorage.getItem('plants') || "[]");
    let earnings = 0;
    plants.forEach(p => {
        if(!p.claimed && (Date.now() - p.start >= 604800000)) {
            earnings += 0.05;
            p.claimed = true;
        }
    });
    
    if(earnings > 0) {
        let bal = parseFloat(localStorage.getItem('balance') || 0) + earnings;
        localStorage.setItem('balance', bal);
        document.getElementById('balance').innerText = bal.toFixed(2);
        localStorage.setItem('plants', JSON.stringify(plants));
    }
}

function requestWithdrawal() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const bal = parseFloat(localStorage.getItem('balance') || 0);
    if(amt >= 1 && bal >= amt) {
        db.ref('withdrawals/' + userId).push({
            amount: amt,
            status: 'pending',
            date: new Date().toISOString()
        });
        alert("Withdrawal Requested!");
    }
}

// Admin Panel Logic
function adminApprove(reqId) {
    const pass = prompt("Enter Admin Password");
    if(pass === "Propetas12") {
        db.ref('withdrawals/' + reqId).update({ status: 'approved' });
    }
}

// Footer Time
setInterval(() => {
    document.getElementById('footer').innerText = new Date().toLocaleString();
}, 1000);
