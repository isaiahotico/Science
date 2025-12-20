import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc,
  onSnapshot, updateDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔥 YOUR FIREBASE KEY */
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

/* Telegram user */
const tg = window.Telegram?.WebApp;
const username = tg?.initDataUnsafe?.user?.username || "Telegram User";
document.getElementById("tgName")?.innerText = username;

/* Balance */
let balance = JSON.parse(localStorage.getItem("balance") || "0");
document.getElementById("balance")?.innerText = balance.toFixed(2);

/* Reward */
function reward(v){
  balance += v;
  localStorage.setItem("balance", balance);
  document.getElementById("balance")?.innerText = balance.toFixed(2);
  alert("🎉 Congratulations you earned ₱0.01");
}

/* Withdraw */
window.withdraw = async ()=>{
  if(balance <= 0) return alert("No balance");
  await addDoc(collection(db,"withdrawals"),{
    user: username,
    amount: balance,
    gcash: document.getElementById("gcash").value,
    status: "Pending",
    time: serverTimestamp()
  });
  balance = 0;
  localStorage.setItem("balance",0);
};

/* User history */
const uh = document.getElementById("userHistory");
if(uh){
  onSnapshot(collection(db,"withdrawals"), snap=>{
    uh.innerHTML="";
    snap.forEach(d=>{
      const w=d.data();
      if(w.user===username){
        uh.innerHTML+=`
        <tr>
          <td>${w.user}</td>
          <td>₱${w.amount}</td>
          <td>${w.gcash}</td>
          <td>${w.status}</td>
          <td>${w.time?.toDate().toLocaleString()}</td>
        </tr>`;
      }
    });
  });
}

/* Admin */
const at = document.getElementById("adminTable");
if(at){
  onSnapshot(collection(db,"withdrawals"), snap=>{
    at.innerHTML="";
    snap.forEach(d=>{
      const w=d.data();
      at.innerHTML+=`
      <tr>
        <td>${w.user}</td>
        <td>₱${w.amount}</td>
        <td>${w.gcash}</td>
        <td>${w.status}</td>
        <td>
          <button onclick="updateStatus('${d.id}','Approved')">✔</button>
          <button onclick="updateStatus('${d.id}','Denied')">✖</button>
        </td>
      </tr>`;
    });
  });
}

window.updateStatus = async (id,s)=>{
  await updateDoc(doc(db,"withdrawals",id),{status:s});
};

/* Clock */
setInterval(()=>{
  document.getElementById("clock")?.innerText=new Date().toLocaleString();
},1000);
