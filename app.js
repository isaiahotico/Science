// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// 🔥 REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || {
  id: "guest",
  first_name: "Guest"
};

// UI Elements
const chatBox = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// Set user info
document.getElementById("username").innerText = user.first_name;
document.getElementById("avatar").src =
  user.photo_url || "https://cdn-icons-png.flaticon.com/512/847/847969.png";

// Firestore chat collection
const messagesRef = collection(db, "globalChat");

// Load messages
const q = query(messagesRef, orderBy("timestamp", "desc"), limit(50));

onSnapshot(q, (snapshot) => {
  chatBox.innerHTML = "";
  snapshot.docs.reverse().forEach((doc) => {
    const msg = doc.data();
    const div = document.createElement("div");

    div.className =
      "message " + (msg.senderId === user.id ? "me" : "other");

    div.innerHTML = `
      <span class="name">${msg.senderName}</span>
      <div class="bubble">${msg.text}</div>
    `;

    chatBox.appendChild(div);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
});

// Send message
sendBtn.onclick = async () => {
  if (!input.value.trim()) return;

  await addDoc(messagesRef, {
    senderId: user.id,
    senderName: user.first_name,
    text: input.value,
    timestamp: Date.now()
  });

  input.value = "";
};

// Enter key send
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});
