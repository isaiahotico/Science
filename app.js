
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment, runTransaction } 
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

// Telegram Init
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user || { id: "dev_test", username: "DevTester", first_name: "Tester" };
const uid = user.id.toString();
const myCode = user.username || `User${uid.slice(0,4)}`;

// App State
let balance = 0, referralBonus = 0;

async function initApp() {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { username: myCode, balance: 0, referralBonus: 0, referredBy: null, referralCount: 0, totalRefGains: 0 });
    }

    onSnapshot(userRef, (d) => {
        const data = d.data();
        balance = data.balance;
        referralBonus = data.referralBonus;
        document.getElementById('balance').innerText = balance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 User: @${data.username}`;
        document.getElementById('myCode').innerText = data.username;
        document.getElementById('refBonus').innerText = referralBonus.toFixed(2);
        document.getElementById('refCount').innerText = data.referralCount;
        document.getElementById('refTotalGains').innerText = `₱ ${data.totalRefGains.toFixed(2)}`;
        if(data.referredBy) document.getElementById('refInputArea').innerHTML = `<p style="color:green">Referred by: ${data.referredBy}</p>`;
    });

    loadTasks();
    loadHistory();
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// Global DateTime Footer
function updateDateTime() {
    const now = new Date();
    document.getElementById('footerDateTime').innerText = now.toLocaleString();
}

// Task Rendering & Timer Logic
const tasks = {
    ads: { zones: [10276123, 10337795, 10337853], cooldown: 300, reward: 0.02, container: 'adsList', prefix: 'A' },
    sign: { zones: [10276123, 10337795, 10337853], cooldown: 10800, reward: 0.025, container: 'signInList', prefix: 'S' },
    gift: { zones: [10276123, 10337795, 10337853], cooldown: 1200, reward: 0.02, container: 'giftList', prefix: 'G' }
};

function loadTasks() {
    Object.keys(tasks).forEach(key => {
        const group = tasks[key];
        const cont = document.getElementById(group.container);
        cont.innerHTML = '';
        group.zones.forEach((zone, i) => {
            const taskId = `${group.prefix}${i}`;
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <button class="btn" id="btn-${taskId}" onclick="runAd('${zone}', ${group.reward}, '${taskId}', ${group.cooldown})">🍍 Task #${i+1} 🍍</button>
                <div id="timer-${taskId}" class="timer-box"></div>
            `;
            cont.appendChild(card);
            checkCooldown(taskId, group.cooldown);
        });
    });
}

window.runAd = (zone, reward, taskId, cooldown) => {
    const sdk = window[`show_${zone}`];
    sdk().then(async () => {
        await updateDoc(doc(db, "users", uid), { balance: increment(reward) });
        localStorage.setItem(`cd_${taskId}`, Date.now());
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        checkCooldown(taskId, cooldown);
    });
};

function checkCooldown(taskId, cooldown) {
    const btn = document.getElementById(`btn-${taskId}`);
    const timer = document.getElementById(`timer-${taskId}`);
    const last = localStorage.getItem(`cd_${taskId}`);
    
    if (last) {
        const remaining = Math.floor((parseInt(last) + cooldown * 1000 - Date.now()) / 1000);
        if (remaining > 0) {
            btn.disabled = true;
            timer.innerText = `Wait: ${Math.floor(remaining/60)}m ${remaining%60}s`;
            setTimeout(() => checkCooldown(taskId, cooldown), 1000);
            return;
        }
    }
    btn.disabled = false;
    timer.innerText = "Status: Ready 🍍";
}

// Referral Logic
window.setReferral = async () => {
    const code = document.getElementById('refCodeInput').value.trim();
    if (code === myCode) return alert("You cannot refer yourself.");
    
    const q = query(collection(db, "users"), where("username", "==", code));
    onSnapshot(q, async (snap) => {
        if (snap.empty) return alert("Invalid Code");
        const inviterDoc = snap.docs[0];
        await updateDoc(doc(db, "users", uid), { referredBy: code });
        await updateDoc(doc(db, "users", inviterDoc.id), { referralCount: increment(1) });
        alert("Referral activated!");
    }, { once: true });
};

window.claimRefBonus = async () => {
    if (referralBonus < 1) return alert("Minimum 1 PHP to claim");
    await updateDoc(doc(db, "users", uid), { balance: increment(referralBonus), referralBonus: 0 });
    alert("Bonus moved to main balance!");
};

// Admin & Withdrawal
window.withdraw = async (method) => {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const target = document.getElementById('wTarget').value;
    if (amt > balance || amt < 10) return alert("Min withdraw 10 PHP");
    
    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), { uid, username: myCode, amount: amt, method, target, status: 'pending', timestamp: serverTimestamp() });
    alert("Withdrawal submitted!");
};

window.updateStatus = async (id, status, user_id, amount) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if (status === 'paid') {
        const uSnap = await getDoc(doc(db, "users", user_id));
        const refBy = uSnap.data().referredBy;
        if (refBy) {
            const q = query(collection(db, "users"), where("username", "==", refBy));
            onSnapshot(q, async (snap) => {
                if (!snap.empty) {
                    await updateDoc(doc(db, "users", snap.docs[0].id), { 
                        referralBonus: increment(amount * 0.1), 
                        totalRefGains: increment(amount * 0.1) 
                    });
                }
            }, { once: true });
        }
    }
};

window.adminLogin = () => { if(prompt("Pass?") === "Propetas6") showPage('adminPage'); };

// Data Loaders (History & Admin)
function loadHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid)), (snap) => {
        const tbody = document.getElementById('historyBody');
        tbody.innerHTML = '';
        snap.forEach(d => {
            const w = d.data();
            tbody.innerHTML += `<tr><td>${w.timestamp?.toDate().toLocaleDateString() || '...'}</td><td>${w.method}</td><td>${w.status}</td></tr>`;
        });
    });
}

onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc")), (snap) => {
    const tbody = document.getElementById('adminBody');
    tbody.innerHTML = ''; let total = 0;
    snap.forEach(d => {
        const w = d.data();
        if(w.status === 'paid') total += w.amount;
        tbody.innerHTML += `<tr><td>${w.username}</td><td>₱${w.amount}</td><td>
            ${w.status === 'pending' ? `<button onclick="updateStatus('${d.id}', 'paid', '${w.uid}', ${w.amount})">Paid</button>` : w.status}
        </td></tr>`;
    });
    document.getElementById('adminTotal').innerText = total.toFixed(2);
});

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

initApp();
