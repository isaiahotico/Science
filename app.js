
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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

/* ================= TELEGRAM AUTH ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_User";
const refBy = tg?.initDataUnsafe?.start_param || null;

document.getElementById("userBar").innerText = "👤 User: " + username;

let userData = { balance: 0, cooldowns: {} };

/* ================= INITIALIZE ================= */
async function initApp() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, { balance: 0, weeklyEarnings: 0, referredBy: refBy, cooldowns: {} });
    }

    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
    });

    onSnapshot(doc(db, "stats", "global"), (s) => {
        if(s.exists()) document.getElementById('globalTotal').innerText = s.data().total.toFixed(2);
    });

    document.getElementById('refLink').value = `http://t.me/Key_52_bot/app?startapp=${username.replace('@','')}`;

    setupTasks();
    syncChat();
    setInterval(tick, 1000);
}

/* ================= CHAT (Max 500 Messages) ================= */
function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15));
    onSnapshot(q, (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = snap.docs.map(d => `<div class="msg"><b>${d.data().user}:</b> ${d.data().text}</div>`).reverse().join('');
        box.scrollTop = box.scrollHeight;
    });
}

window.sendMessage = async () => {
    const inp = document.getElementById('chatInput');
    if(!inp.value.trim()) return;
    await addDoc(collection(db, "messages"), { user: username, text: inp.value, timestamp: serverTimestamp() });
    inp.value = "";
};

/* ================= WITHDRAWAL (Auto Convert) ================= */
window.handleWithdraw = async (method) => {
    if(userData.balance < 1) return alert("Min. withdrawal ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if(!info) return alert("Enter payment details");

    let finalAmount = `₱${userData.balance.toFixed(2)}`;
    if(method === 'FaucetPay') {
        const usdt = userData.balance / 56.5; // PHP to USDT Rate
        finalAmount = `${usdt.toFixed(4)} USDT`;
    }

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: userData.balance, method: method,
        info: info, converted: finalAmount, status: "Pending", timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(userData.balance) });
    alert("Withdrawal synced to owner dashboard for approval.");
};

/* ================= OWNER ADMIN ================= */
window.openAdmin = () => {
    if(prompt("Admin Access:") === "Propetas6") {
        navTo('page-admin');
        const q = query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snap) => {
            document.getElementById('adminBody').innerHTML = snap.docs.map(d => `
                <div class="card">
                    <b>${d.data().user}</b>: ${d.data().converted}<br>
                    <small>${d.data().info} (${d.data().method})</small><br>
                    <button class="btn-task" onclick="approve('${d.id}')">Approve & Pay</button>
                </div>
            `).join('');
        });
    }
};

window.approve = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "Paid" });
};

/* ================= CORE LOGIC ================= */
function setupTasks() {
    const types = { 
        ads: { reward: 0.02, cd: 300000, zone: 10337853, count: 3 },
        gift: { reward: 0.02, cd: 7200000, zone: 10337795, count: 3, pop: true }
    };
    Object.keys(types).forEach(type => {
        const cont = document.getElementById(`cont-${type}`);
        for (let i = 0; i < types[type].count; i++) {
            const id = `${type}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="btn-task" id="btn-${id}" onclick="runAd('${type}', '${id}')">🤑 Claim Reward #${i+1} 🤑</button>
                    <div id="timer-${id}" class="cooldown"></div>
                </div>`;
        }
    });
}

window.runAd = (type, id) => {
    const zones = [10276123, 10337795, 10337853];
    const z = type === 'ads' ? zones[Math.floor(Math.random()*3)] : 10337795;
    window[`show_${z}`](type === 'gift' ? 'pop' : undefined).then(async () => {
        const reward = 0.02;
        await updateDoc(doc(db, "users", username), {
            balance: increment(reward),
            weeklyEarnings: increment(reward),
            [`cooldowns.${id}`]: Date.now() + (type === 'ads' ? 300000 : 7200000)
        });
        if(userData.referredBy) {
            await updateDoc(doc(db, "users", userData.referredBy), { balance: increment(reward * 0.1) }).catch(()=>{});
        }
        alert("Reward Added!");
    });
};

window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-withdraw') {
        onSnapshot(query(collection(db, "withdrawals"), where("user", "==", username), limit(5)), s => {
            document.getElementById('userHistBody').innerHTML = s.docs.map(d => `<tr><td>${d.data().converted}</td><td>${d.data().status}</td></tr>`).join('');
        });
    }
    if(id === 'page-leader') {
        onSnapshot(query(collection(db, "users"), orderBy("weeklyEarnings", "desc"), limit(10)), s => {
            document.getElementById('leaderTable').innerHTML = s.docs.map((d, i) => `<tr><td>#${i+1}</td><td>${d.id}</td><td>₱${d.data().weeklyEarnings.toFixed(2)}</td></tr>`).join('');
        });
    }
};

function tick() {
    const now = new Date();
    document.getElementById('footerClock').innerText = now.toLocaleTimeString() + " | " + now.toDateString();
    Object.keys(userData.cooldowns || {}).forEach(id => {
        const target = userData.cooldowns[id];
        const btn = document.getElementById(`btn-${id}`);
        const timer = document.getElementById(`timer-${id}`);
        if(!btn) return;
        if(Date.now() < target) {
            btn.disabled = true; btn.style.opacity = 0.5;
            const d = target - Date.now();
            timer.innerText = `Wait: ${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;
        } else { btn.disabled = false; btn.style.opacity = 1; timer.innerText = ""; }
    });
}

initApp();
