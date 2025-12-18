import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* 🔥 FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* Telegram */
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;

if (!user) alert("Telegram user not detected");

/* UI */
const chatBox = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const badge = document.getElementById("unreadBadge");

/* User info */
document.getElementById("username").innerText = user.first_name;
document.getElementById("avatar").src =
  user.photo_url || "https://cdn-icons-png.flaticon.com/512/847/847969.png";

/* ROOM LOGIC */
const roomId = `user_${user.id}`;
const messagesRef = collection(db, "chats", roomId, "messages");
const metaRef = doc(db, "chats", roomId, "meta", "status");

/* Init meta */
setDoc(metaRef, {
  userLastRead: Date.now(),
  adminLastRead: 0,
  state: "open"
}, { merge: true });

/* AUTO REPLY ENGINE */
async function autoReply(text) {
  await addDoc(messagesRef, {
    senderId: "system",
    senderName: "Support Bot",
    text,
    timestamp: Date.now(),
    role: "bot"
  });
}

/* Keyword logic */
function handleAutomation(text) {
  const t = text.toLowerCase();

  if (t.includes("withdraw")) {
    autoReply("💰 Please send your GCash number.");
  } else if (t.includes("problem") || t.includes("help")) {
    autoReply("🧑‍💼 Support has been notified.");
  } else if (t.includes("hello")) {
    autoReply("👋 Welcome! How can we help?");
  }
}

/* Listen messages */
const q = query(messagesRef, orderBy("timestamp", "asc"));
onSnapshot(q, (snapshot) => {
  chatBox.innerHTML = "";
  let unread = 0;

  snapshot.forEach((docSnap) => {
    const msg = docSnap.data();
    const div = document.createElement("div");

    div.className =
      "message " +
      (msg.senderId === user.id ? "me" : msg.role === "bot" ? "bot" : "other");

    div.innerHTML = `
      <span class="name">${msg.senderName}</span>
      <div class="bubble">${msg.text}</div>
    `;

    chatBox.appendChild(div);

    if (msg.timestamp > Date.now() - 10000 && msg.senderId !== user.id) {
      unread++;
    }
  });

  badge.innerText = unread;
  chatBox.scrollTop = chatBox.scrollHeight;

  updateDoc(metaRef, {
    userLastRead: Date.now()
  });
});

/* Send message */
sendBtn.onclick = async () => {
  if (!input.value.trim()) return;

  const text = input.value;

  await addDoc(messagesRef, {
    senderId: user.id,
    senderName: user.first_name,
    text,
    timestamp: Date.now(),
    role: "user"
  });

  /* Mirror to global intelligence */
  await addDoc(collection(db, "global_messages"), {
    roomId,
    senderId: user.id,
    text,
    timestamp: Date.now()
  });

  handleAutomation(text);
  input.value = "";
};

input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendBtn.click();
});
