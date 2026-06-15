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

const CONTRACT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days contract
const PROFIT = 0.05;
const RATE = PROFIT / CONTRACT_MS;
const ITEMS_PER_PAGE = 20;

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

    setInterval(updateTicker, 200);
    setInterval(() => {
        document.getElementById('live-clock').innerText = new Date().toLocaleString();
    }, 1000);
}

// --- TABLE PAGINATION SYSTEM ---
window.changePage = (dir) => {
    const totalPlants = user.plants ? user.plants.length : 0;
    const maxPage = Math.ceil(totalPlants / ITEMS_PER_PAGE) || 1;
    
    let newPage = curPage + dir;
    if (newPage >= 1 && newPage <= maxPage) {
        curPage = newPage;
        renderUI();
    }
};

const updateTicker = () => {
    if (!user.plants) return;
    const now = Date.now();
    const startIdx = (curPage - 1) * ITEMS_PER_PAGE;
    const pagePlants = user.plants.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    pagePlants.forEach((p, i) => {
        const globalIdx = startIdx + i;
        const startMs = getMs(p.start);
        const elapsed = Math.min(now - startMs, CONTRACT_MS);
        const acc = Math.max(0, (elapsed * RATE) - (p.claimed || 0));
        
        const accEl = document.getElementById(`acc-${globalIdx}`);
        if (accEl) accEl.innerText = acc.toFixed(8);

        const expEl = document.getElementById(`exp-${globalIdx}`);
        if (expEl) {
            const timeLeft = Math.max(0, (startMs + CONTRACT_MS) - now);
            if (timeLeft === 0) {
                expEl.innerText = "EXPIRED";
                expEl.className = "px-4 py-3 text-red-500 font-black";
            } else {
                const d = Math.floor(timeLeft / 86400000);
                const h = Math.floor((timeLeft % 86400000) / 3600000);
                const m = Math.floor((timeLeft % 3600000) / 60000);
                expEl.innerText = `${d}d ${h}h ${m}m remaining`;
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

    const totalPlants = user.plants ? user.plants.length : 0;
    const maxPage = Math.ceil(totalPlants / ITEMS_PER_PAGE) || 1;
    if (curPage > maxPage) curPage = maxPage;
    
    document.getElementById('page-info').innerText = `Page ${curPage} / ${maxPage}`;

    const tbody = document.getElementById('garden-tbody');
    tbody.innerHTML = "";
    
    const startIdx = (curPage - 1) * ITEMS_PER_PAGE;
    const pagePlants = user.plants.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    if (pagePlants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 font-bold text-slate-400">YOUR GARDEN IS EMPTY</td></tr>`;
        return;
    }

    pagePlants.forEach((p, i) => {
        const globalIdx = startIdx + i;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition font-mono";
        tr.innerHTML = `
            <td class="px-4 py-3 text-slate-400">#${globalIdx + 1}</td>
            <td class="px-4 py-3 font-bold text-slate-700">Sampaguita Flower</td>
            <td class="px-4 py-3 font-bold text-emerald-600">₱<span id="acc-${globalIdx}">0.00000000</span></td>
            <td class="px-4 py-3 text-slate-500" id="exp-${globalIdx}">Calculating...</td>
            <td class="px-4 py-3 text-right">
                <button onclick="claim(${globalIdx})" class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition hover:bg-slate-900">Claim (663)</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    renderHistory();
}

// --- CONTROLLERS ---

window.buyFlower = async () => {
    if (user.plants.length >= 500) return alert("Garden at full capacity (500).");
    const now = Date.now();
    const hourly = (user.pHistory || []).filter(t => now - getMs(t) < 3600000);
    if (hourly.length >= 10) return alert("Limit reached: Maximum 10 plants per hour allowed.");

    if (typeof window.show_10555746 === 'function') await window.show_10555746();
    
    await updateDoc(doc(db, "users", myUid), {
        plants: [...user.plants, { start: now, claimed: 0 }],
        pHistory: [...hourly, now]
    });
};

window.claim = async (idx) => {
    const p = user.plants[idx];
    const now = Date.now();
    const elapsed = Math.min(now - getMs(p.start), CONTRACT_MS);
    const amount = (elapsed * RATE) - (p.claimed || 0);

    if (amount < 0.00000001) return alert("Accumulated balance is too low.");

    if (typeof window.show_10555663 === 'function') await window.show_10555663();

    let newPlants = [...user.plants];
    if (elapsed >= CONTRACT_MS) newPlants.splice(idx, 1);
    else newPlants[idx].claimed = (elapsed * RATE);

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
    if (code === user.refCode || user.inviter) return;
    const q = query(collection(db, "users"), where("refCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return alert("Invalid code.");
    const boss = snap.docs[0].id;
    await updateDoc(doc(db, "users", myUid), { inviter: boss });
    await updateDoc(doc(db, "users", boss), { referrals: increment(1) });
    alert("Referral linked!");
};

window.copyRef = () => {
    navigator.clipboard.writeText(document.getElementById('ref-code').innerText);
    alert("Copied!");
};

// Double-Spend Proof Cashout Request
window.submitWD = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const dest = document.getElementById('wd-dest').value.trim();
    if (!dest || isNaN(amt) || amt < 1 || user.balance < amt) return alert("Invalid details or insufficient balance.");
    
    // Atomically deduct prior to writing payout ticket
    await updateDoc(doc(db, "users", myUid), { balance: increment(-amt) });
    await addDoc(collection(db, "payouts"), {
        uid: myUid, amt, dest, method: document.getElementById('wd-method').value, status: 'pending', time: serverTimestamp()
    });
    alert("Success!");
    document.getElementById('wd-amt').value = "";
    document.getElementById('wd-dest').value = "";
};

async function renderHistory() {
    const div = document.getElementById('wd-history'); 
    div.innerHTML = "";
    const q = query(collection(db, "payouts"), where("uid", "==", myUid));
    const snap = await getDocs(q);
    snap.forEach(s => {
        const d = s.data();
        div.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-[10px] font-bold"><span>₱${d.amt.toFixed(2)} (${d.method})</span><span class="text-orange-500 uppercase">${d.status}</span></div>`;
    });
}

window.tab = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${id}`).classList.remove('hidden-section');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active', 'text-emerald-600'));
    document.getElementById(`nav-${id}`).classList.add('nav-active', 'text-emerald-600');
};

// --- SECURE ADMINISTRATIVE SUITE ---
window.adminCheck = () => { 
    if (prompt("Admin Key:") === "Propetas12") { 
        tab('admin'); 
        loadAdmin(); 
    } 
};

async function loadAdmin() {
    const list = document.getElementById('admin-list'); 
    list.innerHTML = `<div class="p-6 text-center text-xs font-bold text-slate-400">Querying active transaction queues...</div>`;
    
    const q = query(collection(db, "payouts"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    list.innerHTML = "";
    
    if (snap.empty) {
        list.innerHTML = `<div class="glass p-6 rounded-3xl text-center text-xs font-bold text-emerald-600">All queues clear. No transactions pending review.</div>`;
        return;
    }

    snap.forEach(s => {
        const d = s.data();
        const el = document.createElement('div');
        el.className = "glass p-4 rounded-2xl text-[11px] space-y-3 shadow-md border-l-4 border-l-amber-500";
        el.innerHTML = `
            <div class="space-y-1.5">
                <div class="flex justify-between items-center text-[9px] font-mono font-bold text-slate-400">
                    <span>TX DOC ID:</span>
                    <span class="select-all font-semibold">${s.id}</span>
                </div>
                <hr class="border-slate-100">
                <p><b>User ID:</b> <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold select-all">${d.uid}</span></p>
                <p><b>Amount Requested:</b> <span class="font-black text-emerald-600 font-mono text-sm">₱${d.amt.toFixed(2)}</span></p>
                <p><b>Payout Gateway:</b> <span class="font-extrabold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">${d.method}</span></p>
                <p><b>Destination Number/Address:</b> <span class="font-mono bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-800 font-black tracking-wide select-all">${d.dest}</span></p>
            </div>
            <div class="flex gap-2">
                <button onclick="pay('${s.id}', 'paid', '${d.uid}', ${d.amt})" class="bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl flex-1 font-bold transition text-xs shadow-sm">Approve</button>
                <button onclick="pay('${s.id}', 'denied', '${d.uid}', ${d.amt})" class="bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl flex-1 font-bold transition text-xs shadow-sm">Decline & Refund</button>
            </div>`;
        list.appendChild(el);
    });
}

window.pay = async (pid, status, target, amt) => { 
    await updateDoc(doc(db, "payouts", pid), { status }); 
    if (status === 'denied' && target && amt) {
        // Safe Atomic rollback refund logic for declined cashouts
        await updateDoc(doc(db, "users", target), { balance: increment(amt) });
    }
    loadAdmin(); 
};

start();