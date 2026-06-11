
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, 
    collection, query, where, addDoc, serverTimestamp, increment, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const CONTRACT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days lifecycle
const PROFIT = 0.05;
const RATE = PROFIT / CONTRACT_MS;

let myUid = localStorage.getItem('sg_v6_uid') || "U-" + Math.random().toString(36).substring(2, 10).toUpperCase();
localStorage.setItem('sg_v6_uid', myUid);

let user = { balance: 0, plants: [], pHistory: [] };
let curPage = 1;

const getMs = (v) => v?.seconds ? v.seconds * 1000 : Number(v || Date.now());

async function start() {
    const uRef = doc(db, "users", myUid);
    const snap = await getDoc(uRef);

    if (!snap.exists()) {
        await setDoc(uRef, {
            id: myUid, balance: 0, plants: [], pHistory: [], referrals: 0, 
            earnings: 0, refCode: Math.random().toString(36).substring(2, 8).toUpperCase()
        });
        await updateDoc(doc(db, "global", "stats"), { totalUsers: increment(1) }, { merge: true });
    }

    onSnapshot(uRef, (d) => { user = d.data(); renderUI(); });
    onSnapshot(doc(db, "global", "stats"), (d) => { 
        document.getElementById('global-users').innerText = d.data()?.totalUsers || "..."; 
    });

    // Real-time Mining Ticker and Live Foot Clock
    setInterval(updateTicker, 200);
    setInterval(updateSystemTime, 1000);
}

// System Time Driver
const updateSystemTime = () => {
    const now = new Date();
    document.getElementById('live-clock').innerText = now.toLocaleString();
};

// --- TABLE PAGINATION SYSTEM ---
const changePage = (dir) => {
    const maxPage = Math.ceil(user.plants.length / 20) || 1;
    curPage = Math.max(1, Math.min(maxPage, curPage + dir));
    renderUI();
};

const updateTicker = () => {
    const now = Date.now();
    const startIdx = (curPage - 1) * 20;
    const pagePlants = user.plants.slice(startIdx, startIdx + 20);

    pagePlants.forEach((p, i) => {
        const globalIdx = startIdx + i;
        const startMs = getMs(p.start);
        const elapsed = Math.min(now - startMs, CONTRACT_MS);
        const acc = Math.max(0, (elapsed * RATE) - (p.claimed || 0));
        
        // Update accumulated balance in real-time
        const accEl = document.getElementById(`acc-${globalIdx}`);
        if (accEl) accEl.innerText = acc.toFixed(8);

        // Update real-time formatted remaining lifecycle expiry display
        const expEl = document.getElementById(`exp-${globalIdx}`);
        if (expEl) {
            const timeLeft = Math.max(0, (startMs + CONTRACT_MS) - now);
            if (timeLeft === 0) {
                expEl.innerText = "COMPLETE";
                expEl.className = "px-4 py-3 font-mono font-black text-red-500";
            } else {
                const days = Math.floor(timeLeft / 86400000);
                const hrs = Math.floor((timeLeft % 86400000) / 3600000);
                const mins = Math.floor((timeLeft % 3600000) / 60000);
                expEl.innerText = `${days}d ${hrs}h ${mins}m left`;
            }
        }
    });
};

