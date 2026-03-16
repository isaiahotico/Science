
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, limitToLast } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let currentUser = null;
let currentTaskIndex = null;
let timerSeconds = 45;
let timerInterval = null;
let isPaused = false;

const adsgramIds = ['21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];
const taskLinks = [
    "https://sentinelgroup3.blogspot.com/?m=1", "https://sentinelgroup7.blogspot.com/?m=1",
    "https://sentinelgroup6.blogspot.com/?m=1", "https://sentinelgroup5.blogspot.com/?m=1",
    "https://sentinelgroup4.blogspot.com/?m=1", "https://sentinelgroup2.blogspot.com/?m=1",
    "https://sentinelgroup1.blogspot.com/?m=1", "https://withdrawaldashboardadmin.blogspot.com/?m=1",
    "https://farfightimi.blogspot.com/?m=1", "https://lefthandedfirstofall.blogspot.com/?m=1",
    "https://kayee01.blogspot.com/?m=1", "https://paperhouse01.blogspot.com/?m=1",
    "https://funnyfaces252.blogspot.com/?m=1"
];

// --- AUTH ---
window.login = async () => {
    const user = document.getElementById('tg-username').value.trim();
    if (!user.startsWith('@') || user.length < 4) return alert("Enter Telegram @username");
    
    const uKey = user.replace(/[^a-zA-Z0-9]/g, '_');
    const userRef = ref(db, 'users/' + uKey);
    const snap = await get(userRef);
    
    if (snap.exists()) {
        currentUser = snap.val();
    } else {
        currentUser = {
            username: user, balance: 0, 
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referredBy: "", totalReferrals: 0, referralEarnings: 0, cooldowns: {}
        };
        await set(userRef, currentUser);
    }
    document.getElementById('auth-screen').style.display = 'none';
    initApp();
};

function initApp() {
    updateUI();
    renderTasks();
    listenChat();
    listenLeaderboard();
    listenWithdrawals();
    
    // Monetag Logic: Show on open and recurring every 3 mins
    triggerMonetag();
    setInterval(triggerMonetag, 180000); 

    setInterval(renderTasks, 1000); 
}

function triggerMonetag() {
    if(window.show_10555746) {
        window.show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

function updateUI() {
    const uKey = currentUser.username.replace(/[^a-zA-Z0-9]/g, '_');
    onValue(ref(db, 'users/' + uKey), (snap) => {
        currentUser = snap.val();
        document.getElementById('display-username').innerText = currentUser.username;
        document.getElementById('display-balance').innerText = `₱${currentUser.balance.toFixed(3)}`;
        document.getElementById('my-ref-code').innerText = currentUser.referralCode;
        document.getElementById('total-ref').innerText = currentUser.totalReferrals;
        document.getElementById('ref-earnings').innerText = `₱${currentUser.referralEarnings.toFixed(3)}`;
    });
}

// --- TASK SYSTEM ---
window.renderTasks = () => {
    const container = document.getElementById('links-container');
    const now = Date.now();
    container.innerHTML = '';

    taskLinks.forEach((link, index) => {
        const lastClick = currentUser.cooldowns?.[index] || 0;
        const diff = now - lastClick;
        const isCooldown = diff < (2 * 60 * 60 * 1000);
        
        const card = document.createElement('div');
        card.className = `p-4 rounded-2xl flex justify-between items-center transition-all ${isCooldown ? 'bg-gray-100 opacity-60' : 'bg-white shadow-sm border border-gray-100'}`;
        
        let meta = `<span class="text-green-600 font-black text-sm">₱0.019 Reward</span>`;
        if (isCooldown) {
            const rem = (2 * 60 * 60 * 1000) - diff;
            const h = Math.floor(rem / 3600000);
            const m = Math.floor((rem % 3600000) / 60000);
            const s = Math.floor((rem % 60000) / 1000);
            meta = `<span class="text-red-500 font-bold text-[10px]">Cooldown: ${h}h ${m}m ${s}s</span>`;
        }

        card.innerHTML = `
            <div>
                <p class="font-bold text-xs uppercase text-gray-400 italic">Mining Ad Link #${index+1}</p>
                ${meta}
            </div>
            ${!isCooldown ? `<button onclick="openTask(${index},'${link}')" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-xs">VIEW</button>` : ''}
        `;
        container.appendChild(card);
    });
};

window.openTask = (index, link) => {
    currentTaskIndex = index;
    document.getElementById('task-frame').src = link;
    document.getElementById('task-view').style.display = 'block';
    startTaskTimer();
};

function startTaskTimer() {
    timerSeconds = 45;
    isPaused = false;
    updateTimerUI();

    timerInterval = setInterval(() => {
        if (!isPaused) {
            timerSeconds--;
            updateTimerUI();

            // Auto pause every 5 seconds
            if (timerSeconds % 5 === 0 && timerSeconds > 0) {
                isPaused = true;
                document.getElementById('prompt-overlay').style.display = 'flex';
            }

            // Show 1 Monetag + 1 Adsgram every 10 seconds
            if (timerSeconds % 10 === 0 && timerSeconds > 0) {
                triggerDualAds();
            }

            if (timerSeconds <= 0) {
                clearInterval(timerInterval);
                finishTask();
            }
        }
    }, 1000);
}

function triggerDualAds() {
    // 1. Monetag
    if(window.show_10555746) window.show_10555746({ type: 'inApp' });
    
    // 2. Adsgram (random from list)
    const randomId = adsgramIds[Math.floor(Math.random() * adsgramIds.length)];
    const AdController = window.Adsgram?.init({ blockId: randomId });
    AdController?.show();
}

window.resumeTask = () => {
    isPaused = false;
    document.getElementById('prompt-overlay').style.display = 'none';
    // Auto-click logic simulation: focusing frame
    document.getElementById('task-frame').focus();
};

function updateTimerUI() {
    document.getElementById('timer-display').innerText = timerSeconds + "s";
    const adStatus = document.getElementById('ad-status');
    const nextAd = timerSeconds % 10;
    adStatus.innerText = `Dual Ad in ${nextAd === 0 ? 10 : nextAd}s`;
}

async function finishTask() {
    const uKey = currentUser.username.replace(/[^a-zA-Z0-9]/g, '_');
    const reward = 0.019;
    const updates = {};
    
    updates[`users/${uKey}/balance`] = currentUser.balance + reward;
    updates[`users/${uKey}/cooldowns/${currentTaskIndex}`] = Date.now();

    // Referral System
    if (currentUser.referredBy) {
        const refSnap = await get(ref(db, 'users/' + currentUser.referredBy));
        if (refSnap.exists()) {
            const r = refSnap.val();
            updates[`users/${currentUser.referredBy}/balance`] = (r.balance || 0) + (reward * 0.1);
            updates[`users/${currentUser.referredBy}/referralEarnings`] = (r.referralEarnings || 0) + (reward * 0.1);
        }
    }

    await update(ref(db), updates);
    alert("Reward ₱0.019 Earned!");
    closeTask();
}

window.closeTask = () => {
    document.getElementById('task-view').style.display = 'none';
    document.getElementById('task-frame').src = "";
    clearInterval(timerInterval);
};

// --- CORE APP MODULES ---
window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

window.submitReferral = async () => {
    const code = document.getElementById('input-ref-code').value.trim().toUpperCase();
    if (code === currentUser.referralCode || currentUser.referredBy) return alert("Error");
    
    const snapshot = await get(ref(db, 'users'));
    let inviterKey = null;
    snapshot.forEach(c => { if(c.val().referralCode === code) inviterKey = c.key; });

    if (inviterKey) {
        const uKey = currentUser.username.replace(/[^a-zA-Z0-9]/g, '_');
        await update(ref(db, `users/${uKey}`), { referredBy: inviterKey });
        const curCount = snapshot.child(inviterKey).val().totalReferrals || 0;
        await update(ref(db, `users/${inviterKey}`), { totalReferrals: curCount + 1 });
        alert("Referral Applied!");
    }
};

window.sendMessage = () => {
    const text = document.getElementById('chat-input').value;
    if (text) {
        push(ref(db, 'chats'), { user: currentUser.username, text, time: Date.now() });
        document.getElementById('chat-input').value = '';
    }
};

function listenChat() {
    onValue(query(ref(db, 'chats'), limitToLast(15)), (snap) => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = '';
        snap.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div class="bg-gray-100 p-3 rounded-2xl w-fit max-w-[80%] border">
                <p class="text-[9px] font-black text-blue-600 uppercase">${m.user}</p>
                <p class="text-sm">${m.text}</p>
            </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function listenLeaderboard() {
    onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snap) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        let items = []; snap.forEach(c => items.push(c.val()));
        items.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="flex justify-between p-4 text-sm font-bold">
                <span>${i+1}. ${u.username}</span>
                <span class="text-blue-600 font-black">₱${u.balance.toFixed(3)}</span>
            </div>`;
        });
    });
}

window.requestWithdraw = async () => {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    if (amount < 1.0) return alert("Minimum withdrawal is ₱1.00");
    if (amount > currentUser.balance) return alert("Insufficient Balance");
    
    const uKey = currentUser.username.replace(/[^a-zA-Z0-9]/g, '_');
    const req = {
        uid: uKey, username: currentUser.username, amount,
        method: document.getElementById('withdraw-method').value,
        details: document.getElementById('withdraw-details').value,
        status: 'pending', time: Date.now()
    };
    await push(ref(db, 'withdrawals'), req);
    await update(ref(db, `users/${uKey}`), { balance: currentUser.balance - amount });
    alert("Request Sent! Manual approval usually takes 24 hours.");
};

function listenWithdrawals() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const hist = document.getElementById('withdraw-history');
        hist.innerHTML = '';
        snap.forEach(c => {
            const w = c.val();
            if (w.username === currentUser.username) {
                hist.innerHTML += `<div class="bg-white p-3 border rounded-2xl flex justify-between items-center text-[10px] font-bold">
                    <span>${w.amount} PHP - ${w.method}</span>
                    <span class="uppercase ${w.status==='pending'?'text-orange-500':'text-green-600'}">${w.status}</span>
                </div>`;
            }
        });
    });
}

window.checkAdmin = () => {
    if (prompt("Admin Password") === "Propetas12") {
        showTab('admin-panel');
        onValue(ref(db, 'withdrawals'), (snap) => {
            const adminBox = document.getElementById('admin-withdrawals');
            adminBox.innerHTML = '';
            snap.forEach(c => {
                if (c.val().status === 'pending') {
                    const w = c.val();
                    adminBox.innerHTML += `<div class="bg-white p-4 rounded-3xl border-l-4 border-blue-600 shadow">
                        <p class="font-black text-xs">${w.username} - ₱${w.amount}</p>
                        <p class="text-[9px] text-gray-500">${w.method}: ${w.details}</p>
                        <button onclick="approve('${c.key}')" class="bg-blue-600 text-white px-6 py-1 rounded-xl text-[10px] font-bold mt-2">APPROVE</button>
                    </div>`;
                }
            });
        });
    }
};

window.approve = (key) => update(ref(db, `withdrawals/${key}`), { status: 'approved' });
