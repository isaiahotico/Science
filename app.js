
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- Telegram Initialization ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const user = tg?.initDataUnsafe?.user || { id: "guest_000", first_name: "Guest", username: "guest" };
const userId = user.id.toString();
const userRealName = user.username ? `@${user.username}` : user.first_name;

document.getElementById("userBar").innerText = "👤 " + userRealName;

// --- Global State ---
let userData = {};
const adsgramIds = ['21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];

// --- Functions ---

// 1. User Initialization
async function initUser() {
    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
        const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        userData = {
            id: userId,
            username: userRealName,
            balance: 0,
            referralCode: refCode,
            referredBy: "",
            totalReferrals: 0,
            referralEarnings: 0,
            online: true
        };
        await set(userRef, userData);
    } else {
        userData = snapshot.val();
        await update(userRef, { online: true });
    }
    
    updateUI();
    listenToData();
}

function updateUI() {
    document.getElementById("userBalance").innerText = `₱${userData.balance.toFixed(4)}`;
    document.getElementById("myRefCode").innerText = userData.referralCode;
    document.getElementById("refCount").innerText = userData.totalReferrals || 0;
    document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(2)}`;
}

function listenToData() {
    // Sync Balance
    onValue(ref(db, `users/${userId}`), (snap) => {
        userData = snap.val();
        updateUI();
    });

    // Sync Stats
    onValue(ref(db, 'users'), (snap) => {
        const users = snap.val();
        let total = 0;
        let online = 0;
        const leaderList = [];
        
        for (let id in users) {
            total += users[id].balance;
            if (users[id].online) online++;
            leaderList.push(users[id]);
        }
        
        document.getElementById("statsTotal").innerText = `₱${total.toFixed(2)}`;
        document.getElementById("onlineCount").innerText = online;

        // Leaderboard Update
        leaderList.sort((a, b) => b.balance - a.balance);
        const lbHtml = leaderList.slice(0, 10).map((u, i) => `
            <div class="flex justify-between p-3 border-b border-white/5 text-sm">
                <span>${i+1}. ${u.username}</span>
                <span class="text-green-400">₱${u.balance.toFixed(2)}</span>
            </div>
        `).join('');
        document.getElementById("leaderList").innerHTML = lbHtml;
    });

    // Chat
    onValue(ref(db, 'chat'), (snap) => {
        const msgs = snap.val();
        const chatBox = document.getElementById("chatBox");
        chatBox.innerHTML = "";
        for (let id in msgs) {
            const m = msgs[id];
            chatBox.innerHTML += `<div><b class="text-blue-400">${m.user}:</b> ${m.text}</div>`;
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// 2. Task Logic
window.startTask = async function() {
    const linksSnap = await get(ref(db, 'links'));
    const links = linksSnap.val() ? Object.values(linksSnap.val()) : ["https://www.google.com"];
    const randomLink = links[Math.floor(Math.random() * links.length)];

    // Show Ad First
    showAd();

    // Show Fullscreen Task
    const overlay = document.getElementById("taskOverlay");
    const frame = document.getElementById("taskFrame");
    const timerText = document.getElementById("taskTimer");
    const closeBtn = document.getElementById("closeTask");

    overlay.style.display = "flex";
    frame.src = randomLink;
    closeBtn.classList.add("hidden");
    
    let seconds = 15;
    const interval = setInterval(() => {
        seconds--;
        timerText.innerText = `${seconds}s remaining...`;
        if (seconds <= 0) {
            clearInterval(interval);
            timerText.innerText = "Task Complete!";
            closeBtn.classList.remove("hidden");
        }
    }, 1000);
};

function showAd() {
    // Adsgram Random Select
    const blockId = adsgramIds[Math.floor(Math.random() * adsgramIds.length)];
    const AdController = window.Adsgram.init({ blockId: blockId });
    AdController.show().then(() => {
        console.log("Ad finished");
    }).catch((err) => {
        console.error("Ad failed", err);
    });
    
    // Monetag Trigger (Standard SDK calls)
    if (typeof show_10555746 === 'function') show_10555746();
}

window.finishTask = async function() {
    const reward = (Math.random() * (0.025 - 0.003) + 0.003);
    const newBalance = userData.balance + reward;

    await update(ref(db, `users/${userId}`), { balance: newBalance });
    
    // Referral Commission (20%)
    if (userData.referredBy) {
        const refRef = ref(db, `users/${userData.referredBy}`);
        const refSnap = await get(refRef);
        if (refSnap.exists()) {
            const comm = reward * 0.20;
            update(refRef, { 
                balance: refSnap.val().balance + comm,
                referralEarnings: (refSnap.val().referralEarnings || 0) + comm
            });
        }
    }

    document.getElementById("taskOverlay").style.display = "none";
    alert(`Reward Claimed: ₱${reward.toFixed(4)}`);
};

// 3. Admin Logic
window.openAdmin = () => showSection('admin');
window.verifyAdmin = () => {
    const pass = document.getElementById("adminPass").value;
    if (pass === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        loadAdminWithdrawals();
    } else {
        alert("Wrong Password");
    }
};

window.postLink = () => {
    const link = document.getElementById("newLink").value;
    if (link) {
        push(ref(db, 'links'), link);
        alert("Link Posted");
        document.getElementById("newLink").value = "";
    }
};

async function loadAdminWithdrawals() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const wds = snap.val();
        const container = document.getElementById("adminWdList");
        container.innerHTML = "";
        for (let id in wds) {
            if (wds[id].status === "pending") {
                container.innerHTML += `
                    <div class="p-2 bg-black/40 rounded flex justify-between">
                        <span>${wds[id].user} - ₱${wds[id].amount} (${wds[id].method})</span>
                        <button onclick="approveWD('${id}')" class="text-green-500">Approve</button>
                    </div>
                `;
            }
        }
    });
}

window.approveWD = (id) => {
    update(ref(db, `withdrawals/${id}`), { status: "approved" });
    alert("Approved!");
};

// 4. Withdrawal / Referral / Chat
window.requestWithdrawal = async () => {
    const method = document.getElementById("wdMethod").value;
    const addr = document.getElementById("wdAddress").value;
    const amt = parseFloat(document.getElementById("wdAmount").value);

    if (amt > 0 && userData.balance >= amt && addr) {
        const newWD = {
            uid: userId,
            user: userRealName,
            amount: amt,
            method: method,
            address: addr,
            status: "pending",
            date: new Date().toLocaleDateString()
        };
        await push(ref(db, 'withdrawals'), newWD);
        await update(ref(db, `users/${userId}`), { balance: userData.balance - amt });
        alert("Withdrawal Requested!");
    } else {
        alert("Invalid amount or address");
    }
};

window.submitReferral = async () => {
    const code = document.getElementById("refInput").value.toUpperCase();
    if (userData.referredBy) return alert("Already referred");
    if (code === userData.referralCode) return alert("Cannot refer yourself");

    const usersSnap = await get(ref(db, 'users'));
    const users = usersSnap.val();
    let foundUid = null;

    for (let id in users) {
        if (users[id].referralCode === code) {
            foundUid = id;
            break;
        }
    }

    if (foundUid) {
        await update(ref(db, `users/${userId}`), { referredBy: foundUid });
        const refRef = ref(db, `users/${foundUid}`);
        const currentCount = users[foundUid].totalReferrals || 0;
        await update(refRef, { totalReferrals: currentCount + 1 });
        alert("Referral Applied!");
    } else {
        alert("Code not found");
    }
};

window.sendMessage = () => {
    const text = document.getElementById("chatInput").value;
    if (text) {
        push(ref(db, 'chat'), { user: userRealName, text: text });
        document.getElementById("chatInput").value = "";
    }
};

// Start
initUser();

// Handle Online/Offline Status
window.addEventListener('beforeunload', () => {
    update(ref(db, `users/${userId}`), { online: false });
});
