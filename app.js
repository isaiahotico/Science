
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, limitToLast, get, runTransaction, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- User Profile & Telegram Init ---
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
const userId = user?.id ? "TG" + user.id : "U" + Math.random().toString(36).substr(2, 6).toUpperCase();
const username = user?.username || user?.first_name || "User_" + userId.slice(-4);
document.getElementById('tg-username').innerText = "@" + username;

let uData = { balance: 0, refCode: userId, invites: 0, refEarned: 0, referredBy: "", adsDay: 0, lastDayReset: Date.now() };
const uRef = ref(db, 'users/' + userId);

// --- Ad Engine Configuration ---
const adsgramPool = ['21470', '21639', '21423', '24344', '24346', '24347', '24348', '24349', '24350', '24351', '24352'];
let adPtr = 0; // Pointer for rotating Adsgram IDs

// --- Consolidated Quote Database (60+ Earning, 60+ Invite, 100+ Drive Safety) ---
const quotePool = [
    // --- Psychological Earning Tips (60+) ---
    "The brain processes money as a survival tool. Master your brain, master your wealth.",
    "Abundance is a frequency. Tune into it by staying consistent daily.",
    "Delayed gratification is the ultimate psychological superpower for earners.",
    "Focus on the process of earning, and the balance will take care of itself.",
    "Your reticular activating system is now primed to find new wealth opportunities.",
    "Money is a consequence of value. Provide value, earn money.",
    "Scarcity mindset limits your potential. Embrace abundance.",
    "Small consistent actions lead to massive results over time.",
    "The compound effect applies to habits, including earning habits.",
    "Visualize your financial goals. Your subconscious will work towards them.",
    "Discipline is the bridge between goals and accomplishment.",
    "Your comfort zone is a beautiful place, but nothing ever grows there.",
    "Growth mindset: every challenge is an opportunity to learn and earn.",
    "The psychology of success involves positive self-talk and persistence.",
    "Financial literacy starts with understanding where your money comes from.",
    "Every cent earned is a testament to your effort. Celebrate it.",
    "Don't chase money; attract it by being the person who deserves it.",
    "The secret to getting ahead is getting started. Every click counts.",
    "Your financial future is built one decision at a time.",
    "Consistency is the currency of champions. Keep clicking.",
    "Resilience in the face of temporary setbacks defines true earners.",
    "Shift from 'I can't' to 'How can I?' for a powerful earning mindset.",
    "Your daily routine shapes your financial reality. Make it productive.",
    "Self-belief is the most powerful tool in your earning arsenal.",
    "Learn to manage your money, and your money will work for you.",
    "Embrace the hustle. It's the journey to financial freedom.",
    "The more you value your time, the more you'll earn from it.",
    "Stay curious. New earning opportunities always emerge.",
    "Positive expectation is a magnet for success. Expect to earn.",
    "Every obstacle is a stepping stone. Don't let it be a stumbling block.",
    "Your habits dictate your income. Cultivate positive earning habits.",
    "Understand the power of small increments. They accumulate.",
    "Financial independence is a journey, not a destination. Enjoy the ride.",
    "Leverage your time. Even micro-tasks build momentum.",
    "What you focus on expands. Focus on earning and growing.",
    "The journey of a thousand miles begins with a single step. Click that ad.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Your mind is a garden. Plant seeds of success, not weeds of doubt.",
    "Earning is a skill. Like any skill, it improves with practice.",
    "Don't compare your beginning to someone else's middle.",
    "Set clear, actionable goals. Every ad watched is a step towards them.",
    "The greatest wealth is health. Take care of yourself while you earn.",
    "Be proactive, not reactive, in your earning strategy.",
    "Develop a strong 'why'. It fuels your motivation.",
    "Financial planning starts with consistent effort, however small.",
    "Celebrate small wins. They build momentum for bigger ones.",
    "Your dedication today determines your rewards tomorrow.",
    "The best investment you can make is in yourself.",
    "Believe you can, and you're halfway there.",
    "The expert in anything was once a beginner. Keep learning, keep earning.",
    "Optimism is a strategy for making a better future. Keep clicking.",
    "The price of success is hard work, dedication, and persistence.",
    "Action is the foundational key to all success.",
    "Make each day your masterpiece. Earn consciously.",
    "Don't just wish for it, work for it.",
    "The path to success is to take massive, determined action.",
    "You are capable of more than you know. Unlock your potential.",
    "Earning is a mindset of continuous improvement.",
    "Your effort is directly proportional to your reward.",
    "Harness the power of routine for consistent income.",

    // --- Invite Motivation (60+) ---
    "Human beings are wired for tribal success. Build your tribe, build your income.",
    "Inviting others creates a cycle of reciprocity that always pays back.",
    "Your network is your net worth. Expand it carefully but boldly.",
    "Success is more sustainable when shared with a community you built.",
    "The power of connection multiplies your earning potential.",
    "A rising tide lifts all boats. Invite friends, rise together.",
    "Sharing wealth opportunities strengthens your social bonds.",
    "Be a lighthouse for others seeking financial growth.",
    "Every referral is a seed planted for future harvest.",
    "The best way to predict the future is to create it, together.",
    "Collective effort leads to greater individual rewards.",
    "Empower your friends to earn, and your own earnings will reflect it.",
    "Don't just earn for yourself; create a wave of prosperity.",
    "Your influence has financial value. Use it wisely.",
    "The referral program is a testament to shared success.",
    "Spread the word, spread the wealth.",
    "A strong team can achieve more than an individual.",
    "Help others succeed, and success will find you.",
    "The more people you help, the richer you become, in every sense.",
    "Referrals are the foundation of scalable, passive income.",
    "Be the architect of a thriving earning community.",
    "Your vision for financial freedom can inspire many.",
    "Build your empire one referral at a time.",
    "Unlock new dimensions of earning through collaboration.",
    "Refer and reap the rewards of a growing network.",
    "The best opportunities are meant to be shared.",
    "Ignite a chain reaction of earning and empowerment.",
    "Your connections are your greatest asset. Cultivate them.",
    "Turn your social circle into an earning circle.",
    "The ripple effect of one invite can be immense.",
    "Don't keep a good thing to yourself. Share Paperhouse!",
    "Expand your reach, expand your revenue.",
    "When you refer, you're investing in mutual growth.",
    "The fastest way to achieve your goals is to help others achieve theirs.",
    "Be the catalyst for your friends' financial journeys.",
    "A single invite can open doors to significant passive income.",
    "Your advocacy directly translates to your financial gain.",
    "Make earning a communal experience.",
    "The stronger your network, the stronger your balance.",
    "Think beyond your own efforts. Think leverage.",
    "Your referrals are a testament to your belief in this platform.",
    "Inspire action, inspire income.",
    "The journey to financial success is better with companions.",
    "Lead by example, and others will follow your path to earning.",
    "Referral bonuses are our way of thanking you for your influence.",
    "Build a legacy of shared prosperity.",
    "It pays to be connected. Literally.",
    "The best way to multiply your earnings is to empower others.",
    "Transform your social capital into real capital.",
    "Every friend you bring is a step closer to your financial goals.",
    "Your endorsement is powerful. Use it to build wealth.",
    "Share the dream, share the rewards.",
    "The future of earning is collaborative. Join forces.",
    "Become a beacon of opportunity for your circle.",
    "Referral earnings are a smart, strategic income stream.",
    "Your trust in the platform, when shared, builds immense value.",
    "The seeds of your referrals will grow into a forest of earnings.",
    "Don't underestimate the power of a genuine recommendation.",
    "Creating opportunities for others is the ultimate form of self-enrichment.",
    "Be the reason someone else starts their earning journey.",

    // --- Drive Safety & Care (100+) ---
    "Arrive alive, someone is waiting for you.",
    "Speed thrills but kills. Drive safe.",
    "Safety is a cheap price to pay for a long life.",
    "Focus on the road, not the phone.",
    "A second of distraction can cost a lifetime.",
    "Better late than never.",
    "Drive as if your kids are on the road.",
    "Patience behind the wheel is a life saver.",
    "Respect the road, respect life.",
    "Caution is the best driver.",
    "Don't rush your destiny by speeding.",
    "Safe driving is smart earning.",
    "Be a responsible driver today.",
    "Your life is more valuable than any ad reward.",
    "Keep your eyes on the lane.",
    "Safety first, earning second.",
    "Road safety is no accident.",
    "Take care of your life, it's the only one you have.",
    "Brake for safety, drive for peace.",
    "Mindful driving, peaceful arriving.",
    "The best car safety device is a rear-view mirror with a cop in it.",
    "Texting and driving can be a grave mistake.",
    "Leave space and time for safety.",
    "Don't learn safety by accident.",
    "Protect your future by driving carefully now.",
    "The road is shared. Be considerate.",
    "Assume everyone else is a bad driver. Drive defensively.",
    "Don't drive when drowsy. Fatigue kills.",
    "One hand on the wheel, one eye on the road, one mind on safety.",
    "Your car is a weapon if not handled with care.",
    "Check your mirrors, check your blind spots. Every time.",
    "Seatbelts save lives. Buckle up.",
    "Alcohol and driving don't mix. Never drink and drive.",
    "Wet roads? Slow down. Hydroplaning is real.",
    "Distracted driving kills. Put the phone away.",
    "Don't be a statistic. Drive smart.",
    "Your journey is important, but your life is priceless.",
    "Adjust your speed to conditions, not just the limit.",
    "Look twice, save a life. Especially for motorcycles.",
    "Be predictable, not surprising, to other drivers.",
    "Don't tailgate. Give yourself room to react.",
    "A good driver is a safe driver.",
    "Children in the car? Drive extra carefully.",
    "Don't let road rage control you. Stay calm.",
    "Road safety starts with you.",
    "Maintain your vehicle. Brakes, tires, lights are crucial.",
    "Signal your intentions. Let others know what you're doing.",
    "Avoid unnecessary lane changes.",
    "The faster you go, the longer it takes to stop.",
    "Be visible. Use your lights in bad weather.",
    "Yield to pedestrians. They are vulnerable.",
    "A responsible driver makes responsible choices.",
    "Know your limits and your vehicle's limits.",
    "Don't be an impatient driver. It's not worth the risk.",
    "Drive sober or get pulled over.",
    "Winter driving demands extra caution. Ice is tricky.",
    "Stop at all stop signs and red lights. They're there for a reason.",
    "Never drive under the influence of drugs.",
    "Share the road with cyclists. Give them space.",
    "The horn is for emergencies, not impatience.",
    "Maintain a safe following distance.",
    "Keep your vehicle free of distractions inside.",
    "Every trip is an opportunity to practice safe driving.",
    "Be aware of blind spots for larger vehicles.",
    "The safest drivers are the most prepared.",
    "Educate yourself on traffic laws.",
    "Don't let emotions dictate your driving.",
    "Your decisions on the road impact many lives.",
    "A moment of carelessness can change everything.",
    "Prioritize safety over speed.",
    "Be alert for animals on the road.",
    "Never race on public roads.",
    "Good judgment saves lives.",
    "Ensure all passengers are buckled up.",
    "Teach kids about road safety.",
    "Be a role model for safe driving.",
    "The road is forgiving, but not infinitely.",
    "Don't drive when stressed or tired.",
    "Your hands belong on the wheel, not on the phone.",
    "A clean windshield offers a clearer view of safety.",
    "Think before you react. Road conditions can change instantly.",
    "Driving is a privilege, not a right.",
    "Respect emergency vehicles. Pull over.",
    "Never pass on a solid yellow line.",
    "Keep your headlights clean and functional.",
    "Prepare for long trips. Rest stops are essential.",
    "Avoid aggressive driving. It increases risk.",
    "The more careful you are, the luckier you get.",
    "Safety is everyone's business on the road.",
    "A moment of mindfulness prevents a lifetime of sorrow.",
    "Drive with love in your heart, not anger.",
    "Make it home safe, every time.",
    "Your journey's end should always be safe arrival.",
    "The greatest legacy is a safe life lived."
];


