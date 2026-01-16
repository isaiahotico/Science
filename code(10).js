
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction, getDocs, Timestamp } 
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

// Telegram User Info
const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user || { id: "test", first_name: "Tester", username: "Tester" };
const uid = tgUser.id.toString();
const liveName = tgUser.username || tgUser.first_name || `User${uid.slice(0,4)}`;

let uBalance = 0;
let currentRoomId = null; // Track the currently active chat room

async function init() {
    // User Setup
    const uRef = doc(db, "users", uid);
    const snap = await getDoc(uRef);
    if(!snap.exists()) {
        await setDoc(uRef, { username: liveName, balance: 0, referralBonus: 0, referredBy: null, referralCount: 0, totalRefGains: 0, taskCooldowns: {} });
    } else {
        await updateDoc(uRef, { username: liveName }); // Ensure name is up-to-date
    }

    onSnapshot(uRef, (d) => {
        const data = d.data();
        uBalance = data.balance;
        document.getElementById('balance').innerText = uBalance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 @${data.username}`;
        document.getElementById('myCode').innerText = data.username;
        document.getElementById('refBonus').innerText = data.referralBonus.toFixed(2);
        document.getElementById('refCount').innerText = data.referralCount;
        document.getElementById('refTotal').innerText = `₱ ${data.totalRefGains.toFixed(2)}`;
        
        if(data.referredBy) document.getElementById('refInputSection').innerHTML = `<p style="color:green">Invited by @${data.referredBy}</p>`;
        updateCooldowns(data.taskCooldowns || {});
    });

    loadRooms();
    initLeaderboard();
    initHistory();
    initAdmin();
    setInterval(() => { document.getElementById('realTime').innerText = new Date().toLocaleString(); }, 1000);
}

// Navigation
window.nav = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'adsArea') runAutoAd('show_10276123');
};

function runAutoAd(z) { if(window[z]) window[z]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } }); }

// Task System Setup
const tasks = {
    ads: { id: 'adsList', r: 0.02, cd: 300, zones: ['10276123','10337795','10337853'] },
    sign: { id: 'signInList', r: 0.025, cd: 10800, zones: ['10276123','10337795','10337853'] },
    gift: { id: 'giftList', r: 0.02, cd: 1200, zones: ['10276123','10337795','10337853'] }
};
Object.keys(tasks).forEach(k => {
    const g = tasks[k]; const box = document.getElementById(g.id);
    box.innerHTML = `<h3>🍍 ${k.toUpperCase()} AREA</h3>`;
    g.zones.forEach((z, i) => {
        const tId = `${k}_${i}`;
        box.innerHTML += `<div class="card"><button class="btn" id="btn_${tId}" onclick="doAd('${z}','${tId}',${g.r})">🤑 Task #${i+1} 🍍</button><div id="lbl_${tId}" style="color:red; font-size:0.7rem;"></div></div>`;
    });
});

window.doAd = (z, tId, r) => {
    window[`show_${z}`]().then(async () => {
        await updateDoc(doc(db, "users", uid), { balance: increment(r), [`taskCooldowns.${tId}`]: serverTimestamp() });
        alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
    });
};

function updateCooldowns(times) {
    Object.keys(tasks).forEach(k => {
        tasks[k].zones.forEach((_, i) => {
            const tId = `${k}_${i}`;
            const btn = document.getElementById(`btn_${tId}`);
            const lbl = document.getElementById(`lbl_${tId}`);
            if(!btn) return;
            const last = times[tId]?.toDate().getTime() || 0;
            const diff = Math.floor((last + tasks[k].cd * 1000 - Date.now()) / 1000);
            if(diff > 0) { btn.disabled = true; lbl.innerText = `Wait: ${Math.floor(diff/60)}m ${diff%60}s`; }
            else { btn.disabled = false; lbl.innerText = "Ready!"; }
        });
    });
}

// Top Chat System
function loadRooms() {
    const roomsContainer = document.getElementById('chatRoomsContainer');
    // Dynamically create rooms based on balance tiers (example: 5 tiers)
    const balanceTier = Math.floor(uBalance / 50); // Example: 50 PHP per tier
    const roomNames = ["Beginners", "Amateurs", "Pros", "Experts", "Legends"];
    const numRooms = Math.min(balanceTier + 1, roomNames.length);

    roomsContainer.innerHTML = ''; // Clear existing rooms

    for (let i = 0; i < numRooms; i++) {
        const roomName = roomNames[i];
        const roomElement = document.createElement('div');
        roomElement.classList.add('chat-room');
        roomElement.dataset.roomId = `room_${i}`;
        roomElement.innerHTML = `
            <div class="room-name">${roomName} Room</div>
            <div class="room-users">Users: Loading...</div> 
        `;
        roomElement.onclick = () => enterRoom(`room_${i}`, roomName);
        roomsContainer.appendChild(roomElement);
    }
    
    // Set initial active room if available
    if (numRooms > 0) {
        const defaultRoomId = `room_${Math.min(balanceTier, roomNames.length - 1)}`;
        activateRoom(defaultRoomId);
    }
}

