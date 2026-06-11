
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, 
    collection, query, where, addDoc, serverTimestamp, increment, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your verified Firebase configuration
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

// Mining Parameters (Real-time Calculation Matrix)
const MINING_MS = 7 * 24 * 60 * 60 * 1000; // 7 days contract
const TOTAL_YIELD = 0.05; // Yield target per flower
const MS_RATE = TOTAL_YIELD / MINING_MS;

// Device Session Handshake
let myUid = localStorage.getItem('sg_v4_uid') || "USER-" + Math.random().toString(36).substring(2, 10).toUpperCase();
localStorage.setItem('sg_v4_uid', myUid);

let userData = { balance: 0, plants: [] };

// Helper: Secure Timestamp Normalizer
const getMs = (val) => {
    if (!val) return Date.now();
    if (val.seconds) return val.seconds * 1000;
    return Number(val);
};

// --- AD DRIVER (Direct Auto-Dispatch Loop) ---
const triggerAd = async (zoneType) => {
    try {
        if (zoneType === 'buy') {
            console.log("[Ad Service] Direct execution: Buy Zone 10555746.");
            if (typeof window.show_10555746 === 'function') {
                await window.show_10555746();
            } else {
                console.warn("[Ad Service] Zone 10555746 inactive. Simulated Reward.");
            }
        } else if (zoneType === 'claim') {
            console.log("[Ad Service] Direct execution: Claim Zone 10555663. No hourly prohibitions applied.");
            if (typeof window.show_10555663 === 'function') {
                await window.show_10555663();
            } else {
                console.warn("[Ad Service] Zone 10555663 inactive. Simulated Reward.");
            }
        }
        return true;
    } catch (e) {
        console.error("[Ad Network Runtime] Blocked/Error. Bypassed to maintain user flow:", e);
        return true; 
    }
};

// --- INITIALIZE DATA SYNC ---
async function start() {
    const uRef = doc(db, "users", myUid);
    const snap = await getDoc(uRef);

    if (!snap.exists()) {
        await setDoc(uRef, {
            id: myUid, balance: 0, plants: [], referrals: 0, refEarnings: 0,
            refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            inviter: null
        });
        await updateDoc(doc(db, "global", "stats"), { totalUsers: increment(1) }, { merge: true });
    }

    // Realtime Database Handshake listeners
    onSnapshot(uRef, (d) => {
        userData = d.data();
        renderUI();
    });

    onSnapshot(doc(db, "global", "stats"), (d) => {
        document.getElementById('stat-users').innerText = d.data()?.totalUsers || "100+";
    });

    // Precision Mining Heartbeat Interval (100ms Updates)
    setInterval(tickMining, 100);
}

const tickMining = () => {
    if (!userData.plants) return;
    const now = Date.now();
    
    userData.plants.forEach((p, i) => {
        const start = getMs(p.startTime);
        const elapsed = Math.min(now - start, MINING_MS);
        const total = elapsed * MS_RATE;
        const current = Math.max(0, total - (p.claimed || 0));

        const el = document.getElementById(`acc-${i}`);
        if (el) el.innerText = current.toFixed(8);

        const prog = document.getElementById(`prog-${i}`);
        if (prog) prog.style.width = (elapsed / MINING_MS * 100) + "%";
    });
};

// --- CORE TRANSACTIONS ---

// Buy Flower Trigger (Zone 10555746)
window.buyFlower = async () => {
    if (userData.plants.length >= 500) return alert("Your virtual garden is full.");
    
    // Auto Show Ads Immediately on Buying Click
    if (await triggerAd('buy')) {
        await updateDoc(doc(db, "users", myUid), {
            plants: [...userData.plants, { startTime: Date.now(), claimed: 0 }]
        });
    }
};

// Claim Flower Trigger (Zone 10555663 - Unlimited, No Blocks)
window.claimFlower = async (index) => {
    const p = userData.plants[index];
    const now = Date.now();
    const start = getMs(p.startTime);
    const elapsed = Math.min(now - start, MINING_MS);
    const totalGen = elapsed * MS_RATE;
    const amount = totalGen - (p.claimed || 0);

    if (amount <= 0.00000001) {
        return alert("This flower has not mined enough micro-balances yet. Please wait a moment.");
    }

    // Auto Show Ads Immediately on Claiming Click with absolutely NO hourly limits or prohibitions
    if (await triggerAd('claim')) {
        let newPlants = [...userData.plants];
        if (elapsed >= MINING_MS) {
            newPlants.splice(index, 1); // Remove expired plant contract
        } else {
            newPlants[index].claimed = totalGen; // Lock previous claimed amount
        }

        // Add to main balance atomically
        await updateDoc(doc(db, "users", myUid), {
            balance: increment(amount),
            plants: newPlants
        });

        // Instant Realtime Referral Share Payout (5%)
        if (userData.inviter) {
            await updateDoc(doc(db, "users", userData.inviter), {
                balance: increment(amount * 0.05),
                refEarnings: increment(amount * 0.05)
            });
        }
    }
};