function renderUI() {
    document.getElementById('main-bal').innerText = user.balance.toFixed(8);
    document.getElementById('stat-refs').innerText = user.referrals || 0;
    document.getElementById('stat-ref-inc').innerText = `₱${(user.earnings || 0).toFixed(4)}`;
    document.getElementById('stat-garden').innerText = `${user.plants.length}/500`;
    document.getElementById('ref-code').innerText = user.refCode;
    document.getElementById('uid-tag').innerText = `ID: ${myUid}`;

    const maxPage = Math.ceil(user.plants.length / 20) || 1;
    document.getElementById('page-info').innerText = `Page ${curPage} / ${maxPage}`;

    const tbody = document.getElementById('garden-tbody');
    tbody.innerHTML = "";
    
    const startIdx = (curPage - 1) * 20;
    const pagePlants = user.plants.slice(startIdx, startIdx + 20);

    if (pagePlants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 font-bold text-slate-400 uppercase tracking-wider text-[10px]">No plants currently in garden.</td></tr>`;
        return;
    }

    pagePlants.forEach((p, i) => {
        const globalIdx = startIdx + i;
        const startMs = getMs(p.start);
        
        // Expiry Date/Time formatting for the specific contract row
        const expDate = new Date(startMs + CONTRACT_MS).toLocaleString();

        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 hover:bg-slate-50 transition text-[10px] font-semibold";
        tr.innerHTML = `
            <td class="px-4 py-3 font-mono text-slate-400">#${globalIdx + 1}</td>
            <td class="px-4 py-3 text-slate-800 font-extrabold tracking-tight">Sampaguita Flower</td>
            <td class="px-4 py-3 font-mono font-bold text-emerald-600">₱<span id="acc-${globalIdx}">0.00000000</span></td>
            <td class="px-4 py-3 font-mono text-slate-500" id="exp-${globalIdx}">${expDate}</td>
            <td class="px-4 py-3 text-right">
                <button onclick="claim(${globalIdx})" class="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1 rounded-lg text-[9px] font-black tracking-wider uppercase transition">Claim (663)</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    renderHistory();
}

// --- CONTROLLERS ---

// Buy Flow -> Triggers Zone 10555746
window.buyFlower = async () => {
    if (user.plants.length >= 500) return alert("Garden full!");
    const now = Date.now();
    const hourly = (user.pHistory || []).filter(t => now - getMs(t) < 3600000);
    if (hourly.length >= 10) return alert("Planting limit: Max 10 per hour reached.");

    // Direct Zone Call
    if (typeof window.show_10555746 === 'function') await window.show_10555746();
    
    await updateDoc(doc(db, "users", myUid), {
        plants: [...user.plants, { start: now, claimed: 0 }],
        pHistory: [...hourly, now]
    });
};

// Claim Flow -> Unlimited, Triggers Zone 10555663 immediately
window.claim = async (idx) => {
    const p = user.plants[idx];
    const now = Date.now();
    const elapsed = Math.min(now - getMs(p.start), CONTRACT_MS);
    const amount = (elapsed * RATE) - (p.claimed || 0);

    if (amount < 0.00000001) return alert("Nothing to claim yet!");

    // Direct Instant Unlimited Call
    if (typeof window.show_10555663 === 'function') await window.show_10555663();

    let newPlants = [...user.plants];
    if (elapsed >= CONTRACT_MS) {
        newPlants.splice(idx, 1);
    } else {
        newPlants[idx].claimed = (elapsed * RATE);
    }

    await updateDoc(doc(db, "users", myUid), {
        balance: increment(amount),
        plants: newPlants
    });

    if (user.inviter) {
        await updateDoc(doc(db, "users", user.inviter), {
            balance: increment(amount * 0.05),
            earnings: increment(amount * 0.05)
        });
    }
};

window.bindRef = async () => {
    const code = document.getElementById('ref-input').value.trim().toUpperCase();
    if (code === user.refCode || user.inviter) return alert("Invalid Code or Link status.");
    const q = query(collection(db, "users"), where("refCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return alert("Code not found.");
    const boss = snap.docs[0].id;
    await updateDoc(doc(db, "users", myUid), { inviter: boss });
    await updateDoc(doc(db, "users", boss), { referrals: increment(1) });
    alert("Partner Linked!");
};

window.copyRef = () => {
    const code = document.getElementById('ref-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Referral Link copied successfully!");
    });
};

window.submitWD = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const dest = document.getElementById('wd-dest').value.trim();
    if (!dest || isNaN(amt) || amt < 1 || user.balance < amt) return alert("Invalid withdrawal amount or recipient account details.");
    
    await updateDoc(doc(db, "users", myUid), { balance: increment(-amt) });
    await addDoc(collection(db, "payouts"), {
        uid: myUid, amt, dest, method: document.getElementById('wd-method').value, status: 'pending', time: serverTimestamp()
    });
    alert("Withdrawal Request submitted successfully!");
    document.getElementById('wd-dest').value = '';
    document.getElementById('wd-amt').value = '';
};

async function renderHistory() {
    const div = document.getElementById('wd-history'); 
    div.innerHTML = "";
    const q = query(collection(db, "payouts"), where("uid", "==", myUid));
    const snap = await getDocs(q);
    snap.forEach(s => {
        const d = s.data();
        div.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-[10px] font-bold shadow-sm"><span>₱${d.amt.toFixed(2)} (${d.method})</span><span class="text-orange-500 uppercase">${d.status}</span></div>`;
    });
}

window.tab = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${id}`).classList.remove('hidden-section');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active', 'text-emerald-600'));
    document.getElementById(`nav-${id}`).classList.add('nav-active', 'text-emerald-600');
};

window.adminCheck = () => { 
    if (prompt("Enter system administrative password:") === "Propetas12") { 
        tab('admin'); 
        loadAdmin(); 
    } 
};

async function loadAdmin() {
    const list = document.getElementById('admin-list'); 
    list.innerHTML = "Reading transactional logs...";
    const q = query(collection(db, "payouts"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    list.innerHTML = "";
    snap.forEach(s => {
        const d = s.data();
        const el = document.createElement('div');
        el.className = "glass p-4 rounded-2xl text-xs space-y-2 shadow-sm";
        el.innerHTML = `
            <p><b>User:</b> ${d.uid} <br> <b>Amount:</b> ₱${d.amt} <br> <b>Dest:</b> ${d.dest}</p>
            <div class="flex gap-2">
                <button onclick="pay('${s.id}', 'paid')" class="bg-emerald-500 text-white px-4 py-2 rounded-xl flex-1 font-bold">Approve</button>
                <button onclick="pay('${s.id}', 'denied', '${d.uid}', ${d.amt})" class="bg-red-500 text-white px-4 py-2 rounded-xl flex-1 font-bold">Deny</button>
            </div>
        `;
        list.appendChild(el);
    });
}

window.pay = async (pid, status, target, amt) => { 
    await updateDoc(doc(db, "payouts", pid), { status }); 
    if (status === 'denied') {
        await updateDoc(doc(db, "users", target), { balance: increment(amt) });
    }
    loadAdmin(); 
};

start();
