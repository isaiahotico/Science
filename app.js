import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, query, where, onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

/* Telegram */
const tg = window.Telegram.WebApp;
tg.ready();
const user = tg.initDataUnsafe.user;
const uid = String(user.id);

/* UI */
const balanceEl = document.getElementById("balance");
document.getElementById("username").innerText = user.username;

/* Load user */
const userRef = doc(db, "users", uid);

async function loadUser(){
  const snap = await getDoc(userRef);
  if(!snap.exists()){
    await setDoc(userRef,{
      username:user.username,
      balance:0,
      lastWatchAd:0,
      lastDailyGift1:0,
      lastDailyGift2:0,
      lastDailyGift3:0
    });
  }
  onSnapshot(userRef,s=>{
    balanceEl.innerText = s.data().balance.toFixed(3);
  });
}
loadUser();

/* Anti-abuse cooldown */
function canClaim(last, cd){
  return Date.now() - last > cd;
}

/* Rewards */
async function reward(amount, field){
  await updateDoc(userRef,{
    balance: Number((Number(balanceEl.innerText)+amount).toFixed(3)),
    [field]: Date.now()
  });
  alert(`🎉 Gained ₱${amount}`);
}

/* Watch Ads */
window.watchAds = async ()=>{
  const u = (await getDoc(userRef)).data();
  if(!canClaim(u.lastWatchAd,180000)) return alert("Cooldown 3 mins");

  await Promise.all([show_10276123(),show_10337795(),show_10337853()]);
  reward(0.04,"lastWatchAd");
};

/* Daily Gifts */
window.dailyGift = async n=>{
  const field=`lastDailyGift${n}`;
  const u=(await getDoc(userRef)).data();
  if(!canClaim(u[field],900000)) return alert("Cooldown 15 mins");

  [show_10276123,show_10337795,show_10337853][n-1]('pop')
    .then(()=>reward(0.015,field));
};

/* Withdraw */
window.withdraw = async ()=>{
  const amount=Number(balanceEl.innerText);
  if(amount<1) return alert("Min ₱1");

  await addDoc(collection(db,"withdrawals"),{
    userId:uid,
    username:user.username,
    amount,
    gcash:document.getElementById("gcash").value,
    status:"pending",
    createdAt:serverTimestamp()
  });

  await updateDoc(userRef,{balance:0});
  alert("Withdrawal sent 🚀");
};

/* Withdrawal history (LIVE) */
onSnapshot(
  query(collection(db,"withdrawals"),where("userId","==",uid)),
  snap=>{
    const tb=document.getElementById("withdrawTable");
    tb.innerHTML="";
    snap.forEach(d=>{
      const r=d.data();
      tb.innerHTML+=`
        <tr>
          <td>₱${r.amount}</td>
          <td>${r.status}</td>
          <td>${r.createdAt?.toDate().toLocaleString()}</td>
        </tr>`;
    });
  }
);

/* Navigation */
window.openRoom=id=>{
  document.querySelectorAll("section").forEach(s=>s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
};
window.goHome=()=>openRoom("home");

/* Adexium */
new AdexiumWidget({wid:'0f0f814f-d491-4578-9343-531b503ff453',adFormat:'interstitial'}).autoMode();

/* Footer date */
document.getElementById("date").innerText=new Date().toLocaleString();