// --- AD CHAIN LOGIC ---
window.fireAdChain = async () => {
    const btn = document.getElementById('adBtn');
    
    // Daily Limit Check (1000 per day)
    const now = Date.now();
    const millisecondsInADay = 24 * 60 * 60 * 1000; // 86,400,000 milliseconds

    // Reset daily count if a new day has passed
    if (now - uData.lastDayReset > millisecondsInADay) {
        uData.adsDay = 0;
        uData.lastDayReset = now;
        await update(uRef, { adsDay: 0, lastDayReset: now }); // Persist reset
    }

    if (uData.adsDay >= 1000) {
        alert("Daily limit (1000 ads) reached. Try again tomorrow!");
        return; // Exit function if limit reached
    }

    btn.classList.add('btn-disabled');
    btn.innerText = "CHAINING ADS...";

    try {
        // 1. Adsgram Ad 1 (rotating ID)
        const adObj1 = window.Adsgram.init({ blockId: adsgramPool[adPtr] });
        adPtr = (adPtr + 1) % adsgramPool.length; // Rotate pointer
        await adObj1.show(); // Await ensures completion before next ad

        // 2. Adsgram Ad 2 (rotating ID)
        const adObj2 = window.Adsgram.init({ blockId: adsgramPool[adPtr] });
        adPtr = (adPtr + 1) % adsgramPool.length; // Rotate pointer again
        await adObj2.show();

        // 3. Monetag Ad (force trigger)
        if (window.show_10555663) {
            await new Promise(resolve => { // Wrap Monetag in a promise for sequential flow
                show_10555663();
                setTimeout(resolve, 1000); // Give Monetag a moment to load/display
            });
        }
        
        // If all ads (or at least the Adsgram ones) finished, process reward
        processReward();

    } catch (e) {
        console.error("Ad chain interrupted or failed:", e);
        // Optionally inform user about ad loading issues
    } finally {
        startCooldown();
    }
};

