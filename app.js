
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// User Setup
let userId = localStorage.getItem('fg_uid') || "user_" + Math.floor(Math.random() * 1000000);
localStorage.setItem('fg_uid', userId);
let userName = "User_" + userId.slice(-4);
let currentBalance = 0;

// Initialize Adsgram
const AdController = window.Adsgram.init({ blockId: "21639" });

// 1. EARN LOGIC
window.playAdsgram = function() {
    AdController.show().then((result) => {
        if (result.done) addReward();
    }).catch(() => alert("Ad failed to load. Try again."));
};

window.playMonetag = function() {
    // Monetag SDK 'show_10276123' usually auto-triggers or needs a call
    if (typeof show_10276123 === 'function') {
        show_10276123().then(() => addReward());
    } else {
        // Fallback for some monetag scripts
        addReward(); 
        alert("Monetag triggered. Reward added.");
    }
};

function addReward() {
    currentBalance += 0.0099;
    update(ref(db, 'users/' + userId), {
        balance: currentBalance,
        name: userName,
        lastActive: Date.now()
    });
}

// 2. REALTIME DATABASE SYNC
onValue(ref(db, 'users/' + userId), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        currentBalance = data.balance || 0;
        document.getElementById('userBalance').innerText = currentBalance.toFixed(4);
    }
});

// 3. CHAT SYSTEM
window.sendMessage = function() {
    const msg = document.getElementById('chatInput').value;
    if (!msg) return;
    push(ref(db, 'messages'), {
        user: userName,
        text: msg,
        time: Date.now()
    });
    document.getElementById('chatInput').value = "";
};

onValue(query(ref(db, 'messages'), limitToLast(20)), (snapshot) => {
    const box = document.getElementById('chatBox'); // Fixed ID
    const chatContainer = document.getElementById('chat-box');
    chatContainer.innerHTML = "";
    snapshot.forEach((child) => {
        const data = child.val();
        chatContainer.innerHTML += `<div class="p-2 bg-slate-800 rounded text-sm">
            <span class="text-yellow-500 font-bold">${data.user}:</span> ${data.text}
        </div>`;
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
});

// 4. LEADERBOARD
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), (snapshot) => {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = "";
    let entries = [];
    snapshot.forEach(child => entries.push(child.val()));
    entries.reverse().forEach((user, index) => {
        list.innerHTML += `<div class="flex justify-between bg-slate-800 p-3 rounded-lg border-l-4 border-yellow-500">
            <span>${index + 1}. ${user.name}</span>
            <span class="font-bold text-yellow-400">₱${user.balance.toFixed(2)}</span>
        </div>`;
    });
});

// 5. WITHDRAWAL LOGIC
window.requestWithdrawal = function() {
    const method = document.getElementById('withdrawMethod').value;
    const account = document.getElementById('withdrawAccount').value;
    
    if (currentBalance < 1.00) return alert("Minimum ₱1.00 required");
    if (account.length < 5) return alert("Invalid account details");

    const reqId = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + reqId), {
        uid: userId,
        user: userName,
        amount: currentBalance,
        method: method,
        account: account,
        status: 'pending',
        time: Date.now()
    });

    update(ref(db, 'users/' + userId), { balance: 0 });
    alert("Withdrawal Requested!");
};

// 6. ADMIN SYSTEM
window.showAdminPrompt = function() {
    const pass = prompt("Enter Admin Password:");
    if (pass === "Propetas12") {
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
};

window.closeAdmin = () => document.getElementById('admin-panel').classList.add('hidden');

function loadAdminData() {
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        const container = document.getElementById('pending-withdrawals');
        container.innerHTML = "";
        snapshot.forEach(child => {
            const data = child.val();
            if (data.status === 'pending') {
                container.innerHTML += `
                <div class="bg-slate-800 p-4 rounded border border-red-900">
                    <p>User: ${data.user} (${data.method})</p>
                    <p class="text-xl font-bold">₱${data.amount.toFixed(2)}</p>
                    <p class="text-xs text-gray-400">${data.account}</p>
                    <button onclick="approveWithdraw('${child.key}')" class="bg-green-600 px-4 py-2 rounded mt-2 mr-2">Approve</button>
                </div>`;
            }
        });
    });
}

window.approveWithdraw = (id) => {
    update(ref(db, 'withdrawals/' + id), { status: 'approved' });
    alert("Approved!");
};

// UI TABS
window.switchTab = function(tab) {
    document.getElementById('earn-section').classList.add('hidden');
    document.getElementById('leaderboard-section').classList.add('hidden');
    document.getElementById('chat-section').classList.add('hidden');
    document.getElementById('withdraw-section').classList.add('hidden');
    document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active-tab'));

    document.getElementById(tab + '-section').classList.remove('hidden');
    document.getElementById('tab-' + tab.slice(0, 4)).classList.add('active-tab');
};
