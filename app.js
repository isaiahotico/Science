
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- User & Telegram Init ---
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "Guest_" + userId.slice(-4);
document.getElementById('tg-username').innerText = "@" + username;

let uData = { balance: 0, refCode: userId, invites: 0, refEarned: 0, referredBy: "", inviteLimit: 12, adLimitPerHour: 10, lastAdTime: 0 };
const uRef = ref(db, 'users/' + userId);

// --- Ad Configuration ---
const adsgramPool = ['21470', '21639', 'int-21471', '21423', 'task-21424', 'int-21422', 'task-21469'];
let adIdx = 0;
let isCoolingDown = false;

// --- Telega Ads Initialization ---
const telegaAds = window.TelegaIn.AdsController.create_miniapp({ token: 'd3762408-afb4-40e6-ae29-6e3f2ba0dbaa' });

// --- Motivational Content ---
const earnQuotes = ["Money grows on the tree of persistence.", "Your future self is watching you right now.", "Discipline is the bridge between goals and accomplishment.", "Small daily improvements are the key to staggering long-term results.", "The only way to predict the future is to create it.", "Don't stop until you're proud.", "Focus on your goal, not the obstacles.", "Your mind is your greatest asset.", "Every ad is a micro-investment in your future.", "Consistency beats luck.", "Work hard in silence, let success be your noise.", "Winners focus on winning, losers focus on winners.", "The struggle you're in today is developing the strength you need for tomorrow.", "Dream big. Start small. Act now.", "Success is the sum of small efforts repeated day in and day out.", "Your goals don't care about your feelings.", "Don't wish for it, work for it.", "Action is the fundamental key to all success.", "Make today count.", "Stay hungry. Stay foolish.", "The harder you get, the luckier you get.", "Great things take time.", "Be better than you were yesterday.", "Mindset is everything.", "Patience is power.", "Hustle until your haters ask if you're hiring.", "The best way to get started is to quit talking and begin doing.", "Your life only gets better when you get better.", "If you want it, go get it.", "Everything is hard before it is easy.", "Do it with passion or not at all.", "Failure is not the opposite of success, it's part of it.", "Believe you can and you're halfway there.", "Your only limit is you.", "Keep going. Everything you need will come to you at the perfect time.", "Be a warrior, not a worrier.", "The secret to success is to know something nobody else knows.", "Don't wait for opportunity. Create it.", "Success doesn't just find you. You have to go out and get it.", "Little things make big days.", "Be obsessed with your growth.", "Don't decrease the goal, increase the effort.", "Stay focused and extra sparkly.", "You are capable of amazing things.", "Difficulty is the excuse history never accepts.", "Don't be the same, be better.", "Wealth is a mindset.", "Invest in yourself.", "Keep your eyes on the prize.", "The key to success is to start before you are ready.", "Own your life.", "Limits only exist in the mind.", "Hard work always pays off.", "Stay consistent.", "Focus on the outcome.", "Success is a choice.", "Never give up.", "The climb is tough but the view is worth it.", "Do something today that your future self will thank you for.", "You got this."];
const inviteQuotes = ["Partnering up multiplies success!", "Invite a friend, grow together.", "Your network is your net worth.", "Share the opportunity, share the rewards.", "Teamwork makes the dream work.", "The more friends you bring, the more you gain.", "Unlock greater potential with your network.", "Be the reason someone else starts earning.", "Referrals are the foundation of lasting wealth.", "Expand your reach, expand your income.", "Your friends deserve to know about this too!", "Together, we achieve more.", "Share the secret to financial freedom.", "Build your empire, one referral at a time.", "The best opportunities are meant to be shared.", "Empower your friends, empower yourself.", "Don't keep this gem to yourself!", "A simple invite can lead to big rewards.", "Start your referral journey today!", "Your influence has value.", "Grow your earnings by growing your team.", "Maximize your income through smart partnerships.", "Success is better when shared.", "Bring your circle into the fold.", "Referral rewards are our way of saying thank you.", "You're not just earning, you're building.", "Make earning a group activity.", "Share the wealth, double the fun.", "Your referrals are valuable assets.", "Unlock your earning potential with your network.", "Be a leader, invite your crew.", "The power of connection.", "Don't miss out on referral bonuses.", "Let's build an earning community.", "Your network is your biggest asset.", "Help a friend, help yourself.", "The more the merrier, the more the earners!", "Referral bonuses are just the beginning.", "Ignite your earning potential with your network.", "Create a ripple effect of success.", "It pays to have friends here.", "Your journey to abundance starts with a share.", "Let's grow this empire together.", "The best investment is in people.", "Your referrals are key to massive payouts.", "Unlock new income streams.", "Be the spark that ignites their earning journey.", "The future of earning is collaborative.", "Share the success, reap the rewards.", "Your network is your superpower.", "Every referral is a step towards financial freedom.", "Let's create wealth together.", "You're not just earning, you're leading.", "Pass it on!","The journey to wealth is better with friends.", "Make your friends rich, get richer yourself.", "Share the Paperhouse magic!", "Unlock your earning superpower with referrals.", "Your network = Your Net Worth.", "Invite them to the winning circle.", "The more you share, the more you earn.", "Let's build a financially free community.", "Your referrals are the fuel to your financial fire.", "Together, we soar higher."];
const driveQuotes = ["Safety first, always. Accidents are preventable.", "A moment's distraction can lead to a lifetime of regret. Stay focused.", "Buckle up. It's not just a suggestion, it's a life-saver.", "Speed thrills, but it kills. Drive responsibly.", "Don't let your haste ruin someone's day, or life.", "The road is shared. Be considerate, be safe.", "Arrive alive. Drive like you're still trying to meet God.", "Your family is waiting for you. Drive safely.", "Never text and drive. Your message can wait, your life can't.", "Be patient on the road. Patience prevents pain.", "The journey matters as much as the destination. Enjoy it safely.", "Road safety is a shared responsibility. Do your part.", "Don't be a statistic. Be a survivor.", "The difference between a novice and an experienced driver? Caution.", "A calm driver is a safe driver.", "Respect the road, respect life.", "When in doubt, slow down. It's better to be late than never.", "Integrity behind the wheel matters.", "The best protection on the road is awareness.", "Think before you drive. Drive before you think.", "Every journey is a chance to be a hero by driving safely.", "Don't push your luck on the road.", "The road is not a race track. Enjoy the scenery, safely.", "Your reflexes are not invincible. Drive defensively.", "The consequences of careless driving are irreversible.", "Safety is not an option, it's a requirement.", "Be the driver you want others to be.", "Slow down and enjoy the ride of life.", "A small act of caution can prevent a large tragedy.", "The best way to avoid traffic is to drive carefully.", "Make safe driving your habit.", "The road teaches lessons; learn them before it's too late.", "Your decisions on the road impact more than just you.", "Drive with purpose, drive with safety.", "Don't let emotions drive your vehicle.", "The road is unpredictable. Be prepared.", "A focused mind prevents tragic ends.", "The ultimate goal is to arrive home safely.", "Be a responsible road user.", "Prevention is better than cure, especially on the road.", "Your safety is in your hands.", "Drive with respect, arrive with peace.", "The road demands attention; give it.", "Make safety your co-pilot.", "The value of a life is immeasurable. Protect it.", "Don't gamble with your life or others'.", "Drive as if everyone around you is a bad driver.", "Caution is the best policy on the road.", "Arrive home safely, every single time.", "The road is a mirror of your choices.", "Be mindful, be safe, be alive.", "Your driving reflects your character.", "The smartest drivers are the safest drivers.", "Don't let a moment of recklessness cost a lifetime.", "Drive like your kids are in the car.", "Safety is not just a slogan, it's a way of life.", "The road can be unforgiving; be gentle.", "Your attention is your best defense.", "Drive with courtesy, arrive with confidence.", "Make safety your priority, always.", "The road remembers your actions.", "Be an example of safe driving.", "The greatest risk is not being aware."];


