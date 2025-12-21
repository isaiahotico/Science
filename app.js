const WSS_URL = "wss://YOUR_WS_URL";
const ws = new WebSocket(WSS_URL);

const usernameEl = document.getElementById("username");
const balanceEl = document.getElementById("balance");
const historyEl = document.getElementById("history");

const amountInput = document.getElementById("amount");
const gcashInput = document.getElementById("gcash");

let username = "guest_" + Math.floor(Math.random() * 9999);
if (window.Telegram?.WebApp?.initDataUnsafe?.user?.username) {
  username = Telegram.WebApp.initDataUnsafe.user.username;
}
usernameEl.innerText = username;

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "AUTH", role: "USER", username }));
};

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "INIT") {
    balanceEl.innerText = data.balances[username] || 0;
    historyEl.innerHTML = "";
    data.withdrawals
      .filter(w => w.username === username)
      .forEach(render);
  }

  if (data.type === "NEW_WITHDRAW" && data.req.username === username) {
    render(data.req);
  }

  if (data.type === "APPROVED" && data.username === username) {
    updateStatus(data.id, "approved");
    balanceEl.innerText = data.balance;
  }

  if (data.type === "REJECTED" && data.username === username) {
    updateStatus(data.id, "rejected");
  }
};

function withdraw() {
  const amount = Number(amountInput.value);
  const gcash = gcashInput.value.trim();

  if (!amount || !gcash) {
    alert("Please enter both amount and GCash number");
    return;
  }

  // Send withdrawal request to server (admin dashboard)
  ws.send(JSON.stringify({
    type: "WITHDRAW",
    username,
    amount,
    gcash
  }));

  amountInput.value = "";
  gcashInput.value = "";
}

function render(w) {
  const li = document.createElement("li");
  li.id = "w-" + w.id;
  li.innerHTML = `
    ₱${w.amount} — <span class="${w.status}">${w.status}</span>
    <br>GCash: ${w.gcash}
    <small>${new Date(w.id).toLocaleString()}</small>
  `;
  historyEl.prepend(li);
}

function updateStatus(id, status) {
  const el = document.getElementById("w-" + id);
  if (!el) return;
  el.querySelector("span").innerText = status;
  el.querySelector("span").className = status;
}
