
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, 
    query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction, getDocs 
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

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

// Telegram Init
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user || { id: "dev_test", username: "DevTester", first_name: "Tester" };
const uid = user.id.toString();
const myCode = user.username || `User${uid.slice(0,4)}`;

// App State
let balance = 0, referralBonus = 0;
let currentUserData = {}; // Store current user's full data

// --- Initialization ---
async function initApp() {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { 
            username: myCode, 
            balance: 0, 
            referralBonus: 0, 
            referredBy: null, 
            referralCount: 0, 
            totalRefGains: 0,
            taskCooldowns: {} // Initialize task cooldowns
        });
    }
    
    // Real-time listener for current user's data
    onSnapshot(userRef, (d) => {
        currentUserData = d.data(); // Keep current user data updated
        balance = currentUserData.balance;
        referralBonus = currentUserData.referralBonus;

        document.getElementById('balance').innerText = balance.toFixed(3);
        document.getElementById('userBar').innerText = `👤 User: @${currentUserData.username}`;
        
        // Referral UI updates
        document.getElementById('myCode').innerText = currentUserData.username;
        document.getElementById('refBonus').innerText = referralBonus.toFixed(2);
        document.getElementById('refCount').innerText = currentUserData.referralCount;
        document.getElementById('refTotalGains').innerText = `₱ ${currentUserData.totalRefGains.toFixed(2)}`;
        if(currentUserData.referredBy && document.getElementById('refInputArea')) {
            document.getElementById('refInputArea').innerHTML = `<p style="color:green; font-weight:bold;">Referred by: @${currentUserData.referredBy}</p>`;
        }

        // Update task button states based on new cooldown data
        Object.keys(tasks).forEach(key => {
            tasks[key].zones.forEach((zone, i) => {
                const taskId = `${tasks[key].prefix}${i}`;
                const lastClaim = currentUserData.taskCooldowns?.[taskId]?.toDate();
                checkCooldown(taskId, tasks[key].cooldown, lastClaim);
            });
        });

        // Update leaderboard current user balance
        document.getElementById('currentUserBalance').innerText = balance.toFixed(2);
    });

    loadTasks(); // Initial render of task buttons
    loadHistory(); // Load user withdrawal history
    updateDateTime(); // Set initial footer time
    setInterval(updateDateTime, 1000); // Update footer time every second
    
    // Auto-update specific pages when user navigates to them
    onSnapshot(query(collection(db, "withdrawals"), orderBy("timestamp", "desc")), handleAdminData);
    onSnapshot(query(collection(db, "users"), orderBy("balance", "desc"), limit(20)), handleLeaderboardData);
    onSnapshot(query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(50)), handleChatMessages);
}

// --- Global Date/Time Footer ---
function updateDateTime() {
    const now = new Date();
    document.getElementById('footerDateTime').innerText = now.toLocaleString();
}

// --- Page Navigation ---
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // Trigger auto-ads based on page
    if (pageId === 'adsArea') runAutoAd(window.show_10276123);
    if (pageId === 'signInArea') runAutoAd(window.show_10337795);
    if (pageId === 'giftArea') runAutoAd(window.show_10337853);
};