// --- Core Functionality ---
window.fireAdChain = async () => {
    if (isCoolingDown) return;
    const btn = document.getElementById('adBtn');
    btn.disabled = true; btn.innerText = "PREPARING...";
    
    // Check hourly limit
    const now = Date.now();
    const timeSinceLastAd = now - uData.lastAdTime;
    const oneHourAgo = now - 3600000;

    // Reset hourly count if an hour has passed
    if (timeSinceLastAd > 3600000) {
        uData.adCountThisHour = 0; // Initialize if it doesn't exist
    }

    if ((uData.adCountThisHour || 0) >= (uData.adLimitPerHour || 10)) {
        alert(`You have reached the limit of ${uData.adLimitPerHour} ads per hour. Please try again in ${Math.ceil((3600000 - timeSinceLastAd) / 60000)} minutes.`);
        isCoolingDown = false; // Ensure cooldown isn't stuck if limit is hit
        btn.disabled = false; btn.innerText = "💰 Earn ₱0.014 Per Ad";
        return;
    }

    const adId = adsgramPool[adIdx];
    adIdx = (adIdx + 1) % adsgramPool.length;

    try {
        // Adsgram
        const AdController = window.Adsgram.init({ blockId: adId });
        const adsgramResult = await AdController.show();
        if (adsgramResult.done) await processReward();

        // Monetag
        if (typeof show_10555663 === 'function') await show_10555663();
        await processReward();

        // Telega Ads
        await new Promise((resolve, reject) => {
            telegaAds.ad_show({
                adBlockUuid: "d0e821d0-c65c-439b-b5ad-ec20547fd62a"
            }).then(resolve).catch(reject);
        });
        await processReward();

    } catch (e) {
        console.error("Ad chain error:", e);
        // Optionally show error to user
    } finally {
        startCooldown();
    }
};

