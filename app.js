
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

/* ================= TG AUTH ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*9999);
const startParam = tg?.initDataUnsafe?.start_param;

let userData = { balance: 0, refClaimable: 0, cooldowns: {} };
let p = { leader: 1, userHist: 1, admin: 1 };
const LIMIT = 10;

/* ================= INITIALIZATION ================= */
async function start() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const refBy = (startParam && `@${startParam}` !== username) ? `@${startParam}` : null;
        await setDoc(userRef, { 
            balance: 0, weekly: 0, refClaimable: 0, invites: 0, 
            cooldowns: {}, referredBy: refBy 
        });
        if(refBy) await updateDoc(doc(db, "users", refBy), { invites: increment(1) }).catch(()=>{});
    }

    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 ${username}`;
        document.getElementById('refCount').innerText = userData.invites || 0;
        document.getElementById('refClaimable').innerText = `₱${(userData.refClaimable || 0).toFixed(3)}`;
        document.getElementById('refLink').value = `http://t.me/Key_52_bot/app?startapp=${username.replace('@','')}`;
    });

    setupTasks();
    syncChat();
    setInterval(tick, 1000);
    startAutoAds();
}

/* ================= TASK ENGINE ================= */
function setupTasks() {
    const sets = {
        signin: { r: 0.02, c: 10800000, n: 3, z: 10276123 },
        ads: { r: 0.02, c: 300000, n: 3, z: 10337853 },
        gift: { r: 0.02, c: 7200000, n: 3, z: 10337795, p: true },
        bonus: { r: 0.015, c: 600000, n: 5, rnd: true }
    };
    Object.keys(sets).forEach(key => {
        const conf = sets[key];
        const cont = document.getElementById(`cont-${key}`);
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        for (let i = 0; i < conf.n; i++) {
            const id = `${key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="btn-task" id="btn-${id}" onclick="runTask('${key}','${id}')">🤑 Task #${i+1} 🤑</button>
                    <div id="timer-${id}" class="cooldown"></div>
                </div>`;
        }
    });
}

window.runTask = (key, id) => {
    const rewards = { signin: 0.02, ads: 0.02, gift: 0.02, bonus: 0.015 };
    const cds = { signin: 10800000, ads: 300000, gift: 7200000, bonus: 600000 };
    const zones = [10276123, 10337795, 10337853];
    const z = key === 'bonus' ? zones[Math.floor(Math.random()*3)] : (key === 'ads' ? 10337853 : (key === 'gift' ? 10337795 : 10276123));

    window[`show_${z}`](key === 'gift' ? 'pop' : undefined).then(async () => {
        const reward = rewards[key];
        await updateDoc(doc(db, "users", username), {
            balance: increment(reward), weekly: increment(reward),
            [`cooldowns.${id}`]: Date.now() + cds[key]
        });

        if (userData.referredBy) {
            await updateDoc(doc(db, "users", userData.referredBy), { refClaimable: increment(reward * 0.1) }).catch(()=>{});
        }
        showToast(`🎉 Reward Received: ₱${reward}`);
    });
};

/* ================= REFERRAL LOGIC ================= */
window.applyManualCode = async () => {
    const code = document.getElementById('manualCode').value.trim();
    if (!code.startsWith('@')) return alert("Must start with @");
    if (code === username) return alert("Cannot link yourself");
    if (userData.referredBy) return alert("Already linked!");

    const refRef = doc(db, "users", code);
    const snap = await getDoc(refRef);
    if(snap.exists()) {
        await updateDoc(doc(db, "users", username), { referredBy: code });
        await updateDoc(refRef, { invites: increment(1) });
        alert(`Linked to ${code}! You are now a hardworker for them.`);
    } else alert("User code not found.");
};

window.claimRefToMain = async () => {
    const val = userData.refClaimable || 0;
    if(val < 0.001) return alert("Nothing to claim.");
    await updateDoc(doc(db, "users", username), { balance: increment(val), refClaimable: 0 });
    showToast(`Claimed ₱${val.toFixed(3)}!`);
};

