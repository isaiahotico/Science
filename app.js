// 🔁 CHANGE THIS TO YOUR REAL WEBSOCKET SERVER
const WSS_URL = "wss://YOUR_WS_URL";

const ws = new WebSocket(WSS_URL);

const usernameEl = document.getElementById("username");
const connectionEl = document.getElementById("connection");
const historyEl = document.getElementById("history");

const amountInput = document.getElementById("amount");
const gcashInput = document.getElementById("gcash");

// Telegram username (fallback supported)
let username = "guest_" + Math.floor(Math.random() * 9999);
if (window.Telegram?.WebApp?.initDataUnsafe?.user?.username) {
  username = Telegram.WebApp.initDataUnsafe.user.username;
}
usernameEl.innerText = username;

ws.onopen = () => {
  connectionEl.innerText = "Connected";

  ws.send(JSON.stringify({
    type: "AUTH",
    role: "USER",
    username
  }));
};

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  // Initial history sync
  if (data.type === "INIT") {
    historyEl.innerHTML = "";
    data.withdrawals
      .filter(w => w.username === username)
      .forEach(render);
  }

  // New request created
  if (data.type === "NEW_WITHDRAW" && data.req.username === username) {
    render(data.req);
  }

  // Approved
  if (data.type === "APPROVED" && data.username === username) {
    updateStatus(data.id, "approved");
  }

  if (data.type === "ERROR") {
    alert(data.msg);
  }
};

function withdraw() {
  const amount = Number(amountInput.value);
  const gcash = gcashInput.value.trim();

  if (!amount || !gcash) {
    alert("Please fill all fields");
    return;
  }

  ws.send(JSON.stringify({
    type: "WITHDRAW",
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
    ₱${w.amount} — 
    <span class="pending">pending</span>
    <small>${new Date(w.id).toLocaleTimeString()}</small>
  `;
  historyEl.prepend(li);
}

function updateStatus(id, status) {
  const el = document.getElementById("w-" + id);
  if (!el) return;
  el.querySelector("span").innerText = status;
  el.querySelector("span").className = status;
}
