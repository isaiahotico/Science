
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

// Mining Constants
const MINING_TIME_MS = 7 * 24 * 60 * 60 * 1000;
const PROFIT_PER_PLANT = 0.05;
const RATE_PER_MS = PROFIT_PER_PLANT / MINING_TIME_MS;

let myUid = localStorage.getItem('sg_uid_v3') || "U" + Math.random().toString(36).substring(2, 8).toUpperCase();
localStorage.setItem('sg_uid_v3', myUid);

let userData = { balance: 0, plants: [] };
let adLogs = JSON.parse(localStorage.getItem('ad_logs') || "[]");

// --- Ad Helper ---
const runAd = async (zone) => {
    try {
        const adFunc = zone === 'buy' ? window.show_10555746 : window.show_10555663;
        if (typeof adFunc === 'function') {
            await adFunc();
        } else {
            console.warn("Ad SDK blocked. Proceeding with simulation.");
            alert("Ads help keep the game free. Please disable ad-blockers!");
        }
        logAd();
        return true;
    } catch (e) {
        return true; // Still allow action even if ad fails
    }
};

const logAd = () => {
    adLogs.push(Date.now());
    adLogs = adLogs.filter(t => Date.now() - t < 3600000);
    localStorage.setItem('ad_logs', JSON.stringify(adLogs));
    document.getElementById('ad-usage').innerText = adLogs.length;
};

// --- Core Logic ---
async function init() {
    const userRef = doc(db, "users", myUid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            id: myUid, balance: 0, plants: [], referrals: 0, refEarnings: 0,
            refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            inviter: null
        });
        await updateDoc(doc(db, "global", "stats"), { totalUsers: increment(1) }, { merge: true });
    }

    onSnapshot(userRef, (d) => {
        userData = d.data();
        renderUI();
    });

    onSnapshot(doc(db, "global", "stats"), (d) => {
        document.getElementById('global-users').innerText = d.data()?.totalUsers || "100+";
    });

    // High Speed Mining Loop
    setInterval(updateMiningDisplay, 100);
}

const updateMiningDisplay = () => {
    if (!userData.plants) return;
    const now = Date.now();
    userData.plants.forEach((p, i) => {
        const start = p.startTime?.seconds ? p.startTime.seconds * 1000 : p.startTime;
        const elapsed = Math.min(now - start, MINING_TIME_MS);
        
        const totalGen = elapsed * RATE_PER_MS;
        const current = Math.max(0, totalGen - (p.claimed || 0));

        const counter = document.getElementById(`acc-${i}`);
        if (counter) counter.innerText = current.toFixed(8);

        const timeLabel = document.getElementById(`time-${i}`);
        if (timeLabel) {
            const remaining = Math.max(0, MINING_TIME_MS - elapsed);
            if (remaining === 0) {
                timeLabel.innerText = "COMPLETE";
                timeLabel.className = "text-red-500 font-bold text-[9px]";
            } else {
                const hrs = Math.floor(remaining / 3600000);
                const mins = Math.floor((remaining % 3600000) / 60000);
                timeLabel.innerText = `${hrs}h ${mins}m left`;
            }
        }
    });
};

window.buyPlant = async () => {
    if (adLogs.length >= 10) return alert("Limit: 10 ads per hour.");
    if (userData.plants.length >= 500) return alert("Garden full!");

    if (await runAd('buy')) {
        await updateDoc(doc(db, "users", myUid), {
            plants: [...userData.plants, { startTime: Date.now(), claimed: 0 }]
        });
    }
};

window.claimPlant = async (index) => {
    if (adLogs.length >= 10) return alert("Limit: 10 ads per hour.");
    
    const p = userData.plants[index];
    const now = Date.now();
    const start = p.startTime?.seconds ? p.startTime.seconds * 1000 : p.startTime;
    const elapsed = Math.min(now - start, MINING_TIME_MS);
    const totalGen = elapsed * RATE_PER_MS;
    const amount = totalGen - (p.claimed || 0);

    if (amount < 0.00000001) return alert("Nothing to claim yet!");

    if (await runAd('claim')) {
        let updatedPlants = [...userData.plants];
        if (elapsed >= MINING_TIME_MS) {
            updatedPlants.splice(index, 1);
        } else {
            updatedPlants[index].claimed = totalGen;
        }

        await updateDoc(doc(db, "users", myUid), {
            balance: increment(amount),
            plants: updatedPlants
        });

        // Referral logic (5%)
        if (userData.inviter) {
            const comm = amount * 0.05;
            await updateDoc(doc(db, "users", userData.inviter), {
                balance: increment(comm),
                refEarnings: increment(comm)
            });
        }
    }
};