/* ================= WITHDRAWALS ================= */
window.withdraw = async (method) => {
    if(userData.balance < 1) return alert("Min. ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if(!info) return alert("Enter account info.");

    let final = `₱${userData.balance.toFixed(2)}`;
    if(method === 'FaucetPay') final = `${(userData.balance / 56.5).toFixed(4)} USDT`;

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: userData.balance, info: info, method: method,
        converted: final, status: "Pending", timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", username), { balance: 0 });
    alert("Sent for manual approval!");
};

/* ================= UTILS & PAGINATION ================= */
function showToast(msg) {
    const t = document.getElementById('reward-toast');
    t.innerText = msg; t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}

window.openExternal = (url) => { tg.openLink ? tg.openLink(url) : window.open(url, '_blank'); };

window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-withdraw') fetchUserHistory();
    if(id === 'page-leader') fetchLeader();
};

window.changePage = (key, dir) => {
    p[key] = Math.max(1, p[key] + dir);
    document.getElementById(`${key}Page`).innerText = p[key];
    if(key === 'admin') fetchAdmin();
    if(key === 'leader') fetchLeader();
    if(key === 'userHist') fetchUserHistory();
};

function fetchUserHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc")), s => {
        const list = s.docs.map(d => d.data());
        const slice = list.slice((p.userHist-1)*LIMIT, p.userHist*LIMIT);
        document.getElementById('userHistBody').innerHTML = slice.map(r => `<tr><td>${r.converted}</td><td class="status-${r.status}">${r.status}</td></tr>`).join('');
    });
}

function fetchLeader() {
    onSnapshot(query(collection(db, "users"), orderBy("weekly", "desc"), limit(50)), s => {
        const list = s.docs.map(d => ({id: d.id, val: d.data().weekly}));
        const slice = list.slice((p.leader-1)*LIMIT, p.leader*LIMIT);
        document.getElementById('leaderBody').innerHTML = slice.map((r,i) => `<tr><td>#${((p.leader-1)*LIMIT)+i+1}</td><td>${r.id}</td><td>₱${r.val.toFixed(2)}</td></tr>`).join('');
    });
}

window.openAdmin = () => {
    if(prompt("Pass:") === "Propetas6") { navTo('page-admin'); fetchAdmin(); }
};

function fetchAdmin() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending"), orderBy("timestamp", "desc")), s => {
        const list = s.docs.map(d => ({id: d.id, ...d.data()}));
        const slice = list.slice((p.admin-1)*LIMIT, p.admin*LIMIT);
        document.getElementById('adminBody').innerHTML = slice.map(r => `
            <tr><td>${r.user}</td><td>${r.converted}<br><small>${r.info}</small></td>
            <td><button style="background:green;color:white;padding:5px" onclick="updStatus('${r.id}','Paid')">Paid</button></td></tr>
        `).join('');
    });
}
window.updStatus = async (id, s) => { await updateDoc(doc(db, "withdrawals", id), { status: s }); };

/* ================= CHAT ================= */
function syncChat() {
    onSnapshot(query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15)), s => {
        document.getElementById('chat-box').innerHTML = s.docs.map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).reverse().join('');
    });
}
window.sendMessage = async () => {
    const i = document.getElementById('chatInput');
    if(!i.value.trim()) return;
    await addDoc(collection(db, "messages"), { user: username, text: i.value, timestamp: serverTimestamp() });
    i.value = "";
};

function startAutoAds() {
    setInterval(() => {
        const z = [10276123, 10337795, 10337853][Math.floor(Math.random()*3)];
        window[`show_${z}`]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
    }, 180000);
}

function tick() {
    const now = new Date();
    document.getElementById('footerClock').innerText = now.toLocaleTimeString() + " | " + now.toDateString();
    Object.keys(userData.cooldowns || {}).forEach(id => {
        const target = userData.cooldowns[id], btn = document.getElementById(`btn-${id}`), tm = document.getElementById(`timer-${id}`);
        if(btn && Date.now() < target) {
            btn.disabled = true;
            const d = target - Date.now();
            tm.innerText = `${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;
        } else if(btn) { btn.disabled = false; tm.innerText = ""; }
    });
}

start();
