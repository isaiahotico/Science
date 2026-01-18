
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

// --- Telegram Ready ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "@Guest";
const userUID = tgUser?.id?.toString() || "dev_local";

let uData = { balance: 0, cooldowns: {}, refBy: null };

// --- Real-time Sync ---
const uRef = doc(db, "users", userUID);
onSnapshot(uRef, (s) => {
    if (s.exists()) {
        uData = s.data();
        document.getElementById('balanceDisplay').innerText = `₱${uData.balance.toFixed(3)}`;
        document.getElementById('u-name').innerText = `👤 User: ${username}`;
        document.getElementById('my-ref-id').innerText = username;
        document.getElementById('current-ref').innerText = uData.refBy || "None";
    } else {
        setDoc(uRef, { username, balance: 0, cooldowns: {}, refBy: null });
    }
});

// --- Navigation & Auto Interstitials ---
window.go = (id) => {
    document.querySelectorAll('div[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');

    const adSettings = { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false };

    if(id === 'page-ads') {
        if(window.show_10337853) show_10337853({ type: 'inApp', inAppSettings: adSettings });
    } else if(id === 'page-signin') {
        if(window.show_10276123) show_10276123({ type: 'inApp', inAppSettings: adSettings });
    } else if(id === 'page-gifts') {
        if(window.show_10337795) show_10337795({ type: 'inApp', inAppSettings: adSettings });
    }

    if(id === 'page-withdraw') loadHistory();
    if(id === 'page-admin') loadAdmin();
};

window.adminAuth = () => {
    if(prompt("Admin Password:") === "Propetas12") go('page-admin');
    else alert("Wrong Password!");
};

// --- Tasks Rendering ---
const renderTasks = () => {
    const config = [
        { id: 'list-ads', t: 'ads', a: 0.02, l: 'Task', cd: 300000 },
        { id: 'list-signin', t: 'si', a: 0.025, l: 'Task', cd: 10800000 },
        { id: 'list-gifts', t: 'gt', a: 0.02, l: 'Gift', cd: 1200000 }
    ];
    config.forEach(c => {
        const div = document.getElementById(c.id);
        div.innerHTML = '';
        for(let i=1; i<=3; i++){
            div.innerHTML += `
                <div class="card">
                    <button class="btn btn-task" id="btn-${c.t}-${i}" onclick="playAd('${c.t}', ${i})">🤑🍍 ${c.l} #${i} 🍍🤑</button>
                    <div id="cd-${c.t}-${i}" class="cooldown"></div>
                    <button class="btn btn-claim" id="claim-${c.t}-${i}" onclick="claimReward('${c.t}', ${i}, ${c.a}, ${c.cd})">🎁 CLAIM ₱${c.a}</button>
                </div>`;
        }
    });
};

window.playAd = (t, i) => {
    if(uData.cooldowns[`${t}_${i}`] > Date.now()) return;
    const sdk = i === 1 ? show_10276123 : (i === 2 ? show_10337795 : show_10337853);
    
    // Gifts use rewarded popup format per req #3
    const mode = t === 'gt' ? 'pop' : '';

    sdk(mode).then(() => {
        alert('You have seen an ad!');
        document.getElementById(`btn-${t}-${i}`).style.display = 'none';
        document.getElementById(`claim-${t}-${i}`).style.display = 'block';
    }).catch(() => alert("Ad Busy. Try again."));
};

window.claimReward = async (t, i, a, cdTime) => {
    const newCDs = {...uData.cooldowns, [`${t}_${i}`]: Date.now() + cdTime};
    
    // Reward User & Update CD
    await updateDoc(uRef, { balance: increment(a), cooldowns: newCDs });

    // Referral 10% Bonus Logic
    if(uData.refBy) {
        const qRef = query(collection(db, "users"), where("username", "==", uData.refBy), limit(1));
        onSnapshot(qRef, (snap) => {
            snap.forEach(d => updateDoc(doc(db, "users", d.id), { balance: increment(a * 0.1) }));
        }, { once: true });
    }

    document.getElementById(`btn-${t}-${i}`).style.display = 'block';
    document.getElementById(`claim-${t}-${i}`).style.display = 'none';
    alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
};

// --- Referrals ---
window.setReferrer = async () => {
    const input = document.getElementById('ref-input').value.trim();
    if(input === username) return alert("Can't refer yourself.");
    await updateDoc(uRef, { refBy: input });
    alert("Referrer Linked!");
};

// --- Withdrawal System ---
window.handleWD = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const addr = document.getElementById('wd-addr').value;
    const meth = document.getElementById('wd-method').value;

    if(amt > uData.balance || amt <= 0 || !addr) return alert("Check balance/details.");

    // Prevent negative: Deduct first
    await updateDoc(uRef, { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), {
        uid: userUID, name: username, amount: amt, address: addr, method: meth, status: "Pending", date: new Date().toLocaleString()
    });
    alert("Success!");
};

function loadHistory() {
    const q = query(collection(db, "withdrawals"), where("uid", "==", userUID), limit(10));
    onSnapshot(q, s => {
        let h = '<table><tr><th>Date</th><th>₱</th><th>Status</th></tr>';
        s.forEach(d => {
            const w = d.data();
            h += `<tr><td>${w.date}</td><td>${w.amount}</td><td class="status-${w.status}">${w.status}</td></tr>`;
        });
        document.getElementById('wd-history').innerHTML = h + '</table>';
    });
}

// --- Admin Panel ---
function loadAdmin() {
    onSnapshot(collection(db, "withdrawals"), s => {
        let h = '<table><tr><th>User</th><th>Info</th><th>Action</th></tr>';
        s.forEach(d => {
            const w = d.data();
            h += `<tr><td>${w.name}</td><td>₱${w.amount}<br>${w.method}:${w.address}</td><td>
                ${w.status === 'Pending' ? `<button onclick="updWd('${d.id}','Paid')">✅</button><button onclick="updWd('${d.id}','Denied')">❌</button>` : w.status}
            </td></tr>`;
        });
        document.getElementById('admin-table').innerHTML = h + '</table>';
    });
}
window.updWd = (id, st) => updateDoc(doc(db, "withdrawals", id), { status: st });

// --- Cooldown Clock ---
setInterval(() => {
    const now = Date.now();
    ['ads','si','gt'].forEach(t => {
        for(let i=1; i<=3; i++){
            const el = document.getElementById(`cd-${t}-${i}`);
            if(!el) continue;
            const cd = uData.cooldowns[`${t}_${i}`] || 0;
            if(cd > now){
                const r = cd - now;
                const m = Math.floor(r/60000); const s = Math.floor((r%60000)/1000);
                el.innerText = `Ready in: ${m}m ${s}s`;
            } else el.innerText = "";
        }
    });
}, 1000);

renderTasks();
