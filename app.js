
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, remove, query, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// Telegram WebApp Integration
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.random().toString(36).substr(2,4);
document.getElementById("userBar").innerText = "👤 User: " + username;

let user = {
    uid: localStorage.getItem('ph_uid_final_v4') || "u" + Math.random().toString(36).substr(2, 9),
    balance: 0,
    username: username,
    refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    completed: {},
    refCount: 0,
    refEarned: 0
};
localStorage.setItem('ph_uid_final_v4', user.uid);

let timer = 30;
let timerInt;
let isPaused = true;
let currentTask = null;

const techTips = [
    "Shortcut: Ctrl + Shift + N opens a private window instantly.",
    "Restarting your computer clears the RAM and can solve lag.",
    "Use a password manager to keep your accounts secure.",
    "The 'F5' key refreshes your browser page.",
    "A VPN hides your location from websites you visit.",
    "Don't click links in emails from people you don't know.",
    "Cleaning your screen with a dry cloth prevents scratches.",
    "Shift + Delete deletes a file forever, skipping the bin.",
    "Type 'calc' in Windows search to find the calculator fast.",
    "Always update your phone software for the latest security."
    // Support for 100 tips can be added to this array
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

/* ================= ADS LOGIC (1 ADSGRAM + 2 MONETAG) ================= */
function triggerAds() {
    // 1. Adsgram (ID: 24352)
    try { if (window.AdController) { new AdController('24352').show(); } } catch(e){}
    // 2. Monetag (Zone 10555746) - Triggering twice for 2 ads
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
            if (now - lastDone < 7200000) return; // 2 hour cooldown

            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm";
            card.innerHTML = `
                <div>
                    <div class="text-[10px] font-black text-indigo-600 uppercase">₱${task.reward} Reward</div>
                    <div class="text-sm font-bold truncate w-44">${task.url}</div>
                    <div class="text-[9px] text-gray-400 italic">${task.definition}</div>
                </div>
                <button onclick="startTask('${id}')" class="bg-indigo-600 text-white px-6 py-2 rounded-2xl font-black text-xs">VISIT</button>
            `;
            list.appendChild(card);
        });
    });
}

window.startTask = async (id) => {
    triggerAds(); // Trigger on initial click
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
            if (timer > 0 && timer % 5 === 0) { // Auto-pause every 5s
                isPaused = true;
                document.getElementById('interaction-label').style.display = "block";
                document.getElementById('click-shield').style.display = "block";
            }
            if (timer <= 0) finishTask();
        }
    }, 1000);
}

window.handleTaskClick = () => {
    isPaused = false;
    document.getElementById('interaction-label').style.display = "none";
    document.getElementById('click-shield').style.display = "none";
    triggerAds(); // Trigger ads when resuming
};

async function finishTask() {
    clearInterval(timerInt);
    document.getElementById('task-overlay').style.display = "none";
    user.balance += parseFloat(currentTask.reward);
    user.completed[currentTask.id] = Date.now();
    await update(ref(db, 'users/' + user.uid), { balance: user.balance, completed: user.completed });
    
    document.getElementById('tip-content').innerText = techTips[Math.floor(Math.random()*techTips.length)];
    document.getElementById('tip-popup').style.display = "flex";
    refreshUI();
}

window.closeTip = () => {
    document.getElementById('tip-popup').style.display = "none";
    showSection('tasks');
};

/* ================= CHAT LOGIC ================= */
window.sendMessage = () => {
    const msg = document.getElementById('chat-input').value;
    if(!msg) return;
    push(ref(db, 'chat'), { user: user.username, text: msg, time: Date.now() });
    document.getElementById('chat-input').value = "";
};

function listenChat() {
    onValue(query(ref(db, 'chat'), limitToLast(25)), snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(m => {
            const d = m.val();
            box.innerHTML += `<div><span class="font-black text-indigo-600">${d.user}:</span> <span class="text-slate-700">${d.text}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

/* ================= WITHDRAWAL (₱1 MIN) ================= */
window.requestWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const wallet = document.getElementById('wd-wallet').value;
    if(amt < 1) return alert("Minimum withdrawal is ₱1.00");
    if(user.balance < amt) return alert("Insufficient Balance");

    await push(ref(db, 'withdrawals'), { 
        uid: user.uid, 
        user: user.username, 
        amount: amt, 
        wallet: wallet, 
        method: document.getElementById('wd-method').value,
        status: 'pending', 
        time: Date.now() 
    });
    user.balance -= amt;
    await update(ref(db, 'users/' + user.uid), { balance: user.balance });
    alert("Request Sent!");
    refreshUI();
};

/* ================= ADMIN CONTROLS ================= */
window.checkAdmin = () => {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    // Manage Links (All Links)
    onValue(ref(db, 'tasks'), snap => {
        const list = document.getElementById('admin-task-list');
        list.innerHTML = "";
        const data = snap.val();
        for(let id in data) {
            const item = document.createElement('div');
            item.className = "flex justify-between items-center bg-gray-50 p-2 border-b text-[10px]";
            item.innerHTML = `<span class="truncate w-40">${data[id].url}</span> <button onclick="deleteTask('${id}')" class="text-red-600 font-bold">DELETE</button>`;
            list.appendChild(item);
        }
    });

    // Full Withdrawal Info
    onValue(ref(db, 'withdrawals'), snap => {
        const list = document.getElementById('admin-wd-list');
        list.innerHTML = "";
        const d = snap.val();
        for(let id in d) {
            if(d[id].status === 'pending') {
                const tr = document.createElement('tr');
                tr.className = "border-b bg-yellow-50";
                tr.innerHTML = `
                    <td class="p-2">${d[id].user}</td>
                    <td class="p-2 font-bold text-red-600">₱${d[id].amount}</td>
                    <td class="p-2">${d[id].method}</td>
                    <td class="p-2 font-mono">${d[id].wallet}</td>
                    <td class="p-2"><button onclick="approveWD('${id}')" class="bg-green-600 text-white px-2 py-1 rounded">Paid</button></td>
                `;
                list.appendChild(tr);
            }
        }
    });
}

window.deleteTask = async (id) => {
    if(confirm("Admin: Permanently delete this link?")) { 
        await remove(ref(db, `tasks/${id}`)); 
        alert("Link Removed"); 
    }
};

window.approveWD = async (id) => {
    await update(ref(db, `withdrawals/${id}`), { status: 'paid' });
    alert("Marked as Paid");
};

window.adminPostTask = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    const rew = document.getElementById('adm-reward').value || 0.021;
    if(!url || !def) return alert("URL and Definition required");
    await push(ref(db, 'tasks'), { url, definition: def, reward: rew, owner: 'admin' });
    alert("Global Task Created!");
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
        alert("Referral Code Linked!");
    } else { alert("Invalid Code"); }
};
