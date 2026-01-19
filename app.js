
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
const startParam = tg?.initDataUnsafe?.start_param;

document.getElementById('userBar').innerText = `👤 User: ${username}`;

let userData = { balance: 0, refClaimable: 0, invites: 0, cooldowns: {} };
let userPage = 1, adminPage = 1;
const LIMIT = 10;

/* ================= AUTO AD ENGINE (3 MINS) ================= */
function startAdLoop() {
    setInterval(() => {
        const zone = [10276123, 10337795, 10337853][Math.floor(Math.random()*3)];
        window[`show_${zone}`]?.({
            type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }, 180000);
}

/* ================= INITIALIZATION ================= */
async function init() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const referredBy = (startParam && `@${startParam}` !== username) ? `@${startParam}` : null;
        await setDoc(userRef, { balance: 0, weekly: 0, refClaimable: 0, invites: 0, cooldowns: {}, referredBy: referredBy });
        if(referredBy) await updateDoc(doc(db, "users", referredBy), { invites: increment(1) }).catch(()=>{});
    }

    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
        document.getElementById('refCount').innerText = userData.invites || 0;
        document.getElementById('refClaimable').innerText = `₱${(userData.refClaimable || 0).toFixed(3)}`;
        document.getElementById('refLink').value = `http://t.me/Key_52_bot/app?startapp=${username.replace('@','')}`;
    });

    setupTasks();
    syncChat();
    startAdLoop();
    setInterval(updateClock, 1000);
}

/* ================= REFERRAL LOGIC ================= */
window.submitManualCode = async () => {
    const code = document.getElementById('manualCode').value.trim();
    if (!code.startsWith('@')) return alert("Use @username");
    if (code === username || userData.referredBy) return alert("Invalid or already linked");
    const refRef = doc(db, "users", code);
    if((await getDoc(refRef)).exists()) {
        await updateDoc(doc(db, "users", username), { referredBy: code });
        await updateDoc(refRef, { invites: increment(1) });
        alert("Success! Referral linked.");
    } else alert("User not found.");
};

window.claimBonus = async () => {
    if(userData.refClaimable <= 0) return alert("No bonus to claim.");
    await updateDoc(doc(db, "users", username), { balance: increment(userData.refClaimable), refClaimable: 0 });
    popReward(`Claimed ₱${userData.refClaimable.toFixed(3)} Referral Bonus!`);
};

/* ================= TASK LOGIC ================= */
function setupTasks() {
    const areas = { 
        signin: { r: 0.02, c: 10800000, n: 3, z: 10276123 }, 
        ads: { r: 0.02, c: 300000, n: 3, z: 10337853 }, 
        gift: { r: 0.02, c: 7200000, n: 3, z: 10337795, p: true }, 
        bonus: { r: 0.015, c: 600000, n: 5, rnd: true } 
    };
    Object.keys(areas).forEach(key => {
        const conf = areas[key];
        const cont = document.getElementById(`cont-${key}`);
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        for (let i = 0; i < conf.n; i++) {
            const id = `${key}_${i}`;
            cont.innerHTML += `<div class="card"><button class="btn-task" id="btn-${id}" onclick="runAd('${key}','${id}')">🤑 Claim ₱${conf.r} 🤑</button><div id="timer-${id}" class="cooldown"></div></div>`;
        }
    });
}

window.runAd = (key, id) => {
    const r = (key === 'bonus') ? 0.015 : 0.02;
    const cd = { signin: 10800000, ads: 300000, gift: 7200000, bonus: 600000 }[key];
    const z = key === 'ads' ? 10337853 : (key === 'gift' ? 10337795 : 10276123);
    
    window[`show_${z}`](key === 'gift' ? 'pop' : undefined).then(async () => {
        await updateDoc(doc(db, "users", username), { balance: increment(r), weekly: increment(r), [`cooldowns.${id}`]: Date.now() + cd });
        if(userData.referredBy) await updateDoc(doc(db, "users", userData.referredBy), { refClaimable: increment(r * 0.1) }).catch(()=>{});
        popReward(`Received ₱${r}!`);
    });
};

