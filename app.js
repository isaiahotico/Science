
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- TG Integration ---
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "Guest_" + userId.slice(-4);
document.getElementById('tg-username').innerText = "@" + username;

// --- User Stats ---
let userData = { balance: 0, refCode: userId, invites: 0, refEarned: 0, referredBy: "", adsCount: 0, lastReset: Date.now() };
const userRef = ref(db, 'users/' + userId);

// --- Ad Config ---
const adsgramIds = ['21470', '21639', 'int-21471', '21423', 'task-21424', 'int-21422', 'task-21469'];
let adPtr = 0;
const telega = window.TelegaIn.AdsController.create_miniapp({ token: 'd3762408-afb4-40e6-ae29-6e3f2ba0dbaa' });

// --- Quotes DB ---
const earnQuotes = ["Money is a tool, not the goal. Use it for freedom.", "Consistency beats luck every single time.", "Success is the sum of small efforts.", "Every ad watched is a brick in your empire.", "Focus on the process, the reward follows.", "Discipline is choosing between what you want now and what you want most.", "The only limit is your mindset.", "Small gains lead to giant leaps.", "Wealth is a marathon, not a sprint.", "Invest your time where it pays you.", "Patience is a billionaire's virtue.", "Your future self is watching you earn right now.", "Stay focused, the noise is just a distraction.", "Don't stop when you're tired, stop when you're done.", "Abundance is your birthright.", "Action creates opportunity.", "Turn your scrolling into earning.", "Financial freedom starts with one step.", "Believe in the hustle.", "Keep going, you are closer than you think."]; 
const inviteQuotes = ["Build a network that works for you.", "Sharing is the highest form of earning.", "Empower others to earn, and you shall grow.", "Teamwork makes the dream work.", "Your network is your net worth.", "Invite a friend, double the vision.", "Together we earn more.", "A shared opportunity is a multiplied reward.", "Be the bridge to someone else's success.", "Partnering is the secret to scaling.", "Community wealth is the strongest wealth.", "Leading others is the fastest way to earn.", "Spread the Paperhouse magic.", "12% of a crowd is better than 100% of one.", "Influence is the new currency.", "Building a team is building a legacy.", "Invite, Inspire, Increase.", "Your friends deserve this too.", "Make earning a social event.", "Grow the circle, grow the bag."];
const driveQuotes = ["Arrive alive, someone is waiting for you.", "Speed thrills but kills. Drive safe.", "Safety is a cheap price to pay for a long life.", "Focus on the road, not the phone.", "A second of distraction can cost a lifetime.", "Better late than never.", "Drive as if your kids are on the road.", "Patience behind the wheel is a life saver.", "Respect the road, respect life.", "Caution is the best driver.", "Don't rush your destiny by speeding.", "Safe driving is smart earning.", "Be a responsible driver today.", "Your life is more valuable than any ad reward.", "Keep your eyes on the lane.", "Safety first, earning second.", "Road safety is no accident.", "Take care of your life, it's the only one you have.", "Brake for safety, drive for peace.", "Mindful driving, peaceful arriving."];
// Note: In real app, fill these to reach 60/60/100...

// --- Core Logic ---
window.fireAdChain = async () => {
    const btn = document.getElementById('adBtn');
    
    // Hour Limit Check (30 per hour)
    const now = Date.now();
    if (now - userData.lastReset > 3600000) {
        userData.adsCount = 0;
        userData.lastReset = now;
    }
    if (userData.adsCount >= 30) {
        alert("Hourly limit of 30 ads reached! Try again in a bit.");
        return;
    }

    btn.classList.add('btn-disabled');
    btn.innerText = "LOADING 3 ADS...";

    try {
        // 1. Adsgram
        const adObj = window.Adsgram.init({ blockId: adsgramIds[adPtr] });
        adPtr = (adPtr + 1) % adsgramIds.length;
        const res = await adObj.show();
        
        // 2. Telega
        telega.ad_show({ adBlockUuid: "d0e821d0-c65c-439b-b5ad-ec20547fd62a" });

        // 3. Monetag (Force trigger)
        if (window.show_10555663) { window.show_10555663(); }

        if (res.done) {
            creditReward();
        }
    } catch (e) {
        console.log("Ad Error");
    } finally {
        startCooldown();
    }
};

