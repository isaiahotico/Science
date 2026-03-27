
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

// Logic Core
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user || { id: "DEV_USER", first_name: "Admin", username: "dev" };
const userId = tgUser.id.toString();
const userRealName = tgUser.username ? `@${tgUser.username}` : tgUser.first_name;

document.getElementById("userBar").innerText = "👤 " + userRealName;

let userData = {};
const adsgramIds = ['21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];

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

// 1. Initial Start
async function init() {
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

    triggerGlobalAds();
    syncDatabase();
}

function triggerGlobalAds() {
    const last = localStorage.getItem('ad_session');
    if (!last || (Date.now() - last) > 180000) {
        const settings = { type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } };
        if (typeof show_10555746 === 'function') show_10555746(settings);
        if (typeof show_10555727 === 'function') show_10555727(settings);
        localStorage.setItem('ad_session', Date.now());
    }
}

function syncDatabase() {
    onValue(ref(db, `users/${userId}`), (s) => {
        userData = s.val();
        document.getElementById("userBalance").innerText = `₱${userData.balance.toFixed(4)}`;
        document.getElementById("myRefCode").innerText = userData.referralCode;
        document.getElementById("refCount").innerText = userData.totalReferrals || 0;
        document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(4)}`;
        updateCooldowns();
    });

    onValue(ref(db, 'users'), (s) => {
        const users = s.val();
        let total = 0, online = 0, html = "";
        for (let id in users) {
            total += (users[id].balance || 0);
            if (users[id].online) {
                online++;
                html += `<div class="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[9px] border border-blue-500/20 font-bold">${users[id].username}</div>`;
            }
        }
        document.getElementById("onlineCount").innerText = online;
        document.getElementById("statsTotal").innerText = `₱${total.toFixed(2)}`;
        document.getElementById("onlineList").innerHTML = html;
    });

    onValue(ref(db, 'chat'), (s) => {
        const box = document.getElementById("chatBox");
        box.innerHTML = "";
        const data = s.val();
        for (let id in data) {
            box.innerHTML += `<div><b class="text-blue-400">${data[id].user}:</b> <span class="text-gray-300">${data[id].text}</span></div>`;
        }
        box.scrollTop = box.scrollHeight;
    });

    onValue(ref(db, 'withdrawals'), (s) => {
        const hist = document.getElementById("wdHistory");
        hist.innerHTML = "";
        const data = s.val();
        for (let id in data) {
            if (data[id].uid === userId) {
                hist.innerHTML += `<div class="glass p-3 rounded-2xl flex justify-between text-[10px] font-bold"><span>₱${data[id].amount} (${data[id].method})</span> <span class="uppercase ${data[id].status==='pending'?'text-yellow-500':'text-green-500'}">${data[id].status}</span></div>`;
            }
        }
    });
}

// 2. Task System
window.startMainTask = () => {
    // Show Random Ad First
    const isMonetag = Math.random() > 0.5;
    const runTask = () => {
        const links = [...blogLinks];
        get(ref(db, 'links')).then(snap => {
            if (snap.exists()) links.push(...Object.values(snap.val()));
            const target = links[Math.floor(Math.random() * links.length)];
            
            document.getElementById("taskContainer").style.display = "flex";
            document.getElementById("taskFrame").src = target;
            document.getElementById("closeTask").classList.add("hidden");

            let sec = 15;
            const timer = setInterval(() => {
                sec--;
                document.getElementById("taskTimer").innerText = sec + "s";
                if (sec <= 0) {
                    clearInterval(timer);
                    document.getElementById("taskTimer").innerText = "READY";
                    document.getElementById("closeTask").classList.remove("hidden");
                }
            }, 1000);
        });
    };

    if (isMonetag) {
        if (typeof show_10555746 === 'function') show_10555746().then(runTask).catch(runTask);
        else runTask();
    } else {
        const bId = adsgramIds[Math.floor(Math.random() * adsgramIds.length)];
        window.Adsgram.init({ blockId: bId }).show().then(runTask).catch(runTask);
    }
};

window.completeMainTask = () => {
    const reward = (Math.random() * (0.025 - 0.003) + 0.003);
    distributeReward(reward);
    document.getElementById("taskContainer").style.display = "none";
};

window.bonusAd = (bId, idx) => {
    window.Adsgram.init({ blockId: bId }).show().then(async () => {
        const reward = (Math.random() * (0.015 - 0.004) + 0.004);
        const lastBonus = userData.lastBonus || {};
        lastBonus[idx] = Date.now();
        await update(ref(db, `users/${userId}`), { lastBonus: lastBonus });
        distributeReward(reward);
    }).catch(() => alert("Ad not ready."));
};

async function distributeReward(amt) {
    const newBal = (userData.balance || 0) + amt;
    await update(ref(db, `users/${userId}`), { balance: newBal });
    
    // UI Feedback
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

function updateCooldowns() {
    const bonuses = userData.lastBonus || {};
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`btn-bonus-${i}`);
        const diff = Date.now() - (bonuses[i] || 0);
        if (diff < 600000) {
            btn.classList.add("cooldown-mode");
            btn.querySelector('small').innerText = `Locked (${Math.ceil((600000-diff)/60000)}m)`;
        } else {
            btn.classList.remove("cooldown-mode");
            btn.querySelector('small').innerText = `Adsgram Mission`;
        }
    }
}

// 3. Admin & Cashout
window.loginAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        syncAdminQueue();
    } else alert("Wrong Password");
};

function syncAdminQueue() {
    onValue(ref(db, 'withdrawals'), (s) => {
        const list = document.getElementById("adminWdList");
        list.innerHTML = "";
        const data = s.val();
        for (let id in data) {
            if (data[id].status === "pending") {
                list.innerHTML += `
                <div class="bg-black/60 p-4 rounded-2xl border border-white/10 text-[10px]">
                    <div class="mb-2"><b>User:</b> ${data[id].user}</div>
                    <div class="mb-2"><b>Target:</b> <span class="text-blue-400 font-bold">${data[id].address}</span></div>
                    <div class="flex justify-between items-center">
                        <span class="text-green-500 font-black">₱${data[id].amount} (${data[id].method})</span>
                        <button onclick="approveWD('${id}')" class="bg-green-600 px-4 py-1 rounded-lg font-black">APPROVE</button>
                    </div>
                </div>`;
            }
        }
    });
}

window.approveWD = (id) => update(ref(db, `withdrawals/${id}`), { status: "approved" });

window.postAdminLink = () => {
    const l = document.getElementById("newLink").value;
    if (l.includes("http")) {
        push(ref(db, 'links'), l);
        alert("Link added to rotation.");
        document.getElementById("newLink").value = "";
    }
};

window.processWithdraw = async () => {
    const m = document.getElementById("wdMethod").value;
    const a = document.getElementById("wdAddress").value;
    const v = parseFloat(document.getElementById("wdAmount").value);
    if (v > 0 && userData.balance >= v && a.length > 3) {
        await push(ref(db, 'withdrawals'), { 
            uid: userId, user: userRealName, amount: v, 
            method: m, address: a, status: "pending", timestamp: serverTimestamp() 
        });
        await update(ref(db, `users/${userId}`), { balance: userData.balance - v });
        alert("Success! Request sent to admin.");
    } else alert("Insufficient balance or invalid info.");
};

// 4. Misc
window.applyReferral = async () => {
    const c = document.getElementById("refInput").value.toUpperCase();
    if (userData.referredBy || c === userData.referralCode) return alert("Invalid Code");
    const uSnap = await get(ref(db, 'users'));
    const all = uSnap.val();
    for (let id in all) {
        if (all[id].referralCode === c) {
            await update(ref(db, `users/${userId}`), { referredBy: id });
            await update(ref(db, `users/${id}`), { totalReferrals: (all[id].totalReferrals || 0) + 1 });
            return alert("Referral Linked!");
        }
    }
    alert("Not found");
};

window.sendChatMessage = () => {
    const t = document.getElementById("chatInput").value;
    if (t.trim()) {
        push(ref(db, 'chat'), { user: userRealName, text: t });
        document.getElementById("chatInput").value = "";
    }
};

init();
window.onbeforeunload = () => update(ref(db, `users/${userId}`), { online: false });