// --- UI Rendering ---
function renderUI() {
    document.getElementById('balance-display').innerText = userData.balance.toFixed(8);
    document.getElementById('uid-display').innerText = `ID: ${myUid}`;
    document.getElementById('plant-count').innerText = `${userData.plants.length}/500`;
    document.getElementById('ref-code-display').innerText = userData.refCode;
    document.getElementById('ad-usage').innerText = adLogs.length;

    const list = document.getElementById('garden-list');
    list.innerHTML = userData.plants.length === 0 ? '<div class="text-center py-10 text-slate-400 font-bold text-xs">NO PLANTS FOUND. START MINING!</div>' : '';

    userData.plants.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm"><i class="fa-solid fa-leaf"></i></div>
                <div>
                    <p class="text-[10px] font-black text-slate-400">FLOWER #${i+1}</p>
                    <p id="time-${i}" class="text-[9px] font-bold text-slate-500">Calculating...</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-xs font-mono font-black text-emerald-600 tracking-tighter">₱<span id="acc-${i}">0.00000000</span></p>
                <button onclick="claimPlant(${i})" class="mt-1 bg-slate-800 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase">Claim (Zone 663)</button>
            </div>
        `;
        list.appendChild(div);
    });

    renderWithdrawals();
}

// --- Systems (Referral, Withdraw, Admin) ---
window.bindRef = async () => {
    const code = document.getElementById('ref-input').value.trim();
    if (code === userData.refCode) return alert("Self-referral not allowed.");
    if (userData.inviter) return alert("Already bound.");

    const q = query(collection(db, "users"), where("refCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return alert("Code invalid.");

    const invId = snap.docs[0].id;
    await updateDoc(doc(db, "users", myUid), { inviter: invId });
    await updateDoc(doc(db, "users", invId), { referrals: increment(1) });
    alert("Partner bound!");
};

window.requestWithdraw = async () => {
    const method = document.getElementById('wd-method').value;
    const dest = document.getElementById('wd-dest').value;
    const amt = parseFloat(document.getElementById('wd-amt').value);

    if (isNaN(amt) || amt < 1) return alert("Minimum ₱1.00");
    if (userData.balance < amt) return alert("Insufficient: Need ₱" + (amt - userData.balance).toFixed(4) + " more.");

    await updateDoc(doc(db, "users", myUid), { balance: increment(-amt) });
    await addDoc(collection(db, "payouts"), {
        userId: myUid, method, dest, amount: amt, status: 'pending', date: serverTimestamp()
    });
    alert("Request Sent!");
};

async function renderWithdrawals() {
    const container = document.getElementById('wd-history');
    container.innerHTML = '';
    const q = query(collection(db, "payouts"), where("userId", "==", myUid));
    const snap = await getDocs(q);
    snap.forEach(s => {
        const d = s.data();
        const el = document.createElement('div');
        el.className = "bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-[10px]";
        el.innerHTML = `<span>₱${d.amount} via ${d.method}</span> <span class="font-bold text-orange-500 uppercase">${d.status}</span>`;
        container.appendChild(el);
    });
}

window.adminAuth = () => {
    if (prompt("Pass:") === "Propetas12") {
        switchTab('admin');
        loadAdmin();
    }
};

async function loadAdmin() {
    const list = document.getElementById('admin-payouts');
    list.innerHTML = 'Loading...';
    const q = query(collection(db, "payouts"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    list.innerHTML = '';
    snap.forEach(s => {
        const d = s.data();
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-2xl border-l-4 border-emerald-500 text-xs";
        div.innerHTML = `
            <p><b>User:</b> ${d.userId}</p>
            <p><b>Amount:</b> ₱${d.amount}</p>
            <p><b>Dest:</b> ${d.dest} (${d.method})</p>
            <div class="flex gap-2 mt-2">
                <button onclick="payout('${s.id}', 'paid')" class="bg-emerald-500 text-white px-4 py-2 rounded flex-1 font-bold">Approve</button>
                <button onclick="payout('${s.id}', 'denied', '${d.userId}', ${d.amount})" class="bg-red-500 text-white px-4 py-2 rounded flex-1 font-bold">Deny</button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.payout = async (id, status, uid, amt) => {
    await updateDoc(doc(db, "payouts", id), { status });
    if (status === 'denied') await updateDoc(doc(db, "users", uid), { balance: increment(amt) });
    loadAdmin();
};

window.switchTab = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${id}`).classList.remove('hidden-section');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('text-emerald-600', 'active-tab'));
    document.getElementById(`nav-${id}`).classList.add('text-emerald-600', 'active-tab');
};

init();