function processReward() {
    const reward = 0.024; // Total reward for the ad chain
    uData.balance += reward;
    uData.adsDay++; // Increment daily ad count
    uData.lastDayReset = Date.now(); // Update timestamp to reflect latest ad viewed

    // Update user data in Firebase
    update(uRef, {
        balance: uData.balance,
        adsDay: uData.adsDay,
        lastDayReset: uData.lastDayReset // Ensure this is always updated
    });

    // Referral 12% Commission
    if (uData.referredBy) {
        const rRef = ref(db, 'users/' + uData.referredBy);
        runTransaction(rRef, (partner) => {
            if (partner) {
                partner.balance = (partner.balance || 0) + (reward * 0.12);
                partner.refEarned = (partner.refEarned || 0) + (reward * 0.12);
            }
            return partner;
        });
    }

    // Show Motivational Popup
    document.getElementById('quote-text').innerText = `"${quotePool[Math.floor(Math.random() * quotePool.length)]}"`;
    document.getElementById('quote-popup').style.display = 'flex';
}

function startCooldown() {
    let s = 30; // 30-second cooldown
    const btn = document.getElementById('adBtn');
    const bar = document.getElementById('cooldown-box');
    const timer = setInterval(() => {
        s--;
        document.getElementById('timer-text').innerText = `NEXT LOAD IN ${s}s`;
        bar.style.width = ((30 - s) / 30 * 100) + '%';
        if (s <= 0) {
            clearInterval(timer);
            btn.classList.remove('btn-disabled');
            btn.innerText = "START EARNING";
            document.getElementById('timer-text').innerText = "";
            bar.style.width = '0%';
        }
    }, 1000);
}

