import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, onSnapshot, collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* 🔥 YOUR FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* Telegram */
const tg = window.Telegram?.WebApp;
tg?.expand();
const user = tg?.initDataUnsafe?.user;
const uid = user?.id || "guest";
const username = user?.username || "TelegramUser";
document.getElementById("tgName").innerText = username;

const userRef = doc(db, "users", uid);

/* INIT USER */
await setDoc(userRef, {
  username,
  balance: 0,
  lastDaily: {},
  lastGift: {},
  lastUnli: {},
}, { merge: true });

/* REAL-TIME BALANCE */
onSnapshot(userRef, snap => {
  document.getElementById("balance").innerText =
    (snap.data()?.balance || 0).toFixed(2);
});

/* PAGE SWITCH */
window.show = id => {
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
};

/* COOLDOWN CHECK */
async function canWatch(type, key, cooldownMs){
  const snap = await getDoc(userRef);
  const last = snap.data()?.[type]?.[key];
  if(!last) return true;
  return Date.now() - last.toMillis() > cooldownMs;
}

/* REWARD */
async function reward(amount, type, key){
  await updateDoc(userRef, {
    balance: amount,
    [`${type}.${key}`]: serverTimestamp()
  });
  alert(`🍋 Congratulations gain ₱${amount} 🎉🍋`);
}

/* DAILY – 12 HOURS */
window.dailyAd = async v => {
  if(!(await canWatch("lastDaily", v, 12*60*60*1000)))
    return alert("⏳ Cooldown 12 hours");
  (v==="v1"?show_10276123:
   v==="v2"?show_10337795:show_10337853)()
   .then(()=>reward(0.01,"lastDaily",v));
};

/* GIFT – 15 MIN */
window.giftAd = async v => {
  if(!(await canWatch("lastGift", v, 15*60*1000)))
    return alert("⏳ Cooldown 15 minutes");
  (v==="v1"?show_10276123:
   v==="v2"?show_10337795:show_10337853)("pop")
   .then(()=>reward(0.012,"lastGift",v));
};

/* UNLI – 5 MIN */
window.unliAd = async v => {
  if(!(await canWatch("lastUnli", v, 5*60*1000)))
    return alert("⏳ Cooldown 5 minutes");
  (v==="v1"?show_10276123:
   v==="v2"?show_10337795:show_10337853)()
   .then(()=>reward(0,"lastUnli",v));
};

/* WITHDRAW */
window.requestWithdraw = async () => {
  const snap = await getDoc(userRef);
  const bal = snap.data().balance;
  if(bal <= 0) return alert("No balance");
  await addDoc(collection(db,"withdrawals"),{
    uid, username,
    amount: bal,
    gcash: document.getElementById("gcash").value,
    status:"pending",
    time: serverTimestamp()
  });
  await updateDoc(userRef,{ balance:0 });
};
setInterval(()=>document.getElementById("time").innerText=new Date().toLocaleString(),1000);
