
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

/* ================= APP SETTINGS ================= */
const username = window.Telegram?.WebApp?.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random()*9999);
const refLink = new URLSearchParams(window.location.search).get('ref');

const TASK_TYPES = {
    ads: { reward: 0.02, cd: 5*60*1000, count: 3, label: "Task", zone: 10337853 },
    signin: { reward: 0.025, cd: 3*60*60*1000, count: 3, label: "Sign-In", zone: 10276123 },
    gift: { reward: 0.02, cd: 20*60*1000, count: 3, label: "Gift", zone: 10337795, pop: true },
    bonus: { reward: 0.015, cd: 10*60*1000, count: 5, label: "Bonus", random: true }
};

let userData = { balance: 0, cooldowns: {}, referredBy: null };

/* ================= CORE LOGIC ================= */
async function startApp() {
    document.getElementById('userLabel').innerText = `👤 User: @${username}`;
    
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        userData.referredBy = (refLink && refLink !== username) ? refLink : null;
        await setDoc(userRef, userData);
    }

    // Real-time Balance & Global Stats Sync
    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('mainBalance').innerText = userData.balance.toFixed(3);
    });

    onSnapshot(doc(db, "stats", "global"), (s) => {
        if(s.exists()) document.getElementById('globalWithdrawn').innerText = s.data().total.toFixed(2);
    });

    renderAllSections();
    startTimer();
}

function renderAllSections() {
    Object.keys(TASK_TYPES).forEach(type => {
        const conf = TASK_TYPES[type];
        const container = document.getElementById(`cont-${type}`);
        container.innerHTML = "";
        for (let i = 0; i < conf.count; i++) {
            const taskId = `${type}_${i}`;
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <button class="btn-task" id="btn-${taskId}" onclick="watchTaskAd('${type}', '${taskId}')">🤑🍍${conf.label} #${i+1}🍍🤑</button>
                <div id="claim-${taskId}" class="hidden">
                    <button class="btn-main" onclick="claimTaskReward('${type}', '${taskId}')">Claim Reward</button>
                </div>
                <div id="timer-${taskId}" class="cooldown"></div>
            `;
            container.appendChild(card);
        }
    });
}

window.watchTaskAd = (type, taskId) => {
    const conf = TASK_TYPES[type];
    // Randomize zone for bonus buttons
    const zones = [10276123, 10337795, 10337853];
    const targetZone = conf.random ? zones[Math.floor(Math.random()*zones.length)] : conf.zone;
    const adFunc = window[`show_${targetZone}`];

    if (adFunc) {
        adFunc(conf.pop ? 'pop' : undefined).then(() => {
            document.getElementById(`btn-${taskId}`).classList.add('hidden');
            document.getElementById(`claim-${taskId}`).classList.remove('hidden');
        });
    }
};

window.claimTaskReward = async (type, taskId) => {
    const conf = TASK_TYPES[type];
    const userRef = doc(db, "users", username);
    
    await updateDoc(userRef, {
        balance: increment(conf.reward),
        [`cooldowns.${taskId}`]: Date.now() + conf.cd
    });

    // Referral Bonus (10%)
    if (userData.referredBy) {
        await updateDoc(doc(db, "users", userData.referredBy), { balance: increment(conf.reward * 0.1) }).catch(()=>{});
    }

    alert("🎉Congratulations🎉 you earned money!!😍🍍🎉");
    document.getElementById(`claim-${taskId}`).classList.add('hidden');
    document.getElementById(`btn-${taskId}`).classList.remove('hidden');
};

/* ================= WITHDRAWAL LIVE SYNC ================= */
window.handleWithdrawal = async () => {
    const amount = userData.balance;
    const method = document.getElementById('payMethod').value;
    const info = document.getElementById('payInfo').value;

    if (amount < 0.01 || !info) return alert("Invalid details");

    // Add to collection (Instantly synced to Admin)
    await addDoc(collection(db, "withdrawals"), {
        user: username,
        amount: amount,
        method: method,
        info: info,
        status: "Pending",
        timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    // Global stats update
    await updateDoc(doc(db, "stats", "global"), { total: increment(amount) });

    alert("Request Sent! Stay on this page to see real-time updates.");
    navTo('page-withdraw');
};

// User History Listener
onSnapshot(query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc")), (snap) => {
    const body = document.getElementById('userHistBody');
    body.innerHTML = snap.docs.map(d => {
        const r = d.data();
        return `<tr><td>${r.method}</td><td>₱${r.amount.toFixed(2)}</td><td class="status-${r.status}">${r.status}</td></tr>`;
    }).join('');
});

/* ================= OWNER DASHBOARD LIVE SYNC ================= */
window.openAdmin = () => {
    if(prompt("Admin Password:") === "Propetas6") {
        navTo('page-admin');
        syncAdminTable();
    }
};

function syncAdminTable() {
    // Listen for ALL pending withdrawals
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("timestamp", "desc")), (snap) => {
        const body = document.getElementById('adminBody');
        body.innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr>
                <td>${r.user}</td>
                <td>₱${r.amount.toFixed(2)}</td>
                <td>${r.method}: ${r.info}</td>
                <td>
                    <button style="background:green; padding:5px; width:40px" onclick="modReq('${d.id}', 'Paid')">OK</button>
                    <button style="background:red; padding:5px; width:40px" onclick="modReq('${d.id}', 'Denied')">X</button>
                </td>
            </tr>`;
        }).join('');
    });
}

window.modReq = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status: status });
};

/* ================= UTILS ================= */
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

function startTimer() {
    setInterval(() => {
        const now = Date.now();
        Object.keys(TASK_TYPES).forEach(type => {
            for (let i = 0; i < TASK_TYPES[type].count; i++) {
                const taskId = `${type}_${i}`;
                const target = userData.cooldowns?.[taskId] || 0;
                const btn = document.getElementById(`btn-${taskId}`);
                const timer = document.getElementById(`timer-${taskId}`);
                if (btn && now < target) {
                    btn.disabled = true;
                    btn.style.opacity = "0.5";
                    const diff = target - now;
                    const m = Math.floor(diff/60000);
                    const s = Math.floor((diff%60000)/1000);
                    timer.innerText = `Ready in: ${m}m ${s}s`;
                } else if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = "1";
                    timer.innerText = "";
                }
            }
        });
    }, 1000);
}

startApp();
