
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

/* ================= TELEGRAM DATA ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const userName = tgUser ? `@${tgUser.username || tgUser.first_name}` : "User_" + Math.floor(Math.random()*999);
const userId = tgUser ? tgUser.id.toString() : "DEV_SESSION";
const startParam = tg?.initDataUnsafe?.start_param; // From link: https://t.me/Key_52_bot?start=CODE

document.getElementById("userBar").innerHTML = `<div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div> 👤 ${userName}`;

let userData = { balance: 0 };
let giftCount = 0;
let giftTimerActive = false;
let giftSec = 6;
let giftIntv;

const adsgramIDs = ['21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];
const blogLinks = [
    "https://sentinelgroup7.blogspot.com/?m=1", "https://sentinelgroup6.blogspot.com/?m=1",
    "https://sentinelgroup5.blogspot.com/?m=1", "https://sentinelgroup4.blogspot.com/?m=1",
    "https://sentinelgroup2.blogspot.com/?m=1", "https://sentinelgroup1.blogspot.com/?m=1",
    "https://withdrawaldashboardadmin.blogspot.com/?m=1", "https://paperhouse01.blogspot.com/?m=1"
];

/* ================= CORE SYSTEM ================= */

async function init() {
    const uRef = ref(db, 'users/' + userId);
    const snap = await get(uRef);
    
    if (!snap.exists()) {
        const myCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        userData = { 
            id: userId, username: userName, balance: 0, 
            referralCode: myCode, referredBy: "", totalReferrals: 0, 
            referralEarnings: 0, online: true, lastBonus: {} 
        };
        
        // Auto-Register Referral from Link
        if (startParam && startParam !== myCode) {
            const allUsers = await get(ref(db, 'users'));
            for (let id in allUsers.val()) {
                if (allUsers.val()[id].referralCode === startParam) {
                    userData.referredBy = id;
                    await update(ref(db, `users/${id}`), { totalReferrals: (allUsers.val()[id].totalReferrals || 0) + 1 });
                    break;
                }
            }
        }
        await set(uRef, userData);
    } else {
        await update(uRef, { online: true, username: userName });
    }

    document.getElementById("refLinkDisplay").innerText = `https://t.me/Key_52_bot?start=${userData.referralCode || snap.val().referralCode}`;
    sync();
    renderBonusButtons();
}

function sync() {
    onValue(ref(db, `users/${userId}`), (s) => {
        userData = s.val() || {};
        document.getElementById("userBalance").innerText = `₱${(userData.balance || 0).toFixed(4)}`;
        document.getElementById("refCount").innerText = userData.totalReferrals || 0;
        document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(4)}`;
        updateCD();
    });

    onValue(ref(db, 'users'), (s) => {
        const users = s.val();
        let totalPaid = 0, onlineHtml = "", lb = [];
        for (let id in users) {
            totalPaid += (users[id].balance || 0);
            if (users[id].online) onlineHtml += `<div class="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[8px] font-black border border-blue-500/10">${users[id].username}</div>`;
            lb.push(users[id]);
        }
        document.getElementById("onlineCount").innerText = Object.keys(users).filter(k => users[k].online).length;
        document.getElementById("statsTotal").innerText = `₱${totalPaid.toFixed(2)}`;
        document.getElementById("onlineList").innerHTML = onlineHtml;
        
        lb.sort((a,b) => (b.totalReferrals || 0) - (a.totalReferrals || 0));
        let lbH = "";
        lb.slice(0, 5).forEach((u, i) => lbH += `<div class="glass p-3 rounded-xl flex justify-between text-[10px] font-bold"><span>${i+1}. ${u.username}</span> <span class="text-blue-400">${u.totalReferrals || 0} REFS</span></div>`);
        document.getElementById("leaderboard").innerHTML = lbH;
    });

    onValue(ref(db, 'withdrawals'), (s) => {
        const hist = document.getElementById("wdHistory");
        hist.innerHTML = "";
        const data = s.val();
        for (let id in data) if(data[id].uid === userId) hist.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-[9px] font-black uppercase"><span>₱${data[id].amount} (${data[id].method})</span> <span class="${data[id].status === 'pending' ? 'text-yellow-500' : 'text-green-500'}">${data[id].status}</span></div>`;
    });
}

/* ================= TASK LOGIC ================= */

window.startMainTask = async () => {
    // Show 2 Random Interstitials (Monetag or Adsgram)
    const runAd = async () => {
        const rand = Math.random();
        if (rand < 0.3) {
            await show_10555727().catch(()=>{});
        } else if (rand < 0.6) {
            await show_10555746().catch(()=>{});
        } else {
            const bid = adsgramIDs[Math.floor(Math.random() * adsgramIDs.length)];
            await window.Adsgram.init({ blockId: bid }).show().catch(()=>{});
        }
    };

    tg.MainButton.setText("LOADING ADS...").show();
    await runAd();
    await runAd();
    tg.MainButton.hide();

    // Start Task
    giftCount = 0;
    document.getElementById("giftStatus").innerText = `Gifts: 0/4`;
    document.getElementById("taskContainer").style.display = "flex";
    document.getElementById("taskFrame").src = blogLinks[Math.floor(Math.random() * blogLinks.length)];
    document.getElementById("giftBtn").classList.add("hidden");
    document.getElementById("finalClaim").classList.add("hidden");

    let sec = 15;
    const itv = setInterval(() => {
        sec--;
        document.getElementById("taskTimer").innerText = sec + "s";
        if (sec <= 0) {
            clearInterval(itv);
            document.getElementById("taskTimer").innerText = "READY";
            document.getElementById("giftBtn").classList.remove("hidden");
            document.getElementById("finalClaim").classList.remove("hidden");
        }
    }, 1000);
};

