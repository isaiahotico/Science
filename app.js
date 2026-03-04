
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- User Initialization ---
let uid = localStorage.getItem('fg_uid') || "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
localStorage.setItem('fg_uid', uid);
let userRef = ref(db, 'users/' + uid);
let userData = { balance: 0, refCode: uid, invites: 0, refEarned: 0, referredBy: "" };

// Initialize Adsgram
const AdController = window.Adsgram.init({ blockId: "21639" });

// --- Core Ad Logic (Double Hit) ---
window.playDoubleAd = async function() {
    const btn = document.getElementById('adBtn');
    btn.disabled = true;
    btn.innerText = "LOADING ADS...";

    try {
        // 1. Fire Adsgram
        const adsgramResult = await AdController.show();
        if (adsgramResult.done) {
            processReward();
        }
        
        // 2. Fire Monetag (Immediately after or in parallel)
        if (typeof show_10276123 === 'function') {
            await show_10276123();
            processReward(); 
        }
    } catch (e) {
        console.log("Ad Error or Canceled");
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 WATCH ADS & EARN";
    }
};

async function processReward() {
    const reward = 0.0099;
    const comm = reward * 0.12;

    // Update User Balance
    userData.balance += reward;
    await update(userRef, { balance: userData.balance, refCode: uid });

    // Handle Referral Commission
    if (userData.referredBy) {
        const referrerRef = ref(db, 'users/' + userData.referredBy);
        get(referrerRef).then(snap => {
            if (snap.exists()) {
                const rData = snap.val();
                update(referrerRef, {
                    balance: (rData.balance || 0) + comm,
                    refEarned: (rData.refEarned || 0) + comm
                });
            }
        });
    }
}

// --- Navigation & Realtime Sync ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('tab-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('tab-active');
};

onValue(userRef, (snap) => {
    if (snap.exists()) {
        userData = snap.val();
        document.getElementById('userBalance').innerText = userData.balance.toFixed(4);
        document.getElementById('myRefCode').innerText = userData.refCode;
        document.getElementById('totalInvites').innerText = userData.invites || 0;
        document.getElementById('totalRefEarned').innerText = "₱" + (userData.refEarned || 0).toFixed(4);
        
        if (userData.referredBy) {
            document.getElementById('inputRef').disabled = true;
            document.getElementById('applyBtn').innerText = "Code Applied";
        }
    } else {
        set(userRef, userData);
    }
});

// --- Referral Logic ---
window.applyReferral = async function() {
    const code = document.getElementById('inputRef').value.toUpperCase();
    if (code === uid) return alert("You cannot use your own code!");
    if (userData.referredBy) return alert("Referral already applied!");

    // Check if code exists
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    let foundRef = null;
    
    snapshot.forEach(child => {
        if (child.val().refCode === code) foundRef = child.key;
    });

    if (foundRef) {
        await update(userRef, { referredBy: foundRef });
        const referrerRef = ref(db, 'users/' + foundRef);
        const refSnap = await get(referrerRef);
        update(referrerRef, { invites: (refSnap.val().invites || 0) + 1 });
        alert("Referral successfully applied! You now support your friend.");
    } else {
        alert("Invalid Referral Code!");
    }
};

// --- Withdrawals ---
window.requestWithdrawal = function() {
    const method = document.getElementById('wd-method').value;
    const account = document.getElementById('gcash-num').value;
    const amount = parseFloat(document.getElementById('wd-amount').value);

    if (amount < 1) return alert("Min withdrawal ₱1.00");
    if (amount > userData.balance) return alert("Insufficient balance");
    if (account.length < 5) return alert("Enter valid account details");

    const wdId = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + wdId), {
        uid, amount, method, account, user: uid, status: 'pending', time: Date.now()
    });
    update(userRef, { balance: userData.balance - amount });
    alert("Request Sent!");
};

onValue(ref(db, 'withdrawals'), (snap) => {
    const hist = document.getElementById('withdrawal-history');
    hist.innerHTML = "";
    snap.forEach(child => {
        const d = child.val();
        if (d.uid === uid) {
            hist.innerHTML += `<div class="bg-slate-800 p-2 rounded flex justify-between">
                <span>₱${d.amount} (${d.method})</span>
                <span class="${d.status==='pending'?'text-yellow-500':'text-green-500'}">${d.status.toUpperCase()}</span>
            </div>`;
        }
    });
});

// --- Admin ---
window.checkAdmin = function() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        loadAdminList();
    } else alert("Wrong Password");
};

function loadAdminList() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const list = document.getElementById('withdrawal-list');
        list.innerHTML = "";
        snap.forEach(child => {
            const d = child.val();
            if (d.status === 'pending') {
                list.innerHTML += `<div class="bg-slate-800 p-3 rounded border border-slate-700">
                    <p class="text-xs">User: ${d.user} | ${d.method}</p>
                    <p class="font-bold">₱${d.amount} -> ${d.account}</p>
                    <button onclick="approveWd('${child.key}')" class="bg-green-600 px-4 py-1 rounded mt-2 text-xs">Approve</button>
                </div>`;
            }
        });
    });
}
window.approveWd = (id) => update(ref(db, 'withdrawals/' + id), { status: 'approved' });

// --- Chat & Leaderboard ---
window.sendMessage = () => {
    const text = document.getElementById('chatInput').value;
    if (text) push(ref(db, 'chat'), { user: uid, text, time: Date.now() });
    document.getElementById('chatInput').value = "";
};

onValue(query(ref(db, 'chat'), limitToLast(20)), (snap) => {
    const box = document.getElementById('chatBox');
    box.innerHTML = "";
    snap.forEach(c => {
        box.innerHTML += `<div><span class="text-sky-400 font-bold">${c.val().user.slice(0,5)}:</span> ${c.val().text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(100)), (snap) => {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = "";
    let arr = [];
    snap.forEach(c => arr.push(c.val()));
    arr.reverse().forEach((u, i) => {
        list.innerHTML += `<div class="glass-card p-3 flex justify-between items-center ${i<3?'border-yellow-500 border':''}">
            <span class="text-sm">${i+1}. ${u.refCode}</span>
            <span class="font-bold text-sky-400">₱${u.balance.toFixed(2)}</span>
        </div>`;
    });
});
