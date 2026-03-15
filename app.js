
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

    onValue(ref(db, 'withdrawals'), snap => {
        const list = document.getElementById('admin-wd-list');
        list.innerHTML = "<h3 class='font-black mb-2 text-sm'>Requests</h3>";
        const d = snap.val();
        for(let id in d) {
            if(d[id].status === 'pending') {
                const item = document.createElement('div');
                item.className = "flex justify-between text-[10px] p-2 border-b";
                item.innerHTML = `<span>${d[id].user}: ₱${d[id].amount}</span><button onclick="approveWD('${id}')" class="bg-green-600 text-white px-2 rounded">Paid</button>`;
                list.appendChild(item);
            }
        }
    });
}

window.deleteTask = async (id) => {
    if(confirm("Confirm Delete?")) { await remove(ref(db, `tasks/${id}`)); alert("Removed"); }
};

window.approveWD = async (id) => {
    await update(ref(db, `withdrawals/${id}`), { status: 'paid' });
    alert("Paid");
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
