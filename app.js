
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Telegram SDK
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const user = tg?.initDataUnsafe?.user || { id: "GUEST_" + Math.floor(Math.random() * 9999), first_name: "Guest", username: "guest_user" };
const userId = user.id.toString();
const userRealName = user.username ? `@${user.username}` : user.first_name;

document.getElementById("userBar").innerText = "👤 " + userRealName;

let userData = {};
const adsgramIds = ['21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];

// --- APP CORE ---

async function initApp() {
    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);
    
    if (!snap.exists()) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        userData = { 
            id: userId, username: userRealName, balance: 0, 
            referralCode: code, referredBy: "", totalReferrals: 0, 
            referralEarnings: 0, online: true, lastBonus: {} 
        };
        await set(userRef, userData);
    } else {
        userData = snap.val();
        await update(userRef, { online: true });
    }

    triggerAutoAds();
    listenToData();
}

function triggerAutoAds() {
    const lastShow = localStorage.getItem('last_inapp_ad');
    const now = Date.now();
    if (!lastShow || (now - lastShow) > 180000) { // 3 Minutes
        const adConfig = { type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } };
        if (typeof show_10555746 === 'function') show_10555746(adConfig);
        if (typeof show_10555727 === 'function') show_10555727(adConfig);
        localStorage.setItem('last_inapp_ad', now);
    }
}

