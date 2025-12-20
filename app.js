/* ===== CONFIG ===== */
const REWARD = 0.009;
const MAX_ADS = 4;
const COOLDOWN_MIN = 5;

/* ===== STATE ===== */
let watched = 0;

/* ===== REAL-TIME TELEGRAM USER ===== */
function loadTelegramUser() {
  if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.ready();
    const user = Telegram.WebApp.initDataUnsafe.user;
    const name = user ? (user.username ? "@" + user.username : user.first_name) : "Guest";
    document.querySelectorAll("#tgUser").forEach(e => e.innerText = name);
  } else {
    document.querySelectorAll("#tgUser").forEach(e => e.innerText = "Guest");
  }
}

/* ===== WALLET ===== */
function getWallet() {
  return parseFloat(localStorage.getItem("wallet") || 0);
}

function updateWallet(v) {
  const w = getWallet() + v;
  localStorage.setItem("wallet", w.toFixed(3));
  document.querySelectorAll("#wallet").forEach(e => e.innerText = w.toFixed(3));
}

/* ===== COOLDOWN ===== */
function cooldownActive() {
  const t = localStorage.getItem("cooldown");
  return t && Date.now() < t;
}

function startCooldown() {
  localStorage.setItem("cooldown", Date.now() + COOLDOWN_MIN * 60000);
}

function showCooldown() {
  const box = document.getElementById("cooldownBox");
  if (!box) return;
  const end = localStorage.getItem("cooldown");

  const timer = setInterval(() => {
    let left = Math.max(0, end - Date.now());
    let m = Math.floor(left / 60000);
    let s = Math.floor((left % 60000) / 1000);
    box.innerText = `Cooldown: ${m}:${s.toString().padStart(2,'0')}`;
    if (left <= 0) {
      clearInterval(timer);
      box.innerText = "";
    }
  }, 1000);
}

/* ===== PARALLEL ADS ===== */
function startAds() {
  if (cooldownActive()) {
    showCooldown();
    return;
  }
  watched = 0;
  nextAd();
}

function nextAd() {
  if (watched >= MAX_ADS) {
    startCooldown();
    showCooldown();
    return;
  }

  // Parallel rewarded popup ads
  show_10276123('pop').then(() => {
    watched++;
    updateWallet(REWARD);
    const adsLeft = document.getElementById("adsLeft");
    if (adsLeft) adsLeft.innerText = "Ads left: " + (MAX_ADS - watched);
    setTimeout(nextAd, 800); // very fast rotation
  }).catch(() => setTimeout(nextAd, 1200));
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#wallet").forEach(e => e.innerText = getWallet().toFixed(3));
  loadTelegramUser();
});
