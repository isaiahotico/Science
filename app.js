
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

/* ================= CONFIG ================= */
const TASK_CONFIG = {
    'ads': { label: 'Task', reward: 0.02, cd: 5 * 60 * 1000, zones: [10276123, 10337795, 10337853], autoZone: 10337853 },
    'signin': { label: 'Task', reward: 0.025, cd: 3 * 60 * 60 * 1000, zones: [10276123, 10337795, 10337853], autoZone: 10276123 },
    'gift': { label: 'Gift', reward: 0.02, cd: 20 * 60 * 1000, zones: [10276123, 10337795, 10337853], autoZone: 10337795, isPop: true }
};

const tg = window.Telegram?.WebApp;
tg?.ready();
const username = tg?.initDataUnsafe?.user ? `@${tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name}` : "Guest_User";
const referrer = new URLSearchParams(window.location.search).get('ref');

let currentUserData = {};

/* ================= INITIALIZATION ================= */
async function init() {
    document.getElementById('userDisplay').innerText = `👤 ${username}`;
    
    // 1. Sync User Data
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        currentUserData = { balance: 0, cooldowns: {}, referredBy: (referrer && referrer !== username) ? referrer : null };
        await setDoc(userRef, currentUserData);
    } else {
        currentUserData = userSnap.data();
    }

    // 2. Real-time Listeners
    onSnapshot(userRef, (snap) => {
        currentUserData = snap.data();
        document.getElementById('balance').innerText = currentUserData.balance.toFixed(3);
    });

    onSnapshot(doc(db, "stats", "global"), (snap) => {
        if(snap.exists()) document.getElementById('globalWithdrawn').innerText = snap.data().total.toFixed(2);
    });

    // 3. Render Task Areas
    renderTasks('ads');
    renderTasks('signin');
    renderTasks('gift');
    
    startTimerLoop();
}

/* ================= NAVIGATION & AUTO ADS ================= */
window.navTo = (pageId) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');

    const configKey = pageId.split('-')[1];
    if(TASK_CONFIG[configKey]) {
        const zone = TASK_CONFIG[configKey].autoZone;
        if(window[`show_${zone}`]) {
            window[`show_${zone}`]({
                type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
            });
        }
    }
    if(pageId === 'page-withdraw') fetchUserHistory();
};

/* ================= TASK ENGINE ================= */
function renderTasks(type) {
    const config = TASK_CONFIG[type];
    const container = document.getElementById(`container-${type}`);
    container.innerHTML = `<h3>🍍 ${type.toUpperCase()}</h3>`;

    config.zones.forEach((zone, idx) => {
        const taskId = `${type}_${idx}`;
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <button class="btn-task" id="btn-${taskId}" onclick="watchAd('${type}', ${idx}, ${zone})">🤑🍍${config.label} #${idx+1}🍍🤑</button>
            <div id="claim-${taskId}" class="hidden">
                <button class="btn-claim" onclick="claimReward('${type}', ${idx})">Claim Reward</button>
            </div>
            <div id="cd-${taskId}" class="cooldown"></div>
        `;
        container.appendChild(div);
    });
}

window.watchAd = (type, idx, zone) => {
    const taskId = `${type}_${idx}`;
    const adFunc = window[`show_${zone}`];
    const adType = TASK_CONFIG[type].isPop ? 'pop' : undefined;

    if (adFunc) {
        adFunc(adType).then(() => {
            alert('Ad Completed!');
            document.getElementById(`btn-${taskId}`).classList.add('hidden');
            document.getElementById(`claim-${taskId}`).classList.remove('hidden');
        }).catch(e => alert('Ad Error or Closed early.'));
    }
};

window.claimReward = async (type, idx) => {
    const config = TASK_CONFIG[type];
    const taskId = `${type}_${idx}`;
    const reward = config.reward;

    const userRef = doc(db, "users", username);
    await updateDoc(userRef, {
        balance: increment(reward),
        [`cooldowns.${taskId}`]: Date.now() + config.cd
    });

    // Referral Commission (10%)
    if(currentUserData.referredBy) {
        const refRef = doc(db, "users", currentUserData.referredBy);
        await updateDoc(refRef, { balance: increment(reward * 0.10) }).catch(()=>{});
    }

    alert("🎉Congratulations🎉 you earned money!!😍🍍🎉");
    document.getElementById(`claim-${taskId}`).classList.add('hidden');
    document.getElementById(`btn-${taskId}`).classList.remove('hidden');
};

function startTimerLoop() {
    setInterval(() => {
        const now = Date.now();
        Object.keys(TASK_CONFIG).forEach(type => {
            TASK_CONFIG[type].zones.forEach((_, idx) => {
                const taskId = `${type}_${idx}`;
                const cdTime = currentUserData.cooldowns?.[taskId] || 0;
                const btn = document.getElementById(`btn-${taskId}`);
                const cdDiv = document.getElementById(`cd-${taskId}`);
                
                if(now < cdTime) {
                    const diff = cdTime - now;
                    const h = Math.floor(diff/3600000);
                    const m = Math.floor((diff%3600000)/60000);
                    const s = Math.floor((diff%60000)/1000);
                    if(btn) btn.disabled = true;
                    if(cdDiv) cdDiv.innerText = `Wait: ${h}h ${m}m ${s}s`;
                } else {
                    if(btn) btn.disabled = false;
                    if(cdDiv) cdDiv.innerText = "";
                }
            });
        });
    }, 1000);
}

/* ================= WITHDRAWAL & ADMIN ================= */
window.requestWithdraw = async (method) => {
    const amount = currentUserData.balance;
    const info = method === 'GCash' ? document.getElementById('gcashNum').value : document.getElementById('fpayEmail').value;

    if(amount < 0.01) return alert("Min ₱0.01");
    if(!info) return alert("Enter details");

    await addDoc(collection(db, "withdrawals"), {
        user: username,
        amount: amount,
        method: method,
        info: info,
        status: 'Pending',
        timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(amount) });
    
    alert("Requested! Wait for admin approval.");
    fetchUserHistory();
};

async function fetchUserHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        const body = document.getElementById('userHistBody');
        body.innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td>${new Date(r.timestamp).toLocaleDateString()}</td><td>${r.method}</td><td>₱${r.amount.toFixed(2)}</td><td class="status-${r.status}">${r.status}</td></tr>`;
        }).join('');
    });
}

window.openAdmin = () => {
    if(prompt("Password:") === "Propetas6") {
        navTo('page-admin');
        fetchAdminData();
    }
};

function fetchAdminData() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(20));
    onSnapshot(q, (snap) => {
        const body = document.getElementById('adminBody');
        body.innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td>${r.user}</td><td>₱${r.amount.toFixed(2)}</td><td>${r.method}: ${r.info}</td>
            <td>
                ${r.status === 'Pending' ? `
                    <button onclick="updateReq('${d.id}', 'Paid')" style="background:green;padding:5px">Pay</button>
                    <button onclick="updateReq('${d.id}', 'Denied')" style="background:red;padding:5px">X</button>
                ` : r.status}
            </td></tr>`;
        }).join('');
    });
}

window.updateReq = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status: status });
};

init();
