
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

/* ================= TELEGRAM CONFIG ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const userName = tgUser ? `@${tgUser.username || tgUser.first_name}` : "User_" + Math.floor(Math.random()*999);
const userId = tgUser ? tgUser.id.toString() : "TEST_USER";
const botUrl = "https://t.me/Key_52_bot";
const startParam = tg?.initDataUnsafe?.start_param;

document.getElementById("userBar").innerHTML = `<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> 👤 ${userName}`;

let userData = { balance: 0, monetagCount: 0 };
let currentGiftCount = 0;
let giftTimer;

const adsgramIDs = ['21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];
const blogLinks = ["https://sentinelgroup7.blogspot.com/?m=1", "https://sentinelgroup6.blogspot.com/?m=1", "https://paperhouse01.blogspot.com/?m=1", "https://withdrawaldashboardadmin.blogspot.com/?m=1"];

/* ================= INITIALIZATION ================= */

async function init() {
    const uRef = ref(db, 'users/' + userId);
    const snap = await get(uRef);
    
    if (!snap.exists()) {
        const myCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        userData = { 
            id: userId, username: userName, balance: 0, 
            referralCode: myCode, referredBy: "", totalReferrals: 0, 
            referralEarnings: 0, online: true, lastBonus: {}, monetagCount: 0 
        };
        
        // Handle Auto-Referral from start_param
        if (startParam && startParam !== myCode) {
            const usersRef = ref(db, 'users');
            const allUsers = await get(usersRef);
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
        userData = snap.val();
        await update(uRef, { online: true, username: userName });
    }

    document.getElementById("refLinkDisplay").innerText = `${botUrl}?start=${userData.referralCode}`;
    syncData();
    renderBonusButtons();
}

function syncData() {
    onValue(ref(db, `users/${userId}`), (s) => {
        userData = s.val() || userData;
        document.getElementById("userBalance").innerText = `₱${(userData.balance || 0).toFixed(4)}`;
        document.getElementById("refCount").innerText = userData.totalReferrals || 0;
        document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(4)}`;
        updateBonusCD();
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
        lb.slice(0, 10).forEach((u, i) => lbH += `<div class="glass p-3 rounded-xl flex justify-between text-[10px] font-bold"><span>${i+1}. ${u.username}</span> <span class="text-blue-400">${u.totalReferrals || 0} REFS</span></div>`);
        document.getElementById("leaderboard").innerHTML = lbH;
    });

    onValue(ref(db, 'withdrawals'), (s) => {
        const hist = document.getElementById("wdHistory");
        hist.innerHTML = "";
        const data = s.val();
        for (let id in data) if(data[id].uid === userId) hist.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-[9px] font-black uppercase"><span>₱${data[id].amount} (${data[id].method})</span> <span class="${data[id].status === 'pending' ? 'text-yellow-500' : 'text-green-500'}">${data[id].status}</span></div>`;
    });
}

/* ================= AD LOGIC (5:1 ROTATION) ================= */

