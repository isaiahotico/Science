
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

const tg = window.Telegram?.WebApp;
tg?.expand();

const userObj = tg?.initDataUnsafe?.user || { id: "GUEST_" + Math.floor(Math.random()*999), first_name: "Guest", username: "user" };
const userId = userObj.id.toString();
const userHandle = userObj.username ? `@${userObj.username}` : userObj.first_name;

let userData = { balance: 0 };
const adsgramIds = ['21470', '21639', '21423', '24344', '24346'];
const blogLinks = [
    "https://sentinelgroup7.blogspot.com/?m=1", "https://sentinelgroup6.blogspot.com/?m=1",
    "https://sentinelgroup5.blogspot.com/?m=1", "https://sentinelgroup4.blogspot.com/?m=1",
    "https://sentinelgroup2.blogspot.com/?m=1", "https://sentinelgroup1.blogspot.com/?m=1",
    "https://withdrawaldashboardadmin.blogspot.com/?m=1", "https://farfightimi.blogspot.com/?m=1",
    "https://lefthandedfirstofall.blogspot.com/?m=1", "https://kayee01.blogspot.com/?m=1",
    "https://paperhouse01.blogspot.com/?m=1", "https://funnyfaces252.blogspot.com/?m=1",
    "https://sentinelgroup13.blogspot.com/?m=1", "https://sentinelgroup12.blogspot.com/?m=1",
    "https://sentinelgroup11.blogspot.com/?m=1", "https://sentinelgroup10.blogspot.com/?m=1",
    "https://sentinelgroup9.blogspot.com/?m=1", "https://sentinelgroup8.blogspot.com/?m=1",
    "https://sentinelgroup18.blogspot.com/?m=1", "https://sentinelgroup17.blogspot.com/?m=1",
    "https://sentinelgroup16.blogspot.com/?m=1", "https://sentinelgroup15.blogspot.com/?m=1",
    "https://sentinelgroup14.blogspot.com/?m=1", "https://isaiahrossoticoblog5.blogspot.com/?m=1",
    "https://isaiahrossoticoblog4.blogspot.com/?m=1", "https://isaiahrossoticoblog3.blogspot.com/?m=1",
    "https://isaiahrossoticoblog2.blogspot.com/?m=1", "https://isaiahrossotico1.blogspot.com/?m=1"
];

// Start
async function startApp() {
    const uRef = ref(db, 'users/' + userId);
    const snap = await get(uRef);
    if (!snap.exists()) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await set(uRef, { id: userId, username: userHandle, balance: 0, referralCode: code, online: true });
    } else {
        await update(uRef, { online: true });
    }
    syncData();
}