async function processReward() {
    const reward = 0.014;
    const comm = reward * 0.12;

    uData.balance += reward;
    uData.adCountThisHour = (uData.adCountThisHour || 0) + 1;
    uData.lastAdTime = Date.now();

    await update(uRef, {
        balance: uData.balance,
        username,
        adCountThisHour: uData.adCountThisHour,
        lastAdTime: uData.lastAdTime
    });

    // Referral Commission
    if (uData.referredBy && uData.inviteLimit > 0) {
        const rRef = ref(db, 'users/' + uData.referredBy);
        get(rRef).then(s => {
            if (s.exists()) {
                const rData = s.val();
                // Check if referrer has invite slots left
                if ((rData.invites || 0) < (rData.inviteLimit || 12)) {
                    update(rRef, {
                        balance: (rData.balance || 0) + comm,
                        refEarned: (rData.refEarned || 0) + comm,
                        invites: (rData.invites || 0) + 1
                    });
                    showPopup('invite-popup', inviteQuotes);
                } else {
                    // Optionally notify user that referrer reached invite limit
                }
            }
        });
    }
    showPopup('quote-popup', earnQuotes);
    showPopup('drive-popup', driveQuotes); // Show drive popup randomly too
}

function startCooldown() {
    isCoolingDown = true;
    const btn = document.getElementById('adBtn');
    const bar = document.getElementById('cooldown-box');
    let sec = 30; // Cooldown is 30 seconds
    btn.classList.add('btn-disabled');
    bar.style.width = '100%';
    
    const timer = setInterval(() => {
        sec--;
        document.getElementById('timer-text').innerText = `NEXT LOAD: ${sec}s`;
        bar.style.width = ((30 - sec) / 30 * 100) + '%';
        
        if (sec <= 0) {
            clearInterval(timer);
            isCoolingDown = false;
            btn.disabled = false;
            btn.innerText = "💰 Earn ₱0.014 Per Ad";
            btn.classList.remove('btn-disabled');
            document.getElementById('timer-text').innerText = "";
            bar.style.width = '0%';
        }
    }, 1000);
}

// --- Firebase Sync ---
onValue(uRef, (s) => {
    if (s.exists()) {
        uData = { ...uData, ...s.val() };
        document.getElementById('balance').innerText = uData.balance.toFixed(4);
        document.getElementById('myCode').innerText = uData.refCode;
        document.getElementById('totalInvites').innerText = uData.invites || 0;
        document.getElementById('totalRefEarned').innerText = "₱" + (uData.refEarned || 0).toFixed(4);
        if (uData.referredBy) {
            document.getElementById('applyBtn').disabled = true;
            document.getElementById('applyBtn').innerText = "PARTNER ACTIVE";
        }
    } else {
        set(uRef, uData); // Set initial data if user is new
    }
});

