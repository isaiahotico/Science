
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

/* ================= TG AUTH & SETUP ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
// FORCE REAL USERNAME
const username = tg?.initDataUnsafe?.user?.username;
if(!username) {
    document.body.innerHTML = "<h2 style='color:white;text-align:center;margin-top:50px;'>Please open this app from Telegram to access your account.</h2>";
}
const referralCode = tg?.initDataUnsafe?.start_param || null;

let userData = {};
const TASKS = {
    ads: { reward: 0.02, cd: 300000, count: 3, zone: 10337853 },
    signin: { reward: 0.025, cd: 10800000, count: 3, zone: 10276123 },
    gift: { reward: 0.02, cd: 7200000, count: 3, zone: 10337795, pop: true }
};

async function init() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, { 
            balance: 0, weeklyBalance: 0, refCount: 0, 
            cooldowns: {}, referredBy: referralCode 
        });
        if(referralCode) {
            await updateDoc(doc(db, "users", referralCode), { refCount: increment(1) }).catch(()=>{});
        }
    }

    // Real-time Listeners
    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
        document.getElementById('userDisplay').innerText = `👤 @${username}`;
        document.getElementById('refLink').value = `http://t.me/Key_52_bot/app?startapp=${username}`;
        document.getElementById('refCount').innerText = userData.refCount || 0;
    });

    onSnapshot(doc(db, "stats", "global"), (s) => {
        if(s.exists()) document.getElementById('globalTotal').innerText = s.data().total.toFixed(2);
    });

    renderTasks();
    syncChat();
    setInterval(updateClock, 1000);
}

/* ================= CHAT SYSTEM ================= */
function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        const chatBox = document.getElementById('chat-box');
        const msgs = snap.docs.map(d => d.data()).reverse();
        chatBox.innerHTML = msgs.map(m => `
            <div class="msg"><b>@${m.user}:</b> ${m.text}</div>
        `).join('');
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    if(!input.value.trim()) return;
    await addDoc(collection(db, "messages"), {
        user: username,
        text: input.value,
        timestamp: serverTimestamp()
    });
    input.value = "";
};

/* ================= WITHDRAWAL + AUTO USDT ================= */
window.handleWithdraw = async (method) => {
    const amt = userData.balance;
    const info = document.getElementById('payoutInfo').value;
    if(amt < 1) return alert("Min. withdrawal is ₱1.00");
    if(!info) return alert("Enter payment details");

    let displayAmt = `₱${amt.toFixed(2)}`;
    if(method === 'FaucetPay') {
        const usdt = amt / 56.5; // Approx conversion
        displayAmt = `${usdt.toFixed(4)} USDT`;
    }

    await addDoc(collection(db, "withdrawals"), {
        user: username,
        amount: amt,
        converted: displayAmt,
        method: method,
        info: info,
        status: "Pending",
        timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(amt) });
    alert(`Success! Withdrawal sent for manual approval as ${displayAmt}`);
};

function fetchUserHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        document.getElementById('userHistBody').innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td>${r.converted}</td><td>${r.info}</td><td class="status-${r.status}">${r.status}</td></tr>`;
        }).join('');
    });
}

/* ================= ADMIN APPROVAL ================= */
window.openAdmin = () => {
    if(prompt("Admin Password:") === "Propetas6") {
        navTo('page-admin');
        const q = query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snap) => {
            document.getElementById('adminBody').innerHTML = snap.docs.map(d => `
                <tr>
                    <td>${d.data().user}</td>
                    <td>${d.data().converted}</td>
                    <td>${d.data().method}: ${d.data().info}</td>
                    <td>
                        <button style="background:green;padding:5px" onclick="approvePaid('${d.id}')">Pay</button>
                    </td>
                </tr>
            `).join('');
        });
    }
};

window.approvePaid = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "Paid" });
};

/* ================= CORE LOGIC ================= */
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
                <button class="btn-task" id="btn-${id}" onclick="showAd('${key}', '${id}')">🤑 Task #${i+1} 🤑</button>
                <div id="claim-${id}" class="hidden"><button class="btn-main" onclick="claimTask('${key}', '${id}')">Claim Reward</button></div>
                <div id="timer-${id}" class="cooldown"></div>
            `;
            cont.appendChild(div);
        }
    });
}

window.showAd = (key, id) => {
    const ad = window[`show_${TASKS[key].zone}`];
    if(ad) {
        ad(TASKS[key].pop ? 'pop' : undefined).then(() => {
            document.getElementById(`btn-${id}`).classList.add('hidden');
            document.getElementById(`claim-${id}`).classList.remove('hidden');
        });
    }
};

window.claimTask = async (key, id) => {
    const reward = TASKS[key].reward;
    await updateDoc(doc(db, "users", username), {
        balance: increment(reward),
        weeklyBalance: increment(reward),
        [`cooldowns.${id}`]: Date.now() + TASKS[key].cd
    });
    // 10% Ref Bonus
    if(userData.referredBy) {
        await updateDoc(doc(db, "users", userData.referredBy), { balance: increment(reward * 0.1) }).catch(()=>{});
    }
    alert("Reward Collected!");
    document.getElementById(`claim-${id}`).classList.add('hidden');
    document.getElementById(`btn-${id}`).classList.remove('hidden');
};

window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-withdraw') fetchUserHistory();
    if(id === 'page-leader') fetchLeaderboard();
};

function fetchLeaderboard() {
    const q = query(collection(db, "users"), orderBy("weeklyBalance", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        document.getElementById('leaderTable').innerHTML = snap.docs.map((d, i) => `
            <tr><td>#${i+1}</td><td>@${d.id}</td><td>₱${d.data().weeklyBalance.toFixed(2)}</td></tr>
        `).join('');
    });
}

function updateClock() {
    const now = new Date();
    document.getElementById('footerTime').innerText = now.toLocaleTimeString() + " - " + now.toDateString();
    
    // Timer Loop
    Object.keys(TASKS).forEach(key => {
        for (let i = 0; i < TASKS[key].count; i++) {
            const id = `${key}_${i}`, target = userData.cooldowns?.[id] || 0;
            const btn = document.getElementById(`btn-${id}`), timer = document.getElementById(`timer-${id}`);
            if(btn && Date.now() < target) {
                btn.disabled = true; btn.style.opacity = 0.5;
                const d = target - Date.now();
                const h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000), s = Math.floor((d%60000)/1000);
                timer.innerText = `Ready in: ${h}h ${m}m ${s}s`;
            } else if(btn) { btn.disabled = false; btn.style.opacity = 1; timer.innerText = ""; }
        }
    });
}

init();