function syncData() {
    onValue(ref(db, `users/${userId}`), (s) => {
        userData = s.val() || { balance: 0 };
        document.getElementById("userBalance").innerText = `₱${userData.balance.toFixed(4)}`;
        document.getElementById("myRefCode").innerText = userData.referralCode || "---";
        document.getElementById("refCount").innerText = userData.totalReferrals || 0;
        document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(4)}`;
        checkBonusCooldowns();
    });

    onValue(ref(db, 'users'), (s) => {
        const users = s.val();
        let totalPaid = 0, onlineCount = 0, list = "";
        for (let id in users) {
            totalPaid += (users[id].balance || 0);
            if (users[id].online) {
                onlineCount++;
                list += `<span class="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[9px] font-bold border border-blue-500/10">${users[id].username}</span>`;
            }
        }
        document.getElementById("onlineCount").innerText = onlineCount;
        document.getElementById("statsTotal").innerText = `₱${totalPaid.toFixed(2)}`;
        document.getElementById("onlineList").innerHTML = list;
    });

    onValue(ref(db, 'chat'), (s) => {
        const box = document.getElementById("chatBox");
        box.innerHTML = "";
        const data = s.val();
        for (let id in data) { box.innerHTML += `<div><b class="text-blue-400">${data[id].user}:</b> ${data[id].text}</div>`; }
        box.scrollTop = box.scrollHeight;
    });
}

// TASK LOGIC
window.startTaskFlow = () => {
    const isMonetag = Math.random() > 0.5;
    const runInnerTask = () => {
        const combinedLinks = [...blogLinks];
        get(ref(db, 'links')).then(snap => {
            if (snap.exists()) combinedLinks.push(...Object.values(snap.val()));
            const target = combinedLinks[Math.floor(Math.random() * combinedLinks.length)];
            
            document.getElementById("taskContainer").style.display = "flex";
            document.getElementById("taskFrame").src = target;
            document.getElementById("closeTask").classList.add("hidden");

            let timerSec = 15;
            const clock = setInterval(() => {
                timerSec--;
                document.getElementById("taskTimer").innerText = timerSec + "s";
                if (timerSec <= 0) {
                    clearInterval(clock);
                    document.getElementById("taskTimer").innerText = "READY";
                    document.getElementById("closeTask").classList.remove("hidden");
                }
            }, 1000);
        });
    };

    if (isMonetag) {
        if (typeof show_10555746 === 'function') show_10555746().then(runInnerTask).catch(runInnerTask);
        else runInnerTask();
    } else {
        const bid = adsgramIds[Math.floor(Math.random() * adsgramIds.length)];
        window.Adsgram.init({ blockId: bid }).show().then(runInnerTask).catch(runInnerTask);
    }
};

window.finishTaskAction = () => {
    const reward = (Math.random() * (0.025 - 0.003) + 0.003);
    payoutReward(reward);
    document.getElementById("taskContainer").style.display = "none";
};

window.runBonusAd = (bid, idx) => {
    window.Adsgram.init({ blockId: bid }).show().then(async () => {
        const reward = 0.015;
        const lastBonus = userData.lastBonus || {};
        lastBonus[idx] = Date.now();
        await update(ref(db, `users/${userId}`), { lastBonus });
        payoutReward(reward);
    }).catch(() => alert("Ad error."));
};

async function payoutReward(amt) {
    const newBal = (userData.balance || 0) + amt;
    await update(ref(db, `users/${userId}`), { balance: newBal });
    
    const pop = document.getElementById("rewardPopup");
    pop.innerText = `₱${amt.toFixed(4)} EARNED!`;
    pop.style.display = "block";
    setTimeout(() => pop.style.display = "none", 2500);

    if (userData.referredBy) {
        const rRef = ref(db, `users/${userData.referredBy}`);
        const rSnap = await get(rRef);
        if (rSnap.exists()) {
            const comm = amt * 0.20;
            update(rRef, { 
                balance: rSnap.val().balance + comm,
                referralEarnings: (rSnap.val().referralEarnings || 0) + comm
            });
        }
    }
}

function checkBonusCooldowns() {
    const bonuses = userData.lastBonus || {};
    for (let i = 1; i <= 3; i++) {
        const btn = document.getElementById(`btn-bonus-${i}`);
        if (!btn) continue;
        const diff = Date.now() - (bonuses[i] || 0);
        if (diff < 600000) {
            btn.classList.add("cooldown-mode");
            btn.querySelector('small').innerText = `Wait ${Math.ceil((600000-diff)/60000)}m`;
        } else {
            btn.classList.remove("cooldown-mode");
            btn.querySelector('small').innerText = `Premium Ad`;
        }
    }
}

// ADMIN & WITHDRAW
window.checkAdminAuth = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        loadAdminRequests();
    } else alert("Denied.");
};

function loadAdminRequests() {
    onValue(ref(db, 'withdrawals'), (s) => {
        const list = document.getElementById("adminWdList");
        list.innerHTML = "";
        const data = s.val();
        for (let id in data) {
            if (data[id].status === "pending") {
                list.innerHTML += `
                <div class="bg-black/60 p-4 rounded-2xl border border-white/10 text-[10px]">
                    <div class="mb-1"><b>Name:</b> ${data[id].user}</div>
                    <div class="mb-1"><b>Info:</b> <span class="text-blue-400">${data[id].address}</span></div>
                    <div class="mb-2"><b>Amount:</b> <span class="text-green-500 font-black">₱${data[id].amount}</span> (${data[id].method})</div>
                    <button onclick="adminApprove('${id}')" class="w-full bg-green-600 py-2 rounded-lg font-black uppercase">Approve & Mark Paid</button>
                </div>`;
            }
        }
    });
}

window.adminApprove = (id) => update(ref(db, `withdrawals/${id}`), { status: "approved" });

window.addLinkToDb = () => {
    const val = document.getElementById("newLink").value;
    if (val.includes("http")) {
        push(ref(db, 'links'), val);
        alert("Link Registered.");
        document.getElementById("newLink").value = "";
    }
};

window.requestPayout = async () => {
    const m = document.getElementById("wdMethod").value;
    const a = document.getElementById("wdAddress").value;
    const v = parseFloat(document.getElementById("wdAmount").value);
    if (v > 0 && userData.balance >= v && a.length > 5) {
        await push(ref(db, 'withdrawals'), { uid: userId, user: userHandle, amount: v, method: m, address: a, status: "pending" });
        await update(ref(db, `users/${userId}`), { balance: userData.balance - v });
        alert("Request Sent to Admin.");
    } else alert("Invalid input or funds.");
};

window.sendMsg = () => {
    const t = document.getElementById("chatInput").value;
    if (t.trim()) {
        push(ref(db, 'chat'), { user: userHandle, text: t });
        document.getElementById("chatInput").value = "";
    }
};

startApp();
window.onbeforeunload = () => update(ref(db, `users/${userId}`), { online: false });