function listenToData() {
    onValue(ref(db, `users/${userId}`), (snap) => {
        userData = snap.val();
        document.getElementById("userBalance").innerText = `₱${userData.balance.toFixed(4)}`;
        document.getElementById("myRefCode").innerText = userData.referralCode;
        document.getElementById("refCount").innerText = userData.totalReferrals || 0;
        document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(4)}`;
        updateBonusCooldowns();
    });

    onValue(ref(db, 'users'), (snap) => {
        const users = snap.val();
        let total = 0, online = 0, onlineHtml = "";
        for (let id in users) {
            total += (users[id].balance || 0);
            if (users[id].online) {
                online++;
                onlineHtml += `<div class="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px] border border-blue-500/20">${users[id].username}</div>`;
            }
        }
        document.getElementById("onlineCount").innerText = online;
        document.getElementById("onlineList").innerHTML = onlineHtml;
        document.getElementById("statsTotal").innerText = `₱${total.toFixed(2)}`;
    });

    onValue(ref(db, 'chat'), (snap) => {
        const chatBox = document.getElementById("chatBox");
        chatBox.innerHTML = "";
        const data = snap.val();
        for (let id in data) {
            chatBox.innerHTML += `<div><b class="text-blue-400">${data[id].user}:</b> <span class="text-gray-300">${data[id].text}</span></div>`;
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    onValue(ref(db, 'withdrawals'), (snap) => {
        const hist = document.getElementById("wdHistory");
        hist.innerHTML = "";
        const data = snap.val();
        for (let id in data) {
            if (data[id].uid === userId) {
                hist.innerHTML += `<div class="glass p-3 rounded-2xl flex justify-between text-xs"><span>₱${data[id].amount} via ${data[id].method}</span> <span class="uppercase font-bold ${data[id].status==='pending'?'text-yellow-500':'text-green-500'}">${data[id].status}</span></div>`;
            }
        }
    });
}

// --- TASK LOGIC ---

// Randomly shows either Monetag or Adsgram
function showRewardAd(callback) {
    const choice = Math.random() > 0.5 ? 'monetag' : 'adsgram';
    
    if (choice === 'monetag') {
        // Trigger Interstitial
        if (typeof show_10555746 === 'function') show_10555746().then(callback).catch(callback);
        else if (typeof show_10555727 === 'function') show_10555727().then(callback).catch(callback);
        else callback();
    } else {
        const blockId = adsgramIds[Math.floor(Math.random() * adsgramIds.length)];
        const AdController = window.Adsgram.init({ blockId: blockId });
        AdController.show().then(callback).catch(callback);
    }
}

window.triggerRewardTask = async () => {
    // 1. Show Ad First
    showRewardAd(async () => {
        // 2. Open Full Screen Card
        const linksSnap = await get(ref(db, 'links'));
        const links = linksSnap.val() ? Object.values(linksSnap.val()) : ["https://www.google.com"];
        const randomLink = links[Math.floor(Math.random() * links.length)];

        const container = document.getElementById("taskContainer");
        const timerText = document.getElementById("taskTimer");
        const closeBtn = document.getElementById("closeTask");
        
        container.style.display = "flex";
        document.getElementById("taskFrame").src = randomLink;
        closeBtn.classList.add("hidden");

        let sec = 15;
        const timer = setInterval(() => {
            sec--;
            timerText.innerText = sec + "s";
            if (sec <= 0) {
                clearInterval(timer);
                timerText.innerText = "READY";
                closeBtn.classList.remove("hidden");
            }
        }, 1000);
    });
};

window.finishTask = async () => {
    const reward = (Math.random() * (0.025 - 0.003) + 0.003);
    addReward(reward);
    document.getElementById("taskContainer").style.display = "none";
};

window.bonusTask = (blockId, index) => {
    const AdController = window.Adsgram.init({ blockId: blockId });
    AdController.show().then(async () => {
        const reward = (Math.random() * (0.015 - 0.004) + 0.004);
        const lastBonus = userData.lastBonus || {};
        lastBonus[index] = Date.now();
        await update(ref(db, `users/${userId}`), { lastBonus: lastBonus });
        addReward(reward);
        alert(`Bonus Reward: ₱${reward.toFixed(4)}!`);
    }).catch(() => alert("Ad failed to load."));
};

function updateBonusCooldowns() {
    const lastBonus = userData.lastBonus || {};
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`btn-bonus-${i}`);
        const diff = Date.now() - (lastBonus[i] || 0);
        if (diff < 600000) {
            btn.classList.add("cooldown");
            btn.querySelector('small').innerText = `Wait ${Math.ceil((600000-diff)/60000)}m`;
        } else {
            btn.classList.remove("cooldown");
            const ids = ['21470','21639','21423','24344','24346'];
            btn.querySelector('small').innerText = `Adsgram ${ids[i-1]}`;
        }
    }
}

async function addReward(amt) {
    const newBal = (userData.balance || 0) + amt;
    await update(ref(db, `users/${userId}`), { balance: newBal });
    if (userData.referredBy) {
        const refSnap = await get(ref(db, `users/${userData.referredBy}`));
        if (refSnap.exists()) {
            const comm = amt * 0.20;
            update(ref(db, `users/${userData.referredBy}`), { 
                balance: refSnap.val().balance + comm,
                referralEarnings: (refSnap.val().referralEarnings || 0) + comm
            });
        }
    }
}

// --- ADMIN & MISC ---

window.verifyAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        loadAdminQueue();
    }
};

window.postLink = () => {
    const l = document.getElementById("newLink").value;
    if (l.includes("http")) {
        push(ref(db, 'links'), l);
        alert("Link added!");
        document.getElementById("newLink").value = "";
    }
};

function loadAdminQueue() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const list = document.getElementById("adminWdList");
        list.innerHTML = "";
        const data = snap.val();
        for (let id in data) {
            if (data[id].status === "pending") {
                list.innerHTML += `
                <div class="bg-black/50 p-4 rounded-2xl border border-white/5 text-[10px]">
                    <b>User:</b> ${data[id].user} <br>
                    <b>Target:</b> <span class="text-blue-400 font-bold">${data[id].address}</span><br>
                    <b>Amount:</b> <span class="text-green-400 font-bold">₱${data[id].amount} (${data[id].method})</span>
                    <button onclick="approveWD('${id}')" class="w-full mt-3 bg-green-600 py-1 rounded font-bold">APPROVE</button>
                </div>`;
            }
        }
    });
}

window.approveWD = (id) => update(ref(db, `withdrawals/${id}`), { status: "approved" });

window.requestWithdrawal = async () => {
    const m = document.getElementById("wdMethod").value;
    const a = document.getElementById("wdAddress").value;
    const v = parseFloat(document.getElementById("wdAmount").value);
    if (v > 0 && userData.balance >= v && a) {
        await push(ref(db, 'withdrawals'), { uid: userId, user: userRealName, amount: v, method: m, address: a, status: "pending", timestamp: serverTimestamp() });
        await update(ref(db, `users/${userId}`), { balance: userData.balance - v });
        alert("Request Sent!");
    }
};

window.submitReferral = async () => {
    const c = document.getElementById("refInput").value.toUpperCase();
    if (userData.referredBy || c === userData.referralCode) return alert("Invalid");
    const uSnap = await get(ref(db, 'users'));
    const all = uSnap.val();
    for (let id in all) {
        if (all[id].referralCode === c) {
            await update(ref(db, `users/${userId}`), { referredBy: id });
            await update(ref(db, `users/${id}`), { totalReferrals: (all[id].totalReferrals || 0) + 1 });
            return alert("Success!");
        }
    }
    alert("Code not found");
};

window.sendMessage = () => {
    const t = document.getElementById("chatInput").value;
    if (t.trim()) {
        push(ref(db, 'chat'), { user: userRealName, text: t });
        document.getElementById("chatInput").value = "";
    }
};

initApp();
window.onbeforeunload = () => update(ref(db, `users/${userId}`), { online: false });
