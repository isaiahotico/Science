
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Telegram Initialization ---
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "Guest";
document.getElementById('tg-username').innerText = "@" + username;

// --- Earning Logic ---
let currentBalance = 0;
let adIndex = 0;
const adsgramPool = ['21470', '21639', '21423', 'task-21424', 'task-21469'];
const cooldownTime = 30000; // 30 seconds

// --- 60 Psychological/Motivational Quotes ---
const quotes = [
    "Wealth is the ability to fully experience life.", "Don't decrease the goal. Increase the effort.",
    "Your brain is a tool. Learn to use it to create abundance.", "Consistency beats talent every single time.",
    "The secret of getting ahead is getting started.", "Discipline is choosing between what you want now and what you want most.",
    "Success is a state of mind. If you want success, start thinking of yourself as a success.",
    "Action is the foundational key to all success.", "Your mind can be your best friend or your worst enemy. Choose.",
    "The harder you work, the luckier you get.", "Focus on being productive instead of busy.",
    "Small progress is still progress.", "Don't stop when you're tired. Stop when you're done.",
    "The only limit to our realization of tomorrow will be our doubts of today.",
    "Money is a shadow of your value.", "Every ad you watch is a step toward your target.",
    "Great things never come from comfort zones.", "Wake up with determination. Go to bed with satisfaction.",
    "Be obsessed with your own growth.", "Life begins at the end of your comfort zone.",
    "Mindset is everything.", "If it were easy, everyone would do it.",
    "Work in silence, let your success be your noise.", "Be stronger than your excuses.",
    "The only person you should try to be better than is the person you were yesterday.",
    "Dream big, work hard, stay focused.", "Patience is a key element of success.",
    "Do what you have to do until you can do what you want to do.", "The value of time is the value of money.",
    "Believe you can and you're halfway there.", "Your future self will thank you for this.",
    "Stay hungry, stay foolish.", "Innovation distinguishes between a leader and a follower.",
    "Don't wish it were easier, wish you were better.", "Hard work outweighs talent when talent doesn't work hard.",
    "The mindset of a winner is built on repetition.", "Your goals don't care how you feel.",
    "Success doesn't just find you. You have to go out and get it.", "The key to success is to start before you are ready.",
    "Don't tell people your plans. Show them your results.", "If you want to fly, give up everything that weighs you down.",
    "Stay positive. Work hard. Make it happen.", "Motivation gets you started. Habit keeps you going.",
    "Everything you've ever wanted is on the other side of fear.", "Success is not final; failure is not fatal.",
    "A year from now you may wish you had started today.", "You are only one decision away from a totally different life.",
    "Identify your problems but give your power and energy to solutions.", "Winners never quit and quitters never win.",
    "You don't have to be great to start, but you have to start to be great.", "Your life only gets better when you get better.",
    "Progress, not perfection.", "Be the person you want to meet.", "Think like a millionaire. Act like a hustler.",
    "Financial freedom is worth the wait.", "Every master was once a beginner.", "Push yourself, because no one else is going to do it for you.",
    "The best way to predict the future is to create it.", "Your only limit is your mind.", "The dream is free. The hustle is sold separately."
];

// --- Core Ad Logic ---
window.runAdSequence = async function() {
    const btn = document.getElementById('adBtn');
    if (btn.classList.contains('btn-disabled')) return;

    btn.classList.add('btn-disabled');
    const adId = adsgramPool[adIndex];
    adIndex = (adIndex + 1) % adsgramPool.length;

    const AdController = window.Adsgram.init({ blockId: adId });
    
    try {
        const res = await AdController.show();
        if (res.done) {
            // Success Adsgram
            if (typeof show_10555663 === 'function') await show_10555663();
            rewardUser();
        }
    } catch (e) {
        // If adsgram fails, try Monetag as fallback
        if (typeof show_10555663 === 'function') {
            await show_10555663();
            rewardUser();
        }
    }
    startCooldown();
};

function rewardUser() {
    const r = 0.0099;
    update(ref(db, 'users/' + userId), {
        balance: currentBalance + r,
        username: username,
        lastActive: Date.now()
    });
    showQuote();
}

