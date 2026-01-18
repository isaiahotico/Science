
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, orderBy, where, limit, increment } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

/* ================= APP STATE ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const username = tg?.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random()*9999);
const referral = new URLSearchParams(window.location.search).get('ref');

let userData = { balance: 0, cooldowns: {}, referredBy: null };
let userPage = 1;
let adminPage = 1;
const PAGE_SIZE = 10;

const TASKS = {
    ads: { label: 'Task', reward: 0.02, cd: 5*60*1000, zones: [10337853], count: 3 },
    signin: { label: 'Task', reward: 0.025, cd: 3*60*60*1000, zones: [10276123], count: 3 },
    gift: { label: 'Gift', reward: 0.02, cd: 20*60*1000, zones: [10337795], count: 3, pop: true },
    bonus: { label: 'Bonus', reward: 0.015, cd: 10*60*1000, zones: [10276123, 10337795, 10337853], count: 5, random: true }
};

/* ================= CORE FUNCTIONS ================= */
async function start() {
    document.getElementById('userDisplay').innerText = `👤 User: @${username}`;
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        userData.referredBy = (referral && referral !== username) ? referral : null;
        await setDoc(userRef, userData);
    }

    // Real-time Listeners
    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
    });

    onSnapshot(doc(db, "stats", "global"), (s) => {
        if(s.exists()) document.getElementById('globalTotal').innerText = s.data().total.toFixed(2);
    });

    renderTasks();
    initTimers();
}

function renderTasks() {
    Object.keys(TASKS).forEach(key => {
        const conf = TASKS[key];
        const cont = document.getElementById(`cont-${key}`);
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        for (let i = 0; i < conf.count; i++) {
            const id = `${key}_${i}`;
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <button class="btn-task" id="btn-${id}" onclick="doTaskAd('${key}', '${id}')">🤑🍍${conf.label} #${i+1}🍍🤑</button>
                <div id="claim-${id}" class="hidden"><button class="btn-main" onclick="claimTask('${key}', '${id}')">Claim Reward</button></div>
                <div id="timer-${id}" class="cooldown"></div>
            `;
            cont.appendChild(div);
        }
    });
}

window.doTaskAd = (key, id) => {
    const conf = TASKS[key];
    const zone = conf.random ? conf.zones[Math.floor(Math.random()*conf.zones.length)] : conf.zones[0];
    const ad = window[`show_${zone}`];
    if (ad) {
        ad(conf.pop ? 'pop' : undefined).then(() => {
            document.getElementById(`btn-${id}`).classList.add('hidden');
            document.getElementById(`claim-${id}`).classList.remove('hidden');
        });
    }
};

window.claimTask = async (key, id) => {
    const reward = TASKS[key].reward;
    await updateDoc(doc(db, "users", username), {
        balance: increment(reward),
        [`cooldowns.${id}`]: Date.now() + TASKS[key].cd
    });

    if (userData.referredBy) {
        await updateDoc(doc(db, "users", userData.referredBy), { balance: increment(reward * 0.10) }).catch(()=>{});
    }

    alert("🎉Congratulations🎉 you earned money!!😍🍍🎉");
    document.getElementById(`claim-${id}`).classList.add('hidden');
    document.getElementById(`btn-${id}`).classList.remove('hidden');
};

/* ================= WITHDRAWAL SYSTEM ================= */
window.submitWithdraw = async (method) => {
    const info = document.getElementById('payoutInfo').value;
    const amt = userData.balance;
    if (amt < 0.01) return alert("Min. withdrawal ₱0.01");
    if (!info) return alert("Enter account details");

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: amt, info: info, method: method,
        status: "Pending", timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(amt) });

    alert("Success! Request synced to Dashboard for manual approval.");
    fetchHistory();
};

function fetchHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const fullList = snap.docs.map(d => d.data());
        const start = (userPage - 1) * PAGE_SIZE;
        const sliced = fullList.slice(start, start + PAGE_SIZE);
        
        document.getElementById('userHistBody').innerHTML = sliced.map(r => `
            <tr>
                <td>${new Date(r.timestamp).toLocaleDateString()}</td>
                <td>${r.method}</td>
                <td>₱${r.amount.toFixed(2)}</td>
                <td class="status-${r.status}">${r.status}</td>
            </tr>
        `).join('');
    });
}

/* ================= ADMIN SYSTEM ================= */
window.openAdmin = () => {
    if (prompt("Admin Password:") === "Propetas6") {
        navTo('page-admin');
        fetchAdminData();
    }
};

function fetchAdminData() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const fullList = snap.docs.map(d => ({id: d.id, ...d.data()}));
        const start = (adminPage - 1) * PAGE_SIZE;
        const sliced = fullList.slice(start, start + PAGE_SIZE);

        document.getElementById('adminBody').innerHTML = sliced.map(r => `
            <tr>
                <td>${r.user}</td>
                <td>₱${r.amount.toFixed(2)}</td>
                <td>${r.method}: ${r.info}</td>
                <td>
                    ${r.status === 'Pending' ? `
                        <button onclick="updateWithdraw('${r.id}','Paid')" style="background:green;padding:5px;width:35px">✓</button>
                        <button onclick="updateWithdraw('${r.id}','Denied')" style="background:red;padding:5px;width:35px">X</button>
                    ` : r.status}
                </td>
            </tr>
        `).join('');
    });
}

window.updateWithdraw = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status: status });
};

/* ================= UTILS ================= */
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'page-withdraw') fetchHistory();
};

window.changePage = (type, dir) => {
    if (type === 'user') {
        userPage = Math.max(1, userPage + dir);
        document.getElementById('userPageNum').innerText = userPage;
        fetchHistory();
    } else {
        adminPage = Math.max(1, adminPage + dir);
        document.getElementById('adminPageNum').innerText = adminPage;
        fetchAdminData();
    }
};

function initTimers() {
    setInterval(() => {
        const now = Date.now();
        Object.keys(TASKS).forEach(key => {
            for (let i = 0; i < TASKS[key].count; i++) {
                const id = `${key}_${i}`;
                const target = userData.cooldowns?.[id] || 0;
                const btn = document.getElementById(`btn-${id}`);
                const timer = document.getElementById(`timer-${id}`);
                if (btn && now < target) {
                    btn.disabled = true; btn.style.opacity = 0.5;
                    const diff = target - now;
                    const m = Math.floor(diff/60000); const s = Math.floor((diff%60000)/1000);
                    timer.innerText = `Wait: ${m}m ${s}s`;
                } else if (btn) {
                    btn.disabled = false; btn.style.opacity = 1; timer.innerText = "";
                }
            }
        });
    }, 1000);
}

start();
