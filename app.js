
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

const tg = window.Telegram?.WebApp;
tg?.ready();
const userUID = tg?.initDataUnsafe?.user?.id?.toString() || "dev_test";
const myUsername = tg?.initDataUnsafe?.user?.username || "Guest_" + userUID.slice(0,4);

let uData = { balance: 0, cooldowns: {}, referrer: null };

// --- Initialization & Real-time Sync ---
const userRef = doc(db, "users", userUID);
onSnapshot(userRef, (s) => {
    if (s.exists()) {
        uData = s.data();
        document.getElementById('balanceDisplay').innerText = `₱${uData.balance.toFixed(3)}`;
        document.getElementById('myRefCode').innerText = myUsername;
        document.getElementById('refCodeDisplay').innerText = uData.referrer || "None";
    } else {
        setDoc(userRef, { username: myUsername, balance: 0, cooldowns: {}, referrer: null });
    }
});

// --- Navigation ---
window.showPage = (id) => {
    document.querySelectorAll('div[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'page-ads' || id === 'page-signin' || id === 'page-gifts') runAutoAd();
    if(id === 'page-admin') loadAdmin();
    if(id === 'page-withdraw') loadHistory();
};

function runAutoAd() {
    if(window.show_10337795) {
        window.show_10337795({type: 'inApp', inAppSettings: {frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false}});
    }
}

// --- Task Engine ---
const setupTasks = () => {
    const config = [
        { div: 'area-ads', type: 'ads', amt: 0.02, label: 'Task' },
        { div: 'area-signin', type: 'si', amt: 0.025, label: 'Task' },
        { div: 'area-gifts', type: 'gt', amt: 0.02, label: 'Gift' }
    ];
    config.forEach(c => {
        const target = document.getElementById(c.div);
        target.innerHTML = '';
        for(let i=1; i<=3; i++) {
            target.innerHTML += `
                <div class="card">
                    <button class="btn btn-task" id="btn-${c.type}-${i}" onclick="watchAd('${c.type}', ${i})">🤑🍍${c.label} #${i}🍍🤑</button>
                    <div id="cd-${c.type}-${i}" class="cooldown"></div>
                    <button class="btn btn-claim" id="claim-${c.type}-${i}" onclick="claimTask('${c.type}', ${i}, ${c.amt})">CLAIM ₱${c.amt}</button>
                </div>`;
        }
    });
};

window.watchAd = (type, id) => {
    const now = Date.now();
    if(uData.cooldowns[`${type}_${id}`] > now) return alert("Cooldown active!");
    
    const adFunc = id === 1 ? show_10276123 : (id === 2 ? show_10337795 : show_10337853);
    const mode = type === 'gt' ? 'pop' : ''; // Gifts use rewarded popup

    adFunc(mode).then(() => {
        document.getElementById(`btn-${type}-${id}`).style.display = 'none';
        document.getElementById(`claim-${type}-${id}`).style.display = 'block';
    }).catch(() => alert("Ad failed to load. Try again."));
};

window.claimTask = async (type, id, amt) => {
    const cds = { ads: 5*60*1000, si: 3*60*60*1000, gt: 20*60*1000 };
    const newCDs = {...uData.cooldowns, [`${type}_${id}`]: Date.now() + cds[type]};
    
    // Reward User
    await updateDoc(userRef, { balance: increment(amt), cooldowns: newCDs });

    // Referral 10% Bonus
    if(uData.referrer) {
        const refQ = query(collection(db, "users"), where("username", "==", uData.referrer), limit(1));
        onSnapshot(refQ, (snap) => {
            snap.forEach(d => updateDoc(doc(db, "users", d.id), { balance: increment(amt * 0.1) }));
        });
    }

    document.getElementById(`btn-${type}-${id}`).style.display = 'block';
    document.getElementById(`claim-${type}-${id}`).style.display = 'none';
    alert("🎉Congratulations🎉 money earned! Referral bonus sent if applicable.🍍");
};

// --- Referrals ---
window.setReferrer = async () => {
    const refName = document.getElementById('input-referrer').value.trim();
    if(refName === myUsername) return alert("Cannot refer yourself!");
    await updateDoc(userRef, { referrer: refName });
    alert("Referrer set!");
};

// --- Withdrawal & Admin ---
window.requestWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const addr = document.getElementById('wd-addr').value;
    const method = document.getElementById('wd-method').value;
    if(amt > uData.balance || amt <= 0) return alert("Invalid amount!");

    await addDoc(collection(db, "withdrawals"), { 
        userUID, username: myUsername, amount: amt, address: addr, method, status: "Pending", date: Date.now() 
    });
    await updateDoc(userRef, { balance: increment(-amt) });
    alert("Withdrawal Requested!");
};

function loadHistory() {
    const q = query(collection(db, "withdrawals"), where("userUID", "==", userUID), orderBy("date", "desc"), limit(10));
    onSnapshot(q, s => {
        let h = '<table>';
        s.forEach(d => h += `<tr><td>₱${d.data().amount}</td><td class="status-${d.data().status}">${d.data().status}</td></tr>`);
        document.getElementById('history-list').innerHTML = h + '</table>';
    });
}

function loadAdmin() {
    onSnapshot(query(collection(db, "withdrawals"), limit(20)), s => {
        let h = '<table>';
        s.forEach(d => {
            const data = d.data();
            h += `<tr><td>${data.username}<br>₱${data.amount}</td><td>
                <button onclick="updateWd('${d.id}','Paid')">✔</button>
                <button onclick="updateWd('${d.id}','Denied')">✖</button>
            </td></tr>`;
        });
        document.getElementById('admin-list').innerHTML = h + '</table>';
    });
}
window.updateWd = (id, status) => updateDoc(doc(db, "withdrawals", id), { status });

// --- Cooldown Loop ---
setInterval(() => {
    const now = Date.now();
    ['ads','si','gt'].forEach(t => {
        for(let i=1; i<=3; i++) {
            const el = document.getElementById(`cd-${t}-${i}`);
            if(!el) continue;
            const cd = uData.cooldowns[`${t}_${i}`] || 0;
            if(cd > now) {
                const r = cd - now;
                el.innerText = `Wait: ${Math.floor(r/60000)}m ${Math.floor((r%60000)/1000)}s`;
            } else el.innerText = "";
        }
    });
}, 1000);

setupTasks();