// --- SECURE REFERRAL SYSTEM ---
window.applyRef = async () => {
    const code = document.getElementById('inputCode').value.trim().toUpperCase();
    if (uData.referredBy) return alert("System Locked: Referral already applied.");
    if (code === userId) return alert("Error: Cannot refer yourself.");

    const usersSnap = await get(ref(db, 'users'));
    let targetUid = null;
    usersSnap.forEach(snap => { if (snap.val().refCode === code) targetUid = snap.key; });

    if (targetUid) {
        const targetRef = ref(db, 'users/' + targetUid);
        
        // Use Transaction to prevent double counts from multiple users or double clicks
        const result = await runTransaction(targetRef, (post) => {
            if (post) {
                if ((post.invites || 0) >= 12) return; // Limit reached
                post.invites = (post.invites || 0) + 1;
            }
            return post;
        });

        if (result.committed) {
            await update(uRef, { referredBy: targetUid });
            alert("Partner Activated! 12% commission link established.");
        } else {
            alert("Partner reached maximum slots (12/12).");
        }
    } else {
        alert("Invalid Referral Code.");
    }
};

// --- DATA SYNC & UI UPDATES ---
onValue(uRef, s => {
    if (s.exists()) {
        uData = { ...uData, ...s.val() };
        document.getElementById('balance').innerText = uData.balance.toFixed(4);
        document.getElementById('myCode').innerText = uData.refCode;
        document.getElementById('totalInvites').innerText = uData.invites || 0;
        document.getElementById('daily-count').innerText = uData.adsDay || 0; // Update daily count
        document.getElementById('totalRefEarned').innerText = "₱" + (uData.refEarned || 0).toFixed(4);
        if (uData.referredBy) {
            document.getElementById('applyBtn').innerText = "PARTNER ACTIVE";
            document.getElementById('applyBtn').classList.add('btn-disabled');
        }
    } else { set(uRef, uData); }
});

// Leaderboard with Ranking
onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(100)), s => {
    const list = document.getElementById('leader-list');
    list.innerHTML = "";
    let users = [];
    s.forEach(u => users.push({ ...u.val(), id: u.key }));
    users.sort((a, b) => b.balance - a.balance).forEach((u, i) => {
        list.innerHTML += `<div class="glass p-4 flex justify-between items-center rounded-2xl border-l-4 ${i<3?'border-yellow-500':'border-slate-800'}">
            <div class="flex items-center gap-3">
                <span class="text-xs font-black italic text-slate-600">#${i+1}</span>
                <span class="text-xs font-bold">${u.username ? u.username : u.id.slice(0, 10)}</span>
            </div>
            <span class="accent-gold font-black">₱${u.balance.toFixed(2)}</span>
        </div>`;
    });
});

