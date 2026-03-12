
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

const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "User";
document.getElementById('tg-username').innerText = "@" + username;

let uData = { balance: 0, refCode: userId, invites: 0, refEarned: 0, referredBy: "", adsDay: 0, lastDayReset: Date.now() };
const uRef = ref(db, 'users/' + userId);

const quotes = [
    "Safety first, speed second. Someone loves you at home.",
    "Consistency is the bridge between goals and accomplishment.",
    "Road safety is no accident; it is a choice you make daily.",
    "The way you drive says a lot about the way you respect life.",
    "Small micro-earnings today lead to huge financial freedom tomorrow.",
    "Focus on the road, your phone can wait. Your life can't.",
    "Always wear your seatbelt. It is life's most important click.",
    "Don't drink and drive. The road is shared by everyone."
];
for(let i=9; i<=250; i++) quotes.push(`Apex Safety Tip #${i}: Maintain a safe distance and check your mirrors frequently.`);

let currentTaskTab = 'fb';

// --- Ad Engine (Wrapper for everything) ---
async function runAdChain() {
    try {
        const ad1 = window.Adsgram.init({ blockId: '21470' });
        const res = await ad1.show();
        if(res.done) {
            if(window.show_10555663) await window.show_10555663();
            if(window.show_10555746) await window.show_10555746();
            return true;
        }
    } catch(e) { console.error(e); }
    return false;
}

window.fireAdChain = async (type, tData = null) => {
    if(type === 'bundle') {
        const btn = document.getElementById('adBtn');
        btn.classList.add('btn-disabled');
        if(await runAdChain()) {
            rewardUser(0.024);
            uData.adsDay++;
            update(uRef, { adsDay: uData.adsDay });
            startCooldown(120);
        } else { btn.classList.remove('btn-disabled'); }
    } else {
        // Task Chain
        if(await runAdChain()) {
            startTaskUI(tData);
        }
    }
};

function rewardUser(amt) {
    uData.balance += amt;
    update(uRef, { balance: uData.balance });
    if(uData.referredBy) {
        const rRef = ref(db, 'users/' + uData.referredBy);
        runTransaction(rRef, (p) => {
            if(p) { p.balance = (p.balance || 0) + (amt * 0.12); p.refEarned = (p.refEarned || 0) + (amt * 0.12); }
            return p;
        });
    }
    showRewardPopup();
}

// --- Task Engine ---
window.switchTaskTab = (t) => {
    currentTaskTab = t;
    document.getElementById('tab-fb').className = t === 'fb' ? 'flex-1 p-4 rounded-2xl bg-blue-600 font-black text-[10px] uppercase' : 'flex-1 p-4 rounded-2xl glass font-black text-[10px] uppercase';
    document.getElementById('tab-web').className = t === 'web' ? 'flex-1 p-4 rounded-2xl bg-blue-600 font-black text-[10px] uppercase' : 'flex-1 p-4 rounded-2xl glass font-black text-[10px] uppercase';
    loadTasks();
};

async function loadTasks() {
    const snaps = await get(ref(db, 'tasks'));
    const userDone = (await get(ref(db, `userTasks/${userId}`))).val() || {};
    const list = document.getElementById('task-list'); list.innerHTML = "";

    snaps.forEach(s => {
        const t = s.val();
        const tid = s.key;
        const lastDone = userDone[tid] || 0;
        const diff = Date.now() - lastDone;
        const limit = t.admin ? 7200000 : 86400000; // Admin: 2h, User: 24h

        if(t.type === currentTaskTab && t.capacity > 0 && diff > limit) {
            list.innerHTML += `<div class="glass p-5 rounded-3xl border-l-4 border-yellow-400">
                <div class="flex justify-between mb-2"><span class="text-[9px] font-black uppercase text-slate-500">${t.admin ? 'Global Task' : 'Community'}</span><span class="text-green-400 font-black">₱0.025</span></div>
                <p class="text-sm font-bold mb-4">${t.desc}</p>
                <button onclick="handleTaskStart('${tid}')" class="w-full bg-white/5 p-3 rounded-xl text-[10px] font-black">START TASK</button>
            </div>`;
        }
    });
}

