
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, orderBy, limit, increment, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= TELEGRAM CONFIG ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*9999);
const referralCode = tg?.initDataUnsafe?.start_param || null;

document.getElementById('userBar').innerText = `👤 ${username}`;

let userData = { balance: 0, weekly: 0, refPending: 0, refTotal: 0, invites: 0, cooldowns: {} };
let p = { leader: 1, userHist: 1, admin: 1 };
const LIMIT = 10;

const TASKS = {
    signin: { reward: 0.025, cd: 10800000, count: 3, zone: 10276123, label: 'Sign In' },
    ads: { reward: 0.02, cd: 300000, count: 3, zone: 10337853, label: 'Task' },
    gift: { reward: 0.02, cd: 7200000, count: 3, zone: 10337795, label: 'Gift', pop: true },
    bonus: { reward: 0.015, cd: 600000, count: 5, zone: 0, label: 'Bonus', random: true }
};

/* ================= INITIALIZATION ================= */
async function start() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, { 
            balance: 0, weekly: 0, refPending: 0, refTotal: 0, invites: 0, 
            cooldowns: {}, referredBy: referralCode 
        });
        if(referralCode) {
            await updateDoc(doc(db, "users", referralCode), { invites: increment(1) }).catch(()=>{});
        }
    }

    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
        document.getElementById('refInvites').innerText = userData.invites || 0;
        document.getElementById('refEarned').innerText = `₱${(userData.refPending || 0).toFixed(3)}`;
    });

    onSnapshot(doc(db, "stats", "global"), (s) => {
        if(s.exists()) document.getElementById('globalTotal').innerText = s.data().total.toFixed(2);
    });

    document.getElementById('refLink').value = `http://t.me/Key_52_bot/app?startapp=${username.replace('@','')}`;

    initTasks();
    syncChat();
    setInterval(tick, 1000);
}

/* ================= CORE LOGIC ================= */
function initTasks() {
    Object.keys(TASKS).forEach(key => {
        const conf = TASKS[key];
        const cont = document.getElementById(`cont-${key}`);
        cont.innerHTML = `<h3>🍍 ${conf.label.toUpperCase()} AREA</h3>`;
        for (let i = 0; i < conf.count; i++) {
            const id = `${key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="btn-task" id="btn-${id}" onclick="runTask('${key}','${id}')">🤑 ${conf.label} #${i+1} 🤑</button>
                    <div id="timer-${id}" class="cooldown"></div>
                </div>`;
        }
    });
}

window.runTask = (key, id) => {
    const conf = TASKS[key];
    const zones = [10276123, 10337795, 10337853];
    const zone = conf.random ? zones[Math.floor(Math.random()*3)] : conf.zone;
    
    window[`show_${zone}`](conf.pop ? 'pop' : undefined).then(async () => {
        const reward = conf.reward;
        await updateDoc(doc(db, "users", username), {
            balance: increment(reward),
            weekly: increment(reward),
            [`cooldowns.${id}`]: Date.now() + conf.cd
        });
        if(userData.referredBy) {
            await updateDoc(doc(db, "users", userData.referredBy), { 
                refPending: increment(reward * 0.1),
                refTotal: increment(reward * 0.1)
            }).catch(()=>{});
        }
        alert("🎉 Reward Added!");
    });
};

/* ================= WITHDRAWALS ================= */
window.withdraw = async (method) => {
    if(userData.balance < 1) return alert("Min. withdrawal ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if(!info) return alert("Enter account details");

    let displayAmt = `₱${userData.balance.toFixed(2)}`;
    if(method === 'FaucetPay') {
        displayAmt = `${(userData.balance / 56.5).toFixed(4)} USDT`;
    }

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: userData.balance, info: info, method: method,
        converted: displayAmt, status: "Pending", timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(userData.balance) });
    alert("Sent for approval!");
};

/* ================= CHAT ================= */
function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15));
    onSnapshot(q, (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).reverse().join('');
        box.scrollTop = box.scrollHeight;
    });
}
window.sendMessage = async () => {
    const i = document.getElementById('chatInput');
    if(!i.value.trim()) return;
    await addDoc(collection(db, "messages"), { user: username, text: i.value, timestamp: serverTimestamp() });
    i.value = "";
};

/* ================= ADMIN ================= */
window.openAdmin = () => {
    if(prompt("Admin Access:") === "Propetas6") { navTo('page-admin'); fetchAdmin(); }
};
function fetchAdmin() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
        const sliced = list.slice((p.admin-1)*LIMIT, p.admin*LIMIT);
        document.getElementById('adminBody').innerHTML = sliced.map(r => `
            <tr>
                <td>${r.user}</td><td>${r.method}: ${r.info}</td><td>${r.converted}</td>
                <td>
                    ${r.status === 'Pending' ? `
                        <button onclick="updWithdraw('${r.id}','Paid')" style="background:green">✓</button>
                        <button onclick="updWithdraw('${r.id}','Denied')" style="background:red">X</button>
                    ` : r.status}
                </td>
            </tr>
        `).join('');
    });
}
window.updWithdraw = async (id, s) => { await updateDoc(doc(db, "withdrawals", id), { status: s }); };

/* ================= HELPERS ================= */
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(d => d.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-leader') fetchLeader();
    if(id === 'page-withdraw') fetchHistory();
};

function fetchLeader() {
    const q = query(collection(db, "users"), orderBy("weekly", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({id: d.id, val: d.data().weekly}));
        const sliced = list.slice((p.leader-1)*LIMIT, p.leader*LIMIT);
        document.getElementById('leaderBody').innerHTML = sliced.map((r, i) => `
            <tr><td>#${(p.leader-1)*LIMIT + i + 1}</td><td>${r.id}</td><td>₱${r.val.toFixed(2)}</td></tr>
        `).join('');
    });
}

function fetchHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => d.data());
        const sliced = list.slice((p.userHist-1)*LIMIT, p.userHist*LIMIT);
        document.getElementById('userHistBody').innerHTML = sliced.map(r => `
            <tr><td>${r.method}: ${r.info}</td><td>${r.converted}</td><td class="status-${r.status}">${r.status}</td></tr>
        `).join('');
    });
}

window.changePage = (key, dir) => {
    p[key] = Math.max(1, p[key] + dir);
    document.getElementById(key + 'Page').innerText = p[key];
    if(key === 'leader') fetchLeader();
    if(key === 'userHist') fetchHistory();
    if(key === 'admin') fetchAdmin();
};

function tick() {
    const now = new Date();
    document.getElementById('footerClock').innerText = now.toLocaleTimeString() + " | " + now.toDateString();
    Object.keys(userData.cooldowns || {}).forEach(id => {
        const target = userData.cooldowns[id], btn = document.getElementById(`btn-${id}`), timer = document.getElementById(`timer-${id}`);
        if(!btn) return;
        if(Date.now() < target) {
            btn.disabled = true; btn.style.opacity = 0.5;
            const d = target - Date.now();
            timer.innerText = `Ready in: ${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;
        } else { btn.disabled = false; btn.style.opacity = 1; timer.innerText = ""; }
    });
}

start();
