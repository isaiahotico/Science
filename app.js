
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- User Logic ---
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "Guest_" + userId.slice(-4);
document.getElementById('tg-username').innerText = "@" + username;

let uData = { balance: 0, refCode: userId, invites: 0, refEarned: 0, referredBy: "" };
const uRef = ref(db, 'users/' + userId);

// --- Ad Config ---
const adsgramPool = ['21470', '21639', 'int-21471', '21423', 'task-21424', 'int-21422', 'task-21469'];
let adIdx = 0;
let isCooling = false;

// --- 60 Quotes ---
const quotes = ["Money grows on the tree of persistence.", "Your future self is watching you right now.", "Discipline is the bridge between goals and accomplishment.", "Small daily improvements are the key to staggering long-term results.", "The only way to predict the future is to create it.", "Don't stop until you're proud.", "Focus on your goal, not the obstacles.", "Your mind is your greatest asset.", "Every ad is a micro-investment in your future.", "Consistency beats luck.", "Work hard in silence, let success be your noise.", "Winners focus on winning, losers focus on winners.", "The struggle you're in today is developing the strength you need for tomorrow.", "Dream big. Start small. Act now.", "Success is the sum of small efforts repeated day in and day out.", "Your goals don't care about your feelings.", "Don't wish for it, work for it.", "Action is the fundamental key to all success.", "Make today count.", "Stay hungry. Stay foolish.", "The harder you work, the luckier you get.", "Great things take time.", "Be better than you were yesterday.", "Mindset is everything.", "Patience is power.", "Hustle until your haters ask if you're hiring.", "The best way to get started is to quit talking and begin doing.", "Your life only gets better when you get better.", "If you want it, go get it.", "Everything is hard before it is easy.", "Do it with passion or not at all.", "Failure is not the opposite of success, it's part of it.", "Believe you can and you're halfway there.", "Your only limit is you.", "Keep going. Everything you need will come to you at the perfect time.", "Be a warrior, not a worrier.", "The secret to success is to know something nobody else knows.", "Don't wait for opportunity. Create it.", "Success doesn't just find you. You have to go out and get it.", "Little things make big days.", "Be obsessed with your growth.", "Don't decrease the goal, increase the effort.", "Stay focused and extra sparkly.", "You are capable of amazing things.", "Difficulty is the excuse history never accepts.", "Don't be the same, be better.", "Wealth is a mindset.", "Invest in yourself.", "Keep your eyes on the prize.", "The key to success is to start before you are ready.", "Own your life.", "Limits only exist in the mind.", "Hard work always pays off.", "Stay consistent.", "Focus on the outcome.", "Success is a choice.", "Never give up.", "The climb is tough but the view is worth it.", "Do something today that your future self will thank you for.", "You got this."];

// --- Core Functionality ---
window.fireAdChain = async () => {
    if (isCooling) return;
    const btn = document.getElementById('adBtn');
    btn.disabled = true; btn.innerText = "PREPARING...";
    
    const adId = adsgramPool[adIdx];
    adIdx = (adIdx + 1) % adsgramPool.length;
    const AdController = window.Adsgram.init({ blockId: adId });

    try {
        const result = await AdController.show();
        if (result.done) {
            if (typeof show_10555663 === 'function') await show_10555663();
            processReward();
        }
    } catch (e) {
        // Fallback to Monetag if Adsgram fails
        if (typeof show_10555663 === 'function') {
            await show_10555663();
            processReward();
        }
    } finally {
        startCooldown();
    }
};

function processReward() {
    const reward = 0.0099;
    const comm = reward * 0.12;

    uData.balance += reward;
    update(uRef, { balance: uData.balance, username, lastActive: Date.now() });

    if (uData.referredBy) {
        const rRef = ref(db, 'users/' + uData.referredBy);
        get(rRef).then(s => {
            if (s.exists()) {
                update(rRef, {
                    balance: (s.val().balance || 0) + comm,
                    refEarned: (s.val().refEarned || 0) + comm
                });
            }
        });
    }
    showQuote();
}

function startCooldown() {
    isCooling = true;
    const btn = document.getElementById('adBtn');
    const bar = document.getElementById('cooldown-box');
    let sec = 30;
    btn.classList.add('opacity-50');
    
    const timer = setInterval(() => {
        sec--;
        document.getElementById('timer-text').innerText = `NEXT LOAD: ${sec}S`;
        bar.style.width = ((30 - sec) / 30 * 100) + '%';
        if (sec <= 0) {
            clearInterval(timer);
            isCooling = false;
            btn.disabled = false;
            btn.innerText = "WATCH AD & EARN";
            btn.classList.remove('opacity-50');
            document.getElementById('timer-text').innerText = "";
            bar.style.width = '0%';
        }
    }, 1000);
}