window.launchMainTask = async () => {
    let count = userData.monetagCount || 0;
    
    tg.MainButton.setText("VERIFYING ADS...").show();
    
    if (count >= 5) {
        // Show Adsgram after 5 Monetags
        const bid = adsgramIDs[Math.floor(Math.random() * adsgramIDs.length)];
        await window.Adsgram.init({ blockId: bid }).show().catch(()=>{});
        count = 0; // Reset
    } else {
        // Show Monetag
        const zone = Math.random() > 0.5 ? '10555727' : '10555746';
        if(window[`show_${zone}`]) await window[`show_${zone}`]().catch(()=>{});
        count++;
    }
    
    await update(ref(db, `users/${userId}`), { monetagCount: count });
    tg.MainButton.hide();

    // Start UI Task
    currentGiftCount = 0;
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

/* ================= GIFT (ADSTERRA POP-UNDER) ================= */

window.claimGift = () => {
    if (currentGiftCount >= 4) return alert("Task Complete");
    
    // Adsterra Popunder Simulation/Trigger
    // We open a direct ad link in a new tab
    window.open("https://www.highrevenuegate.com/example_popunder", "_blank");
    
    document.getElementById("giftBtn").classList.add("hidden");
    let gSec = 6;
    giftTimer = setInterval(() => {
        if (!document.hidden) {
            gSec--;
            document.getElementById("taskTimer").innerText = `WAIT: ${gSec}s`;
            if (gSec <= 0) {
                clearInterval(giftTimer);
                currentGiftCount++;
                document.getElementById("giftStatus").innerText = `Gifts: ${currentGiftCount}/4`;
                addBalance(0.002);
                document.getElementById("taskTimer").innerText = "GIFT DETECTED";
                if(currentGiftCount < 4) document.getElementById("giftBtn").classList.remove("hidden");
            }
        } else {
            document.getElementById("taskTimer").innerText = "PAUSED (RETURN TO PAGE)";
        }
    }, 1000);
};

window.closeTask = () => {
    addBalance(0.025);
    document.getElementById("taskContainer").style.display = "none";
    clearInterval(giftTimer);
};

async function addBalance(amt) {
    const newBal = (userData.balance || 0) + amt;
    await update(ref(db, `users/${userId}`), { balance: newBal });
    
    const p = document.getElementById("rewardPopup");
    p.innerText = `₱${amt.toFixed(4)} EARNED!`;
    p.style.display = "block";
    setTimeout(() => p.style.display = "none", 2000);

    // 20% Referral Commission
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

window.copyRefLink = () => {
    const link = `${botUrl}?start=${userData.referralCode}`;
    navigator.clipboard.writeText(link);
    alert("Referral link copied!");
};

function renderBonusButtons() {
    const cont = document.getElementById("bonusContainer");
    cont.innerHTML = "";
    adsgramIDs.slice(0, 5).forEach((id, i) => {
        cont.innerHTML += `<button onclick="runBonus('${id}', ${i})" id="b${i}" class="glass p-4 rounded-2xl flex justify-between items-center"><span class="font-bold text-sm">Node ${i+1}</span><span class="text-green-400 font-black text-xs">₱0.015</span></button>`;
    });
}

window.runBonus = (bid, idx) => {
    window.Adsgram.init({ blockId: bid }).show().then(async () => {
        const lastBonus = userData.lastBonus || {};
        lastBonus[idx] = Date.now();
        await update(ref(db, `users/${userId}`), { lastBonus });
        addBalance(0.015);
    });
};

function updateBonusCD() {
    const bonuses = userData.lastBonus || {};
    [0,1,2,3,4].forEach(i => {
        const btn = document.getElementById('b'+i);
        if (btn && Date.now() - (bonuses[i] || 0) < 600000) btn.classList.add("cooldown-mode");
        else if(btn) btn.classList.remove("cooldown-mode");
    });
}

window.requestWithdraw = async () => {
    const m = document.getElementById("wdMethod").value, a = document.getElementById("wdAddress").value, v = parseFloat(document.getElementById("wdAmount").value);
    if (v > 0 && userData.balance >= v && a.length > 5) {
        await push(ref(db, 'withdrawals'), { uid: userId, user: userName, amount: v, method: m, address: a, status: "pending", time: serverTimestamp() });
        await update(ref(db, `users/${userId}`), { balance: userData.balance - v });
        alert("Sent to admin.");
    }
};

window.verifyAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        onValue(ref(db, 'withdrawals'), (s) => {
            const list = document.getElementById("adminWdList"); list.innerHTML = "";
            const d = s.val();
            for(let id in d) if(d[id].status === "pending") list.innerHTML += `<div class="bg-black/40 p-4 rounded-xl text-[10px] border border-white/5"><p class="text-blue-400">${d[id].user}</p><p><b>Method:</b> ${d[id].method}</p><p><b>Wallet:</b> ${d[id].address}</p><p class="text-green-500 font-bold">₱${d[id].amount}</p><button onclick="approveWD('${id}')" class="w-full bg-green-600 mt-2 py-1 rounded">PAID</button></div>`;
        });
    }
};

window.approveWD = (id) => update(ref(db, `withdrawals/${id}`), { status: "approved" });

init();
window.onbeforeunload = () => update(ref(db, `users/${userId}`), { online: false });
