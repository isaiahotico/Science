/********************************
 FAST TELEGRAM USERNAME
*********************************/
const usernameKey = "tgUser";

let username = localStorage.getItem(usernameKey);
function renderUsername(name) {
  const el = document.getElementById("globalUsername");
  if (el) el.innerText = name ? "@" + name : "Guest";
}
renderUsername(username);

function setTelegramUsername(name) {
  username = name;
  localStorage.setItem(usernameKey, username);
  renderUsername(username);
}

// Prompt user to enter Telegram username if not set
if (!username) {
  setTimeout(() => {
    const tg = prompt("Enter your Telegram username (without @):");
    if (tg) setTelegramUsername(tg);
  }, 100);
}

// Broadcast username across tabs
const channel = new BroadcastChannel("global_user_sync");
channel.postMessage({ user: username });
channel.onmessage = e => {
  if (e.data.user) setTelegramUsername(e.data.user);
};
window.addEventListener("storage", e => {
  if (e.key === usernameKey) renderUsername(e.newValue);
});

/********************************
 BALANCE
*********************************/
let balance = Number(localStorage.getItem(username + "_bal")) || 0;
function updateBalance() {
  const el = document.getElementById("balance");
  if (el) el.innerText = balance;
  localStorage.setItem(username + "_bal", balance);
  loadHistory();
  loadOwner();
  loadAdmin();
}
updateBalance();

/********************************
 WATCH ADS - INSTANT ₱50
*********************************/
document.getElementById("watchAdBtn")?.addEventListener("click", () => {
  balance += 50;
  updateBalance();
  alert("🎉 Instant ₱50 added!");
});

/********************************
 WITHDRAW
*********************************/
document.getElementById("withdrawBtn")?.addEventListener("click", () => {
  const gcash = document.getElementById("gcash").value.trim();
  if (!gcash || balance < 50) return alert("Invalid withdrawal");
  const withdrawals = JSON.parse(localStorage.getItem("withdrawals")) || [];
  withdrawals.push({
    user: username,
    gcash,
    amount: 50,
    status: "PENDING",
    time: new Date().toLocaleString()
  });
  localStorage.setItem("withdrawals", JSON.stringify(withdrawals));
  balance -= 50;
  updateBalance();
});

/********************************
 USER HISTORY
*********************************/
function loadHistory() {
  const table = document.getElementById("history");
  if (!table) return;
  const withdrawals = JSON.parse(localStorage.getItem("withdrawals")) || [];
  table.innerHTML = "";
  withdrawals.filter(w => w.user === username)
    .forEach(w => {
      table.innerHTML += `
        <tr>
          <td>${w.gcash}</td>
          <td>₱${w.amount}</td>
          <td>${w.status}</td>
        </tr>`;
    });
}

/********************************
 ADMIN LOGIN
*********************************/
function adminLogin() {
  if (document.getElementById("adminPass").value !== "Propetas6")
    return alert("❌ Wrong password");
  localStorage.setItem("adminLogged", "true");
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  loadAdmin();
  checkAdminUnlock();
}
document.getElementById("adminLoginBtn")?.addEventListener("click", adminLogin);
if (localStorage.getItem("adminLogged") === "true") {
  document.getElementById("loginBox")?.remove();
  document.getElementById("adminPanel")?.style.display = "block";
}

/********************************
 ADMIN TABLE
*********************************/
function loadAdmin() {
  const table = document.getElementById("adminTable");
  if (!table) return;
  const withdrawals = JSON.parse(localStorage.getItem("withdrawals")) || [];
  table.innerHTML = "";
  withdrawals.forEach((w, i) => {
    table.innerHTML += `
      <tr>
        <td>@${w.user}</td>
        <td>${w.gcash}</td>
        <td>₱${w.amount}</td>
        <td>${w.status}</td>
        <td>
          <button onclick="approve(${i})">PAID</button>
          <button onclick="reject(${i})">REJECT</button>
        </td>
      </tr>`;
  });
}
function approve(i) {
  const withdrawals = JSON.parse(localStorage.getItem("withdrawals"));
  withdrawals[i].status = "PAID";
  localStorage.setItem("withdrawals", JSON.stringify(withdrawals));
  updateBalance();
}
function reject(i) {
  const withdrawals = JSON.parse(localStorage.getItem("withdrawals"));
  withdrawals[i].status = "REJECTED";
  localStorage.setItem("withdrawals", JSON.stringify(withdrawals));
  updateBalance();
}

/********************************
 OWNER TABLE
*********************************/
function loadOwner() {
  const table = document.getElementById("ownerTable");
  if (!table) return;
  const withdrawals = JSON.parse(localStorage.getItem("withdrawals")) || [];
  table.innerHTML = "";
  withdrawals.forEach(w => {
    table.innerHTML += `
      <tr>
        <td>@${w.user}</td>
        <td>${w.gcash}</td>
        <td>₱${w.amount}</td>
        <td>${w.status}</td>
        <td>${w.time}</td>
      </tr>`;
  });
}

/********************************
 OWNER PASSWORD UNLOCK
*********************************/
function unlockOwner() {
  const pass = document.getElementById("ownerPass")?.value;
  if(pass === "Propetas6") {
    document.getElementById("ownerCard")?.style.display = "block";
    document.getElementById("ownerPasswordCard")?.style.display = "none";
    loadOwner();
  } else alert("❌ Wrong password");
}
document.getElementById("unlockOwnerBtn")?.addEventListener("click", unlockOwner);

/********************************
 ADMIN AUTO UNLOCK OWNER TABLE
*********************************/
function checkAdminUnlock() {
  const isAdmin = localStorage.getItem("adminLogged") === "true";
  if (isAdmin) {
    document.getElementById("ownerCard")?.style.display = "block";
    document.getElementById("ownerPasswordCard")?.style.display = "none";
    loadOwner();
  }
}
window.addEventListener("load", checkAdminUnlock);

/********************************
 NAVIGATE OWNER PAGE
*********************************/
function goOwner() {
  window.location.href = "owner.html";
}
document.getElementById("goOwnerBtn")?.addEventListener("click", goOwner);

/********************************
 AUTO REAL-TIME UPDATE
*********************************/
setInterval(() => {
  loadHistory();
  loadAdmin();
  loadOwner();
}, 1000);
