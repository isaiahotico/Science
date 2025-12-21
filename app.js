const WS_URL = "wss://YOUR_WS_URL";
const ws = new WebSocket(WS_URL);

const userList = document.getElementById("userList");
const userCount = document.getElementById("userCount");
const withdrawList = document.getElementById("withdrawList");

const users = {};   // username -> balance
const withdrawals = {}; // id -> row

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "AUTH",
    role: "OWNER",
    username: "ADMIN"
  }));
};

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  // Initial full state
  if(data.type==="INIT"){
    userList.innerHTML="";
    withdrawList.innerHTML="";
    for(const u in data.balances){
      addOrUpdateUser(u, data.balances[u]);
    }
    data.withdrawals.forEach(addOrUpdateWithdraw);
  }

  // New withdrawal
  if(data.type==="NEW_WITHDRAW"){
    addOrUpdateWithdraw(data.req);
  }

  // Balance update
  if(data.type==="BALANCE_UPDATE"){
    addOrUpdateUser(data.username, data.balance);
  }

  // Approved / Rejected
  if(data.type==="APPROVED" || data.type==="REJECTED"){
    updateWithdrawStatus(data.id, data.status);
    addOrUpdateUser(data.username, data.balance);
  }

  if(data.type==="ERROR"){
    alert(data.msg);
  }
};

// User table
function addOrUpdateUser(username, balance){
  users[username] = balance;
  let tr = document.getElementById("user-"+username);
  if(!tr){
    tr=document.createElement("tr");
    tr.id="user-"+username;
    tr.innerHTML=`<td>${username}</td><td>₱<span class="bal">${balance}</span></td>`;
    userList.appendChild(tr);
  } else {
    tr.querySelector(".bal").innerText=balance;
  }
  userCount.innerText=Object.keys(users).length;
}

// Withdrawal table
function addOrUpdateWithdraw(w){
  if(withdrawals[w.id]) return;
  const tr = document.createElement("tr");
  tr.id="w-"+w.id;
  tr.innerHTML=`
    <td>${w.username}</td>
    <td>₱${w.amount}</td>
    <td>${w.gcash}</td>
    <td class="${w.status}">${w.status}</td>
    <td>${new Date(w.id).toLocaleString()}</td>
    <td>${w.status==="pending"?`<button onclick="approve(${w.id})">Approve</button>`:"-"}</td>
  `;
  withdrawList.prepend(tr);
  withdrawals[w.id]=tr;
}

// Update withdrawal status
function updateWithdrawStatus(id, status){
  const tr = withdrawals[id];
  if(!tr) return;
  tr.children[3].innerText=status;
  tr.children[3].className=status;
  tr.children[5].innerText="-";
}

// Approve button
window.approve=id=>{
  ws.send(JSON.stringify({type:"APPROVE",id}));
}
