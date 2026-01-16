
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction, getDocs } 
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

const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user || { id: 88888, username: "GuestUser" };
const uid = user.id.toString();
const myName = user.username || `User_${uid.slice(0,4)}`;

let uBalance = 0;

async function start() {
    const uRef = doc(db, "users", uid);
    const snap = await getDoc(uRef);
    if(!snap.exists()) {
        await setDoc(uRef, { username: myName, balance: 0, referralBonus: 0, referredBy: null, referralCount: 0, totalRefGains: 0, taskCooldowns: {} });
    }

    onSnapshot(uRef, (d) => {
        const data = d.data();
        uBalance = data.balance;
        document.getElementById('balance').innerText = uBalance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 @${data.username}`;
        document.getElementById('myCode').innerText = data.username;
        document.getElementById('refBonus').innerText = data.referralBonus.toFixed(2);
        document.getElementById('refCount').innerText = data.referralCount;
        document.getElementById('refTotal').innerText = `₱ ${data.totalRefGains.toFixed(2)}`;
        
        if(data.referredBy) {
            document.getElementById('refInputSection').innerHTML = `<p style="color:green">Referrer: @${data.referredBy}</p>`;
        }
        updateCooldowns(data.taskCooldowns || {});
    });

    initChat();
    initLeaderboard();
    initHistory();
    setInterval(() => { document.getElementById('realTime').innerText = new Date().toLocaleString(); }, 1000);
}

// Navigation
window.nav = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'adsArea') runAutoAd('show_10276123');
};

function runAutoAd(zone) {
    if(window[zone]) window[zone]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
}

// Tasks
const tasks = {
    ads: { id: 'adsList', r: 0.02, cd: 300, zones: ['10276123','10337795','10337853'] },
    sign: { id: 'signInList', r: 0.025, cd: 10800, zones: ['10276123','10337795','10337853'] },
    gift: { id: 'giftList', r: 0.02, cd: 1200, zones: ['10276123','10337795','10337853'] }
};

function loadTasks() {
    Object.keys(tasks).forEach(k => {
        const g = tasks[k];
        const box = document.getElementById(g.id);
        box.innerHTML = `<h3>🍍 ${k.toUpperCase()} AREA</h3>`;
        g.zones.forEach((z, i) => {
            const tId = `${k}_${i}`;
            box.innerHTML += `
                <div class="card">
                    <button class="btn" id="btn_${tId}" onclick="doAd('${z}','${tId}',${g.r})">🤑 Task #${i+1} 🍍</button>
                    <div id="lbl_${tId}" style="color:red; font-size:0.7rem;"></div>
                </div>`;
        });
    });
}

window.doAd = (z, tId, r) => {
    window[`show_${z}`]().then(async () => {
        await updateDoc(doc(db, "users", uid), { balance: increment(r), [`taskCooldowns.${tId}`]: serverTimestamp() });
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
    });
};

function updateCooldowns(times) {
    Object.keys(tasks).forEach(k => {
        tasks[k].zones.forEach((_, i) => {
            const tId = `${k}_${i}`;
            const btn = document.getElementById(`btn_${tId}`);
            const lbl = document.getElementById(`lbl_${tId}`);
            if(!btn) return;
            const last = times[tId]?.toDate().getTime() || 0;
            const diff = Math.floor((last + tasks[k].cd * 1000 - Date.now()) / 1000);
            if(diff > 0) { btn.disabled = true; lbl.innerText = `Wait: ${Math.floor(diff/60)}m ${diff%60}s`; }
            else { btn.disabled = false; lbl.innerText = "Ready!"; }
        });
    });
}

// Chat System (Fast Sync & History)
window.sendMsg = async () => {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if(!txt) return;
    await addDoc(collection(db, "messages"), { uid, username: myName, text: txt, timestamp: serverTimestamp() });
    input.value = "";
};

function initChat() {
    const limitDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = query(collection(db, "messages"), where("timestamp", ">", limitDate), orderBy("timestamp", "asc"));
    onSnapshot(q, (snap) => {
        const box = document.getElementById('chatMessages');
        box.innerHTML = "";
        snap.forEach(doc => {
            const m = doc.data();
            const time = m.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'Just now';
            box.innerHTML += `<div class="msg"><span class="msg-u">@${m.username}:</span><span class="msg-t">${m.text}</span><span class="msg-d">${time}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// Referrals
window.setInviter = async () => {
    const code = document.getElementById('refInput').value.trim();
    if(code === myName) return alert("Invalid");
    const q = query(collection(db, "users"), where("username", "==", code));
    const s = await getDocs(q);
    if(s.empty) return alert("Code not found");
    
    await runTransaction(db, async (t) => {
        t.update(doc(db, "users", uid), { referredBy: code });
        t.update(doc(db, "users", s.docs[0].id), { referralCount: increment(1) });
    });
    alert("Referrer Added!");
};

window.claimBonus = async () => {
    const s = await getDoc(doc(db, "users", uid));
    const b = s.data().referralBonus;
    if(b < 1) return alert("Min 1 PHP");
    await updateDoc(doc(db, "users", uid), { balance: increment(b), referralBonus: 0 });
    alert("Claimed!");
};

// Leaderboard
function initLeaderboard() {
    onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(20)), (s) => {
        const b = document.getElementById('leadBody');
        b.innerHTML = "";
        let i = 1;
        s.forEach(d => {
            b.innerHTML += `<tr><td>${i}</td><td>@${d.data().username}</td><td>₱${d.data().balance.toFixed(2)}</td></tr>`;
            i++;
        });
    });
}

// Withdrawals
window.requestW = async () => {
    const a = parseFloat(document.getElementById('wAmt').value);
    const t = document.getElementById('wTarget').value;
    if(a < 10 || a > uBalance) return alert("Check balance (Min 10)");
    await updateDoc(doc(db, "users", uid), { balance: increment(-a) });
    await addDoc(collection(db, "withdrawals"), { uid, username: myName, amount: a, target: t, status: "pending", timestamp: serverTimestamp() });
    alert("Submitted");
};

function initHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("timestamp", "desc")), (s) => {
        const b = document.getElementById('wHistory');
        b.innerHTML = "";
        s.forEach(d => {
            const w = d.data();
            b.innerHTML += `<tr><td>${w.timestamp?.toDate().toLocaleDateString() || ''}</td><td>${w.target}</td><td>${w.status}</td></tr>`;
        });
    });
}

// Admin
window.adminLogin = () => { if(prompt("Pass?") === "Propetas6") nav('adminPage'); };

onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (s) => {
    const box = document.getElementById('adminReqs');
    box.innerHTML = "";
    s.forEach(d => {
        const w = d.data();
        box.innerHTML += `<div class="card">@${w.username} - ₱${w.amount}<br>${w.target}<br>
        <button onclick="approve('${d.id}','${w.uid}',${w.amount})">Pay</button></div>`;
    });
});

window.approve = async (id, userId, amt) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "paid" });
    const uS = await getDoc(doc(db, "users", userId));
    const ref = uS.data().referredBy;
    if(ref) {
        const q = query(collection(db, "users"), where("username", "==", ref));
        const s = await getDocs(q);
        if(!s.empty) {
            await updateDoc(doc(db, s.docs[0].id), { referralBonus: increment(amt * 0.1), totalRefGains: increment(amt * 0.1) });
        }
    }
};

loadTasks();
start();
