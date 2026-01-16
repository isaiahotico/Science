
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, getDocs } 
from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

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

// Telegram
const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user || { id: 99999, username: "Guest" };
const uid = tgUser.id.toString();
const myUsername = tgUser.username || `User_${uid.slice(0,4)}`;

// App Global State
let balance = 0;

async function init() {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { username: myUsername, balance: 0, referralBonus: 0, referredBy: null, taskTimes: {} });
    }

    onSnapshot(userRef, (d) => {
        const data = d.data();
        balance = data.balance;
        document.getElementById('balanceDisplay').innerText = balance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 @${data.username}`;
        document.getElementById('myRefCode').innerText = data.username;
        document.getElementById('refBonus').innerText = data.referralBonus.toFixed(2);
        if(data.referredBy) document.getElementById('refAction').innerHTML = `<p style="color:green">Referred by @${data.referredBy}</p>`;
        updateAllTimers(data.taskTimes || {});
    });

    loadChat();
    loadLeaderboard();
    loadHistory();
    setInterval(() => { document.getElementById('footerTime').innerText = new Date().toLocaleString(); }, 1000);
}

// --- Navigation Fix ---
window.openPage = (id) => {
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));
    
    // Show selected
    const target = document.getElementById(id);
    if(target) target.classList.add('active');

    // Auto Ads
    if(id === 'adsArea') runAutoAd('show_10276123');
    if(id === 'signInArea') runAutoAd('show_10337795');
};

function runAutoAd(zone) {
    if(window[zone]) window[zone]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
}

// --- Chat Logic ---
window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    try {
        await addDoc(collection(db, "messages"), {
            uid, 
            username: myUsername, 
            text: msg, 
            timestamp: serverTimestamp() 
        });
        input.value = "";
    } catch (e) { console.error(e); }
};

function loadChat() {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = query(collection(db, "messages"), where("timestamp", ">", twoDaysAgo), orderBy("timestamp", "asc"));

    onSnapshot(q, (snap) => {
        const box = document.getElementById('chatBoxWrapper');
        box.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const time = m.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '';
            box.innerHTML += `<div class="msg-item"><span class="msg-user">@${m.username}:</span> ${m.text} <span style="font-size:0.6rem; color:#aaa;">${time}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// --- Task System ---
const taskCfg = {
    ads: { container: 'adsList', reward: 0.02, cd: 300, zones: ['10276123','10337795','10337853'] },
    sign: { container: 'signInList', reward: 0.025, cd: 10800, zones: ['10276123','10337795','10337853'] },
    gift: { container: 'giftList', reward: 0.02, cd: 1200, zones: ['10276123','10337795','10337853'] }
};

function setupTasks() {
    Object.keys(taskCfg).forEach(key => {
        const g = taskCfg[key];
        const cont = document.getElementById(g.container);
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        g.zones.forEach((zone, i) => {
            const tId = `${key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="btn" id="btn_${tId}" onclick="runTaskAd('${zone}','${tId}',${g.reward})">🍍 Task #${i+1} 🍍</button>
                    <div id="lbl_${tId}" style="font-size:0.7rem; color:red;"></div>
                </div>`;
        });
    });
}

window.runTaskAd = (zone, tId, reward) => {
    window[`show_${zone}`]().then(async () => {
        await updateDoc(doc(db, "users", uid), { 
            balance: increment(reward), 
            [`taskTimes.${tId}`]: serverTimestamp() 
        });
        alert("Earned ₱" + reward);
    });
};

function updateAllTimers(times) {
    Object.keys(taskCfg).forEach(key => {
        const g = taskCfg[key];
        g.zones.forEach((_, i) => {
            const tId = `${key}_${i}`;
            const btn = document.getElementById(`btn_${tId}`);
            const lbl = document.getElementById(`lbl_${tId}`);
            if(!btn) return;
            const last = times[tId]?.toDate().getTime() || 0;
            const diff = Math.floor((last + g.cd * 1000 - Date.now()) / 1000);
            if(diff > 0) {
                btn.disabled = true;
                lbl.innerText = `Wait: ${Math.floor(diff/60)}m ${diff%60}s`;
            } else {
                btn.disabled = false;
                lbl.innerText = "Ready!";
            }
        });
    });
}

// --- Leaderboard ---
function loadLeaderboard() {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(20));
    onSnapshot(q, (snap) => {
        const body = document.getElementById('leaderboardBody');
        body.innerHTML = ''; let i = 1;
        snap.forEach(d => {
            body.innerHTML += `<tr><td>${i}</td><td>@${d.data().username}</td><td>${d.data().balance.toFixed(2)}</td></tr>`;
            i++;
        });
    });
}

// --- Admin & Misc ---
window.submitWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const target = document.getElementById('wTarget').value;
    if(amt < 10 || amt > balance) return alert("Invalid");
    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), { uid, username: myUsername, amount: amt, target, status: 'pending', timestamp: serverTimestamp() });
    alert("Requested");
};

function loadHistory() {
    const q = query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const body = document.getElementById('historyBody');
        body.innerHTML = '';
        snap.forEach(d => {
            const w = d.data();
            body.innerHTML += `<tr><td>${w.timestamp?.toDate().toLocaleDateString() || ''}</td><td>${w.target}</td><td>${w.status}</td></tr>`;
        });
    });
}

window.adminLogin = () => { if(prompt("Pass") === "Propetas6") openPage('adminPage'); };

setupTasks();
init();
