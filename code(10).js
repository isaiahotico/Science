
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction, getDocs, Timestamp } 
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

// Telegram Setup
const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user || { id: 12345, username: "Guest" };
const uid = tgUser.id.toString();
const myUsername = tgUser.username || `User_${uid.slice(0,4)}`;

let balance = 0, referralBonus = 0;

// Initialize User
async function initUser() {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { username: myUsername, balance: 0, referralBonus: 0, referredBy: null, taskTimes: {} });
    }

    onSnapshot(userRef, (d) => {
        const data = d.data();
        balance = data.balance;
        referralBonus = data.referralBonus;
        document.getElementById('balanceDisplay').innerText = balance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 @${data.username}`;
        document.getElementById('myRefCode').innerText = data.username;
        document.getElementById('refBonus').innerText = referralBonus.toFixed(2);
        if(data.referredBy) document.getElementById('refAction').innerHTML = `<p style="color:green">Invited by @${data.referredBy}</p>`;
        
        // Update Timers
        updateAllCooldowns(data.taskTimes || {});
    });

    loadLeaderboard();
    loadChat();
    loadHistory();
    startTime();
}

// --- Navigation ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Auto Ads Logic
    if(id === 'adsArea') runAutoAd('show_10276123');
    if(id === 'signInArea') runAutoAd('show_10337795');
};

function runAutoAd(zone) {
    if(window[zone]) window[zone]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
}

// --- Tasks System ---
const taskCfg = {
    ads: { id: 'adsList', reward: 0.02, cd: 300, zones: ['10276123','10337795','10337853'] },
    sign: { id: 'signInList', reward: 0.025, cd: 10800, zones: ['10276123','10337795','10337853'] },
    gift: { id: 'giftList', reward: 0.02, cd: 1200, zones: ['10276123','10337795','10337853'] }
};

function loadTasks() {
    Object.keys(taskCfg).forEach(key => {
        const group = taskCfg[key];
        const container = document.getElementById(group.id);
        container.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        group.zones.forEach((z, i) => {
            const tId = `${key}_${i}`;
            container.innerHTML += `
                <div class="card">
                    <button class="btn" id="btn_${tId}" onclick="doTask('${z}','${tId}',${group.reward},${group.cd})">🍍 Task #${i+1} 🍍</button>
                    <div id="timer_${tId}" style="font-size:0.7rem; color:red;"></div>
                </div>`;
        });
    });
}

window.doTask = async (zone, tId, reward, cd) => {
    const sdk = window[`show_${zone}`];
    sdk().then(async () => {
        await updateDoc(doc(db, "users", uid), { 
            balance: increment(reward), 
            [`taskTimes.${tId}`]: serverTimestamp() 
        });
        alert("Success! ₱" + reward + " added.");
    }).catch(() => alert("Ad failed. Try again."));
};

function updateAllCooldowns(times) {
    Object.keys(taskCfg).forEach(key => {
        taskCfg[key].zones.forEach((_, i) => {
            const tId = `${key}_${i}`;
            const btn = document.getElementById(`btn_${tId}`);
            const lbl = document.getElementById(`timer_${tId}`);
            if(!btn) return;

            const last = times[tId]?.toDate().getTime() || 0;
            const now = Date.now();
            const diff = Math.floor((last + taskCfg[key].cd * 1000 - now) / 1000);

            if (diff > 0) {
                btn.disabled = true;
                lbl.innerText = `Wait: ${Math.floor(diff/60)}m ${diff%60}s`;
            } else {
                btn.disabled = false;
                lbl.innerText = "Ready!";
            }
        });
    });
}

// --- Chat System (Improved) ---
window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    // Use a random zone for chat reward
    const zones = ['show_10276123','show_10337795','show_10337853'];
    const randomZone = zones[Math.floor(Math.random()*zones.length)];

    try {
        // Show Ad First
        await window[randomZone]();
        
        // If ad succeeds, send message and reward
        await addDoc(collection(db, "messages"), {
            uid, username: myUsername, text: msg, timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, "users", uid), { balance: increment(0.01) });
        input.value = "";
    } catch (e) {
        // If ad fails, we still allow sending message but NO reward (to avoid soft-locks)
        await addDoc(collection(db, "messages"), {
            uid, username: myUsername, text: msg, timestamp: serverTimestamp()
        });
        input.value = "";
        console.log("Ad failed, message sent without reward.");
    }
    sendBtn.disabled = false;
};

function loadChat() {
    // 48 Hours Filter
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = query(collection(db, "messages"), 
                where("timestamp", ">", twoDaysAgo), 
                orderBy("timestamp", "asc"));

    onSnapshot(q, (snap) => {
        const box = document.getElementById('chatMessages');
        box.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const time = m.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '';
            box.innerHTML += `<div class="msg-item"><span class="msg-user">@${m.username}:</span> ${m.text} <span class="msg-time">${time}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// --- Leaderboard ---
function loadLeaderboard() {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(20));
    onSnapshot(q, (snap) => {
        const body = document.getElementById('leaderboardBody');
        body.innerHTML = '';
        let rank = 1;
        snap.forEach(d => {
            if(d.id === uid) document.getElementById('myRank').innerText = `#${rank}`;
            body.innerHTML += `<tr><td>${rank}</td><td>@${d.data().username}</td><td>${d.data().balance.toFixed(2)}</td></tr>`;
            rank++;
        });
    });
}

// --- Referral ---
window.submitReferral = async () => {
    const code = document.getElementById('refInput').value.trim();
    if(code === myUsername) return alert("Error");

    const q = query(collection(db, "users"), where("username", "==", code));
    const snap = await getDocs(q);
    if(snap.empty) return alert("Invalid Code");

    await updateDoc(doc(db, "users", uid), { referredBy: code });
    alert("Referral Set!");
};

// --- Withdrawals ---
window.submitWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const target = document.getElementById('wTarget').value;
    if(amt < 10 || amt > balance) return alert("Check balance/amount");

    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), { uid, username: myUsername, amount: amt, target, status: 'pending', timestamp: serverTimestamp() });
    alert("Submitted");
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

// --- Admin ---
window.adminLogin = () => { if(prompt("Pass") === "Propetas6") showPage('adminPage'); };

onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
    const div = document.getElementById('adminRequests');
    div.innerHTML = '';
    snap.forEach(d => {
        const w = d.data();
        const row = document.createElement('div');
        row.className = 'card';
        row.innerHTML = `<p>@${w.username} - ₱${w.amount}<br>${w.target}</p>`;
        const btn = document.createElement('button');
        btn.innerText = "Approve (Pay)";
        btn.onclick = () => approvePayment(d.id, w.uid, w.amount);
        row.appendChild(btn);
        div.appendChild(row);
    });
});

async function approvePayment(id, user_id, amount) {
    await updateDoc(doc(db, "withdrawals", id), { status: 'paid' });
    // Referral Commission (10%)
    const uSnap = await getDoc(doc(db, "users", user_id));
    const inviter = uSnap.data().referredBy;
    if(inviter) {
        const q = query(collection(db, "users"), where("username", "==", inviter));
        const iSnap = await getDocs(q);
        if(!iSnap.empty) {
            await updateDoc(doc(db, iSnap.docs[0].ref.path), { referralBonus: increment(amount * 0.1) });
        }
    }
}

function startTime() {
    setInterval(() => { document.getElementById('footerTime').innerText = new Date().toLocaleString(); }, 1000);
}

loadTasks();
initUser();
