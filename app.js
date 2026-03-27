
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasedatabase.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Telegram App Logic
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const user = tg?.initDataUnsafe?.user || { id: "GUEST_" + Math.floor(Math.random() * 9999), first_name: "Guest", username: "guest_user" };
const userId = user.id.toString();
const userRealName = user.username ? `@${user.username}` : user.first_name;

document.getElementById("userBar").innerText = "👤 " + userRealName;

let userData = {};

// 1. Initial Load & Monetag In-App Ads
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
    updateUI();
}

function triggerAutoAds() {
    const lastShow = localStorage.getItem('last_inapp_ad');
    const now = Date.now();
    
    // 3 minute cooldown for in-app popups
    if (!lastShow || (now - lastShow) > 180000) {
        if (typeof show_10555746 === 'function') {
            show_10555746({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        }
        if (typeof show_10555727 === 'function') {
            show_10555727({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        }
        localStorage.setItem('last_inapp_ad', now);
    }
}

function listenToData() {
    onValue(ref(db, `users/${userId}`), (snap) => {
        userData = snap.val();
        updateUI();
        updateBonusCooldowns();
    });

    onValue(ref(db, 'users'), (snap) => {
        const users = snap.val();
        let onlineCount = 0;
        let onlineHtml = "";
        let totalStats = 0;

        for (let id in users) {
            totalStats += users[id].balance || 0;
            if (users[id].online) {
                onlineCount++;
                onlineHtml += `<div class="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-[10px] border border-blue-500/20">@${users[id].username.replace('@','')}</div>`;
            }
        }
        document.getElementById("onlineCount").innerText = onlineCount;
        document.getElementById("onlineList").innerHTML = onlineHtml;
        document.getElementById("statsTotal").innerText = `₱${totalStats.toFixed(2)}`;
    });

    onValue(ref(db, 'chat'), (snap) => {
        const msgs = snap.val();
        const box = document.getElementById("chatBox");
        box.innerHTML = "";
        for (let id in msgs) {
            box.innerHTML += `<div><span class="text-blue-400 font-bold">${msgs[id].user}:</span> <span class="text-gray-200">${msgs[id].text}</span></div>`;
        }
        box.scrollTop = box.scrollHeight;
    });

    onValue(ref(db, 'withdrawals'), (snap) => {
        const wds = snap.val();
        const hist = document.getElementById("wdHistory");
        hist.innerHTML = "";
        for (let id in wds) {
            if (wds[id].uid === userId) {
                hist.innerHTML += `
                <div class="glass p-3 rounded-xl flex justify-between items-center text-xs border border-white/5">
                    <span>${wds[id].method} - ₱${wds[id].amount}</span>
                    <span class="${wds[id].status === 'pending' ? 'text-yellow-500' : 'text-green-500'} uppercase font-bold">${wds[id].status}</span>
                </div>`;
            }
        }
    });
}

function updateUI() {
    document.getElementById("userBalance").innerText = `₱${userData.balance.toFixed(4)}`;
    document.getElementById("myRefCode").innerText = userData.referralCode;
    document.getElementById("refCount").innerText = userData.totalReferrals || 0;
    document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(4)}`;
}

// 2. Task System
window.startTask = async function() {
    const linksSnap = await get(ref(db, 'links'));
    const links = linksSnap.val() ? Object.values(linksSnap.val()) : ["https://www.google.com"];
    const randomLink = links[Math.floor(Math.random() * links.length)];

    const overlay = document.getElementById("taskOverlay");
    overlay.style.display = "flex";
    document.getElementById("taskFrame").src = randomLink;
    
    let sec = 15;
    const timer = setInterval(() => {
        sec--;
        document.getElementById("taskTimer").innerText = sec + "s";
        if (sec <= 0) {
            clearInterval(timer);
            document.getElementById("closeTask").classList.remove("hidden");
        }
    }, 1000);
};

window.finishTask = async function() {
    const reward = (Math.random() * (0.025 - 0.003) + 0.003);
    addReward(reward);
    document.getElementById("taskOverlay").style.display = "none";
    document.getElementById("closeTask").classList.add("hidden");
};

// 3. Bonus Ad Logic (10 mins cooldown)
window.bonusTask = function(blockId, index) {
    const AdController = window.Adsgram.init({ blockId: blockId });
    AdController.show().then(async () => {
        const reward = (Math.random() * (0.015 - 0.004) + 0.004);
        const lastBonus = userData.lastBonus || {};
        lastBonus[index] = Date.now();
        
        await update(ref(db, `users/${userId}`), { lastBonus: lastBonus });
        addReward(reward);
        alert(`Bonus Reward: ₱${reward.toFixed(4)} Claimed!`);
    }).catch(err => alert("Ad not ready or skipped. Try again."));
};

function updateBonusCooldowns() {
    const lastBonus = userData.lastBonus || {};
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`btn-bonus-${i}`);
        const lastTime = lastBonus[i] || 0;
        const diff = Date.now() - lastTime;
        if (diff < 600000) { // 10 minutes
            btn.classList.add("cooldown");
            const minsLeft = Math.ceil((600000 - diff) / 60000);
            btn.querySelector('small').innerText = `Cooldown: ${minsLeft}m left`;
        } else {
            btn.classList.remove("cooldown");
            const ids = ['21470','21639','21423','24344','24346'];
            btn.querySelector('small').innerText = `Adsgram ${ids[i-1]}`;
        }
    }
}

async function addReward(amt) {
    const newBal = userData.balance + amt;
    await update(ref(db, `users/${userId}`), { balance: newBal });
    
    if (userData.referredBy) {
        const refRef = ref(db, `users/${userData.referredBy}`);
        const snap = await get(refRef);
        if (snap.exists()) {
            const comm = amt * 0.20;
            update(refRef, { 
                balance: snap.val().balance + comm,
                referralEarnings: (snap.val().referralEarnings || 0) + comm
            });
        }
    }
}

// 4. Withdrawal & Referral & Chat
window.requestWithdrawal = async () => {
    const method = document.getElementById("wdMethod").value;
    const addr = document.getElementById("wdAddress").value;
    const amt = parseFloat(document.getElementById("wdAmount").value);

    if (amt > 0 && userData.balance >= amt && addr.length > 5) {
        await push(ref(db, 'withdrawals'), {
            uid: userId, user: userRealName, amount: amt,
            method: method, address: addr, status: "pending",
            timestamp: serverTimestamp()
        });
        await update(ref(db, `users/${userId}`), { balance: userData.balance - amt });
        alert("Success! Admin will verify your request.");
        document.getElementById("wdAmount").value = "";
        document.getElementById("wdAddress").value = "";
    } else {
        alert("Invalid input or insufficient balance.");
    }
};

window.submitReferral = async () => {
    const code = document.getElementById("refInput").value.toUpperCase();
    if (userData.referredBy) return alert("Already referred!");
    if (code === userData.referralCode) return alert("Nice try!");

    const usersSnap = await get(ref(db, 'users'));
    const allUsers = usersSnap.val();
    let targetUid = null;

    for (let id in allUsers) {
        if (allUsers[id].referralCode === code) {
            targetUid = id; break;
        }
    }

    if (targetUid) {
        await update(ref(db, `users/${userId}`), { referredBy: targetUid });
        await update(ref(db, `users/${targetUid}`), { totalReferrals: (allUsers[targetUid].totalReferrals || 0) + 1 });
        alert("Referral Code Linked!");
    } else {
        alert("Code not found.");
    }
};

window.sendMessage = () => {
    const msg = document.getElementById("chatInput").value;
    if (msg.trim()) {
        push(ref(db, 'chat'), { user: userRealName, text: msg });
        document.getElementById("chatInput").value = "";
    }
};

// 5. Admin Control
window.openAdmin = () => showSection('admin');
window.verifyAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        loadAdminQueue();
    } else {
        alert("Access Denied");
    }
};

window.postLink = () => {
    const l = document.getElementById("newLink").value;
    if (l.startsWith("http")) {
        push(ref(db, 'links'), l);
        alert("Link added to tasks!");
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
                <div class="bg-black/40 p-3 rounded-xl border border-white/5 text-[11px]">
                    <div class="mb-2"><b>User:</b> ${data[id].user} <br> <b>Target:</b> <span class="text-blue-400 font-bold">${data[id].address}</span></div>
                    <div class="flex justify-between items-center">
                        <span class="text-green-400 font-bold">₱${data[id].amount} (${data[id].method})</span>
                        <button onclick="approveWD('${id}')" class="bg-green-600 px-3 py-1 rounded font-bold">APPROVE</button>
                    </div>
                </div>`;
            }
        }
    });
}

window.approveWD = (id) => {
    update(ref(db, `withdrawals/${id}`), { status: "approved" });
    alert("Payout Approved!");
};

// Lifecycle
initApp();
window.onbeforeunload = () => update(ref(db, `users/${userId}`), { online: false });
