import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

initializeApp(firebaseConfig);

/* -------- USER DATA -------- */
const params = new URLSearchParams(location.search);
const username = params.get("user") || "guest";

let wallet = parseFloat(localStorage.getItem("wallet") || 0);
let adsLeft = parseInt(localStorage.getItem("adsLeft") || 4);
let lastWatch = parseInt(localStorage.getItem("lastWatch") || 0);

/* -------- UI UPDATE -------- */
function updateUI() {
  document.getElementById("wallet")?.innerText = wallet.toFixed(3);
  document.getElementById("username")?.innerText = username;
}
updateUI();

/* -------- NAV -------- */
window.openRoom = () => {
  location.href = "index.html?room=1&user=" + username;
};

/* -------- COOLDOWN -------- */
function inCooldown() {
  return Date.now() - lastWatch < 5 * 60 * 1000;
}

/* -------- WATCH AD -------- */
window.watchAd = () => {
  if (adsLeft <= 0) return alert("No ads left");
  if (inCooldown()) return alert("Cooldown 5 minutes");

  show_10276123("pop").then(() => {
    wallet += 0.009;
    adsLeft--;
    lastWatch = Date.now();

    localStorage.setItem("wallet", wallet);
    localStorage.setItem("adsLeft", adsLeft);
    localStorage.setItem("lastWatch", lastWatch);

    updateUI();
    alert("Reward added ₱0.009");
  });
};

/* -------- MEDIUM–HIGH CPM -------- */
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