function showQuote() {
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quote-text').innerText = `"${q}"`;
    document.getElementById('quote-popup').style.display = 'flex';
}

window.closeQuote = () => document.getElementById('quote-popup').style.display = 'none';

function startCooldown() {
    const btn = document.getElementById('adBtn');
    const bar = document.getElementById('cooldown-bar');
    let timeLeft = 30;
    
    btn.classList.add('btn-disabled');
    bar.style.width = '100%';
    
    const inter = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-text').innerText = `Ready in ${timeLeft}s`;
        bar.style.width = (timeLeft / 30 * 100) + '%';
        
        if (timeLeft <= 0) {
            clearInterval(inter);
            btn.classList.remove('btn-disabled');
            document.getElementById('timer-text').innerText = "";
            bar.style.width = '0%';
        }
    }, 1000);
}

// --- Firebase Sync ---
onValue(ref(db, 'users/' + userId), (snap) => {
    if (snap.exists()) {
        currentBalance = snap.val().balance || 0;
        document.getElementById('userBalance').innerText = currentBalance.toFixed(4);
    } else {
        set(ref(db, 'users/' + userId), { balance: 0, username, refCode: userId });
    }
});

// --- Chat System (20 msgs + Date) ---
window.sendChatMessage = () => {
    const txt = document.getElementById('chatInput').value;
    if (txt) {
        push(ref(db, 'chat'), { 
            u: username, 
            t: txt, 
            d: new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) 
        });
        document.getElementById('chatInput').value = "";
    }
};

onValue(query(ref(db, 'chat'), limitToLast(20)), (snap) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snap.forEach(c => {
        const d = c.val();
        box.innerHTML += `<div><span class="text-zinc-500 text-[10px]">[${d.d}]</span> <span class="text-yellow-500 font-bold">${d.u}:</span> ${d.t}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// --- Leaderboard (Top 100) ---
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(100)), (snap) => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    let users = [];
    snap.forEach(u => users.push(u.val()));
    users.reverse().forEach((u, i) => {
        list.innerHTML += `<div class="paper-card p-3 flex justify-between items-center border-l-2 ${i<3?'border-yellow-500':'border-zinc-800'}">
            <span class="text-sm font-bold"><span class="text-zinc-500 mr-2">#${i+1}</span> @${u.username}</span>
            <span class="accent-text font-black">₱${(u.balance || 0).toFixed(2)}</span>
        </div>`;
    });
});

// --- Admin & Withdraw ---
window.submitWithdrawal = () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const acc = document.getElementById('wd-acc').value;
    const method = document.getElementById('wd-method').value;
    if (amt < 1 || currentBalance < amt) return alert("Check balance or minimum.");

    const id = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + id), { uid: userId, u: username, amt, acc, method, status: 'pending', time: Date.now() });
    update(ref(db, 'users/' + userId), { balance: currentBalance - amt });
    alert("PAPERHOUSE INC: Request Registered.");
};

window.tryAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), snap => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            snap.forEach(w => {
                const d = w.val();
                if (d.status === 'pending') {
                    list.innerHTML += `<div class="paper-card p-3 text-xs">
                        ${d.u} | ${d.method} | ₱${d.amt}<br>${d.acc}
                        <button onclick="approve('${w.key}')" class="bg-green-600 px-2 rounded ml-2">Approve</button>
                    </div>`;
                }
            });
        });
    }
};

window.approve = (id) => update(ref(db, 'withdrawals/' + id), { status: 'paid' });

// --- Auto Ads (Every 5 Mins) ---
setInterval(() => {
    if (typeof show_10555663 === 'function') show_10555663();
}, 300000);

// --- Clock & UI ---
setInterval(() => {
    const now = new Date();
    document.getElementById('live-clock').innerText = now.toLocaleTimeString();
    document.getElementById('live-date').innerText = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}, 1000);

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active-page');
    document.getElementById('btn-' + id).classList.add('nav-active');
};