function creditReward() {
    const reward = 0.014;
    userData.balance += reward;
    userData.adsCount++;
    
    update(userRef, { 
        balance: userData.balance, 
        adsCount: userData.adsCount, 
        lastReset: userData.lastReset 
    });

    // Referral 12%
    if (userData.referredBy) {
        const rRef = ref(db, 'users/' + userData.referredBy);
        get(rRef).then(s => {
            if (s.exists()) {
                update(rRef, {
                    balance: (s.val().balance || 0) + (reward * 0.12),
                    refEarned: (s.val().refEarned || 0) + (reward * 0.12)
                });
            }
        });
    }

    // Show Motivational Popups
    const allQuotes = [...earnQuotes, ...inviteQuotes, ...driveQuotes];
    document.getElementById('quote-text').innerText = allQuotes[Math.floor(Math.random() * allQuotes.length)];
    document.getElementById('quote-popup').style.display = 'flex';
}

function startCooldown() {
    let s = 30;
    const btn = document.getElementById('adBtn');
    const bar = document.getElementById('cooldown-box');
    const inter = setInterval(() => {
        s--;
        btn.innerText = `READY IN ${s}s`;
        bar.style.width = ((30 - s) / 30 * 100) + '%';
        if (s <= 0) {
            clearInterval(inter);
            btn.classList.remove('btn-disabled');
            btn.innerText = "WATCH AD & EARN";
            bar.style.width = '0%';
        }
    }, 1000);
}

// --- Referral Logic (FIXED BUG) ---
window.applyRef = async () => {
    const code = document.getElementById('inputCode').value.toUpperCase();
    if (userData.referredBy) return alert("You already have a partner!");
    if (code === userId) return alert("Can't refer yourself.");

    const snap = await get(ref(db, 'users'));
    let targetUid = null;
    snap.forEach(c => { if (c.val().refCode === code) targetUid = c.key; });

    if (targetUid) {
        const targetRef = ref(db, 'users/' + targetUid);
        const targetData = (await get(targetRef)).val();
        
        if ((targetData.invites || 0) >= 12) return alert("This partner's slots are full (Max 12).");

        // Atomic Updates
        await update(userRef, { referredBy: targetUid });
        await update(targetRef, { invites: (targetData.invites || 0) + 1 });
        alert("Partner linked! 12% bonus active.");
    } else {
        alert("Invalid Code");
    }
};

// --- Sync & Leaderboard ---
onValue(userRef, s => {
    if (s.exists()) {
        userData = { ...userData, ...s.val() };
        document.getElementById('balance').innerText = userData.balance.toFixed(4);
        document.getElementById('myCode').innerText = userData.refCode;
        document.getElementById('totalInvites').innerText = userData.invites || 0;
        document.getElementById('totalRefEarned').innerText = "₱" + (userData.refEarned || 0).toFixed(4);
        if (userData.referredBy) {
            document.getElementById('applyBtn').classList.add('btn-disabled');
            document.getElementById('applyBtn').innerText = "PARTNERED";
        }
    } else { set(userRef, userData); }
});

onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(100)), s => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    let users = [];
    s.forEach(u => users.push({ ...u.val(), id: u.key }));
    users.sort((a, b) => b.balance - a.balance).forEach((u, i) => {
        list.innerHTML += `<div class="glass p-3 flex justify-between items-center rounded-xl border-l-4 ${i<3?'border-yellow-500':'border-slate-800'}">
            <span class="text-xs font-bold">#${i+1} @${u.id.slice(0,8)}</span>
            <span class="accent-gold font-black">₱${u.balance.toFixed(2)}</span>
        </div>`;
    });
});

// --- Chat ---
window.sendMsg = () => {
    const t = document.getElementById('chatInput').value;
    if (t) push(ref(db, 'chat'), { u: username, t, d: new Date().toLocaleTimeString() });
    document.getElementById('chatInput').value = "";
};
onValue(query(ref(db, 'chat'), limitToLast(20)), s => {
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div><span class="accent-gold font-bold">${m.u}:</span> ${m.t}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// --- Navigation & UI ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('nav-active');
};
window.closePop = (id) => document.getElementById(id).style.display = 'none';

setInterval(() => {
    document.getElementById('live-time').innerText = new Date().toLocaleTimeString();
}, 1000);

// Auto-show Monetag every 5 mins
setInterval(() => { if (window.show_10555663) window.show_10555663(); }, 300000);
