
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment } 
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
tg?.ready();
const user = tg?.initDataUnsafe?.user || { id: "guest", username: "Guest_User", first_name: "Guest" };
const uid = user.id.toString();

// State
let balance = 0;
let lastReward = 0;

// Initialize User
async function initUser() {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { username: user.username || user.first_name, balance: 0 });
    }
    
    onSnapshot(userRef, (doc) => {
        balance = doc.data().balance;
        document.getElementById('userBalance').innerText = balance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 User: @${doc.data().username}`;
    });

    loadHistory();
}

// Show Page Logic
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // Auto-Interstitial logic
    if (pageId === 'adsArea') runAutoAd('show_10276123');
    if (pageId === 'signInArea') runAutoAd('show_10337795');
};

function runAutoAd(id) {
    if (window[id]) {
        window[id]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
    }
}

// Reward Logic
window.triggerTask = async (zoneId, rewardAmt, taskId) => {
    const sdk = window[`show_${zoneId}`];
    sdk().then(async () => {
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        await updateDoc(doc(db, "users", uid), { balance: increment(rewardAmt) });
    });
};

// Withdrawal Logic
window.requestWithdraw = async (method) => {
    const amtInput = method === 'GCash' ? 'gcashAmt' : 'fpAmt';
    const targetInput = method === 'GCash' ? 'gcashNum' : 'fpEmail';
    const amount = parseFloat(document.getElementById(amtInput).value);
    const target = document.getElementById(targetInput).value;

    if (amount > balance || amount < 0.01) return alert("Invalid amount or insufficient balance");

    // Deduct Balance
    await updateDoc(doc(db, "users", uid), { balance: increment(-amount) });

    // Create Request
    await addDoc(collection(db, "withdrawals"), {
        uid,
        username: user.username || user.first_name,
        amount,
        method,
        target,
        status: "pending",
        timestamp: serverTimestamp()
    });

    alert("Withdrawal submitted!");
    document.getElementById(amtInput).value = "";
    document.getElementById(targetInput).value = "";
};

// Admin Dashboard
window.adminLogin = () => {
    if (prompt("Enter Admin Password") === "Propetas6") {
        showPage('adminPage');
        loadAdminData();
    }
};

function loadAdminData() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const body = document.getElementById('adminBody');
        body.innerHTML = "";
        let totalPaid = 0;
        snap.forEach(d => {
            const w = d.data();
            if (w.status === 'paid') totalPaid += w.amount;
            body.innerHTML += `
                <tr>
                    <td>${w.username}</td>
                    <td>${w.method}: ${w.target}</td>
                    <td>₱${w.amount}</td>
                    <td>
                        ${w.status === 'pending' ? 
                        `<button onclick="updateStatus('${d.id}', 'paid')">✅</button>
                         <button onclick="updateStatus('${d.id}', 'denied', '${w.uid}', ${w.amount})">❌</button>` : 
                        w.status}
                    </td>
                </tr>`;
        });
        document.getElementById('adminTotalWithdrawn').innerText = totalPaid.toFixed(2);
    });
}

window.updateStatus = async (id, status, userId = null, refundAmt = 0) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
    if (status === 'denied' && userId) {
        await updateDoc(doc(db, "users", userId), { balance: increment(refundAmt) });
    }
};

function loadHistory() {
    const q = query(collection(db, "withdrawals"), where("uid", "==", uid), limit(10));
    onSnapshot(q, (snap) => {
        const historyBody = document.getElementById('historyBody');
        historyBody.innerHTML = "";
        snap.forEach(d => {
            const w = d.data();
            historyBody.innerHTML += `<tr><td>${w.timestamp?.toDate().toLocaleDateString() || '...'}</td><td>₱${w.amount}</td><td class="status-${w.status}">${w.status}</td></tr>`;
        });
    });
}

// Render UI Components
const taskList = (id, zone) => `
    <div class="card">
        <button class="task-btn" onclick="triggerTask('${zone}', 0.02, '${id}')">🤑 Task #${id} 🍍</button>
    </div>`;

document.getElementById('adsList').innerHTML = taskList(1, 10276123) + taskList(2, 10337795) + taskList(3, 10337853);
document.getElementById('signInList').innerHTML = taskList('S1', 10276123) + taskList('S2', 10337795) + taskList('S3', 10337853);
document.getElementById('giftList').innerHTML = taskList('G1', 10276123) + taskList('G2', 10337795) + taskList('G3', 10337853);

initUser();
