
// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    databaseURL: "https://paper-house-inc-default-rtdb.firebaseio.com",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- TELEGRAM INIT ---
const tg = window.Telegram.WebApp;
tg.ready();
const user = tg.initDataUnsafe?.user;
const username = user?.username || user?.first_name || "Guest_" + Math.floor(Math.random()*1000);
const userId = user?.id || "anon";

document.getElementById("userBar").innerText = "👤 User: " + username;

// --- INITIAL STATE ---
let userData = {
    balance: 0,
    referrals: 0,
    refBonus: 0,
    referredBy: "",
    lastAd: {}
};

// --- DATA SYNC ---
const userRef = db.ref('users/' + username);
userRef.on('value', (snap) => {
    if(snap.exists()){
        userData = snap.val();
        document.getElementById("balance-display").innerText = "₱ " + userData.balance.toFixed(3);
        document.getElementById("ref-code-display").innerText = username;
        document.getElementById("ref-count").innerText = userData.referrals || 0;
        document.getElementById("ref-bonus").innerText = "₱ " + (userData.refBonus || 0).toFixed(3);
    } else {
        userRef.set({ balance: 0, referrals: 0, refBonus: 0, username: username });
    }
});

// --- AUTOMATIC ADS (NO REWARD) ---
function showAutoAd() {
    const ads = [show_10337853, show_10276123, show_10337795];
    const randomAd = ads[Math.floor(Math.random() * ads.length)];
    
    randomAd({
        type: 'inApp',
        inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
        }
    });
}

// Show ad on open and every 3 minutes
setTimeout(showAutoAd, 5000);
setInterval(showAutoAd, 180000);

// --- REWARDED ADS ---
function handleAd(type) {
    const now = Date.now();
    const cooldown15 = 15 * 60 * 1000;
    const cooldown5 = 5 * 60 * 1000;

    if(type.startsWith('gift')){
        if(now - (userData.lastAd[type] || 0) < cooldown15) return alert("Cooldown! 15m");
        
        let adId = (type === 'gift1') ? show_10276123 : (type === 'gift2' ? show_10337795 : show_10337853);
        
        adId('pop').then(() => {
            processReward(0.075, type);
        }).catch(() => alert("Ad Error"));

    } else if(type === 'vip') {
        if(now - (userData.lastAd[type] || 0) < cooldown5) return alert("Cooldown! 5m");
        // Shows 3 combined inline ads (Logic simplified to 1 reward)
        show_10276123('pop').then(() => processReward(0.022, 'vip'));

    } else if(type === 'premium') {
        if(now - (userData.lastAd[type] || 0) < cooldown5) return alert("Cooldown! 5m");
        show_10337853().then(() => processReward(0.022, 'premium'));
    }
}

function processReward(amt, type) {
    let newBal = userData.balance + amt;
    let updates = { balance: newBal };
    updates[`lastAd/${type}`] = Date.now();
    userRef.update(updates);

    // 8% Referral Logic
    if(userData.referredBy) {
        db.ref('users/' + userData.referredBy + '/refBonus').transaction(b => (b || 0) + (amt * 0.08));
    }
    tg.HapticFeedback.notificationOccurred('success');
}

// --- WITHDRAWAL ---
function submitWithdraw() {
    const name = document.getElementById("w-name").value;
    const num = document.getElementById("w-number").value;
    const amt = parseFloat(document.getElementById("w-amount").value);

    if(amt < 1 || isNaN(amt)) return alert("Min ₱1");
    if(userData.balance < amt) return alert("Insufficient Balance");

    const req = {
        username: username,
        name: name,
        number: num,
        amount: amt,
        status: "PENDING",
        date: new Date().toLocaleString()
    };

    db.ref('withdrawals').push(req);
    userRef.update({ balance: userData.balance - amt });
    alert("Request Sent!");
}

// --- REFERRALS ---
function setReferrer() {
    const ref = document.getElementById("input-ref").value;
    if(ref === username) return alert("Can't refer yourself");
    if(userData.referredBy) return alert("Already referred");

    db.ref('users/' + ref).once('value', snap => {
        if(snap.exists()) {
            userRef.update({ referredBy: ref });
            db.ref('users/' + ref + '/referrals').transaction(r => (r || 0) + 1);
            alert("Referrer Applied!");
        } else {
            alert("User not found");
        }
    });
}

function claimReferral() {
    if(userData.refBonus < 0.01) return alert("Nothing to claim");
    userRef.update({
        balance: userData.balance + userData.refBonus,
        refBonus: 0
    });
    alert("Bonus Claimed!");
}

// --- CHAT ---
function sendChat() {
    const msg = document.getElementById("chat-msg").value;
    if(!msg) return;
    db.ref('chat').push({ user: username, text: msg, time: Date.now() });
    document.getElementById("chat-msg").value = "";
}

db.ref('chat').limitToLast(20).on('value', snap => {
    const container = document.getElementById("chat-content");
    container.innerHTML = "";
    snap.forEach(c => {
        container.innerHTML += `<div style="margin-bottom:5px;"><b class="gold-text">${c.val().user}:</b> ${c.val().text}</div>`;
    });
    container.scrollTop = container.scrollHeight;
});

// --- ADMIN DASHBOARD ---
function adminLogin() {
    if(document.getElementById("admin-pass").value === "Propetas12") {
        document.getElementById("admin-auth").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', snap => {
        const list = document.getElementById("pending-list");
        const hist = document.querySelector("#admin-history tbody");
        list.innerHTML = ""; hist.innerHTML = "";
        
        snap.forEach(c => {
            const w = c.val();
            const id = c.key;
            if(w.status === "PENDING") {
                list.innerHTML += `
                <div style="background:#222; padding:10px; margin-bottom:5px; border:1px solid gold">
                    ${w.name} (${w.username}) - ₱${w.amount}<br>GCash: ${w.number}<br>
                    <button onclick="approve('${id}', 'APPROVED')">APPROVE</button>
                    <button onclick="approve('${id}', 'DENIED')">DENY</button>
                </div>`;
            } else {
                hist.innerHTML += `<tr><td>${w.name}</td><td>${w.number}</td><td>₱${w.amount}</td><td>${w.status}</td></tr>`;
            }
        });
    });
}

function approve(id, status) {
    db.ref('withdrawals/' + id).update({ status: status });
    if(status === "DENIED") {
        db.ref('withdrawals/' + id).once('value', snap => {
            db.ref('users/' + snap.val().username + '/balance').transaction(b => b + snap.val().amount);
        });
    }
}

// --- UI UTILS ---
function showTab(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'withdraw') loadMyHistory();
}

function loadMyHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(username).on('value', snap => {
        const tbody = document.querySelector("#my-history tbody");
        tbody.innerHTML = "";
        snap.forEach(c => {
            const w = c.val();
            tbody.innerHTML += `<tr><td>${w.date}</td><td>₱${w.amount}</td><td>${w.status}</td></tr>`;
        });
    });
}

const colors = ["#0f0f0f", "#1a0033", "#330000", "#001a00", "#1a1a00"];
function changeBg() {
    document.body.style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
}