function runAutoAd(adFunction) {
    if (typeof adFunction === 'function') {
        adFunction({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
    }
}

// --- Task Rendering & Cooldown Logic ---
const tasks = {
    ads: { zones: [10276123, 10337795, 10337853], cooldown: 300, reward: 0.02, container: 'adsList', prefix: 'A' }, // 5 minutes
    sign: { zones: [10276123, 10337795, 10337853], cooldown: 10800, reward: 0.025, container: 'signInList', prefix: 'S' }, // 3 hours
    gift: { zones: [10276123, 10337795, 10337853], cooldown: 1200, reward: 0.02, container: 'giftList', prefix: 'G' } // 20 minutes
};

function loadTasks() {
    Object.keys(tasks).forEach(key => {
        const group = tasks[key];
        const cont = document.getElementById(group.container);
        if (!cont) return; // Skip if container doesn't exist (e.g., in admin page)
        cont.innerHTML = '';
        group.zones.forEach((zone, i) => {
            const taskId = `${group.prefix}${i}`;
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <button class="btn" id="btn-${taskId}" onclick="runAdAndReward('${zone}', ${group.reward}, '${taskId}', ${group.cooldown})">🍍 Task #${i+1} 🍍</button>
                <div id="timer-${taskId}" class="timer-box"></div>
            `;
            cont.appendChild(card);
            // checkCooldown will be called by the onSnapshot listener for currentUserData
        });
    });
}

window.runAdAndReward = (zone, reward, taskId) => {
    const btn = document.getElementById(`btn-${taskId}`);
    if (btn.disabled) return; // Prevent ad trigger if disabled by cooldown

    const sdk = window[`show_${zone}`];
    if (typeof sdk === 'function') {
        sdk().then(async () => {
            // Update balance and set cooldown timestamp in Firestore
            await updateDoc(doc(db, "users", uid), { 
                balance: increment(reward),
                [`taskCooldowns.${taskId}`]: serverTimestamp() 
            });
            alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
        }).catch(e => {
            console.error("Ad failed or skipped:", e);
            alert("Ad failed to load or was skipped. Please try again.");
        });
    } else {
        alert("Ad system not ready. Please wait a moment.");
    }
};

const timerIntervals = {}; // Store interval IDs to clear them
function checkCooldown(taskId, cooldownSeconds, lastClaimedTimestamp) {
    const btn = document.getElementById(`btn-${taskId}`);
    const timerDisplay = document.getElementById(`timer-${taskId}`);
    if (!btn || !timerDisplay) return; // Element not on current page

    // Clear previous interval if exists
    if (timerIntervals[taskId]) {
        clearInterval(timerIntervals[taskId]);
        delete timerIntervals[taskId];
    }

    if (lastClaimedTimestamp) {
        const endTime = lastClaimedTimestamp.getTime() + cooldownSeconds * 1000;
        const updateTimer = () => {
            const remainingSeconds = Math.floor((endTime - Date.now()) / 1000);
            if (remainingSeconds > 0) {
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                timerDisplay.innerText = `Wait: ${minutes}m ${seconds}s`;
                btn.disabled = true;
            } else {
                clearInterval(timerIntervals[taskId]);
                delete timerIntervals[taskId];
                timerDisplay.innerText = "Status: Ready 🍍";
                btn.disabled = false;
            }
        };
        updateTimer(); // Initial call
        timerIntervals[taskId] = setInterval(updateTimer, 1000);
    } else {
        timerDisplay.innerText = "Status: Ready 🍍";
        btn.disabled = false;
    }
}

// --- Referral System ---
window.setReferral = async () => {
    const code = document.getElementById('refCodeInput').value.trim();
    if (!code) return alert("Please enter a referral code.");
    if (code === myCode) return alert("You cannot refer yourself.");

    const userRef = doc(db, "users", uid);
    
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) { throw new Error("User document does not exist!"); }
            if (userDoc.data().referredBy) {
                alert("You are already referred by someone.");
                return; // Exit transaction without doing anything
            }

            const inviterQuery = query(collection(db, "users"), where("username", "==", code));
            const inviterSnap = await getDocs(inviterQuery); // Use getDocs for a query
            
            if (inviterSnap.empty) {
                alert("Invalid Referral Code.");
                throw new Error("Invalid Code"); // Abort transaction
            }
            
            const inviterDocRef = inviterSnap.docs[0].ref;
            const inviterId = inviterSnap.docs[0].id;
            if (inviterId === uid) { // Double check self-referral
                alert("You cannot refer yourself.");
                throw new Error("Self-referral");
            }

            // Update current user
            transaction.update(userRef, { referredBy: code });
            
            // Increment inviter's count
            transaction.update(inviterDocRef, { referralCount: increment(1) });
        });
        alert("Referral activated successfully!");
    } catch (e) {
        if (e.message === "Invalid Code" || e.message === "Self-referral" || e.message === "You are already referred by someone.") {
            // Specific alerts already shown
        } else {
            console.error("Transaction failed: ", e);
            alert("Failed to set referral. Please try again.");
        }
    }
};

window.claimRefBonus = async () => {
    if (referralBonus < 1) return alert("Minimum 1 PHP to claim");
    await updateDoc(doc(db, "users", uid), { balance: increment(referralBonus), referralBonus: 0 });
    alert("Bonus moved to main balance!");
};

// --- Withdrawal System ---
window.withdraw = async (method) => {
    const amt = parseFloat(document.getElementById('wAmt').value);
    const target = document.getElementById('wTarget').value.trim();
    if (isNaN(amt) || amt <= 0 || amt > balance) return alert("Invalid amount or insufficient balance.");
    if (amt < 10) return alert("Minimum withdrawal is 10 PHP.");
    if (!target) return alert("Please enter your GCash number or FaucetPay email.");
    
    // Deduct balance first
    await updateDoc(doc(db, "users", uid), { balance: increment(-amt) });

    await addDoc(collection(db, "withdrawals"), { 
        uid, 
        username: currentUserData.username, 
        amount: amt, 
        method, 
        target, 
        status: 'pending', 
        timestamp: serverTimestamp() 
    });
    alert("Withdrawal submitted! Please check your history for status.");
    document.getElementById('wAmt').value = '';
    document.getElementById('wTarget').value = '';
};

function loadHistory() {
    onSnapshot(query(collection(db, "withdrawals"), where("uid", "==", uid), orderBy("timestamp", "desc"), limit(10)), (snap) => {
        const tbody = document.getElementById('historyBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        snap.forEach(d => {
            const w = d.data();
            tbody.innerHTML += `<tr><td>${w.timestamp?.toDate().toLocaleDateString() || '...'}</td><td>${w.method}</td><td class="status-${w.status}">${w.status}</td></tr>`;
        });
    });
}

// --- Admin Dashboard ---
window.adminLogin = () => { 
    if(prompt("Enter Admin Password:") === "Propetas6") {
        showPage('adminPage');
    } else {
        alert("Incorrect password.");
    }
};

function handleAdminData(snap) {
    const tbody = document.getElementById('adminBody');
    const adminTotalDisplay = document.getElementById('adminTotal');
    if (!tbody || !adminTotalDisplay) return;

    tbody.innerHTML = ''; 
    let totalPaid = 0;
    snap.forEach(d => {
        const w = d.data();
        if(w.status === 'paid') totalPaid += w.amount;
        tbody.innerHTML += `<tr>
            <td>@${w.username}</td>
            <td>₱${w.amount} (${w.method})</td>
            <td>
                ${w.status === 'pending' ? 
                `<button onclick="updateWithdrawStatus('${d.id}', 'paid', '${w.uid}', ${w.amount})">✅</button> 
                 <button onclick="updateWithdrawStatus('${d.id}', 'denied', '${w.uid}', ${w.amount})">❌</button>` 
                : w.status}
            </td>
        </tr>`;
    });
    adminTotalDisplay.innerText = totalPaid.toFixed(2);
}

window.updateWithdrawStatus = async (withdrawalId, status, user_id, amount) => {
    try {
        await runTransaction(db, async (transaction) => {
            const withdrawalRef = doc(db, "withdrawals", withdrawalId);
            const withdrawalDoc = await transaction.get(withdrawalRef);

            if (!withdrawalDoc.exists || withdrawalDoc.data().status !== 'pending') {
                throw new Error("Withdrawal not found or already processed.");
            }

            transaction.update(withdrawalRef, { status: status });

            if (status === 'denied') {
                const userRef = doc(db, "users", user_id);
                transaction.update(userRef, { balance: increment(amount) }); // Refund user
            } else if (status === 'paid') {
                // Process referral commission
                const invitedUserRef = doc(db, "users", user_id);
                const invitedUserDoc = await transaction.get(invitedUserRef);
                const referredByUsername = invitedUserDoc.data().referredBy;

                if (referredByUsername) {
                    const inviterQuery = query(collection(db, "users"), where("username", "==", referredByUsername));
                    const inviterSnap = await getDocs(inviterQuery); // Use getDocs for query
                    if (!inviterSnap.empty) {
                        const inviterDocRef = inviterSnap.docs[0].ref;
                        const commission = amount * 0.10; // 10% commission
                        transaction.update(inviterDocRef, { 
                            referralBonus: increment(commission), 
                            totalRefGains: increment(commission) 
                        });
                    }
                }
            }
        });
        alert(`Withdrawal marked as ${status}.`);
    } catch (e) {
        console.error("Error updating withdrawal status or processing referral:", e);
        alert(`Failed to update status: ${e.message}`);
    }
};

// --- Leaderboard ---
function handleLeaderboardData(snap) {
    const tbody = document.getElementById('leaderboardBody');
    const currentUserRankDisplay = document.getElementById('currentUserRank');
    if (!tbody || !currentUserRankDisplay) return;

    tbody.innerHTML = '';
    let rank = 1;
    let userFoundInLeaderboard = false;

    snap.forEach(d => {
        const userData = d.data();
        tbody.innerHTML += `<tr>
            <td>${rank}</td>
            <td>@${userData.username}</td>
            <td>₱${userData.balance.toFixed(2)}</td>
        </tr>`;
        if (d.id === uid) {
            currentUserRankDisplay.innerText = rank;
            userFoundInLeaderboard = true;
        }
        rank++;
    });

    if (!userFoundInLeaderboard) {
        // If current user is not in top 20, just show 'N/A' as rank (simplification)
        currentUserRankDisplay.innerText = 'N/A';
    }
}

// --- Chat System ---
const adFunctionsForChat = [window.show_10276123, window.show_10337795, window.show_10337853];

window.sendMessage = async () => {
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    const randomAd = adFunctionsForChat[Math.floor(Math.random() * adFunctionsForChat.length)];
    if (typeof randomAd === 'function') {
        randomAd().then(async () => {
            // Ad shown, now send message and reward
            await addDoc(collection(db, "messages"), {
                uid,
                username: currentUserData.username,
                message: messageText,
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, "users", uid), { balance: increment(0.01) }); // Reward 0.01 PHP
            chatInput.value = ''; // Clear input
        }).catch(e => {
            console.error("Chat ad failed:", e);
            alert("Failed to show ad for chat. Message not sent.");
        });
    } else {
        alert("Ad system not ready for chat. Cannot send message.");
    }
};

function handleChatMessages(snap) {
    const chatMessagesDiv = document.getElementById('chatMessages');
    if (!chatMessagesDiv) return;

    chatMessagesDiv.innerHTML = '';
    // Display in reverse chronological order (newest at bottom)
    const messages = [];
    snap.forEach(d => messages.push(d.data()));
    messages.reverse().forEach(msg => { // Reverse to show newest at bottom
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        const timestamp = msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '...';
        messageElement.innerHTML = `
            <span class="chat-sender">@${msg.username}:</span> 
            <span>${msg.message}</span>
            <span class="chat-time">${timestamp}</span>
        `;
        chatMessagesDiv.appendChild(messageElement);
    });
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
}

// --- Initialize the app ---
initApp();
