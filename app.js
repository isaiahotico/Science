
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

/* ================= TELEGRAM IDENTITY ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const userName = tgUser ? `@${tgUser.username || tgUser.first_name}` : "User_" + Math.floor(Math.random()*999);
const userId = tgUser ? tgUser.id.toString() : "DEV_SESSION";

document.getElementById("userBar").innerHTML = `<div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div> 👤 ${userName}`;

let userData = { balance: 0 };
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

/* ================= APP STARTUP ================= */

async function startSystem() {
    const uRef = ref(db, 'users/' + userId);
    const snap = await get(uRef);
    
    if (!snap.exists()) {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        userData = { 
            id: userId, username: userName, balance: 0, 
            referralCode: newCode, referredBy: "", totalReferrals: 0, 
            referralEarnings: 0, online: true, lastBonus: {} 
        };
        await set(uRef, userData);
    } else {
        await update(uRef, { online: true, username: userName });
    }

    triggerEntryAds();
    syncRealtime();
}

function triggerEntryAds() {
    const lastTime = localStorage.getItem('monetag_cd');
    if (!lastTime || (Date.now() - lastTime) > 180000) { // 3 Minutes
        const adConfig = { type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } };
        if (typeof show_10555746 === 'function') show_10555746(adConfig);
        if (typeof show_10555727 === 'function') show_10555727(adConfig);
        localStorage.setItem('monetag_cd', Date.now());
    }
}

function syncRealtime() {
    // User Data
    onValue(ref(db, `users/${userId}`), (s) => {
        userData = s.val() || { balance: 0 };
        document.getElementById("userBalance").innerText = `₱${(userData.balance || 0).toFixed(4)}`;
        document.getElementById("myCode").innerText = userData.referralCode;
        document.getElementById("refCount").innerText = userData.totalReferrals || 0;
        document.getElementById("refEarned").innerText = `₱${(userData.referralEarnings || 0).toFixed(4)}`;
        updateBonusCooldowns();
    });

    // Global Stats & Online List
    onValue(ref(db, 'users'), (s) => {
        const users = s.val();
        let totalPaid = 0, onlineCount = 0, onlineHtml = "", lb = [];
        for (let id in users) {
            totalPaid += (users[id].balance || 0);
            if (users[id].online) {
                onlineCount++;
                onlineHtml += `<div class="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[8px] font-black border border-blue-500/10">${users[id].username}</div>`;
            }
            lb.push(users[id]);
        }
        document.getElementById("onlineCount").innerText = onlineCount;
        document.getElementById("statsTotal").innerText = `₱${totalPaid.toFixed(2)}`;
        document.getElementById("onlineList").innerHTML = onlineHtml;

        lb.sort((a,b) => (b.totalReferrals || 0) - (a.totalReferrals || 0));
        let lbHtml = "";
        lb.slice(0, 5).forEach((u, i) => {
            lbHtml += `<div class="glass p-3 rounded-xl flex justify-between text-[10px] font-bold"><span>${i+1}. ${u.username}</span> <span class="text-blue-400">${u.totalReferrals || 0} REFS</span></div>`;
        });
        document.getElementById("leaderboard").innerHTML = lbHtml;
    });

    // Withdrawal History
    onValue(ref(db, 'withdrawals'), (s) => {
        const hist = document.getElementById("wdHistory");
        hist.innerHTML = "";
        const data = s.val();
        for (let id in data) {
            if (data[id].uid === userId) {
                hist.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-[9px] font-black uppercase"><span>₱${data[id].amount} (${data[id].method})</span> <span class="${data[id].status === 'pending' ? 'text-yellow-500' : 'text-green-500'}">${data[id].status}</span></div>`;
            }
        }
    });
}

/* ================= EARNING LOGIC ================= */

window.launchRotation = () => {
    const target = blogLinks[Math.floor(Math.random() * blogLinks.length)];
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
};

window.claimTaskReward = () => {
    const amt = (Math.random() * (0.025 - 0.005) + 0.005);
    processReward(amt);
    document.getElementById("taskContainer").style.display = "none";
};

window.runBonusAd = (bid, idx) => {
    if (window.Adsgram) {
        window.Adsgram.init({ blockId: bid.toString() }).show().then(async () => {
            const amt = (Math.random() * (0.015 - 0.004) + 0.004);
            const lastBonus = userData.lastBonus || {};
            lastBonus[idx] = Date.now();
            await update(ref(db, `users/${userId}`), { lastBonus });
            processReward(amt);
        }).catch(() => alert("Ad not ready. Try again."));
    }
};

async function processReward(amt) {
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
            await update(rRef, { 
                balance: (rSnap.val().balance || 0) + comm,
                referralEarnings: (rSnap.val().referralEarnings || 0) + comm
            });
        }
    }
}

function updateBonusCooldowns() {
    const bonuses = userData.lastBonus || {};
    [1,2,3,4,5].forEach(i => {
        const btn = document.getElementById('b'+i);
        const diff = Date.now() - (bonuses[i] || 0);
        if (diff < 600000) btn.classList.add("cooldown-mode");
        else btn.classList.remove("cooldown-mode");
    });
}

/* ================= WITHDRAWAL & REFERRAL ================= */

window.requestWithdrawal = async () => {
    const m = document.getElementById("wdMethod").value;
    const a = document.getElementById("wdAddress").value;
    const v = parseFloat(document.getElementById("wdAmount").value);
    
    if (v > 0 && userData.balance >= v && a.length > 5) {
        await push(ref(db, 'withdrawals'), {
            uid: userId, user: userName, amount: v, method: m, address: a, status: "pending", time: serverTimestamp()
        });
        await update(ref(db, `users/${userId}`), { balance: userData.balance - v });
        alert("Withdrawal submitted for manual review.");
    } else alert("Error: Check balance or wallet info.");
};

window.bindReferrer = async () => {
    const code = document.getElementById("refInput").value.trim().toUpperCase();
    if (userData.referredBy || code === userData.referralCode) return alert("Invalid Code");
    
    const uSnap = await get(ref(db, 'users'));
    const all = uSnap.val();
    for (let id in all) {
        if (all[id].referralCode === code) {
            await update(ref(db, `users/${userId}`), { referredBy: id });
            await update(ref(db, `users/${id}`), { totalReferrals: (all[id].totalReferrals || 0) + 1 });
            alert("Partner Linked! You now give 20% bonus to your friend.");
            return;
        }
    }
    alert("Referrer not found.");
};

/* ================= ADMIN ================= */

window.verifyAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminLogin").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        onValue(ref(db, 'withdrawals'), (s) => {
            const list = document.getElementById("adminWdList");
            list.innerHTML = "";
            const data = s.val();
            for (let id in data) {
                if (data[id].status === "pending") {
                    list.innerHTML += `
                    <div class="bg-black/40 p-4 rounded-2xl border border-white/5 text-[10px]">
                        <p class="mb-1 text-blue-400 font-black uppercase">${data[id].user}</p>
                        <p class="mb-1"><b>Contact:</b> ${data[id].address}</p>
                        <p class="mb-2"><b>Request:</b> ₱${data[id].amount} (${data[id].method})</p>
                        <button onclick="approveRequest('${id}')" class="w-full bg-blue-600 py-2 rounded-lg font-black uppercase text-[8px]">Approve Payout</button>
                    </div>`;
                }
            }
        });
    } else alert("Access Denied.");
};

window.approveRequest = (id) => update(ref(db, `withdrawals/${id}`), { status: "approved" });

startSystem();
window.onbeforeunload = () => update(ref(db, `users/${userId}`), { online: false });