// Chat (2000 Message Limit)
window.sendMsg = () => {
    const t = document.getElementById('chatInput').value;
    if (t) push(ref(db, 'chat'), { u: username, t, ts: Date.now() });
    document.getElementById('chatInput').value = "";
};
onValue(query(ref(db, 'chat'), limitToLast(2000)), s => {
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div><span class="accent-gold font-bold">@${m.u}:</span> <span class="text-slate-300 ml-1">${m.t}</span></div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// Admin & Wallet
window.requestWithdraw = () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const acc = document.getElementById('wd-acc').value.trim();
    if (isNaN(amt) || amt < 1 || uData.balance < amt) return alert("Low balance or invalid amount. Min ₱1.00");
    if (acc.length < 5) return alert("Invalid GCash number. Must be at least 5 digits.");

    const id = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + id), { uid: userId, u: username, amt, acc, status: 'pending', ts: Date.now() });
    update(uRef, { balance: uData.balance - amt });
    alert("Withdrawal request filed.");
};

// User's Withdrawal History
onValue(query(ref(db, 'withdrawals'), orderByChild('uid'), equalTo(userId)), s => {
    const historyDiv = document.getElementById('user-wd-history');
    historyDiv.innerHTML = "";
    if (!s.exists()) {
        historyDiv.innerHTML = "<p class='text-slate-500 text-center italic'>No withdrawal history yet.</p>";
        return;
    }
    let withdrawals = [];
    s.forEach(wd => withdrawals.push({ ...wd.val(), key: wd.key }));
    withdrawals.sort((a, b) => b.ts - a.ts); // Sort by newest first

    withdrawals.forEach(wd => {
        const date = new Date(wd.ts).toLocaleDateString();
        const statusClass = wd.status === 'paid' ? 'text-green-400' : 'text-yellow-400';
        historyDiv.innerHTML += `
            <div class="glass p-3 rounded-lg flex justify-between items-center text-[10px]">
                <div>
                    <p class="font-bold">₱${wd.amt.toFixed(2)} to ${wd.acc}</p>
                    <p class="text-slate-500">${date}</p>
                </div>
                <span class="${statusClass} font-bold uppercase">${wd.status}</span>
            </div>
        `;
    });
});


window.checkAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-content').classList.remove('hidden');
        onValue(query(ref(db, 'withdrawals'), orderByChild('ts')), s => { // Order by timestamp for admin
            const l = document.getElementById('admin-list'); l.innerHTML = "";
            let pendingWithdrawals = [];
            s.forEach(w => {
                const d = w.val();
                if (d.status === 'pending') {
                    pendingWithdrawals.push({ ...d, key: w.key });
                }
            });
            pendingWithdrawals.sort((a, b) => a.ts - b.ts); // Oldest first for admin processing

            pendingWithdrawals.forEach(d => {
                const date = new Date(d.ts).toLocaleDateString();
                l.innerHTML += `<div class="glass p-3 text-xs flex justify-between items-center">
                    <div>
                        <p class="font-bold">${d.u} (UID: ${d.uid.slice(2, 8)})</p>
                        <p>₱${d.amt} to ${d.acc}</p>
                        <p class="text-slate-500">${date}</p>
                    </div>
                    <button onclick="approve('${d.key}')" class="bg-green-600 px-3 py-1 rounded text-white">PAY</button>
                </div>`;
            });
            if (pendingWithdrawals.length === 0) {
                l.innerHTML = "<p class='text-slate-500 text-center italic'>No pending withdrawals.</p>";
            }
        });
    } else {
        alert("Invalid Admin Key.");
    }
};
window.approve = (k) => update(ref(db, 'withdrawals/' + k), { status: 'paid', paidBy: userId, paidTs: Date.now() });

// UI Logic
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('nav-active');
};
window.closePop = (id) => document.getElementById(id).style.display = 'none';

setInterval(() => {
    const n = new Date();
    document.getElementById('live-time').innerText = n.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    document.getElementById('live-date').innerText = n.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}, 1000);

// Initial Random In-App Interstitial Ad (3 minute cooldown)
function showInitialAd() {
    const now = Date.now();
    if (now - lastInitialAd < INITIAL_AD_COOLDOWN_MS) {
        return; // Still in cooldown
    }

    const adFunction = getRandomAdZone();
    
    try {
        adFunction({
            type: 'inApp',
            inAppSettings: {
                frequency: 5, 
                capping: 0.1,
                interval: 45,
                timeout: 5,
                everyPage: false
            }
        });
