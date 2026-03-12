
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get, runTransaction, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Instant Telegram User Display ---
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "Anonymous";
document.getElementById('tg-username').innerText = "@" + username;

let uData = { balance: 0, refCode: userId, invites: 0, refEarned: 0, referredBy: "", adsDay: 0, lastDayReset: Date.now() };
const uRef = ref(db, 'users/' + userId);

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
        show_10555663({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
    }
    setTimeout(() => {
        if (typeof show_10555746 === 'function') {
            show_10555746({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        }
    }, 2000);
}

// --- Ad Engine Configuration ---
const adsgramPool = ['21470', '21423', '21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];
let adPtr = 0;

const quotePool = [
    "Wealth is not about how much money you make, but how much you keep.",
    "Road safety is no accident. Drive for your family tonight.",
    "Small steps lead to big destinations. Keep pushing.",
    "Consistency is the secret ingredient of every successful person.",
    "Your future self will thank you for the work you do today.",
    "Abundance flows to those who are disciplined and patient.",
    "Patience behind the wheel is a life-saver. Arrive alive.",
    "Micro-earnings lead to macro-results. Don't underestimate the cent.",
    "The best way to predict your future is to create it.",
    "Speed thrills but kills. Drive carefully, someone loves you."
];

// --- Core Reward Logic ---
window.fireAdChain = async () => {
    const btn = document.getElementById('adBtn');
    const now = Date.now();

    // Daily Limit reset (1000 ads)
    if (now - uData.lastDayReset > 86400000) {
        uData.adsDay = 0;
        uData.lastDayReset = now;
        update(uRef, { adsDay: 0, lastDayReset: now });
    }
    if (uData.adsDay >= 1000) return alert("Daily limit reached. Refresh tomorrow!");

    btn.classList.add('btn-disabled');
    btn.innerText = "LOADING CORE...";

    try {
        // 1. Adsgram (Rotating)
        const ad1 = window.Adsgram.init({ blockId: adsgramPool[adPtr] });
        adPtr = (adPtr + 1) % adsgramPool.length;
        const res1 = await ad1.show();

        if (res1.done) {
            // 2. Monetag Cluster
            btn.innerText = "LOADING CLUSTER (2/3)...";
            if (window.show_10555663) await window.show_10555663();
            
            btn.innerText = "FINALIZING (3/3)...";
            setTimeout(() => {
                if (window.show_10555746) window.show_10555746();
                processReward();
            }, 3000);
        } else {
            resetAdButton();
        }
    } catch (e) {
        resetAdButton();
    }
};

function processReward() {
    const reward = 0.024;
    uData.balance += reward;
    uData.adsDay++;
    update(uRef, { balance: uData.balance, adsDay: uData.adsDay });

    // Referral Commission (12%)
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
    let s = 30; // 2 Minutes
    const btn = document.getElementById('adBtn');
    const timerText = document.getElementById('timer-text');
    const bar = document.getElementById('cooldown-box');
    
    const inter = setInterval(() => {
        s--;
        const m = Math.floor(s/60);
        const sc = s%60;
        timerText.innerText = `RECHARGE IN PROGRESS: ${m}M ${sc}S`;
        bar.style.width = ((30 - s) / 30 * 100) + '%';
        
        if (s <= 0) {
            clearInterval(inter);
            btn.classList.remove('btn-disabled');
            btn.innerText = "START BUNDLE";
            timerText.innerText = "";
            bar.style.width = '0%';
        }
    }, 1000);
}

function resetAdButton() {
    const btn = document.getElementById('adBtn');
    btn.classList.remove('btn-disabled');
    btn.innerText = "START BUNDLE";
}

// --- Wallet & Payout Logic ---
window.updateWalletLabels = () => {
    const m = document.getElementById('wd-method').value;
    const i = document.getElementById('wd-acc');
    i.placeholder = m === 'gcash' ? "09xxxxxxxxx" : "Enter Gmail Address";
};

window.requestWithdraw = () => {
    const acc = document.getElementById('wd-acc').value.trim();
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const method = document.getElementById('wd-method').value;

    if (amt < 1 || uData.balance < amt) return alert("Minimum ₱1.00 / Insufficient balance");
    if (!acc) return alert("Enter account info");

    const wId = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + wId), {
        uid: userId, u: username, method, acc, amt, status: 'pending', ts: Date.now()
    });
    update(uRef, { balance: uData.balance - amt });
    alert("Withdrawal Logged!");
};

// --- Real-time Data Sync ---
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

// History Sync
onValue(query(ref(db, 'withdrawals'), orderByChild('uid'), equalTo(userId)), s => {
    const h = document.getElementById('user-wd-history');
    h.innerHTML = "";
    if(!s.exists()) h.innerHTML = "<p class='text-center text-slate-600 italic text-xs py-4'>No history yet</p>";
    s.forEach(w => {
        const d = w.val();
        h.innerHTML += `<div class="glass p-4 rounded-2xl flex justify-between items-center text-xs">
            <div><p class="font-bold">₱${d.amt.toFixed(2)}</p><p class="text-slate-500 text-[10px] uppercase">${d.method}</p></div>
            <span class="font-black ${d.status === 'paid' ? 'text-green-400' : 'text-yellow-500'} uppercase">${d.status}</span>
        </div>`;
    });
});

// Leaderboard Sync
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(20)), s => {
    const l = document.getElementById('leader-list'); l.innerHTML = "";
    let items = [];
    s.forEach(u => items.push(u.val()));
    items.sort((a,b) => b.balance - a.balance).forEach((u, i) => {
        l.innerHTML += `<div class="glass p-4 flex justify-between rounded-2xl border-l-2 border-white/5">
            <span class="font-bold text-slate-400">#${i+1} @${u.refCode.slice(0,8)}</span>
            <span class="accent-gold font-black">₱${u.balance.toFixed(2)}</span>
        </div>`;
    });
});

// --- Referral Logic ---
window.applyRef = async () => {
    const code = document.getElementById('inputCode').value.trim().toUpperCase();
    if (uData.referredBy) return alert("Already linked!");
    if (code === userId) return alert("Cannot link self!");

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
            alert("Partner Linked!");
        } else { alert("Slots full (Max 12)!"); }
    } else { alert("Code not found!"); }
};

// --- Chat Engine ---
window.sendMsg = () => {
    const t = document.getElementById('chatInput').value;
    if (t.trim()) push(ref(db, 'chat'), { u: username, t: t.trim(), ts: Date.now() });
    document.getElementById('chatInput').value = "";
};
onValue(query(ref(db, 'chat'), limitToLast(25)), s => {
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div><span class="accent-gold font-black">@${m.u}:</span> <span class="text-slate-200">${m.t}</span></div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// --- Admin System ---
window.checkAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('admin-list'); list.innerHTML = "";
            s.forEach(w => {
                const d = w.val();
                if (d.status === 'pending') {
                    list.innerHTML += `<div class="glass p-4 text-xs flex justify-between items-center rounded-2xl">
                        <div><p>${d.method}: ${d.acc}</p><p class="font-bold text-lg">₱${d.amt}</p></div>
                        <button onclick="approve('${w.key}')" class="bg-green-600 px-6 py-2 rounded-xl font-bold">PAY</button>
                    </div>`;
                }
            });
        });
    }
};
window.approve = (k) => update(ref(db, 'withdrawals/' + k), { status: 'paid' });

// --- UI Logic ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('nav-active');
};
window.closePop = (id) => document.getElementById(id).style.display = 'none';

// Initialize Auto-Ads
initAutoInterstitials();
