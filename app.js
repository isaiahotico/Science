
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

/* ================= TG SETUP ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*9999);
const startParam = tg?.initDataUnsafe?.start_param;

let userData = { balance: 0, refClaimable: 0, cooldowns: {} };
let userPage = 1, adminPage = 1;
const PAGE_SIZE = 10;

/* ================= AUTO AD LOOP ================= */
function startAdLoop() {
    setInterval(() => {
        const z = [10276123, 10337795, 10337853][Math.floor(Math.random()*3)];
        window[`show_${z}`]?.({
            type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }, 180000); // 3 minutes
}

/* ================= INITIALIZATION ================= */
async function init() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const refBy = (startParam && `@${startParam}` !== username) ? `@${startParam}` : null;
        await setDoc(userRef, { balance: 0, weekly: 0, refClaimable: 0, invites: 0, cooldowns: {}, referredBy: refBy });
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
    startAdLoop();
    setInterval(updateTimers, 1000);
}

/* ================= TASKS ================= */
function setupTasks() {
    const config = {
        signin: { r: 0.02, c: 10800000, n: 3, z: 10276123 },
        ads: { r: 0.02, c: 300000, n: 3, z: 10337853 },
        gift: { r: 0.02, c: 7200000, n: 3, z: 10337795, p: true },
        bonus: { r: 0.015, c: 600000, n: 5, rnd: true }
    };
    Object.keys(config).forEach(key => {
        const c = config[key];
        const cont = document.getElementById(`cont-${key}`);
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()} (₱${c.r})</h3>`;
        for (let i = 0; i < c.n; i++) {
            const id = `${key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="btn-task" id="btn-${id}" onclick="triggerAd('${key}','${id}')">🤑 Task #${i+1} 🤑</button>
                    <div id="tmr-${id}" class="cooldown"></div>
                </div>`;
        }
    });
}

window.triggerAd = (key, id) => {
    const rewards = { signin: 0.02, ads: 0.02, gift: 0.02, bonus: 0.015 };
    const cds = { signin: 10800000, ads: 300000, gift: 7200000, bonus: 600000 };
    const z = key === 'ads' ? 10337853 : (key === 'gift' ? 10337795 : 10276123);

    window[`show_${z}`](key === 'gift' ? 'pop' : undefined).then(async () => {
        const amt = rewards[key];
        await updateDoc(doc(db, "users", username), {
            balance: increment(amt), weekly: increment(amt),
            [`cooldowns.${id}`]: Date.now() + cds[key]
        });
        if(userData.referredBy) {
            await updateDoc(doc(db, "users", userData.referredBy), { refClaimable: increment(amt * 0.1) }).catch(()=>{});
        }
        showReward(`₱${amt} Added to balance!`);
    });
};

/* ================= REFERRALS ================= */
window.applyReferralCode = async () => {
    const code = document.getElementById('manualRefCode').value.trim();
    if (!code.startsWith('@') || code === username || userData.referredBy) return alert("Invalid Code");
    const ref = doc(db, "users", code);
    if ((await getDoc(ref)).exists()) {
        await updateDoc(doc(db, "users", username), { referredBy: code });
        await updateDoc(ref, { invites: increment(1) });
        alert("Linked successfully!");
    } else alert("User not found!");
};

window.claimReferralBonus = async () => {
    if (userData.refClaimable < 0.001) return alert("Nothing to claim.");
    await updateDoc(doc(db, "users", username), { balance: increment(userData.refClaimable), refClaimable: 0 });
    showReward(`₱${userData.refClaimable.toFixed(3)} Referral Bonus Claimed!`);
};

/* ================= WITHDRAWALS ================= */
window.handleWithdraw = async (method) => {
    if (userData.balance < 1) return alert("Minimum ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if (!info) return alert("Enter account details");

    let displayAmt = `₱${userData.balance.toFixed(2)}`;
    if (method === 'FaucetPay') {
        const usdt = (userData.balance / 56.5).toFixed(4); // Example rate
        displayAmt = `${usdt} USDT`;
    }

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: userData.balance, info: info, method: method,
        converted: displayAmt, status: "Pending", timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", username), { balance: 0 });
    alert("Withdrawal request sent!");
};

function fetchUserHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const all = snap.docs.map(d => d.data());
        const sliced = all.slice((userPage-1)*PAGE_SIZE, userPage*PAGE_SIZE);
        document.getElementById('userHistBody').innerHTML = sliced.map(r => `
            <tr><td>${r.method}</td><td>${r.info}</td><td>${r.converted}</td><td>${new Date(r.timestamp).toLocaleDateString()}</td><td class="status-${r.status}">${r.status}</td></tr>
        `).join('');
    });
}

/* ================= OWNER/ADMIN ================= */
window.openAdmin = () => {
    if (prompt("Access Code:") === "Propetas6") { navTo('page-admin'); fetchAdminData(); }
};

function fetchAdminData() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const all = snap.docs.map(d => ({id: d.id, ...d.data()}));
        const sliced = all.slice((adminPage-1)*PAGE_SIZE, adminPage*PAGE_SIZE);
        document.getElementById('adminBody').innerHTML = sliced.map(r => `
            <tr>
                <td>${r.user}</td><td>${r.method}</td><td>${r.info}</td><td>${r.converted}</td>
                <td>${new Date(r.timestamp).toLocaleTimeString()}</td>
                <td>
                    ${r.status === 'Pending' ? `
                        <button onclick="updStat('${r.id}','Paid')" style="background:green; padding:3px">✓</button>
                        <button onclick="updStat('${r.id}','Denied')" style="background:red; padding:3px">X</button>
                    ` : r.status}
                </td>
            </tr>
        `).join('');
    });
}
window.updStat = async (id, s) => { await updateDoc(doc(db, "withdrawals", id), { status: s }); };

/* ================= UI HELPERS ================= */
window.openSocial = (url) => { tg.openLink ? tg.openLink(url) : window.open(url, '_blank'); };
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'page-withdraw') fetchUserHistory();
    if (id === 'page-leader') fetchLeaders();
};

window.changeUserPage = (v) => { userPage = Math.max(1, userPage + v); document.getElementById('userPageNum').innerText = userPage; fetchUserHistory(); };
window.changeAdminPage = (v) => { adminPage = Math.max(1, adminPage + v); document.getElementById('adminPageNum').innerText = adminPage; fetchAdminData(); };

function showReward(msg) {
    document.getElementById('reward-msg').innerText = msg;
    document.getElementById('reward-pop').style.display = 'block';
}
window.closeReward = () => { document.getElementById('reward-pop').style.display = 'none'; };

function updateTimers() {
    document.getElementById('footerTime').innerText = new Date().toLocaleTimeString();
    Object.keys(userData.cooldowns || {}).forEach(id => {
        const btn = document.getElementById(`btn-${id}`), tm = document.getElementById(`tmr-${id}`), target = userData.cooldowns[id];
        if (btn && Date.now() < target) {
            btn.disabled = true; const d = target - Date.now();
            tm.innerText = `${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;
        } else if (btn) { btn.disabled = false; tm.innerText = ""; }
    });
}

function fetchLeaders() {
    const q = query(collection(db, "users"), orderBy("weekly", "desc"), limit(10));
    onSnapshot(q, (s) => {
        document.getElementById('leaderBody').innerHTML = s.docs.map((d, i) => `<tr><td>#${i+1}</td><td>${d.id}</td><td>₱${d.data().weekly.toFixed(2)}</td></tr>`).join('');
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

init();