window.triggerGift = () => {
    if (giftCount >= 4) return alert("Task Limit Reached");
    
    // Simulate Popunder Detection
    window.open("https://www.highrevenuegate.com/example_ad", "_blank");
    
    giftTimerActive = true;
    giftSec = 6;
    document.getElementById("giftBtn").classList.add("hidden");
    
    giftIntv = setInterval(() => {
        if (!document.hidden) {
            giftSec--;
            document.getElementById("taskTimer").innerText = "WATCH: " + giftSec + "s";
            if (giftSec <= 0) {
                clearInterval(giftIntv);
                giftCount++;
                document.getElementById("giftStatus").innerText = `Gifts: ${giftCount}/4`;
                addBal(0.002);
                document.getElementById("taskTimer").innerText = "GIFT CLAIMED";
                document.getElementById("giftBtn").classList.remove("hidden");
            }
        } else {
            // Auto Pause logic
            document.getElementById("taskTimer").innerText = "PAUSED (STAY ON PAGE)";
        }
    }, 1000);
};

window.closeTask = () => {
    addBal(0.025);
    document.getElementById("taskContainer").style.display = "none";
    clearInterval(giftIntv);
};

async function addBal(amt) {
    const newB = (userData.balance || 0) + amt;
    await update(ref(db, `users/${userId}`), { balance: newB });
    
    const p = document.getElementById("rewardPopup");
    p.innerText = `₱${amt.toFixed(4)} EARNED!`;
    p.style.display = "block";
    setTimeout(() => p.style.display = "none", 2000);

    if (userData.referredBy) {
        const rRef = ref(db, `users/${userData.referredBy}`);
        const rSnap = await get(rRef);
        if (rSnap.exists()) {
            const comm = amt * 0.20;
            await update(rRef, { 
                balance: (rSnap.val().balance || 0) + comm,
                referralEarnings: (rSnap.val().referralEarnings || 0) + comm
            });
        }
    }
}

/* ================= UTILS ================= */

function renderBonusButtons() {
    const cont = document.getElementById("bonusContainer");
    cont.innerHTML = "";
    adsgramIDs.slice(0, 5).forEach((id, i) => {
        cont.innerHTML += `
            <button onclick="runBonus('${id}', ${i})" id="b${i}" class="glass p-4 rounded-2xl flex justify-between items-center">
                <span class="font-bold text-sm">Node ${i+1}</span>
                <span class="text-green-400 font-black text-xs">₱0.015</span>
            </button>`;
    });
}

window.runBonus = (bid, idx) => {
    window.Adsgram.init({ blockId: bid }).show().then(async () => {
        const lastBonus = userData.lastBonus || {};
        lastBonus[idx] = Date.now();
        await update(ref(db, `users/${userId}`), { lastBonus });
        addBal(0.015);
    });
};

function updateCD() {
    const bonuses = userData.lastBonus || {};
    [0,1,2,3,4].forEach(i => {
        const btn = document.getElementById('b'+i);
        if (btn && Date.now() - (bonuses[i] || 0) < 600000) btn.classList.add("cooldown-mode");
        else if(btn) btn.classList.remove("cooldown-mode");
    });
}

window.requestPayout = async () => {
    const m = document.getElementById("wdMethod").value, a = document.getElementById("wdAddress").value, v = parseFloat(document.getElementById("wdAmount").value);
    if (v > 0 && userData.balance >= v && a.length > 5) {
        await push(ref(db, 'withdrawals'), { uid: userId, user: userName, amount: v, method: m, address: a, status: "pending", time: serverTimestamp() });
        await update(ref(db, `users/${userId}`), { balance: userData.balance - v });
        alert("Submitted.");
    }
};

window.checkAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        onValue(ref(db, 'withdrawals'), (s) => {
            const list = document.getElementById("adminWdList");
            list.innerHTML = "";
            const d = s.val();
            for(let id in d) if(d[id].status === "pending") list.innerHTML += `<div class="bg-black/40 p-4 rounded-xl text-[10px]"><p>${d[id].user}</p><p class="text-blue-400">${d[id].address}</p><p>₱${d[id].amount} (${d[id].method})</p><button onclick="approveWD('${id}')" class="w-full bg-green-600 mt-2 py-1 rounded">APPROVE</button></div>`;
        });
    }
};

window.approveWD = (id) => update(ref(db, `withdrawals/${id}`), { status: "approved" });

init();
window.onbeforeunload = () => update(ref(db, `users/${userId}`), { online: false });
