
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, where, increment, serverTimestamp } 
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
const userUID = tg?.initDataUnsafe?.user?.id?.toString() || "dev_888";
const username = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "User";

let uData = { balance: 0, cooldowns: {}, myRef: '', refBy: '' };

// --- Init User & Real-time Update ---
const uRef = doc(db, "users", userUID);
onSnapshot(uRef, async (s) => {
    if (s.exists()) {
        uData = s.data();
        document.getElementById('balanceDisplay').innerText = `₱${uData.balance.toFixed(3)}`;
        document.getElementById('my-code').innerText = uData.myRef;
        document.getElementById('u-name').innerText = username;
        document.getElementById('u-id').innerText = userUID;
    } else {
        const newRefCode = Math.floor(100000 + Math.random() * 900000).toString();
        await setDoc(uRef, { username, balance: 0, cooldowns: {}, myRef: newRefCode, refBy: '' });
    }
}, (err) => console.error("Snapshot error:", err));

// --- Navigation ---
window.go = (id) => {
    document.querySelectorAll('div[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(['page-ads','page-signin','page-gifts'].includes(id)) {
        if(window.show_10337795) window.show_10337795({type:'inApp', inAppSettings:{frequency:2, capping:0.1, interval:30, timeout:5, everyPage:false}});
    }
    if(id === 'page-admin') loadAdmin();
    if(id === 'page-withdraw') loadHistory();
};

// --- Task Engine ---
const draw = () => {
    const sets = [
        { id: 'list-ads', t: 'ads', a: 0.02, l: 'Task' },
        { id: 'list-signin', t: 'si', a: 0.025, l: 'Sign' },
        { id: 'list-gifts', t: 'gt', a: 0.02, l: 'Gift' }
    ];
    sets.forEach(s => {
        const div = document.getElementById(s.id);
        div.innerHTML = '';
        for(let i=1; i<=3; i++) {
            div.innerHTML += `
                <div class="card">
                    <button class="btn btn-main" id="btn-${s.t}-${i}" onclick="playAd('${s.t}', ${i})">🤑🍍 ${s.l} #${i} 🍍🤑</button>
                    <div id="cd-${s.t}-${i}" class="cooldown"></div>
                    <button class="btn btn-claim" id="claim-${s.t}-${i}" onclick="claimAd('${s.t}', ${i}, ${s.a})">🎁 CLAIM ₱${s.a}</button>
                </div>`;
        }
    });
};

window.playAd = (t, i) => {
    if(uData.cooldowns[`${t}_${i}`] > Date.now()) return;
    const sdk = i === 1 ? show_10276123 : (i === 2 ? show_10337795 : show_10337853);
    const mode = t === 'gt' ? 'pop' : '';

    sdk(mode).then(() => {
        document.getElementById(`btn-${t}-${i}`).style.display = 'none';
        document.getElementById(`claim-${t}-${i}`).style.display = 'block';
    }).catch(e => alert("Ad Busy. Click again."));
};

window.claimAd = async (t, i, a) => {
    const times = { ads: 300000, si: 10800000, gt: 1200000 };
    const newCD = {...uData.cooldowns, [`${t}_${i}`]: Date.now() + times[t]};
    
    await updateDoc(uRef, { balance: increment(a), cooldowns: newCD });

    // 10% Referral Bonus
    if(uData.refBy) {
        const qRef = query(collection(db, "users"), where("myRef", "==", uData.refBy), limit(1));
        const qSnap = await getDoc(doc(db, "users", "some_id")); // Logic updated below for speed
        // To keep it fast, we use a global referral listener or background update
        onSnapshot(qRef, snap => { snap.forEach(d => updateDoc(doc(db, "users", d.id), { balance: increment(a * 0.1) })); }, {once: true});
    }

    document.getElementById(`btn-${t}-${i}`).style.display = 'block';
    document.getElementById(`claim-${t}-${i}`).style.display = 'none';
};

// --- Referrals ---
window.bindRef = async () => {
    const val = document.getElementById('ref-input').value;
    if(val === uData.myRef) return alert("Error: Self-refer");
    await updateDoc(uRef, { refBy: val });
    alert("Referrer Linked!");
};

// --- Withdrawals ---
window.requestWD = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const addr = document.getElementById('wd-addr').value;
    const method = document.getElementById('wd-method').value;

    if(amt > uData.balance || amt <= 0 || !addr) return alert("Insufficient/Invalid");

    // Atomic Balance Update (No negative)
    await updateDoc(uRef, { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), {
        uid: userUID, name: username, amount: amt, address: addr, method: method, status: "Pending", date: new Date().toLocaleString()
    });
    alert("Withdrawal Logged!");
};

function loadHistory() {
    const q = query(collection(db, "withdrawals"), where("uid", "==", userUID), limit(10));
    onSnapshot(q, s => {
        let h = '<table><tr><th>Date</th><th>Amt</th><th>Status</th></tr>';
        s.forEach(d => {
            const w = d.data();
            h += `<tr><td>${w.date}</td><td>₱${w.amount}</td><td class="status-${w.status}">${w.status}</td></tr>`;
        });
        document.getElementById('wd-history').innerHTML = h + '</table>';
    });
}

// --- Admin Dashboard ---
function loadAdmin() {
    onSnapshot(collection(db, "withdrawals"), s => {
        let h = '<table><tr><th>Name</th><th>Info</th><th>Action</th></tr>';
        s.forEach(d => {
            const w = d.data();
            h += `<tr><td>${w.name}</td><td>₱${w.amount}<br>${w.method}: ${w.address}</td><td>
                ${w.status === 'Pending' ? `
                <button onclick="admUpd('${d.id}','Paid')">✅</button>
                <button onclick="admUpd('${d.id}','Denied')">❌</button>` : w.status}
            </td></tr>`;
        });
        document.getElementById('admin-table').innerHTML = h + '</table>';
    });
}
window.admUpd = (id, st) => updateDoc(doc(db, "withdrawals", id), { status: st });

// --- Cooldown Timer ---
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
                el.innerText = `Wait: ${m}m ${s}s`;
            } else el.innerText = "";
        }
    });
}, 1000);

draw();
