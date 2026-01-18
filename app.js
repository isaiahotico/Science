import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, updateDoc, onSnapshot, 
    collection, addDoc, query, where, getDoc, increment, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.appspot.com",
    messagingSenderId: "1056588265588",
    appId: "1:1056588265588:web:8662660a09e07289"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- TELEGRAM INIT ---
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const tgUser = tg.initDataUnsafe?.user;
const uid = tgUser?.id?.toString() || "dev_user";
const username = tgUser?.username || tgUser?.first_name || "Guest";

// --- UI ELEMENTS ---
document.getElementById('userNameDisplay').innerText = `👤 ${username}`;
document.getElementById('my-ref-id').innerText = uid;

// --- NAVIGATION ---
window.showPage = (pageId) => {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
};

// --- DATA LOGIC ---
let userData = {};

// 1. Sync User Data
const userRef = doc(db, "users", uid);
onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
        userData = snapshot.data();
        document.getElementById('balanceDisplay').innerText = `₱${userData.balance.toFixed(3)}`;
        document.getElementById('current-ref').innerText = userData.referredBy || "None";
    } else {
        // Create new user profile
        setDoc(userRef, {
            username: username,
            balance: 0.00,
            referredBy: null,
            lastSignIn: 0,
            createdAt: serverTimestamp()
        });
    }
});

// 2. Ad Rewards
window.watchAd = async (zoneId) => {
    if (typeof show_8662660 !== 'undefined') { // Generic check for Monetag
        // Logic to trigger Monetag show
        // Note: Monetag usually handles display via the script tags.
        // This is a simulation of the reward logic.
        alert("Ad starting... Complete it to earn rewards.");
        
        // After ad (ideally use Monetag callbacks)
        await updateDoc(userRef, { balance: increment(0.05) });        tg.showAlert("You earned ₱0.05!");
    } else {
        // Fallback for testing
        await updateDoc(userRef, { balance: increment(0.05) });
        tg.showScanQrPopup({text: "Ad Simulation"}); // Just visual feedback
        setTimeout(() => {
            tg.closeScanQrPopup();
            tg.showAlert("Reward added (Demo Mode)");
        }, 2000);
    }
};

// 3. Daily Sign-In
window.dailySignIn = async () => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (now - (userData.lastSignIn || 0) > oneDay) {
        await updateDoc(userRef, {
            balance: increment(1.00),
            lastSignIn: now
        });
        tg.showAlert("Success! You claimed ₱1.00");
    } else {
        tg.showAlert("Already claimed! Come back tomorrow.");
    }
};

// 4. Referrals
window.setReferrer = async () => {
    const refInput = document.getElementById('ref-input').value.trim();
    if (!refInput || refInput === uid) return tg.showAlert("Invalid ID");
    if (userData.referredBy) return tg.showAlert("Referrer already set");

    const targetRef = doc(db, "users", refInput);
    const targetSnap = await getDoc(targetRef);

    if (targetSnap.exists()) {
        await updateDoc(userRef, { referredBy: refInput });
        await updateDoc(targetRef, { balance: increment(2.00) }); // Bonus for referrer
        tg.showAlert("Referrer linked! They earned ₱2.00");
    } else {
        tg.showAlert("User not found");
    }
};

// 5. Withdrawals
window.handleWithdraw = async () => {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const addr = document.getElementById('wd-addr').value;
    const method = document.getElementById('wd-method').value;

    if (amt >= 10 && userData.balance >= amt) {
        await updateDoc(userRef, { balance: increment(-amt) });
        await addDoc(collection(db, "withdrawals"), {
            uid, username, amt, addr, method,
            status: "Pending",
            timestamp: serverTimestamp()
        });
        tg.showAlert("Withdrawal Request Sent!");
        fetchWithdrawals();
    } else {
        tg.showAlert("Insufficient balance (Min: ₱10)");
    }
};

// 6. Fetch History
async function fetchWithdrawals() {
    const q = query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        tbody.innerHTML += `<tr>
            <td>₱${d.amt}</td>
            <td>${d.method}</td>
            <td class="status-${d.status}">${d.status}</td>
        </tr>`;
    });
}
// Run on load
fetchWithdrawals();
