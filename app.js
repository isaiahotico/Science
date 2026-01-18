
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, orderBy, limit, increment, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= TELEGRAM CONFIG ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*9999);
const startParam = tg?.initDataUnsafe?.start_param; // From link: ?startapp=username

let userData = { balance: 0, refClaimable: 0, invites: 0, cooldowns: {}, referredBy: null };

/* ================= INITIALIZATION ================= */
async function init() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const referredBy = (startParam && `@${startParam}` !== username) ? `@${startParam}` : null;
        await setDoc(userRef, { 
            balance: 0, weekly: 0, refClaimable: 0, invites: 0, 
            cooldowns: {}, referredBy: referredBy 
        });
        if(referredBy) {
            await updateDoc(doc(db, "users", referredBy), { invites: increment(1) }).catch(()=>{});
        }
    }

    onSnapshot(userRef, (s) => {
        userData = s.data();
        document.getElementById('topBalance').innerText = userData.balance.toFixed(3);
        document.getElementById('earnBox').innerText = userData.balance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 ${username}`;
        document.getElementById('refCount').innerText = userData.invites || 0;
        document.getElementById('refClaimable').innerText = `₱${(userData.refClaimable || 0).toFixed(3)}`;
    });

    onSnapshot(doc(db, "stats", "global"), (s) => {
        if(s.exists()) document.getElementById('globalTotal').innerText = s.data().total.toFixed(2);
    });

    document.getElementById('refLink').value = `http://t.me/Key_52_bot/app?startapp=${username.replace('@','')}`;

    setupTasks();
    syncChat();
    setInterval(tick, 1000);
    startAutoAds();
}

/* ================= AUTO ADS (3 MIN LOOP) ================= */
function startAutoAds() {
    const zones = [10276123, 10337795, 10337853];
    setInterval(() => {
        const zone = zones[Math.floor(Math.random() * zones.length)];
        const adFunc = window[`show_${zone}`];
        if (adFunc) {
            adFunc({
                type: 'inApp',
                inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
            });
        }
    }, 180000); // 3 Minutes
}

/* ================= REFERRAL SYSTEM ================= */
window.submitInviteCode = async () => {
    const code = document.getElementById('inputCode').value.trim();
    if (!code.startsWith('@')) return alert("Code must start with @");
    if (code === username) return alert("You cannot invite yourself");
    if (userData.referredBy) return alert("You already have an active referrer");

    const refRef = doc(db, "users", code);
    const refSnap = await getDoc(refRef);

    if (refSnap.exists()) {
        await updateDoc(doc(db, "users", username), { referredBy: code });
        await updateDoc(refRef, { invites: increment(1) });
        alert(`Successfully joined via ${code}!`);
    } else {
        alert("Invite code not found.");
    }
};

window.claimReferralBalance = async () => {
    const amount = userData.refClaimable || 0;
    if (amount <= 0) return alert("No bonus to claim yet.");

    await updateDoc(doc(db, "users", username), {
        balance: increment(amount),
        refClaimable: 0
    });
    alert(`Successfully claimed ₱${amount.toFixed(3)} to main balance!`);
};

/* ================= TASK LOGIC ================= */
function setupTasks() {
    const configs = {
        signin: { reward: 0.025, cd: 10800000, count: 3, zone: 10276123 },
        ads: { reward: 0.02, cd: 300000, count: 3, zone: 10337853 },
        gift: { reward: 0.02, cd: 7200000, count: 3, zone: 10337795, pop: true },
        bonus: { reward: 0.015, cd: 600000, count: 5, random: true }
    };

    Object.keys(configs).forEach(key => {
        const conf = configs[key];
        const cont = document.getElementById(`cont-${key}`);
        cont.innerHTML = `<h3>🍍 ${key.toUpperCase()}</h3>`;
        for (let i = 0; i < conf.count; i++) {
            const id = `${key}_${i}`;
            cont.innerHTML += `
                <div class="card">
                    <button class="btn-task" id="btn-${id}" onclick="runAd('${key}','${id}')">🤑 Task #${i+1} 🤑</button>
                    <div id="timer-${id}" class="cooldown"></div>
                </div>`;
        }
    });
}

window.runAd = (key, id) => {
    const rewards = { signin: 0.025, ads: 0.02, gift: 0.02, bonus: 0.015 };
    const cds = { signin: 10800000, ads: 300000, gift: 7200000, bonus: 600000 };
    const zones = [10276123, 10337795, 10337853];
    const zone = (key === 'bonus') ? zones[Math.floor(Math.random()*3)] : (key === 'ads' ? 10337853 : (key === 'gift' ? 10337795 : 10276123));

    window[`show_${zone}`](key === 'gift' ? 'pop' : undefined).then(async () => {
        const reward = rewards[key];
        await updateDoc(doc(db, "users", username), {
            balance: increment(reward),
            weekly: increment(reward),
            [`cooldowns.${id}`]: Date.now() + cds[key]
        });

        // 10% Referral Bonus logic
        if (userData.referredBy) {
            await updateDoc(doc(db, "users", userData.referredBy), {
                refClaimable: increment(reward * 0.1)
            }).catch(() => {});
        }
        alert("Reward Added!");
    });
};

/* ================= WITHDRAWALS ================= */
window.handleWithdraw = async (method) => {
    if (userData.balance < 1) return alert("Min. withdrawal ₱1.00");
    const info = document.getElementById('payoutInfo').value;
    if (!info) return alert("Details required.");

    let finalAmt = `₱${userData.balance.toFixed(2)}`;
    if (method === 'FaucetPay') finalAmt = `${(userData.balance / 56.5).toFixed(4)} USDT`;

    await addDoc(collection(db, "withdrawals"), {
        user: username, amount: userData.balance, info: info,
        method: method, converted: finalAmt, status: "Pending", timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(userData.balance) });
    alert("Sent for approval!");
};

/* ================= UTILS ================= */
window.navTo = (id) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'page-withdraw') fetchHistory();
    if (id === 'page-leader') fetchLeader();
};

