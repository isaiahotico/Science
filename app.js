
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

/* ================= TG CORE ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
const username = tg?.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "Guest_" + Math.floor(Math.random()*9999);
const startParam = tg?.initDataUnsafe?.start_param;

let userData = {};
let pages = { leader: 1, userHist: 1, admin: 1 };
const PAGE_LIMIT = 10;

/* ================= AUTO AD LOOP (3 MIN) ================= */
function startAutoAds() {
    setInterval(() => {
        const zone = [10276123, 10337795, 10337853][Math.floor(Math.random()*3)];
        if(window[`show_${zone}`]) {
            window[`show_${zone}`]({
                type: 'inApp',
                inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
            });
        }
    }, 180000);
}

/* ================= INITIALIZE ================= */
async function initApp() {
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
    startAutoAds();
    setInterval(updateClock, 1000);
}

/* ================= TASKS ================= */
function setupTasks() {
    const sets = {
        signin: { r: 0.025, c: 10800000, n: 3, z: 10276123 },
        ads: { r: 0.02, c: 300000, n: 3, z: 10337853 },
        gift: { r: 0.02, c: 7200000, n: 3, z: 10337795, p: true },
        bonus: { r: 0.015, c: 600000, n: 5, z: 0, rnd: true }
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
    const rewards = { signin: 0.025, ads: 0.02, gift: 0.02, bonus: 0.015 };
    const cds = { signin: 10800000, ads: 300000, gift: 7200000, bonus: 600000 };
    const zone = key === 'gift' ? 10337795 : key === 'ads' ? 10337853 : 10276123;

    window[`show_${zone}`](key === 'gift' ? 'pop' : undefined).then(async () => {
        const reward = rewards[key];
        await updateDoc(doc(db, "users", username), {
            balance: increment(reward), weekly: increment(reward),
            [`cooldowns.${id}`]: Date.now() + cds[key]
        });
        if(userData.referredBy) {
            await updateDoc(doc(db, "users", userData.referredBy), { refClaimable: increment(reward * 0.1) }).catch(()=>{});
        }
        alert("Reward Added!");
    });
};

/* ================= WITHDRAWALS (SYNC + PAGINATION) ================= */
window.withdrawFunds = async (method) => {
    if(userData.balance < 1) return alert("Minimum ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if(!info) return alert("Enter account details!");

    let finalAmt = `₱${userData.balance.toFixed(2)}`;
    if(method === 'FaucetPay') finalAmt = `${(userData.balance / 56.5).toFixed(4)} USDT`;

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: userData.balance, info: info, method: method,
        converted: finalAmt, status: "Pending", timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    alert("Request Sent!");
};

function fetchUserHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const all = snap.docs.map(d => d.data());
        const sliced = all.slice((pages.userHist-1)*PAGE_LIMIT, pages.userHist*PAGE_LIMIT);
        document.getElementById('userHistBody').innerHTML = sliced.map(r => `
            <tr><td>${r.converted}</td><td>${r.method}: ${r.info}</td><td>${new Date(r.timestamp).toLocaleDateString()}</td><td class="status-${r.status}">${r.status}</td></tr>
        `).join('');
    });
}

/* ================= ADMIN (SYNC + PAGINATION) ================= */
window.openAdmin = () => {
    if(prompt("Password:") === "Propetas6") {
        navTo('page-admin');
        fetchAdminData();
    }
};

function fetchAdminData() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const all = snap.docs.map(d => ({id: d.id, ...d.data()}));
        const sliced = all.slice((pages.admin-1)*PAGE_LIMIT, pages.admin*PAGE_LIMIT);
        document.getElementById('adminBody').innerHTML = sliced.map(r => `
            <tr>
                <td>${r.user}</td><td>${r.converted}</td><td>${r.method}: ${r.info}</td>
                <td>${new Date(r.timestamp).toLocaleTimeString()}</td>
                <td>
                    ${r.status === 'Pending' ? `
                        <button onclick="adminAction('${r.id}','Paid')" style="background:green; color:white; padding:3px">Paid</button>
                        <button onclick="adminAction('${r.id}','Denied')" style="background:red; color:white; padding:3px">Deny</button>
                    ` : r.status}
                </td>
            </tr>
        `).join('');
    });
}

window.adminAction = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status: status });
};

/* ================= UTILS ================= */
window.handleLink = (url) => {
    if(tg.openLink) tg.openLink(url);
    else window.open(url, '_blank');
};

window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-withdraw') fetchUserHistory();
    if(id === 'page-leader') fetchLeader();
};

window.changePage = (key, dir) => {
    pages[key] = Math.max(1, pages[key] + dir);
    document.getElementById(`${key}PageNum`).innerText = pages[key];
    if(key === 'admin') fetchAdminData();
    if(key === 'userHist') fetchUserHistory();
};

function fetchLeader() {
    const q = query(collection(db, "users"), orderBy("weekly", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const all = snap.docs.map(d => ({id: d.id, val: d.data().weekly}));
        const sliced = all.slice((pages.leader-1)*PAGE_LIMIT, pages.leader*PAGE_LIMIT);
        document.getElementById('leaderBody').innerHTML = sliced.map((r,i) => `
            <tr><td>#${((pages.leader-1)*PAGE_LIMIT)+i+1}</td><td>${r.id}</td><td>₱${r.val.toFixed(2)}</td></tr>
        `).join('');
    });
}

window.claimRefRewards = async () => {
    const val = userData.refClaimable || 0;
    if(val <= 0) return alert("No rewards yet.");
    await updateDoc(doc(db, "users", username), { balance: increment(val), refClaimable: 0 });
    alert("Rewards Claimed!");
};

function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15));
    onSnapshot(q, (s) => {
        document.getElementById('chat-box').innerHTML = s.docs.map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).reverse().join('');
    });
}

window.sendMessage = async () => {
    const i = document.getElementById('chatInput');
    if(!i.value.trim()) return;
    await addDoc(collection(db, "messages"), { user: username, text: i.value, timestamp: serverTimestamp() });
    i.value = "";
};

function updateClock() {
    const now = new Date();
    document.getElementById('liveClock').innerText = now.toLocaleTimeString() + " - " + now.toDateString();
    Object.keys(userData.cooldowns || {}).forEach(id => {
        const target = userData.cooldowns[id], btn = document.getElementById(`btn-${id}`), tm = document.getElementById(`timer-${id}`);
        if(btn && Date.now() < target) {
            btn.disabled = true;
            const d = target - Date.now();
            tm.innerText = `${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;
        } else if(btn) { btn.disabled = false; tm.innerText = ""; }
    });
}

initApp();
