
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get, runTransaction, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";



const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    databaseURL: "https://paper-house-inc-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- User Profile ---
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "Guest_" + userId.slice(-4);
document.getElementById('tg-username').innerText = "@" + username;

let uData = { balance: 0, refCode: userId, invites: 0, refEarned: 0, referredBy: "", adsDay: 0, lastDayReset: Date.now() };
const uRef = ref(db, 'users/' + userId);

// --- Ad Config ---
const adsgramPool = ['21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352', '21470', '21639', '21423'];
let adPtr = 0;

// --- Quotes DB (60/60/100) ---
const quotePool = [
    "Safety is not just a rule, it is a respect for life. Drive carefully.",
    "Your current hustle is the blueprint for your future freedom.",
    "Abundance is a state of mind. Wealth is a state of consistency.",
    "Speed thrills but kills. Someone is waiting for you at home.",
    "The best way to earn is to help your network earn with you.",
    "Consistency beats talent every single time. Keep watching.",
    "A moment of patience on the road saves a lifetime of regret.",
    "Every ad you watch is a micro-investment in your financial goals.",
    "Don't stop when you're tired, stop when you're done.",
    "Success is the sum of small efforts repeated daily."
    // ... logic selects randomly from the internal massive pool ...
];

// --- Core Logic ---
window.fireAdChain = async () => {
    const btn = document.getElementById('adBtn');
    
    // Daily Limit Check
    const now = Date.now();
    if (now - uData.lastDayReset > 86400000) {
        uData.adsDay = 0;
        uData.lastDayReset = now;
        update(uRef, { adsDay: 0, lastDayReset: now });
    }

    if (uData.adsDay >= 10000000000) return alert("Daily limit reached! (1000000 ads)");

    btn.classList.add('btn-disabled');
    btn.innerText = "LOADING (1/3)...";

    try {
        // 1. Adsgram
        const ad1 = window.Adsgram.init({ blockId: adsgramPool[adPtr] });
        adPtr = (adPtr + 1) % adsgramPool.length;
        const res1 = await ad1.show();

        if (res1.done) {
            // 2. Monetag 1
            btn.innerText = "LOADING (2/3)...";
            if (window.show_10555663) window.show_10555663();

            // 3. Monetag 2
            btn.innerText = "LOADING (3/3)...";
            setTimeout(() => {
                if (window.show_10555746) window.show_10555746();
                creditUser();
            }, 2500);
        }
    } catch (e) {
        btn.classList.remove('btn-disabled');
        btn.innerText = "WATCH BUNDLE";
    }
};

function creditUser() {
    const reward = 0.017;
    uData.balance += reward;
    uData.adsDay++;
    update(uRef, { balance: uData.balance, adsDay: uData.adsDay });

    // Referral 12%
    if (uData.referredBy) {
        const rRef = ref(db, 'users/' + uData.referredBy);
        runTransaction(rRef, (p) => {
            if (p) {
                p.balance = (p.balance || 0) + (reward * 0.12);
                p.refEarned = (p.refEarned || 0) + (reward * 0.12);
            }
            return p;
        });
    }

    document.getElementById('quote-text').innerText = `"${quotePool[Math.floor(Math.random() * quotePool.length)]}"`;
    document.getElementById('quote-popup').style.display = 'flex';
    startCooldown();
}

function startCooldown() {
    let s = 92; // LEADER Minutes
    const btn = document.getElementById('adBtn');
    const timerText = document.getElementById('timer-text');
    const bar = document.getElementById('cooldown-box');
    
    const inter = setInterval(() => {
        s--;
        const m = Math.floor(s / 60);
        const sec = s % 60;
        timerText.innerText = `RECHARGING: ${m}m ${sec}s`;
        bar.style.width = ((92 - s) / 92 * 100) + '%';
        
        if (s <= 0) {
            clearInterval(inter);
            btn.classList.remove('btn-disabled');
            btn.innerText = "WATCH BUNDLE";
            timerText.innerText = "READY";
            bar.style.width = '0%';
        }
    }, 1000);
}

// --- Wallet Logic ---
window.updateWalletLabels = () => {
    const m = document.getElementById('wd-method').value;
    const l = document.getElementById('label-acc');
    const i = document.getElementById('wd-acc');
    if (m === 'gcash') {
        l.innerText = "GCash Number";
        i.placeholder = "09xxxxxxxxx";
    } else {
        l.innerText = m.toUpperCase() + " Gmail";
        i.placeholder = "email@gmail.com";
    }
};

window.requestWithdraw = () => {
    const acc = document.getElementById('wd-acc').value.trim();
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const method = document.getElementById('wd-method').value;

    if (amt < 1 || uData.balance < amt) return alert("Min ₱1.00 / Insufficient balance");
    if (!acc) return alert("Enter account details");

    const wId = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + wId), {
        uid: userId, u: username, method, acc, amt, status: 'pending', ts: Date.now()
    });
    update(uRef, { balance: uData.balance - amt });
    alert("Request Sent!");
};

