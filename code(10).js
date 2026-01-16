
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction, getDocs } 
from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

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

const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user || { id: "test_user", first_name: "Local", username: "LocalUser" };
const uid = tgUser.id.toString();
const realName = tgUser.username || tgUser.first_name || uid;

let uBalance = 0;
let chatUnsub = null;
let currentRoom = "";

const ROOMS = [
    { id: "global_1", name: "🏆 Diamond Lounge" },
    { id: "global_2", name: "🍍 Pineapple Chat" },
    { id: "global_3", name: "💸 Earners Group" }
];

async function init() {
    const uRef = doc(db, "users", uid);
    const snap = await getDoc(uRef);

    if(!snap.exists()) {
        await setDoc(uRef, { 
            username: realName, 
            balance: 0, 
            referralBonus: 0, 
            referralCount: 0, 
            referredBy: null,
            taskCooldowns: {} 
        });
    } else {
        await updateDoc(uRef, { username: realName });
    }

    onSnapshot(uRef, (d) => {
        const data = d.data();
        uBalance = data.balance;
        document.getElementById('balance').innerText = uBalance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 @${data.username}`;
        document.getElementById('myCode').innerText = data.username;
        document.getElementById('refCount').innerText = data.referralCount || 0;
        document.getElementById('refBonus').innerText = (data.referralBonus || 0).toFixed(2);
        if(data.referredBy) document.getElementById('refInputSection').innerHTML = "Referrer Set!";
    });

    renderRooms();
    loadWithdrawalHistory();
    initTasks();
}

window.nav = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (chatUnsub && id !== 'chatRoomPage') { chatUnsub(); chatUnsub = null; }
};

// --- INVITE SYSTEM FIX ---
window.setInviter = async () => {
    const code = document.getElementById('refInput').value.trim();
    if(code === realName) return alert("You cannot invite yourself!");

    const q = query(collection(db, "users"), where("username", "==", code));
    const snap = await getDocs(q);

    if(snap.empty) return alert("Code not found!");

    const inviterDoc = snap.docs[0];
    const uRef = doc(db, "users", uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(uRef);
            if (userSnap.data().referredBy) throw "Already referred";

            transaction.update(uRef, { referredBy: code });
            transaction.update(inviterDoc.ref, { referralCount: increment(1) });
        });
        alert("Referral saved!");
    } catch (e) { alert(e); }
};

window.claimBonus = async () => {
    const uRef = doc(db, "users", uid);
    const snap = await getDoc(uRef);
    const bonus = snap.data().referralBonus || 0;
    if(bonus < 1) return alert("Min claim is 1 PHP");

    await updateDoc(uRef, { balance: increment(bonus), referralBonus: 0 });
    alert("Claimed!");
};

// --- CHAT SYSTEM FIX ---
function renderRooms() {
    const cont = document.getElementById('roomsContainer');
    cont.innerHTML = "";
    ROOMS.forEach(r => {
        const div = document.createElement('div');
        div.className = "chat-room";
        div.innerHTML = `<strong>${r.name}</strong>`;
        div.onclick = () => openRoom(r.id, r.name);
        cont.appendChild(div);
    });
}

function openRoom(id, name) {
    currentRoom = id;
    document.getElementById('roomTitle').innerText = name;
    nav('chatRoomPage');
    
    const q = query(collection(db, "chats", id, "messages"), orderBy("timestamp", "desc"), limit(30));
    chatUnsub = onSnapshot(q, (snap) => {
        const box = document.getElementById('chatMessages');
        box.innerHTML = "";
        snap.docs.reverse().forEach(d => {
            const m = d.data();
            box.innerHTML += `<div class="msg"><span class="msg-u">@${m.user}</span>: ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

window.sendMsg = async () => {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if(!txt || !currentRoom) return;

    await addDoc(collection(db, "chats", currentRoom, "messages"), {
        user: realName,
        text: txt,
        timestamp: serverTimestamp()
    });
    input.value = "";
};

// --- WITHDRAWAL & ADMIN ---
window.requestW = async () => {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const target = document.getElementById('wTarget').value;
    if(amt < 1 || amt > uBalance) return alert("Invalid Amount (Min 1 PHP)");

    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), { 
        uid, user: realName, amount: amt, target, status: "pending", timestamp: serverTimestamp() 
    });
    alert("Request Sent!");
};

function loadWithdrawalHistory() {
    const q = query(collection(db, "withdrawals"), where("uid", "==", uid));
    onSnapshot(q, (snap) => {
        const body = document.getElementById('wHistoryBody');
        body.innerHTML = "";
        snap.forEach(d => {
            const w = d.data();
            body.innerHTML += `<tr><td>${new Date(w.timestamp?.toDate()).toLocaleDateString()}</td><td>${w.amount}</td><td>${w.status}</td></tr>`;
        });
    });
}

window.adminLogin = () => { if(prompt("Pass?") === "Propetas6") nav('adminPage'); };

function initTasks() {
    // Basic Task Rendering Logic
    const ads = ['10276123', '10337795'];
    const list = document.getElementById('adsList');
    ads.forEach(zone => {
        const b = document.createElement('button');
        b.className = "btn";
        b.innerText = `Watch Ad (Zone ${zone})`;
        b.onclick = () => {
            window[`show_${zone}`]().then(() => {
                updateDoc(doc(db, "users", uid), { balance: increment(0.05) });
                alert("Earned 0.05 PHP!");
            });
        };
        list.appendChild(b);
    });
}

init();