// --- Firebase Sync ---
onValue(uRef, (s) => {
    if (s.exists()) {
        uData = { ...uData, ...s.val() };
        document.getElementById('balance').innerText = uData.balance.toFixed(4);
        document.getElementById('myCode').innerText = uData.refCode;
        document.getElementById('totalInvites').innerText = uData.invites || 0;
        document.getElementById('totalRefEarned').innerText = "₱" + (uData.refEarned || 0).toFixed(4);
        if (uData.referredBy) {
            document.getElementById('applyBtn').disabled = true;
            document.getElementById('applyBtn').innerText = "PARTNER ACTIVE";
        }
    } else { set(uRef, uData); }
});

// --- Referral ---
window.applyRef = async () => {
    const code = document.getElementById('inputCode').value.toUpperCase();
    if (code === userId || uData.referredBy) return alert("Action Invalid");

    const usersSnap = await get(ref(db, 'users'));
    let found = null;
    usersSnap.forEach(c => { if (c.val().refCode === code) found = c.key; });

    if (found) {
        await update(uRef, { referredBy: found });
        const rRef = ref(db, 'users/' + found);
        const rSnap = await get(rRef);
        update(rRef, { invites: (rSnap.val().invites || 0) + 1 });
        alert("Success! 12% commission active.");
    } else { alert("Invalid Code"); }
};

// --- Realtime Features ---
window.sendMsg = () => {
    const t = document.getElementById('chatInput').value;
    if (!t) return;
    push(ref(db, 'chat'), { 
        u: username, t, 
        d: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    });
    document.getElementById('chatInput').value = "";
};

onValue(query(ref(db, 'chat'), limitToLast(20)), (s) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div><span class="text-slate-600 mr-1">${m.d}</span> <span class="accent-gold font-bold">${m.u}:</span> <span class="text-slate-200">${m.t}</span></div>`;
    });
    box.scrollTop = box.scrollHeight;
});

onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(100)), (s) => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    let arr = []; s.forEach(u => arr.push(u.val()));
    arr.reverse().forEach((u, i) => {
        list.innerHTML += `<div class="glass p-3 flex justify-between items-center rounded-xl border-l-2 ${i < 3 ? 'border-yellow-500' : 'border-slate-800'}">
            <span class="text-xs">#${i + 1} @${u.username}</span>
            <span class="font-black text-yellow-500 text-xs">₱${(u.balance || 0).toFixed(2)}</span>
        </div>`;
    });
});

// --- Admin/Wallet ---
window.requestWithdraw = () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const acc = document.getElementById('wd-acc').value;
    const method = document.getElementById('wd-method').value;
    if (amt < 1 || uData.balance < amt) return alert("Invalid Amount");

    const id = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + id), { uid: userId, u: username, amt, acc, method, status: 'pending', time: Date.now() });
    update(uRef, { balance: uData.balance - amt });
    alert("Request Sent!");
};

window.checkAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), s => {
            const l = document.getElementById('admin-list'); l.innerHTML = "";
            s.forEach(w => {
                const d = w.val();
                if (d.status === 'pending') {
                    l.innerHTML += `<div class="glass p-3 text-[10px] flex justify-between items-center">
                        <div>${d.u}<br>₱${d.amt} | ${d.acc}</div>
                        <button onclick="approve('${w.key}')" class="bg-green-600 px-3 py-1 rounded">PAY</button>
                    </div>`;
                }
            });
        });
    }
};
window.approve = (id) => update(ref(db, 'withdrawals/' + id), { status: 'paid' });

// --- UI Utils ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('nav-active');
};

function showQuote() {
    document.getElementById('quote-text').innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
    document.getElementById('quote-popup').style.display = 'flex';
}
window.closeQuote = () => document.getElementById('quote-popup').style.display = 'none';

setInterval(() => {
    const n = new Date();
    document.getElementById('live-time').innerText = n.toLocaleTimeString();
    document.getElementById('live-date').innerText = n.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}, 1000);

// Auto-show Monetag every 5 mins
setInterval(() => { if (typeof show_10555663 === 'function') show_10555663(); }, 300000);