window.handleTaskStart = async (tid) => {
    const s = await get(ref(db, `tasks/${tid}`));
    fireAdChain('task', { ...s.val(), id: tid });
};

function startTaskUI(t) {
    if(t.type === 'fb') {
        window.open(t.link, '_blank');
        const overlay = document.createElement('div');
        overlay.className = "fixed inset-0 z-[11000] glass flex flex-col items-center justify-center p-10 text-center";
        overlay.innerHTML = `<h2 class="text-xl font-black mb-4 uppercase">Verifying...</h2><p class="text-xs text-slate-400 mb-6 font-bold uppercase">Like/Follow & Return in <span id="fb-tm">12</span>s</p>
                             <button id="fb-cl" class="btn-disabled bg-white text-black p-5 rounded-2xl font-black w-full">CLAIM ₱0.025</button>`;
        document.body.appendChild(overlay);
        let s = 12;
        const itv = setInterval(() => {
            s--; document.getElementById('fb-tm').innerText = s;
            if(s <= 0) { clearInterval(itv); document.getElementById('fb-cl').classList.remove('btn-disabled'); document.getElementById('fb-cl').onclick = () => { finishTask(t.id); overlay.remove(); }; }
        }, 1000);
    } else {
        document.getElementById('task-iframe').src = t.link;
        document.getElementById('web-view').style.display = 'block';
        let s = 12;
        const itv = setInterval(() => {
            s--; document.getElementById('web-timer').innerText = s;
            if(s <= 0) { clearInterval(itv); finishTask(t.id); closeWebCard(); }
        }, 1000);
    }
}

async function finishTask(tid) {
    const tRef = ref(db, `tasks/${tid}`);
    const res = await runTransaction(tRef, (t) => { if(t && t.capacity > 0) { t.capacity--; return t; } return; });
    if(res.committed) {
        rewardUser(0.025);
        update(ref(db, `userTasks/${userId}`), { [tid]: Date.now() });
        loadTasks();
    }
}

// --- Admin ---
window.checkAdmin = () => { if(document.getElementById('admin-pass').value === "Propetas12") { document.getElementById('admin-login').classList.add('hidden'); document.getElementById('admin-content').classList.remove('hidden'); syncAdmin(); } };

window.createAdminTask = async () => {
    const link = document.getElementById('adm-link').value;
    const desc = document.getElementById('adm-desc').value;
    const type = document.getElementById('adm-type').value;
    if(!link.startsWith('http')) return alert("Invalid link");
    const tid = push(ref(db, 'tasks')).key;
    await set(ref(db, `tasks/${tid}`), { link, desc, type, capacity: 100000, admin: true, ts: Date.now() });
    alert("Global Task Live (Free 100K Cap)");
};

function syncAdmin() {
    onValue(ref(db, 'withdrawals'), s => {
        const list = document.getElementById('admin-list'); list.innerHTML = "";
        s.forEach(w => {
            const d = w.val();
            if(d.status === 'pending') list.innerHTML += `<div class="glass p-4 text-[10px] flex justify-between items-center rounded-2xl"><div>${d.method}: ${d.acc} | ₱${d.amt}</div><button onclick="approveW('${w.key}')" class="bg-green-600 px-4 py-2 rounded-lg font-black">APPROVE</button></div>`;
        });
    });
}
window.approveW = (k) => update(ref(db, 'withdrawals/' + k), { status: 'paid' });

// --- Purchases ---
window.buyTask = async () => {
    if(uData.balance < 2) return alert("Min ₱2.00");
    const link = document.getElementById('task-link').value;
    const desc = document.getElementById('task-desc').value;
    const type = document.getElementById('task-type-input').value;
    const tid = push(ref(db, 'tasks')).key;
    await set(ref(db, `tasks/${tid}`), { link, desc, type, capacity: 100, uid: userId, admin: false, ts: Date.now() });
    uData.balance -= 2; update(uRef, { balance: uData.balance });
    alert("Task Promoted!"); closePop('task-modal');
};

