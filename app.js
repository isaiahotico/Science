
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, remove, query, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// Telegram SDK Initialization
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.random().toString(36).substr(2,4);
document.getElementById("userBar").innerText = "👤 User: " + username;

let user = {
    uid: localStorage.getItem('ph_uid_final') || "u" + Math.random().toString(36).substr(2, 9),
    balance: 0,
    username: username,
    refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    completed: {},
    refCount: 0,
    refEarned: 0
};
localStorage.setItem('ph_uid_final', user.uid);

let timer = 30;
let timerInt;
let isPaused = true;
let currentTask = null;

const techTips = [
    "Shortcut: Windows + V opens your clipboard history.",
    "Incognito mode doesn't hide your IP, only your history.",
    "Restarting your computer clears memory and fixes bugs.",
    "Pressing Space scrolls down, Shift + Space scrolls up.",
    "Control + Shift + Esc opens Task Manager directly.",
    "Type 'cmd' in the file explorer address bar to open it there.",
    "Public Wi-Fi is dangerous; always use a VPN.",
    "SSD is way faster than HDD for boot times.",
    "Update your software to fix security vulnerabilities.",
    "Two-Factor Authentication is your best defense."
];

window.onload = () => {
    syncUser();
    setInterval(() => { document.getElementById('footer-clock').innerText = new Date().toLocaleString(); }, 1000);
    renderTasks();
    listenChat();
};

async function syncUser() {
    const uRef = ref(db, 'users/' + user.uid);
    const snap = await get(uRef);
    if (!snap.exists()) { await set(uRef, user); } 
    else { user = snap.val(); if(!user.completed) user.completed = {}; }
    refreshUI();
}

function refreshUI() {
    document.getElementById('user-balance').innerText = `₱${user.balance.toFixed(3)}`;
    document.getElementById('my-ref-code').innerText = user.refCode;
    document.getElementById('ref-count').innerText = user.refCount || 0;
    document.getElementById('ref-earned').innerText = "₱" + (user.refEarned || 0).toFixed(2);
}

window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + id).classList.remove('hidden');
};

/* ================= ADS ENGINE (ADSGRAM 24352 + MONETAG) ================= */
function triggerAds() {
    // 1 Adsgram Ad
    try { if (window.AdController) { new AdController('24352').show(); } } catch(e){}
    // 2 Monetag Ads (Triggered via provided SDK zone)
    try { if (window.show_10555746) { show_10555746(); show_10555746(); } } catch(e){}
}

/* ================= TASK MANAGEMENT ================= */
function renderTasks() {
    const list = document.getElementById('task-list');
    onValue(ref(db, 'tasks'), snap => {
        list.innerHTML = "";
        const data = snap.val();
        if(!data) return;
        const now = Date.now();
        
        Object.keys(data).forEach(id => {
            const task = data[id];
            const lastDone = user.completed[id] || 0;
            if (now - lastDone < 7200000) return; // 2 hour hide cooldown

            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm";
            card.innerHTML = `
                <div>
                    <div class="text-[10px] font-black text-indigo-600 mb-1">REWARD: ₱${task.reward}</div>
                    <div class="text-sm font-bold truncate w-40">${task.url}</div>
                    <div class="text-[9px] text-slate-400 italic">${task.definition}</div>
                </div>
                <button onclick="startTask('${id}')" class="bg-indigo-600 text-white px-8 py-2 rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 active:scale-95 transition-all">VISIT</button>
            `;
            list.appendChild(card);
        });
    });
}

window.startTask = async (id) => {
    // CLICK VISIT = TRIGGER 1 ADSGRAM + 2 MONETAG IMMEDIATELY
    triggerAds();
    
    const snap = await get(ref(db, `tasks/${id}`));
    currentTask = { id, ...snap.val() };
    
    document.getElementById('task-frame').src = currentTask.url;
    document.getElementById('task-hint').innerText = currentTask.definition;
    document.getElementById('task-overlay').style.display = "flex";
    
    timer = 30; isPaused = true;
    document.getElementById('timer-txt').innerText = "30";
    document.getElementById('interaction-label').style.display = "block";
    document.getElementById('click-shield').style.display = "block";
    runTimer();
};

function runTimer() {
    clearInterval(timerInt);
    timerInt = setInterval(() => {
        if(!isPaused) {
            timer--;
            document.getElementById('timer-txt').innerText = timer;
            
            // Auto-pause every 5 seconds to force ad clicks
            if (timer > 0 && timer % 5 === 0) {
                isPaused = true;
                document.getElementById('interaction-label').style.display = "block";
                document.getElementById('click-shield').style.display = "block";
            }
            if (timer <= 0) finishTask();
        }
    }, 1000);
}

// Resuming also triggers ads to maximize revenue
window.handleTaskClick = () => {
    isPaused = false;
    document.getElementById('interaction-label').style.display = "none";
    document.getElementById('click-shield').style.display = "none";
    triggerAds(); 
};

async function finishTask() {
    clearInterval(timerInt);
    document.getElementById('task-overlay').style.display = "none";
    user.balance += parseFloat(currentTask.reward);
    user.completed[currentTask.id] = Date.now();
    
    await update(ref(db, 'users/' + user.uid), { balance: user.balance, completed: user.completed });
    
    // Tech Tip Knowledge
    document.getElementById('tip-content').innerText = techTips[Math.floor(Math.random()*techTips.length)];
    document.getElementById('tip-popup').style.display = "flex";
    refreshUI();
    renderTasks();
}

