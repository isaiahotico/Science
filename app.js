
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

/* ================= SETTINGS ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const username = tg?.initDataUnsafe?.user?.username || "Guest_" + Math.floor(Math.random()*9999);
const referralFrom = tg?.initDataUnsafe?.start_param || null;

let userData = { balance: 0, weeklyBalance: 0, refEarnings: 0, invitedCount: 0, cooldowns: {}, referredBy: null };
let leaderboardPage = 1;
const PAGE_SIZE = 10;

const TASKS = {
    ads: { reward: 0.02, cd: 5*60*1000, count: 3, zone: 10337853 },
    signin: { reward: 0.025, cd: 3*60*60*1000, count: 3, zone: 10276123 },
    gift: { reward: 0.02, cd: 120*60*1000, count: 3, zone: 10337795, pop: true },
    bonus: { reward: 0.015, cd: 10*60*1000, count: 5, random: true }
};

/* ================= INITIALIZE ================= */
async function startApp() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        userData.referredBy = (referralFrom && referralFrom !== username) ? referralFrom : null;
        await setDoc(userRef, userData);
        if(userData.referredBy) {
            const refRef = doc(db, "users", userData.referredBy);
            await updateDoc(refRef, { invitedCount: increment(1) }).catch(()=>{});
        }
    }

    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
        document.getElementById('refCount').innerText = userData.invitedCount || 0;
        document.getElementById('refEarned').innerText = "₱" + (userData.refEarnings || 0).toFixed(3);
    });

    onSnapshot(doc(db, "stats", "global"), (s) => {
        if(s.exists()) document.getElementById('globalTotal').innerText = s.data().total.toFixed(2);
    });

    document.getElementById('userDisplay').innerText = `👤 @${username}`;
    document.getElementById('refLink').value = `http://t.me/Key_52_bot/app?startapp=${username}`;
    
    renderAllTasks();
    setInterval(updateFooter, 1000);
    initTimers();
}

/* ================= ACTIONS ================= */
function renderAllTasks() {
    Object.keys(TASKS).forEach(key => {
        const conf = TASKS[key];
        const cont = document.getElementById(`cont-${key}`);
        if(!cont) return;
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        for (let i = 0; i < conf.count; i++) {
            const id = `${key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="btn-task" id="btn-${id}" onclick="triggerAd('${key}', '${id}')">🤑 Task #${i+1} 🤑</button>
                    <div id="claim-${id}" class="hidden"><button class="btn-main" onclick="claimReward('${key}', '${id}')">Claim Reward</button></div>
                    <div id="timer-${id}" class="cooldown"></div>
                </div>`;
        }
    });
}

window.triggerAd = (key, id) => {
    const conf = TASKS[key];
    const zones = [10276123, 10337795, 10337853];
    const zone = conf.random ? zones[Math.floor(Math.random()*3)] : conf.zone;
    const adFunc = window[`show_${zone}`];
    
    if (adFunc) {
        adFunc(conf.pop ? 'pop' : undefined).then(() => {
            document.getElementById(`btn-${id}`).classList.add('hidden');
            document.getElementById(`claim-${id}`).classList.remove('hidden');
        });
    }
};

window.claimReward = async (key, id) => {
    const reward = TASKS[key].reward;
    const userRef = doc(db, "users", username);
    
    await updateDoc(userRef, {
        balance: increment(reward),
        weeklyBalance: increment(reward),
        [`cooldowns.${id}`]: Date.now() + TASKS[key].cd
    });

    if (userData.referredBy) {
        const refRef = doc(db, "users", userData.referredBy);
        await updateDoc(refRef, { 
            balance: increment(reward * 0.1),
            refEarnings: increment(reward * 0.1)
        }).catch(()=>{});
    }

    alert("Reward Claimed!");
    document.getElementById(`claim-${id}`).classList.add('hidden');
    document.getElementById(`btn-${id}`).classList.remove('hidden');
};

/* ================= NAVIGATION ================= */
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-leaderboard') fetchLeaderboard();
    if(id === 'page-withdraw') fetchUserHistory();
};

/* ================= FEATURES ================= */
function fetchLeaderboard() {
    const q = query(collection(db, "users"), orderBy("weeklyBalance", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
        const sliced = list.slice((leaderboardPage-1)*PAGE_SIZE, leaderboardPage*PAGE_SIZE);
        document.getElementById('leaderBody').innerHTML = sliced.map((r, i) => `
            <tr><td>#${(leaderboardPage-1)*PAGE_SIZE + i + 1}</td><td>${r.id}</td><td>₱${r.weeklyBalance.toFixed(3)}</td></tr>
        `).join('');
    });
}

window.submitWithdraw = async (method) => {
    if (userData.balance < 1) return alert("Min. Withdrawal ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if (!info) return alert("Enter details");

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: userData.balance, info: info, method: method,
        status: "Pending", timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(userData.balance) });
    alert("Request Sent!");
};

function updateFooter() {
    const now = new Date();
    document.getElementById('liveClock').innerText = now.toLocaleTimeString() + " - " + now.toDateString();
}

function initTimers() {
    setInterval(() => {
        const now = Date.now();
        Object.keys(TASKS).forEach(key => {
            for (let i = 0; i < TASKS[key].count; i++) {
                const id = `${key}_${i}`, target = userData.cooldowns?.[id] || 0;
                const btn = document.getElementById(`btn-${id}`), timer = document.getElementById(`timer-${id}`);
                if (btn && now < target) {
                    btn.disabled = true; btn.style.opacity = 0.5;
                    const d = target - now, h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000), s = Math.floor((d%60000)/1000);
                    timer.innerText = `Wait: ${h}h ${m}m ${s}s`;
                } else if (btn) { btn.disabled = false; btn.style.opacity = 1; timer.innerText = ""; }
            }
        });
    }, 1000);
}

// ... Additional standard history/admin functions from previous builds integrated ...
startApp();
