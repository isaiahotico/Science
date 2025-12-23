/********************************
 USER IDENTIFICATION (REAL-TIME)
*********************************/
let username = localStorage.getItem("tgUser");

if (!username) {
  username = "user_" + Math.floor(Math.random() * 100000);
  localStorage.setItem("tgUser", username);
}

const userEl = document.getElementById("username");
if (userEl) userEl.innerText = "👤 @" + username;

/********************************
 BALANCE SYSTEM
*********************************/
let balance = Number(localStorage.getItem(username + "_bal")) || 0;

function updateBalance() {
  const balEl = document.getElementById("balance");
  if (balEl) balEl.innerText = balance;
  localStorage.setItem(username + "_bal", balance);
}
updateBalance();

/********************************
 WATCH ADS (INSTANT ₱50)
*********************************/
function watchAd() {
  balance += 50;
  updateBalance();
  alert("🎉 ₱50 added instantly!");
}

/********************************
 WITHDRAW SYSTEM
*********************************/
function withdraw() {
  const gcash = document.getElementById("gcash").value.trim();
  if (!gcash) return alert("❌ Enter GCash number");
  if (balance < 50) return alert("❌ Minimum ₱50 required");

  let withdrawals = JSON.parse(localStorage.getItem("withdrawals")) || [];

  withdrawals.push({
    user: username,
    gcash: gcash,
    amount: 50,
    status: "PENDING",
    time: new Date().toLocaleString()
  });

  localStorage.setItem("withdrawals", JSON.stringify(withdrawals));

  balance -= 50;
  updateBalance();
  loadHistory();
  alert("⏳ Withdrawal submitted");
}

/********************************
 USER WITHDRAW HISTORY
*********************************/
function loadHistory() {
  const table = document.getElementById("history");
  if (!table) return;

  let withdrawals = JSON.parse(localStorage.getItem("withdrawals")) || [];
  table.innerHTML = "";

  withdrawals
    .filter(w => w.user === username)
    .forEach(w => {
      table.innerHTML += `
        <tr>
          <td>${w.gcash}</td>
          <td>₱${w.amount}</td>
          <td>${w.status}</td>
        </tr>
      `;
    });
}
loadHistory();

/********************************
 ADMIN LOGIN (PASSWORD)
*********************************/
function adminLogin() {
  const pass = document.getElementById("adminPass").value;
  if (pass !== "Propetas6") {
    alert("❌ Wrong password");
    return;
  }

  localStorage.setItem("adminLogged", "true");
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  document.getElementById("adminUser").innerText = "Logged in as ADMIN";
  loadAdmin();
}

if (localStorage.getItem("adminLogged") === "true") {
  document.getElementById("loginBox")?.remove();
  document.getElementById("adminPanel").style.display = "block";
  document.getElementById("adminUser").innerText = "Logged in as ADMIN";
}

/********************************
 ADMIN DASHBOARD (REAL-TIME)
*********************************/
function loadAdmin() {
  const table = document.getElementById("adminTable");
  if (!table) return;

  let withdrawals = JSON.parse(localStorage.getItem("withdrawals")) || [];
  table.innerHTML = "";

  withdrawals.forEach((w, i) => {
    table.innerHTML += `
      <tr>
        <td>@${w.user}</td>
        <td>${w.gcash}</td>
        <td>₱${w.amount}</td>
        <td>${w.status}</td>
        <td>
          <button onclick="approve(${i})">✅ PAID</button>
          <button onclick="reject(${i})">❌ REJECT</button>
        </td>
      </tr>
    `;
  });
}

function approve(i) {
  let withdrawals = JSON.parse(localStorage.getItem("withdrawals"));
  withdrawals[i].status = "PAID";
  localStorage.setItem("withdrawals", JSON.stringify(withdrawals));
  loadAdmin();
}

function reject(i) {
  let withdrawals = JSON.parse(localStorage.getItem("withdrawals"));
  withdrawals[i].status = "REJECTED";
  localStorage.setItem("withdrawals", JSON.stringify(withdrawals));
  loadAdmin();
}

setInterval(loadAdmin, 2000);
