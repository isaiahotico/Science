import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  updateDoc, doc, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* FIREBASE CONFIG */
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
const auth = getAuth(app);

/* TELEGRAM USER */
const tg = window.Telegram?.WebApp;
const telegramId = tg?.initDataUnsafe?.user?.id || "guest";
const tgName = tg?.initDataUnsafe?.user?.username || "Guest";
document.getElementById("tgName")?.innerText = tgName;

/* AUTH */
let currentUser = null;
signInAnonymously(auth).catch(console.error);

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    console.log("User UID:", user.uid);
    loadUserWithdrawals();
    loadAdminWithdrawals();
  }
});

/* BALANCE */
let balance = parseFloat(localStorage.getItem("balance") || "0");
document.getElementById("balance")?.innerText = balance.toFixed(2);

/* REWARD FUNCTION */
function reward(v){
  balance += v;
  localStorage.setItem("balance", balance);
  document.getElementById("balance")?.innerText = balance.toFixed(2);
  alert("🎉 Congratulations you earned ₱0.01");
}

/* COOLDOWNS */
function key(name){ return `${currentUser?.uid}_${name}`; }
function canRun(name, cooldownMs){
  const last = localStorage.getItem(key(name)) || 0;
  return Date.now()-last >= cooldownMs;
}
function markRun(name){ localStorage.setItem(key(name), Date.now()); }

/* AD BUTTONS WITH TIMER + LOADING */
function runAd(btn, sdk, name, cooldownMs){
  if(!canRun(name,cooldownMs)) return alert("⏳ Cooldown active");
  btn.disabled=true;
  btn.innerHTML += `<div class="spinner"></div>`;
  sdk().then(()=>{
    reward(0.01);
    markRun(name);
  }).finally(()=>{
    btn.disabled=false;
    btn.querySelector(".spinner")?.remove();
  });
}

/* DAILY / GIFT / UNLI */
window.runDaily = (btn,v)=>{
  const sdk = v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853;
  runAd(btn, sdk,"daily_"+v,12*60*60*1000);
};
window.runGift = (btn,v)=>{
  const sdk = v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853;
  runAd(btn, sdk,"gift_"+v,15*60*1000);
};
window.runUnli = (btn,v)=>{
  const sdk = v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853;
  runAd(btn, sdk,"unli_"+v,5*60*1000);
};

/* COOL DOWN TIMERS */
function startTimer(name, ms, elId){
  setInterval(()=>{
    const last = localStorage.getItem(key(name))||0;
    const left = ms-(Date.now()-last);
    const el = document.getElementById(elId);
    if(!el) return;
    if(left<=0) el.textContent="✅ Ready";
    else{
      const m = Math.floor(left/60000);
      const s = Math.floor((left%60000)/1000);
      el.textContent=`⏳ ${m}:${s.toString().padStart(2,"0")}`;
    }
  },1000);
}

/* START ALL TIMERS */
startTimer("daily_v1",12*60*60*1000,"daily_v1_timer");
startTimer("daily_v2",12*60*60*1000,"daily_v2_timer");
startTimer("daily_v3",12*60*60*1000,"daily_v3_timer");
startTimer("gift_v1",15*60*1000,"gift_v1_timer");
startTimer("gift_v2",15*60*1000,"gift_v2_timer");
startTimer("gift_v3",15*60*1000,"gift_v3_timer");
startTimer("unli_v1",5*60*1000,"unli_v1_timer");
startTimer("unli_v2",5*60*1000,"unli_v2_timer");
startTimer("unli_v3",5*60*1000,"unli_v3_timer");

/* WITHDRAWAL FUNCTION */
window.withdraw = async ()=>{
  if(balance<=0) return alert("No balance");
  const gcash=document.getElementById("gcash").value||"Unknown";
  await addDoc(collection(db,"withdrawals"),{
    uid:currentUser.uid,
    telegramId,
    username: tgName,
    amount:balance,
    gcash,
    status:"Pending",
    time:serverTimestamp()
  });
  balance=0;
  localStorage.setItem("balance",0);
  document.getElementById("balance").innerText="0.00";
};

/* LOAD USER WITHDRAWALS */
function loadUserWithdrawals(){
  if(!currentUser) return;
  const tbody=document.getElementById("userHistory");
  if(!tbody) return;
  const q=query(collection(db,"withdrawals"),where("uid","==",currentUser.uid));
  onSnapshot(q,snap=>{
    tbody.innerHTML="";
    snap.forEach(d=>{
      const w=d.data();
      tbody.innerHTML+=`
      <tr>
        <td>${w.username}</td>
        <td>₱${w.amount}</td>
        <td>${w.gcash}</td>
        <td>${w.status}</td>
        <td>${w.time?.toDate().toLocaleString()}</td>
      </tr>`;
    });
  });
}

/* LOAD ADMIN DASHBOARD */
function loadAdminWithdrawals(){
  const tbody=document.getElementById("adminTable");
  if(!tbody) return;
  onSnapshot(collection(db,"withdrawals"),snap=>{
    tbody.innerHTML="";
    snap.forEach(d=>{
      const w=d.data();
      tbody.innerHTML+=`
      <tr>
        <td>${w.username}</td>
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

/* ADMIN UPDATE STATUS */
window.updateStatus = async (id,s)=>{
  await updateDoc(doc(db,"withdrawals",id),{status:s});
};

/* CLOCK */
setInterval(()=>document.getElementById("clock")?.innerText=new Date().toLocaleString(),1000);
