import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, increment
} from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔥 Firebase Init */
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

/* 👤 Telegram */
const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user || {};
const uid = user.id || "guest";
const username = user.username || "Guest";

/* 🧾 UI */
document.getElementById("tgUser")?.innerText = username;

/* 💰 Wallet */
const ref = doc(db, "users", uid);

async function initUser() {
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      username,
      balance: 0,
      lastWatch: 0
    });
  }
  updateWallet();
}
initUser();

async function updateWallet() {
  const snap = await getDoc(ref);
  document.getElementById("wallet").innerText =
    snap.data().balance.toFixed(3);
}

/* 🔁 Navigation */
window.openRoom = () => location.href = "ads.html";
window.goBack = () => history.back();

/* 🎯 Ads Config */
let adsLeft = 4;
const reward = 0.009;
const cooldown = 5 * 60 * 1000;

/* ⚡ Parallel Preload (warm 2 ads) */
show_10276123('pop').catch(()=>{});
show_10276123('pop').catch(()=>{});

/* ▶ Start Ads */
window.startAds = async () => {
  const snap = await getDoc(ref);
  if (Date.now() - snap.data().lastWatch < cooldown) {
    alert("Cooldown active");
    return;
  }
  playAd();
};

async function playAd() {
  if (adsLeft <= 0) {
    await updateDoc(ref, { lastWatch: Date.now() });
    startCooldown();
    return;
  }

  document.getElementById("adsLeft").innerText = adsLeft;

  show_10276123('pop').then(async () => {
    adsLeft--;
    await updateDoc(ref, {
      balance: increment(reward)
    });
    updateWallet();
    playAd();
  });
}

/* ⏱ Cooldown UI */
function startCooldown() {
  let t = cooldown / 1000;
  const el = document.getElementById("cooldown");

  const timer = setInterval(() => {
    el.innerText = `Cooldown: ${t--}s`;
    if (t <= 0) {
      clearInterval(timer);
      adsLeft = 4;
      el.innerText = "Ready";
      document.getElementById("adsLeft").innerText = adsLeft;
    }
  }, 1000);
}