function fetchHistory() {
    const q = query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"), limit(10));
    onSnapshot(q, (s) => {
        document.getElementById('userHistBody').innerHTML = s.docs.map(d => `<tr><td>${d.data().converted}</td><td>${d.data().info}</td><td style="color:var(--gold)">${d.data().status}</td></tr>`).join('');
    });
}

function fetchLeader() {
    const q = query(collection(db, "users"), orderBy("weekly", "desc"), limit(10));
    onSnapshot(q, (s) => {
        document.getElementById('leaderBody').innerHTML = s.docs.map((d, i) => `<tr><td>#${i+1}</td><td>${d.id}</td><td>₱${d.data().weekly.toFixed(2)}</td></tr>`).join('');
    });
}

function syncChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(15));
    onSnapshot(q, (s) => {
        document.getElementById('chat-box').innerHTML = s.docs.map(d => `<div><b>${d.data().user}:</b> ${d.data().text}</div>`).reverse().join('');
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim()) return;
    await addDoc(collection(db, "messages"), { user: username, text: input.value, timestamp: serverTimestamp() });
    input.value = "";
};

window.openAdmin = () => {
    if (prompt("Admin Pass:") === "Propetas6") {
        navTo('page-admin');
        onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "Pending")), (s) => {
            document.getElementById('adminBody').innerHTML = s.docs.map(d => `
                <div class="card">
                    <b>${d.data().user}</b> | ${d.data().converted}<br>${d.data().method}: ${d.data().info}<br>
                    <button class="btn-task" onclick="updateWithdrawStatus('${d.id}', 'Paid')">Approve</button>
                    <button class="btn-withdraw" onclick="updateWithdrawStatus('${d.id}', 'Denied')">Deny</button>
                </div>
            `).join('');
        });
    }
};

window.updateWithdrawStatus = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status: status });
};

function tick() {
    const now = new Date();
    document.getElementById('footerClock').innerText = now.toLocaleTimeString() + " | " + now.toDateString();
    Object.keys(userData.cooldowns || {}).forEach(id => {
        const target = userData.cooldowns[id], btn = document.getElementById(`btn-${id}`), timer = document.getElementById(`timer-${id}`);
        if (btn && Date.now() < target) {
            btn.disabled = true;
            const d = target - Date.now();
            timer.innerText = `Ready in: ${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;
        } else if (btn) { btn.disabled = false; timer.innerText = ""; }
    });
}

init();