window.closeTip = () => {
    document.getElementById('tip-popup').style.display = "none";
    showSection('tasks');
};

/* ================= CHAT ================= */
window.sendMessage = () => {
    const msg = document.getElementById('chat-input').value;
    if(!msg) return;
    push(ref(db, 'chat'), { user: user.username, text: msg, time: Date.now() });
    document.getElementById('chat-input').value = "";
};

function listenChat() {
    onValue(query(ref(db, 'chat'), limitToLast(20)), snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(m => {
            const d = m.val();
            box.innerHTML += `<div><span class="font-black text-indigo-600">${d.user}:</span> <span class="text-slate-700">${d.text}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

/* ================= WITHDRAWAL (MIN ₱1) ================= */
window.requestWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const wallet = document.getElementById('wd-wallet').value;
    if(amt < 1) return alert("Minimum withdrawal is ₱1.00");
    if(user.balance < amt) return alert("Insufficient Balance");

    await push(ref(db, 'withdrawals'), { uid: user.uid, user: user.username, amount: amt, wallet, status: 'pending', time: Date.now() });
    user.balance -= amt;
    await update(ref(db, 'users/' + user.uid), { balance: user.balance });
    alert("Withdrawal Requested!");
    refreshUI();
};

/* ================= ADMIN MANAGEMENT ================= */
window.checkAdmin = () => {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'tasks'), snap => {
        const list = document.getElementById('admin-task-list');
        list.innerHTML = "";
        const data = snap.val();
        for(let id in data) {
            const item = document.createElement('div');
            item.className = "flex justify-between bg-slate-50 p-2 border-b text-[10px]";
            item.innerHTML = `<span>${data[id].url}</span> <button onclick="deleteTask('${id}')" class="text-red-600 font-bold">DELETE</button>`;
            list.appendChild(item);
        }
    });

    
    // Auto-sync admin view for new requests and status changes
    const adminQuery = query(ref(db, 'withdrawals'), orderByChild('status'));
    onValue(adminQuery, snap => {
        const list = document.getElementById('withdrawal-list');
        list.innerHTML = "";
        
        snap.forEach(child => {
            const w = child.val();
            const key = child.key;
            const statusColor = w.status === 'Paid' ? 'bg-green-100' : (w.status === 'Pending' ? 'bg-yellow-100' : 'bg-red-100');
            
            list.innerHTML += `
                <div class="p-3 ${statusColor} rounded-lg mb-2 shadow-sm">
                    <p class="font-bold">Amount: ₱${w.amount} (${w.status})</p>
                    <p class="text-sm">User: ${w.username} (ID: ${w.userId})</p>
                    <p class="text-sm mb-2">GCash: ${w.gcash}</p>
                    ${w.status === 'Pending' ? 
                        `<button class="bg-green-500 text-white px-3 py-1 rounded text-xs mr-2" onclick="markAsPaid('${key}')">Mark Paid</button>
                         <button class="bg-red-500 text-white px-3 py-1 rounded text-xs" onclick="markAsRejected('${key}', '${w.userId}', ${w.amount})">Reject & Refund</button>` :
                        `<span class="text-gray-700 text-xs">Status: ${w.status}</span>`
                    }
                </div>`;
        });
    });
}

// Admin Action: Mark Paid
window.markAsPaid = function(key) {
    if (confirm(`Confirm payment for withdrawal ${key}?`)) {
        // Update status in withdrawals. This auto-syncs the user's history.
        update(ref(db, 'withdrawals/' + key), { status: 'Paid' })
            .then(() => tg.showAlert(`Payment recorded.`))
            .catch(e => tg.showAlert(`Error marking paid: ${e.message}`));
    }
};

// Admin Action: Reject and Refund
window.markAsRejected = function(key, userId, amount) {
    if (confirm(`WARNING: Rejecting this request will refund ₱${amount} to the user. Proceed?`)) {
        // 1. Update withdrawal status
        update(ref(db, 'withdrawals/' + key), { status: 'Rejected' });

        // 2. Refund the user's balance
        const userToRefundRef = ref(db, 'users/' + userId);
        get(userToRefundRef).then(snapshot => {
            const userData = snapshot.val();
            if (userData) {
                const currentBalance = userData.balance || 0;
                const newBalance = parseFloat(currentBalance) + parseFloat(amount);
                update(userToRefundRef, { balance: parseFloat(newBalance.toFixed(4)) });
                tg.showAlert(`Request rejected and ₱${amount} refunded to user ${userId}.`);
            }
        });
    }
};
}

window.deleteTask = async (id) => {
    if(confirm("Confirm Delete?")) { await remove(ref(db, `tasks/${id}`)); alert("Removed"); }
};



window.adminPostTask = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    const rew = document.getElementById('adm-reward').value || 0.021;
    if(!url || !def) return alert("Fill URL and Definition");
    await push(ref(db, 'tasks'), { url, definition: def, reward: rew, owner: 'admin' });
    alert("Global Task Live!");
    document.getElementById('adm-url').value = "";
    document.getElementById('adm-def').value = "";
};

window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.trim().toUpperCase();
    const uSnap = await get(ref(db, 'users'));
    const users = uSnap.val();
    let found = null;
    for (let u in users) { if (users[u].refCode === code) found = u; }
    if (found && found !== user.uid) {
        user.referredBy = found;
        await update(ref(db, 'users/' + user.uid), { referredBy: found });
        alert("Referral Applied!");
    } else { alert("Invalid Code"); }
};
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