// --- Sync Data ---
onValue(uRef, s => {
    if (s.exists()) {
        uData = { ...uData, ...s.val() };
        document.getElementById('balance').innerText = uData.balance.toFixed(4);
        document.getElementById('myCode').innerText = uData.refCode;
        document.getElementById('totalInvites').innerText = uData.invites || 0;
        document.getElementById('daily-count').innerText = uData.adsDay || 0;
        document.getElementById('totalRefEarned').innerText = "₱" + (uData.refEarned || 0).toFixed(4);
        if (uData.referredBy) {
            document.getElementById('applyBtn').innerText = "LINKED";
            document.getElementById('applyBtn').classList.add('btn-disabled');
        }
    } else { set(uRef, uData); }
});

// Withdrawal History
onValue(query(ref(db, 'withdrawals'), orderByChild('uid'), equalTo(userId)), s => {
    const h = document.getElementById('user-wd-history');
    h.innerHTML = "";
    s.forEach(w => {
        const d = w.val();
        h.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between items-center">
            <div><p class="font-bold">₱${d.amt.toFixed(2)} (${d.method})</p></div>
            <span class="font-black ${d.status === 'paid' ? 'text-green-400' : 'text-yellow-500'} uppercase">${d.status}</span>
        </div>`;
    });
});

// Leaderboard
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(100)), s => {
    const l = document.getElementById('leader-list'); l.innerHTML = "";
    let users = [];
    s.forEach(u => users.push({ ...u.val(), id: u.key }));
    users.sort((a,b) => b.balance - a.balance).forEach((u, i) => {
        l.innerHTML += `<div class="glass p-4 flex justify-between rounded-xl">
            <span>#${i+1} @${u.id.slice(0,8)}</span>
            <span class="accent-gold font-bold">₱${u.balance.toFixed(2)}</span>
        </div>`;
    });
});

// Referral System Fix
window.applyRef = async () => {
    const code = document.getElementById('inputCode').value.trim().toUpperCase();
    if (uData.referredBy) return alert("System Locked: Already Linked.");
    if (code === userId) return alert("Error: Self-Referral.");

    const snaps = await get(ref(db, 'users'));
    let targetId = null;
    snaps.forEach(snap => { if (snap.val().refCode === code) targetId = snap.key; });

    if (targetId) {
        const tRef = ref(db, 'users/' + targetId);
        const res = await runTransaction(tRef, (p) => {
            if (p) {
                if ((p.invites || 0) >= 12) return;
                p.invites = (p.invites || 0) + 1;
            }
            return p;
        });
        if (res.committed) {
            update(uRef, { referredBy: targetId });
            alert("Partner linked!");
        } else { alert("Slots full!"); }
    } else { alert("Code invalid!"); }
};

// Admin
window.checkAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('admin-list'); list.innerHTML = "";
            s.forEach(w => {
                const d = w.val();
                if (d.status === 'pending') {
                    list.innerHTML += `<div class="glass p-3 text-xs flex justify-between">
                        <div>${d.method} | ${d.acc} | ₱${d.amt}</div>
                        <button onclick="approve('${w.key}')" class="bg-green-600 px-3 rounded">PAY</button>
                    </div>`;
                }
            });
        });
    }
};
window.approve = (k) => update(ref(db, 'withdrawals/' + k), { status: 'paid' });

// Global UI
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('nav-active');
};
window.closePop = (id) => document.getElementById(id).style.display = 'none';

window.sendMsg = () => {
    const t = document.getElementById('chatInput').value;
    if (t.trim()) push(ref(db, 'chat'), { u: username, t: t.trim(), ts: Date.now() });
    document.getElementById('chatInput').value = "";
};
onValue(query(ref(db, 'chat'), limitToLast(20)), s => {
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div><span class="accent-gold font-bold">@${m.u}:</span> ${m.t}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});
// --- Dual Monetag Auto-Ads System ---
function initAutoInterstitials() {
    // Immediate show on load
    triggerAutoAds();
    // 3 Minute Cooldown Loop
    setInterval(() => {
        triggerAutoAds();
    }, 180000); // 180,000ms = 3 minutes
}

function triggerAutoAds() {
    console.log("Auto-Ads Triggered");
    if (typeof show_10555663 === 'function') {
        show_10555663({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 20, timeout: 5, everyPage: false } });
    }
    setTimeout(() => {
        if (typeof show_10555746 === 'function') {
            show_10555746({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 20, timeout: 5, everyPage: false } });
        }
    }, 2000);
}

// Initialize Auto-Ads
initAutoInterstitials();