/* ================= WITHDRAWALS ================= */
window.handleWithdraw = async (method) => {
    if(userData.balance < 1) return alert("Min. ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if(!info) return alert("Enter details");
    let converted = `₱${userData.balance.toFixed(2)}`;
    if(method === 'FaucetPay') converted = `${(userData.balance / 56.5).toFixed(4)} USDT`;

    await addDoc(collection(db, "withdrawals"), { user: username, amount: userData.balance, info: info, method: method, converted: converted, status: "Pending", timestamp: Date.now() });
    await updateDoc(doc(db, "users", username), { balance: 0 });
    alert("Sent for approval!");
};

function syncUserHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"));
    onSnapshot(q, (s) => {
        const data = s.docs.map(d => d.data());
        const sliced = data.slice((userPage-1)*LIMIT, userPage*LIMIT);
        document.getElementById('userHistBody').innerHTML = sliced.map(r => `<tr><td>${r.converted}</td><td>${r.info}</td><td class="status-${r.status}">${r.status}</td></tr>`).join('');
    });
}

/* ================= ADMIN ================= */
window.openAdmin = () => { if(prompt("Pass:") === "Propetas6") { navTo('page-admin'); syncAdmin(); } };
function syncAdmin() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"));
    onSnapshot(q, (s) => {
        const data = s.docs.map(d => ({id: d.id, ...d.data()}));
        const sliced = data.slice((adminPage-1)*LIMIT, adminPage*LIMIT);
        document.getElementById('adminBody').innerHTML = sliced.map(r => `<tr><td>${r.user}</td><td>${r.converted}</td><td>${r.info}</td><td>${r.status === 'Pending' ? `<button onclick="updStat('${r.id}','Paid')" style="background:green">✓</button>` : r.status}</td></tr>`).join('');
    });
}
window.updStat = async (id, s) => { await updateDoc(doc(db, "withdrawals", id), { status: s }); };

/* ================= UTILS ================= */
window.openLink = (url) => { if(tg.openLink) tg.openLink(url); else window.open(url, '_blank'); };
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-withdraw') syncUserHistory();
    if(id === 'page-leader') fetchLeader();
};

window.changeUserPage = (d) => { userPage = Math.max(1, userPage + d); document.getElementById('userPageNum').innerText = userPage; syncUserHistory(); };
window.changeAdminPage = (d) => { adminPage = Math.max(1, adminPage + d); document.getElementById('adminPageNum').innerText = adminPage; syncAdmin(); };

function popReward(m) {
    const p = document.getElementById('reward-pop');
    document.getElementById('reward-msg').innerText = m;
    p.style.display = 'block'; setTimeout(() => p.style.display = 'none', 3000);
}

function updateClock() {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString();
    Object.keys(userData.cooldowns || {}).forEach(id => {
        const btn = document.getElementById(`btn-${id}`), tm = document.getElementById(`timer-${id}`), target = userData.cooldowns[id];
        if(btn && Date.now() < target) {
            btn.disabled = true; const d = target - Date.now();
            tm.innerText = `${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;
        } else if(btn) { btn.disabled = false; tm.innerText = ""; }
    });
}

function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15));
    onSnapshot(q, (s) => { document.getElementById('chat-box').innerHTML = s.docs.map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).reverse().join(''); });
}
window.sendMessage = async () => {
    const i = document.getElementById('chatInput'); if(!i.value.trim()) return;
    await addDoc(collection(db, "messages"), { user: username, text: i.value, timestamp: serverTimestamp() }); i.value = "";
};

function fetchLeader() {
    const q = query(collection(db, "users"), orderBy("weekly", "desc"), limit(10));
    onSnapshot(q, (s) => { document.getElementById('leaderBody').innerHTML = s.docs.map((d, i) => `<tr><td>#${i+1}</td><td>${d.id}</td><td>₱${d.data().weekly.toFixed(2)}</td></tr>`).join(''); });
}

init();