// Render UI Components
function renderUI() {
    document.getElementById('bal-main').innerText = userData.balance.toFixed(8);
    document.getElementById('uid-card').innerText = `ID: ${myUid}`;
    document.getElementById('stat-plants').innerText = userData.plants.length;
    document.getElementById('my-ref-code').innerText = userData.refCode;

    const cont = document.getElementById('garden-container');
    cont.innerHTML = userData.plants.length === 0 ? '<div class="glass p-8 text-center text-slate-400 font-bold text-xs rounded-3xl border-dashed border-2 border-slate-200">YOUR GARDEN IS EMPTY. PLANT FLOWERS TO START MINING!</div>' : '';

    userData.plants.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = "glass p-4 rounded-3xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow duration-300";
        div.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p class="text-[10px] font-black text-slate-800 uppercase tracking-wider">Sampaguita Flower #${i+1}</p>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div id="prog-${i}" class="mining-gradient h-full progress-bar" style="width: 0%;"></div>
                </div>
                <p class="text-[9px] text-slate-400 mt-1 font-bold">Mines: ₱0.05 / 7 Days Duration</p>
            </div>
            <div class="text-right pl-4">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Accumulated</p>
                <p class="text-xs font-mono font-black text-emerald-600">₱<span id="acc-${i}">0.00000000</span></p>
                <button onclick="claimFlower(${i})" class="mt-1 bg-slate-800 hover:bg-slate-900 transition text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight">Claim (663)</button>
            </div>
        `;
        cont.appendChild(div);
    });
    renderHistory();
}

// Bind Inviter Referral Link
window.bindInviter = async () => {
    const code = document.getElementById('input-ref').value.trim().toUpperCase();
    if (code === userData.refCode) return alert("Self-referrals are prohibited.");
    if (userData.inviter) return alert("You already have bound an invite code.");

    const q = query(collection(db, "users"), where("refCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return alert("Code not found.");

    const invId = snap.docs[0].id;
    await updateDoc(doc(db, "users", myUid), { inviter: invId });
    await updateDoc(doc(db, "users", invId), { referrals: increment(1) });
    alert("Referral partner bound successfully!");
};

// Copy Referral Link
window.copyRef = () => {
    const code = document.getElementById('my-ref-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Referral Code copied to clipboard!");
    });
};

// Submit Withdrawal (Secure Double-Spend Protection)
window.submitWithdraw = async () => {
    const method = document.getElementById('wd-method').value;
    const dest = document.getElementById('wd-dest').value.trim();
    const amt = parseFloat(document.getElementById('wd-amt').value);

    if (!dest || isNaN(amt) || amt < 1.00) return alert("Minimum cashout is ₱1.00.");
    if (userData.balance < amt) return alert(`Insufficient Balance! You need ₱${(amt - userData.balance).toFixed(4)} more.`);

    // Advanced Protection: Deduct instantly from user balance before creating cashout record
    await updateDoc(doc(db, "users", myUid), { balance: increment(-amt) });
    
    await addDoc(collection(db, "payouts"), {
        userId: myUid, method, dest, amount: amt, status: 'pending', time: serverTimestamp()
    });
    
    alert("Withdrawal requested successfully!");
    document.getElementById('wd-dest').value = '';
    document.getElementById('wd-amt').value = '';
};

// Render User Payout logs
async function renderHistory() {
    const cont = document.getElementById('history-container');
    cont.innerHTML = '';
    const q = query(collection(db, "payouts"), where("userId", "==", myUid));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        cont.innerHTML = '<p class="text-[10px] text-slate-400 font-bold text-center py-2 uppercase tracking-wider">No transactional activity</p>';
        return;
    }

    snap.forEach(s => {
        const d = s.data();
        const div = document.createElement('div');
        div.className = "glass p-3 rounded-2xl flex justify-between items-center text-[10px] font-black";
        div.innerHTML = `<span>₱${d.amount.toFixed(2)} (${d.method})</span> <span class="text-orange-500 uppercase">${d.status}</span>`;
        cont.appendChild(div);
    });
}

// Nav Tab Switcher
window.tab = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`view-${id}`).classList.remove('hidden-section');
    
    document.querySelectorAll('nav button').forEach(b => {
        b.classList.remove('nav-active');
        b.classList.add('text-slate-400');
    });
    document.getElementById(`nav-${id}`).classList.add('nav-active');
    document.getElementById(`nav-${id}`).classList.remove('text-slate-400');
};

// Admin Console Authorization
window.authAdmin = () => {
    if (prompt("Enter Console Password:") === "Propetas12") {
        tab('home'); // Reset selection view state safely before opening admin console
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
        document.getElementById('view-admin').classList.remove('hidden-section');
        loadAdmin();
    } else {
        alert("Incorrect administrative password.");
    }
};

async function loadAdmin() {
    const cont = document.getElementById('admin-container');
    cont.innerHTML = '<p class="text-xs font-bold text-slate-400 py-4 text-center">Reading cashout queue...</p>';
    
    const q = query(collection(db, "payouts"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    cont.innerHTML = '';
    
    if (snap.empty) {
        cont.innerHTML = '<p class="text-xs font-bold text-emerald-600 text-center py-4">No pending approvals to process.</p>';
        return;
    }

    snap.forEach(s => {
        const d = s.data();
        const div = document.createElement('div');
        div.className = "glass p-4 rounded-3xl text-xs space-y-2";
        div.innerHTML = `
            <p><b>User:</b> ${d.userId} <br> <b>Amount:</b> ₱${d.amount.toFixed(2)} <br> <b>Dest:</b> ${d.dest} (${d.method})</p>
            <div class="flex gap-2">
                <button onclick="payout('${s.id}', 'approved')" class="bg-emerald-500 text-white p-2 rounded-xl flex-1 font-bold">Approve</button>
                <button onclick="payout('${s.id}', 'denied', '${d.userId}', ${d.amount})" class="bg-red-500 text-white p-2 rounded-xl flex-1 font-bold">Reject & Refund</button>
            </div>
        `;
        cont.appendChild(div);
    });
}

window.payout = async (id, status, uid, amt) => {
    await updateDoc(doc(db, "payouts", id), { status });
    if (status === 'denied') {
        await updateDoc(doc(db, "users", uid), { balance: increment(amt) });
    }
    loadAdmin();
};

start();