// --- Core Sync ---
onValue(uRef, s => {
    if(s.exists()) {
        uData = {...uData, ...s.val()};
        document.getElementById('balance').innerText = uData.balance.toFixed(4);
        document.getElementById('myCode').innerText = uData.refCode;
        document.getElementById('totalInvites').innerText = uData.invites || 0;
        document.getElementById('totalRefEarned').innerText = "₱" + (uData.refEarned || 0).toFixed(4);
    } else set(uRef, uData);
});

onValue(query(ref(db, 'withdrawals'), orderByChild('uid'), equalTo(userId)), s => {
    const h = document.getElementById('user-wd-history'); h.innerHTML = "";
    s.forEach(w => { const d = w.val(); h.innerHTML += `<div class="glass p-4 rounded-xl flex justify-between text-[10px]"><span>₱${d.amt.toFixed(2)} (${d.method})</span><span class="font-black ${d.status==='paid'?'text-green-400':'text-yellow-500'}">${d.status.toUpperCase()}</span></div>`; });
});

// --- Chat ---
window.sendMsg = () => {
    const t = document.getElementById('chatInput').value;
    if(t.trim()) push(ref(db, 'chat'), { u: username, t: t.trim(), ts: Date.now() });
    document.getElementById('chatInput').value = "";
};
onValue(query(ref(db, 'chat'), limitToLast(20)), s => {
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    s.forEach(c => { const m = c.val(); box.innerHTML += `<div><span class="text-yellow-400 font-bold">@${m.u}:</span> ${m.t}</div>`; });
    box.scrollTop = box.scrollHeight;
});

// --- UI / Nav ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('nav-active');
    if(id === 'tasks') loadTasks();
};

window.requestWithdraw = () => {
    const acc = document.getElementById('wd-acc').value;
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const m = document.getElementById('wd-method').value;
    if(amt >= 1 && uData.balance >= amt) {
        const wid = push(ref(db, 'withdrawals')).key;
        set(ref(db, 'withdrawals/'+wid), { uid: userId, u: username, method: m, acc, amt, status: 'pending', ts: Date.now() });
        update(uRef, { balance: uData.balance - amt });
        alert("Requested!");
    }
};

window.applyRef = async () => {
    const code = document.getElementById('inputCode').value.toUpperCase();
    if(uData.referredBy || code === userId) return;
    const snaps = await get(ref(db, 'users'));
    let target = null; snaps.forEach(s => { if(s.val().refCode === code) target = s.key; });
    if(target) {
        const res = await runTransaction(ref(db, 'users/'+target), (p) => { if(p && (p.invites||0) < 12) { p.invites = (p.invites||0)+1; return p; } return; });
        if(res.committed) { update(uRef, { referredBy: target }); alert("Linked!"); }
    }
};

window.startCooldown = (s) => {
    const btn = document.getElementById('adBtn');
    const timerText = document.getElementById('timer-text');
    const itv = setInterval(() => {
        s--; timerText.innerText = `RECHARGE: ${s}S`;
        if(s <= 0) { clearInterval(itv); btn.classList.remove('btn-disabled'); timerText.innerText = ""; }
    }, 1000);
};

window.showRewardPopup = () => { document.getElementById('quote-text').innerText = quotes[Math.floor(Math.random()*quotes.length)]; document.getElementById('quote-popup').style.display = 'flex'; };
window.closePop = (id) => document.getElementById(id).style.display = 'none';
window.showTaskForm = () => document.getElementById('task-modal').style.display = 'flex';
window.closeWebCard = () => { document.getElementById('web-view').style.display = 'none'; document.getElementById('task-iframe').src = ""; };

setInterval(() => { if(window.show_10555663) window.show_10555663({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } }); }, 180000);
