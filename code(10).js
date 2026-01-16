
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction, getDocs, Timestamp, deleteDoc } 
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
let currentRoomId = null;
let unsubscribeChatListener = null; 

// Predefined chat rooms for all users
const CHAT_ROOMS = [
    { id: "room_0", name: "Beginners Lounge", description: "For newcomers & casual chats." },
    { id: "room_1", name: "Mid-Tier Haven", description: "Grow your balance, share tips!" },
    { id: "room_2", name: "High Rollers Club", description: "Discussions for serious earners." },
    { id: "room_3", name: "Diamond Elite", description: "Exclusive for top contributors." },
    { id: "room_4", name: "The Apex", description: "Where legends gather." }
];

async function init() {
    // User Setup
    const uRef = doc(db, "users", uid);
    const snap = await getDoc(uRef);
    if(!snap.exists()) {
        await setDoc(uRef, { username: liveName, balance: 0, referralBonus: 0, referredBy: null, referralCount: 0, totalRefGains: 0, taskCooldowns: {} });
    } else {
        await updateDoc(uRef, { username: liveName }); // Ensure username is up-to-date
    }

    onSnapshot(uRef, (d) => {
        const data = d.data();
        uBalance = data.balance;
        document.getElementById('balance').innerText = uBalance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 @${data.username}`;
        document.getElementById('myCode').innerText = data.username;
        document.getElementById('refBonus').innerText = data.referralBonus.toFixed(2);
        document.getElementById('refCount').innerText = data.referralCount; // This should now be stable
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

    if (id === 'chatPage') {
        document.getElementById('chatRoomsList').style.display = 'block';
        document.getElementById('roomChatContent').style.display = 'none';
        if (unsubscribeChatListener) {
            unsubscribeChatListener();
            unsubscribeChatListener = null;
        }
    } else {
        // When navigating away from chat page, ensure chat-specific elements are hidden
        document.getElementById('chatRoomsList').style.display = 'block';
        document.getElementById('roomChatContent').style.display = 'none';
    }

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
    roomsContainer.innerHTML = ''; 

    CHAT_ROOMS.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.classList.add('chat-room');
        roomElement.dataset.roomId = room.id;
        roomElement.innerHTML = `
            <div class="room-name">${room.name}</div>
            <div class="room-desc">${room.description}</div> 
        `;
        roomElement.onclick = () => enterRoom(room.id, room.name);
        roomsContainer.appendChild(roomElement);
    });
}

function enterRoom(roomId, roomName) {
    currentRoomId = roomId;
    document.getElementById('currentRoomName').innerText = roomName;
    
    document.getElementById('chatRoomsList').style.display = 'none';
    document.getElementById('roomChatContent').style.display = 'block';

    document.querySelectorAll('.chat-room').forEach(r => r.classList.remove('active-room'));
    document.querySelector(`.chat-room[data-room-id="${roomId}"]`)?.classList.add('active-room');

    loadRoomMessages(roomId);
}

window.backToRooms = () => {
    currentRoomId = null;
    document.getElementById('chatRoomsList').style.display = 'block';
    document.getElementById('roomChatContent').style.display = 'none';
    document.getElementById('chatInput').value = '';
    document.getElementById('chatMessages').innerHTML = ''; 

    if (unsubscribeChatListener) {
        unsubscribeChatListener(); 
        unsubscribeChatListener = null;
    }
};

function loadRoomMessages(roomId) {
    if (!roomId) {
        console.warn("No room ID provided to load messages.");
        return;
    }
    
    if (unsubscribeChatListener) {
        unsubscribeChatListener();
    }

    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = ''; 

    const limitDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h history
    const roomMessagesQuery = query(
        collection(db, "chats", roomId, "messages"), 
        where("timestamp", ">", limitDate),
        orderBy("timestamp", "asc")
    );

    unsubscribeChatListener = onSnapshot(roomMessagesQuery, (snap) => {
        messagesContainer.innerHTML = ''; 
        snap.forEach(doc => {
            const m = doc.data();
            const time = m.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '...';
            messagesContainer.innerHTML += `<div class="msg"><span class="msg-u">@${m.username}:</span><span class="msg-t">${m.text}</span><span class="msg-d">${time}</span></div>`;
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, (error) => {
        console.error("Error loading chat messages:", error);
        messagesContainer.innerHTML = "<p style='color:red;'>Error loading messages. Please try again later.</p>";
    });
}

window.sendMsg = async () => {
    if (!currentRoomId) {
        alert("Please select a chat room first.");
        return;
    }
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if (!txt) return;

    const roomMessagesRef = collection(db, "chats", currentRoomId, "messages");
    try {
        await addDoc(roomMessagesRef, { 
            uid: uid, 
            username: liveName, 
            text: txt, 
            timestamp: serverTimestamp() 
        });
        input.value = "";
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message. Please check your connection or try again later.");
    }
};

// Referrals
window.setInviter = async () => {
    const code = document.getElementById('refInput').value.trim();
    if(code === liveName) return alert("Self-referral blocked");
    
    // Ensure the user hasn't already set an inviter
    const currentUserSnap = await getDoc(doc(db, "users", uid));
    if (currentUserSnap.data().referredBy) {
        alert("You have already set a referrer.");
        return;
    }

    const q = query(collection(db, "users"), where("username", "==", code));
    const s = await getDocs(q);
    
    if(s.empty) {
        alert("Referral code not found.");
        return;
    }
    
    const inviterDocRef = s.docs[0].ref;
    const inviterData = s.docs[0].data();

    // Transaction to update both user's referral status and inviter's count
    await runTransaction(db, async (t) => {
        const inviterDoc = await t.get(inviterDocRef);
        if (!inviterDoc.exists()) {
            throw "Inviter not found during transaction.";
        }
        // Update the current user's referredBy field
        t.update(doc(db, "users", uid), { referredBy: code });
        // Increment the inviter's referralCount
        t.update(inviterDoc.ref, { referralCount: increment(1) });
    });
    alert("Referral Applied Successfully!");
    document.getElementById('refInputSection').innerHTML = `<p style="color:green">Invited by @${code}</p>`; // Update UI immediately
};

window.claimBonus = async () => {
    const userDoc = doc(db, "users", uid);
    try {
        await runTransaction(db, async (t) => {
            const snap = await t.get(userDoc);
            if (!snap.exists()) {
                throw "User document does not exist!";
            }
            const data = snap.data();
            const bonus = data.referralBonus || 0;
            if (bonus < 1) {
                alert("Minimum 1 PHP bonus required to claim.");
                return; // Exit transaction if condition not met
            }
            t.update(userDoc, {
                balance: increment(bonus),
                referralBonus: 0 
            });
        });
        alert("Bonus Claimed to Main Balance!");
    } catch (error) {
        console.error("Error claiming bonus:", error);
        alert("Failed to claim bonus. Please try again.");
    }
};

// Withdrawals
window.requestW = async () => {
    const a = parseFloat(document.getElementById('wAmt').value);
    const t = document.getElementById('wTarget').value.trim();
    if(a < 1 || isNaN(a)) return alert("Invalid amount. Minimum 1 PHP.");
    if (!t) return alert("Please enter your GCash number or FaucetPay email.");
    
    try {
        await updateDoc(doc(db, "users", uid), { balance: increment(-a) });
        await addDoc(collection(db, "withdrawals"), { uid, username: liveName, amount: a, target: t, status: "pending", timestamp: serverTimestamp() });
        alert("Withdrawal Requested Successfully!");
        document.getElementById('wAmt').value = '';
        document.getElementById('wTarget').value = '';
    } catch (error) {
        console.error("Error requesting withdrawal:", error);
        alert("Failed to request withdrawal. Please check your balance or try again later.");
    }
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
    try {
        await updateDoc(doc(db, "withdrawals", id), { status: "paid" });
        
        const userDoc = doc(db, "users", userId);
        const uS = await getDoc(userDoc);
        const ref = uS.data().referredBy;

        if(ref) {
            const q = query(collection(db, "users"), where("username", "==", ref));
            const inviterDocs = await getDocs(q);
            if(!inviterDocs.empty) {
                await updateDoc(inviterDocs.docs[0].ref, { 
                    referralBonus: increment(amt * 0.1), 
                    totalRefGains: increment(amt * 0.1) 
                });
            }
        }
        alert(`Withdrawal ${id} marked as paid.`);
    } catch (error) {
        console.error("Error approving withdrawal:", error);
        alert("Failed to approve withdrawal. Please check logs.");
    }
};

// Initialize the app
init();