function enterRoom(roomId, roomName) {
    currentRoomId = roomId;
    document.getElementById('currentRoomName').innerText = `${roomName} Chat`;
    nav('roomChat'); // Navigate to the chat display page
    loadRoomMessages(roomId);
    // Update active room styling
    document.querySelectorAll('.chat-room').forEach(r => r.classList.remove('active-room'));
    document.querySelector(`.chat-room[data-room-id="${roomId}"]`).classList.add('active-room');
}

function backToRooms() {
    currentRoomId = null;
    nav('chatPage'); // Go back to the room selection list
}

function loadRoomMessages(roomId) {
    if (!roomId) return;
    const messagesContainer = document.getElementById('chatMessages');
    const roomMessagesQuery = query(collection(db, "chats", roomId, "messages"), orderBy("timestamp", "asc")); // Subcollection

    onSnapshot(roomMessagesQuery, (snap) => {
        messagesContainer.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const time = m.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '...';
            messagesContainer.innerHTML += `<div class="msg"><span class="msg-u">@${m.username}:</span><span class="msg-t">${m.text}</span><span class="msg-d">${time}</span></div>`;
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

window.sendMsg = async () => {
    if (!currentRoomId) return alert("Please select a room first.");
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if (!txt) return;

    const roomMessagesRef = collection(db, "chats", currentRoomId, "messages");
    await addDoc(roomMessagesRef, { 
        uid: uid, // Store user ID for potential future features
        username: liveName, 
        text: txt, 
        timestamp: serverTimestamp() 
    });
    input.value = "";
};

function activateRoom(roomId) {
    // Placeholder for styling active room visually
    // For now, nav() handles page visibility
}

// Referrals
window.setInviter = async () => {
    const code = document.getElementById('refInput').value.trim();
    if(code === liveName) return alert("Self-referral blocked");
    const q = query(collection(db, "users"), where("username", "==", code));
    const s = await getDocs(q);
    if(s.empty) return alert("Code not found");
    await runTransaction(db, async (t) => {
        t.update(doc(db, "users", uid), { referredBy: code });
        t.update(doc(db, s.docs[0].ref), { referralCount: increment(1) });
    });
    alert("Referral Applied!");
};

window.claimBonus = async () => {
    const s = await getDoc(doc(db, "users", uid));
    const b = s.data().referralBonus;
    if(b < 1) return alert("Minimum 1 PHP required");
    await updateDoc(doc(db, "users", uid), { balance: increment(b), referralBonus: 0 });
    alert("Claimed to Main Balance!");
};

// Withdrawals
window.requestW = async () => {
    const a = parseFloat(document.getElementById('wAmt').value);
    const t = document.getElementById('wTarget').value;
    if(a < 1 || a > uBalance) return alert("Invalid amount. Minimum 1 PHP.");
    await updateDoc(doc(db, "users", uid), { balance: increment(-a) });
    await addDoc(collection(db, "withdrawals"), { uid, username: liveName, amount: a, target: t, status: "pending", timestamp: serverTimestamp() });
    alert("Withdrawal Requested!");
};

function initHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("timestamp", "desc")), (s) => {
        const b = document.getElementById('wHistoryBody');
        b.innerHTML = "";
        s.forEach(d => {
            const w = d.data();
            b.innerHTML += `<tr><td>${w.timestamp?.toDate().toLocaleDateString() || ''}</td><td>${w.target}</td><td>${w.status}</td></tr>`;
        });
    });
}

// Leaderboard
function initLeaderboard() {
    onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(20)), (s) => {
        const b = document.getElementById('leadBody');
        b.innerHTML = ""; let i = 1;
        s.forEach(d => {
            b.innerHTML += `<tr><td>${i}</td><td>@${d.data().username}</td><td>₱${d.data().balance.toFixed(2)}</td></tr>`;
            i++;
        });
    });
}

// Admin Panel
window.adminLogin = () => { if(prompt("Pass?") === "Propetas6") nav('adminPage'); };

function initAdmin() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (s) => {
        const box = document.getElementById('adminReqs'); box.innerHTML = "";
        s.forEach(d => {
            const w = d.data();
            box.innerHTML += `<div class="card">@${w.username} - ₱${w.amount}<br>${w.target}<br>
            <button onclick="approve('${d.id}','${w.uid}',${w.amount})">Mark as Paid</button></div>`;
        });
    });
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc"), limit(50)), (s) => {
        const b = document.getElementById('adminHistory'); b.innerHTML = "";
        let total = 0;
        s.forEach(d => {
            const w = d.data();
            if(w.status === 'paid') total += w.amount;
            b.innerHTML += `<tr><td>@${w.username}</td><td>₱${w.amount}</td><td>${w.target}</td><td>${w.status}</td></tr>`;
        });
        document.getElementById('adminTotal').innerText = total.toFixed(2);
    });
}

window.approve = async (id, userId, amt) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "paid" });
    const uS = await getDoc(doc(db, "users", userId));
    const ref = uS.data().referredBy;
    if(ref) {
        const q = query(collection(db, "users"), where("username", "==", ref));
        const s = await getDocs(q);
        if(!s.empty) {
            await updateDoc(s.docs[0].ref, { referralBonus: increment(amt * 0.1), totalRefGains: increment(amt * 0.1) });
        }
    }
};

init();
