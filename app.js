import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* FIREBASE */
const app = initializeApp({
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
});
const db = getFirestore(app);

/* TELEGRAM LOGIN */
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;
const uid = tgUser?.id?.toString() || "guest";
const username = tgUser?.username || "guest";

/* UI */
document.getElementById("username").innerText = username;

/* USER DOC */
const userRef = doc(db, "users", uid);

/* INIT USER */
await setDoc(userRef, {
  username,
  wallet: 0,
  adsLeft: 4,
  lastWatch: 0,
  updated: serverTimestamp()
}, { merge: true });

/* REALTIME WALLET */
onSnapshot(userRef, snap => {
  if (!snap.exists()) return;
  document.getElementById("wallet").innerText =
    snap.data().wallet.toFixed(3);
});

/* COOLDOWN */
function cooldownOK(lastWatch) {
  return Date.now() - lastWatch >= 5 * 60 * 1000;
}

/* PARALLEL PRELOAD (🔥 FAST) */
function preloadAds() {
  try {
    show_10276123();
    show_10276123("pop");
  } catch (e) {}
}
preloadAds();

/* AUTOPLAY ADS */
async function playAdsAuto() {
  const snap = await (await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
  )).getDoc(userRef);

  let { adsLeft, lastWatch, wallet } = snap.data();

  if (adsLeft <= 0) return alert("No ads left");
  if (!cooldownOK(lastWatch)) return alert("Cooldown active");

  show_10276123("pop").then(async () => {
    await updateDoc(userRef, {
      wallet: wallet + 0.009,
      adsLeft: adsLeft - 1,
      lastWatch: Date.now(),
      updated: serverTimestamp()
    });

    if (adsLeft - 1 > 0) {
      setTimeout(playAdsAuto, 1200); // 🔥 autoplay next
    } else {
      alert("All ads completed ₱0.036");
    }
  });
}

/* OPEN ROOM */
window.openRoom = () => {
  document.getElementById("main").innerHTML = `
    <h2>Watch Earn ₱0.036 Each Ad Peso</h2>
    <div class="ads-box">
      <p>Ads autoplaying...</p>
    </div>
    <button class="secondary-btn" onclick="location.reload()">Return</button>
  `;
  playAdsAuto();
};

/* MEDIUM CPM IN-APP */
show_10276123({
  type: "inApp",
  inAppSettings: {
    frequency: 2,
    capping: 0.1,
    interval: 30,
    timeout: 5,
    everyPage: false
  }
});
