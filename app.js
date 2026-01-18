
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, where, increment } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- Telegram & User Setup ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const userId = tg?.initDataUnsafe?.user?.id?.toString() || "local_user";
const username = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "Guest";
document.getElementById('usernameDisplay').innerText = `@${username}`;

let userData = { balance: 0, cooldowns: {} };

// --- Real-time User Data ---
onSnapshot(doc(db, "users", userId), (docSnap) => {
    if (docSnap.exists()) {
        userData = docSnap.data();
        document.getElementById('balanceDisplay').innerText = `₱${userData.balance.toFixed(3)}`;
    } else {
        setDoc(doc(db, "users", userId), { username, balance: 0, cooldowns: {} });
    }
});

// --- Navigation ---
window.showPage = (id) => {
    document.querySelectorAll('div[id^="page-"], #nav-menu').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-gifts') runAutoAd();
    if(id === 'page-admin') loadAdminData();
    if(id === 'page-withdraw') loadUserHistory();
};

// --- Task Rendering ---
const renderTasks = () => {
    const si = document.getElementById('signin-tasks');
    const gt = document.getElementById('gift-tasks');
    si.innerHTML = ''; gt.innerHTML = '';

    for(let i=1; i<=3; i++) {
        si.innerHTML += createTaskUI('si', i, '0.025');
        gt.innerHTML += createTaskUI('gt', i, '0.020');
    }
};

const createTaskUI = (type, id, amt) => `
    <div class="card">
        <button class="btn btn-main" id="btn-${type}-${id}" onclick="triggerAd('${type}', ${id})">🍍${type==='si'?'Task':'Gift'} #${id}🍍</button>
        <div id="cd-${type}-${id}" class="cooldown"></div>
        <button class="btn btn-claim" id="claim-${type}-${id}" onclick="claimReward('${type}', ${id}, ${amt})">CLAIM ₱${amt}</button>
    </div>`;

// --- Ad Logic ---
function runAutoAd() {
    if(window.show_10337795) {
        window.show_10337795({type: 'inApp', inAppSettings: {frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false}});
    }
}

window.triggerAd = (type, id) => {
    const now = Date.now();
    const cdKey = `${type}_${id}`;
    if(userData.cooldowns[cdKey] > now) return alert("Still on cooldown!");

    const adFunc = id === 1 ? show_10276123 : (id === 2 ? show_10337795 : show_10337853);
    const method = type === 'gt' ? 'pop' : '';

    adFunc(method).then(() => {
        document.getElementById(`btn-${type}-${id}`).style.display = 'none';
        document.getElementById(`claim-${type}-${id}`).style.display = 'block';
    });
};

window.claimReward = async (type, id, amt) => {
    const cdKey = `${type}_${id}`;
    const cdTime = type === 'si' ? (3*60*60*1000) : (20*60*1000);
    
    const newCooldowns = {...userData.cooldowns, [cdKey]: Date.now() + cdTime};
    await updateDoc(doc(db, "users", userId), {
        balance: increment(amt),
        cooldowns: newCooldowns
    });

    document.getElementById(`btn-${type}-${id}`).style.display = 'block';
    document.getElementById(`claim-${type}-${id}`).style.display = 'none';
    alert("🎉Congratulations🎉 you earned money!!😍🍍");
};

// --- Withdrawal System ---
window.handleWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const addr = document.getElementById('wd-address').value;
    const method = document.getElementById('wd-method').value;

    if(amt > userData.balance || amt <= 0 || !addr) return alert("Check balance or input!");

    await addDoc(collection(db, "withdrawals"), {
        userId, username, amount: amt, address: addr, method, status: "Pending", timestamp: Date.now()
    });
    await updateDoc(doc(db, "users", userId), { balance: increment(-amt) });
    alert("Request Sent!");
};

function loadUserHistory() {
    const q = query(collection(db, "withdrawals"), where("userId", "==", userId), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        let html = '<table><tr><th>Amt</th><th>Status</th></tr>';
        snap.forEach(d => {
            const data = d.data();
            html += `<tr><td>₱${data.amount}</td><td class="status-${data.status}">${data.status}</td></tr>`;
        });
        document.getElementById('user-history').innerHTML = html + '</table>';
    });
}

// --- Admin Dashboard ---
function loadAdminData() {
    const q = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(20));
    onSnapshot(q, (snap) => {
        let html = '<table><tr><th>User</th><th>Details</th><th>Action</th></tr>';
        let totalPaid = 0;
        snap.forEach(d => {
            const data = d.data();
            if(data.status === 'Paid') totalPaid += data.amount;
            html += `<tr>
                <td>${data.username}</td>
                <td>₱${data.amount}<br><small>${data.method}</small></td>
                <td>
                    ${data.status === 'Pending' ? `
                    <div class="admin-controls">
                        <button class="btn-sm" style="background:green" onclick="updateWdStatus('${d.id}', 'Paid')">✔</button>
                        <button class="btn-sm" style="background:red" onclick="updateWdStatus('${d.id}', 'Denied')">✖</button>
                    </div>` : data.status}
                </td>
            </tr>`;
        });
        document.getElementById('admin-list').innerHTML = html + '</table>';
        document.getElementById('admin-total-paid').innerText = totalPaid.toFixed(2);
    });
}

window.updateWdStatus = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status });
};

// --- Timers ---
setInterval(() => {
    const now = Date.now();
    ['si', 'gt'].forEach(type => {
        for(let i=1; i<=3; i++){
            const cd = userData.cooldowns[`${type}_${i}`] || 0;
            const el = document.getElementById(`cd-${type}-${i}`);
            if(!el) continue;
            if(cd > now) {
                const rem = cd - now;
                const m = Math.floor(rem/60000); const s = Math.floor((rem%60000)/1000);
                el.innerText = `Wait: ${m}m ${s}s`;
            } else el.innerText = "";
        }
    });
}, 1000);

renderTasks();
