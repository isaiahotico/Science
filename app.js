
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, addDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

/* ================= TELEGRAM & AUTH ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? (tgUser.username || `user_${tgUser.id}`) : "Guest_User";
const refBy = new URLSearchParams(window.location.search).get('ref');

let userData = { balance: 0, cooldowns: {}, referredBy: null };

async function initUser() {
    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        userData.referredBy = refBy !== username ? refBy : null;
        await setDoc(userRef, userData);
    } else {
        userData = snap.data();
    }
    
    document.getElementById("userBar").innerText = "👤 User: @" + username;
    document.getElementById("refLink").value = `https://t.me/YOUR_BOT_USERNAME/app?startapp=${username}`;
    
    // Real-time Balance & Global Stats
    onSnapshot(userRef, (doc) => {
        const d = doc.data();
        document.getElementById("topBalance").innerText = d.balance.toFixed(2);
        document.getElementById("mainBalance").innerText = d.balance.toFixed(2);
    });

    onSnapshot(doc(db, "stats", "global"), (doc) => {
        if(doc.exists()) document.getElementById("globalWithdrawn").innerText = doc.data().total.toFixed(2);
    });

    startCooldownManager();
    renderHistory();
}

/* ================= ADS LOGIC ================= */
// Monetag Auto Interstitial
window.addEventListener('load', () => {
    try {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    } catch(e) {}
});

window.runTask = (num) => {
    const zones = { 1: show_10276123, 2: show_10337795, 3: show_10337853 };
    zones[num]().then(() => {
        alert('You have seen an ad!');
        document.getElementById(`t${num}-btn`).classList.add('hidden');
        document.getElementById(`t${num}-claim`).classList.remove('hidden');
    });
};

window.claim = async (num) => {
    const reward = 0.02;
    const userRef = doc(db, "users", username);
    
    await updateDoc(userRef, { 
        balance: increment(reward),
        [`cooldowns.t${num}`]: Date.now() + (5 * 60 * 1000)
    });

    // Referral 10% Logic
    if (userData.referredBy) {
        const refRef = doc(db, "users", userData.referredBy);
        await updateDoc(refRef, { balance: increment(reward * 0.10) }).catch(() => {});
    }

    document.getElementById(`t${num}-claim`).classList.add('hidden');
    document.getElementById(`t${num}-btn`).classList.remove('hidden');
    alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
};

/* ================= WITHDRAWALS ================= */
window.handleWithdraw = async (method) => {
    const amount = parseFloat(document.getElementById("topBalance").innerText);
    const detail = method === 'GCash' ? document.getElementById("gcashNum").value : document.getElementById("fpayEmail").value;

    if (amount <= 0 || !detail) return alert("Invalid amount or details");

    // Add to Firestore
    await addDoc(collection(db, "withdrawals"), {
        user: username,
        amount: amount,
        method: method,
        detail: detail,
        status: "Pending",
        timestamp: Date.now()
    });

    // Deduct and Update Global Stats
    await updateDoc(doc(db, "users", username), { balance: 0 });
    await updateDoc(doc(db, "stats", "global"), { total: increment(amount) });

    alert("Withdrawal Requested!");
    renderHistory();
};

/* ================= ADMIN & UI ================= */
window.showPage = (id) => {
    ['page-main', 'page-ads', 'page-withdraw', 'page-admin'].forEach(p => document.getElementById(p).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};

window.checkAdmin = () => {
    if (prompt("Enter Password") === "Propetas6") {
        showPage('page-admin');
        loadAdminData();
    }
};

function loadAdminData() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
        const body = document.getElementById("adminBody");
        body.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            body.innerHTML += `<tr>
                <td>${data.user}</td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td>${data.method}</td>
                <td>
                    ${data.status === 'Pending' ? `
                        <button onclick="updateStatus('${d.id}','Paid')" style="background:green; padding:5px; width:40px">✓</button>
                        <button onclick="updateStatus('${d.id}','Denied')" style="background:red; padding:5px; width:40px">X</button>
                    ` : data.status}
                </td>
            </tr>`;
        });
    });
}

window.updateStatus = async (id, status) => {
    await updateDoc(doc(db, "withdrawals", id), { status: status });
};

function renderHistory() {
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(10)), (snap) => {
        const body = document.getElementById("histBody");
        body.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            if(data.user === username) {
                body.innerHTML += `<tr><td>₱${data.amount.toFixed(2)}</td><td>${data.method}</td><td class="status-${data.status.toLowerCase()}">${data.status}</td></tr>`;
            }
        });
    });
}

function startCooldownManager() {
    setInterval(() => {
        const now = Date.now();
        [1, 2, 3].forEach(n => {
            const cd = userData.cooldowns?.[`t${n}`] || 0;
            const btn = document.getElementById(`t${n}-btn`);
            const timer = document.getElementById(`t${n}-timer`);
            if (cd > now) {
                btn.disabled = true;
                btn.style.opacity = 0.5;
                timer.innerText = `Ready in: ${Math.ceil((cd - now) / 1000)}s`;
            } else {
                btn.disabled = false;
                btn.style.opacity = 1;
                timer.innerText = "";
            }
        });
    }, 1000);
}

// Fallback for ad functions if Monetag script fails to load
window.show_10276123 = window.show_10276123 || (() => Promise.resolve());
window.show_10337795 = window.show_10337795 || (() => Promise.resolve());
window.show_10337853 = window.show_10337853 || (() => Promise.resolve());

initUser();