// --- Referral ---
window.applyRef = async () => {
    const code = document.getElementById('inputCode').value.toUpperCase();
    if (code === uData.refCode || uData.referredBy) return alert("Invalid Action");
    if (uData.invites >= uData.inviteLimit) return alert(`You have reached your invite limit of ${uData.inviteLimit}.`);

    const usersSnap = await get(ref(db, 'users'));
    let foundRef = null;
    usersSnap.forEach(c => { if (c.val().refCode === code) foundRef = c.key; });

    if (foundRef) {
        await update(uRef, { referredBy: foundRef });
        const rRef = ref(db, 'users/' + foundRef);
        const rSnap = await get(rRef);
        await update(rRef, { invites: (rSnap.val().invites || 0) + 1 });
        alert("Referral Partner Activated!");
    } else { alert("Invalid Referral Code!"); }
};

// --- Real-time Features ---
window.sendMsg = () => {
    const t = document.getElementById('chatInput').value;
    if (!t) return;
    const now = new Date();
    push(ref(db, 'chat'), { 
        u: username, t, 
        d: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ts: now.getTime() // Store timestamp for sorting
    });
    document.getElementById('chatInput').value = "";
};

onValue(query(ref(db, 'chat'), orderByChild('ts'), limitToLast(30)), (s) => { // Increased limit slightly for smoother scrolling
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    let msgs = [];
    s.forEach(c => msgs.push(c.val()));
    msgs.sort((a, b) => a.ts - b.ts).slice(-30).forEach(m => { // Ensure only last 30 shown
        box.innerHTML += `<div><span class="text-slate-600 mr-1">${m.d}</span> <span class="accent-gold font-bold">${m.u}:</span> <span class="text-slate-200">${m.t}</span></div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// Leaderboard fixed
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(100)), (s) => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    let arr = []; s.forEach(u => arr.push(u.val()));
    arr.reverse().forEach((u, i) => {
        // Ensure username exists for display
        const displayName = u.username || "Guest";
        list.innerHTML += `<div class="glass p-3 flex justify-between items-center rounded-xl border-l-2 ${i < 3 ? 'border-yellow-500' : 'border-slate-800'}">
            <span class="text-xs">#${i + 1} @${displayName}</span>
            <span class="font-black text-yellow-500 text-xs">₱${(u.balance || 0).toFixed(2)}</span>
        </div>`;
    });
});

// --- Admin/Wallet ---
window.requestWithdraw = () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const acc = document.getElementById('wd-acc').value;
    const method = document.getElementById('wd-method').value;
    if (amt < 1 || uData.balance < amt) return alert("Invalid Amount or Balance");
    if (acc.length < 5) return alert("Invalid Account Details");

    const id = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + id), { uid: userId, u: username, amt, acc, method, status: 'pending', time: Date.now() });
    update(uRef, { balance: uData.balance - amt });
    alert("Request Sent!");
};

window.checkAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        onValue(ref(db, 'withdrawals'), s => {
            const l = document.getElementById('admin-list'); l.innerHTML = "";
            s.forEach(w => {
                const d = w.val();
                if (d.status === 'pending') {
                    l.innerHTML += `<div class="glass p-3 text-[10px] flex justify-between items-center">
                        <div>${d.u} | ${d.method} | ₱${d.amt}<br>${d.acc}</div>
                        <button onclick="approve('${w.key}')" class="bg-green-600 px-3 py-1 rounded">PAY</button>
                    </div>`;
                }
            });
        });
    }
};
window.approve = (id) => update(ref(db, 'withdrawals/' + id), { status: 'paid' });

// --- UI Utilities ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('nav-active');
};

function showPopup(id, quotesArray) {
    const popup = document.getElementById(id);
    if (popup) {
        popup.style.display = 'flex';
        const quoteTextElement = popup.querySelector('p[id$="-quote-text"]'); // Selects p element with id ending in -quote-text
        if (quoteTextElement) {
            quoteTextElement.innerText = `"${quotesArray[Math.floor(Math.random() * quotesArray.length)]}"`;
        }
    }
}
window.closePopup = (id) => document.getElementById(id).style.display = 'none';

// --- Timers ---
setInterval(() => {
    const n = new Date();
    document.getElementById('live-time').innerText = n.toLocaleTimeString();
    document.getElementById('live-date').innerText = n.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}, 1000);

// Auto-show Monetag every 5 mins
setInterval(() => { if (typeof show_10555663 === 'function') show_10555663(); }, 300000);
