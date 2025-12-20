/* TELEGRAM USER */
const tg = window.Telegram?.WebApp;
const telegramId = tg?.initDataUnsafe?.user?.id || "guest";
const tgName = tg?.initDataUnsafe?.user?.username || "Guest";
document.getElementById("tgName")?.innerText = tgName;

/* BALANCE */
let balance = parseFloat(localStorage.getItem("balance")||"0");
document.getElementById("balance")?.innerText = balance.toFixed(2);

/* SIMULATED WITHDRAWAL STORAGE */
let withdrawals = JSON.parse(localStorage.getItem("withdrawals")||"[]");

/* REWARD FUNCTION */
function reward(v){
  balance += v;
  localStorage.setItem("balance",balance);
  document.getElementById("balance").innerText = balance.toFixed(2);
  alert("🎉 Congratulations you earned ₱0.01");
}

/* COOLDOWN LOCK BY TELEGRAM ID */
function key(name){ return `${telegramId}_${name}`; }
function canRun(name, cooldownMs){
  const last = localStorage.getItem(key(name))||0;
  return Date.now()-last>=cooldownMs;
}
function markRun(name){ localStorage.setItem(key(name),Date.now()); }

/* RUN ADS WITH SPINNER */
function runAd(btn,sdk,name,cooldownMs){
  if(!canRun(name,cooldownMs)) return alert("⏳ Cooldown active");
  btn.disabled=true;
  btn.innerHTML += `<div class="spinner"></div>`;
  sdk().then(()=>{
    reward(0.01);
    markRun(name);
  }).finally(()=>{
    btn.disabled=false;
    btn.querySelector(".spinner")?.remove();
  });
}

/* DAILY / GIFT / UNLI */
window.runDaily=(btn,v)=>{
  const sdk=v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853;
  runAd(btn,sdk,"daily_"+v,12*60*60*1000);
};
window.runGift=(btn,v)=>{
  const sdk=v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853;
  runAd(btn,sdk,"gift_"+v,15*60*1000);
};
window.runUnli=(btn,v)=>{
  const sdk=v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853;
  runAd(btn,sdk,"unli_"+v,5*60*1000);
};

/* COOL DOWN TIMERS */
function startTimer(name,ms,elId){
  setInterval(()=>{
    const last = localStorage.getItem(key(name))||0;
    const left = ms-(Date.now()-last);
    const el = document.getElementById(elId);
    if(!el) return;
    if(left<=0) el.textContent="✅ Ready";
    else{
      const m=Math.floor(left/60000);
      const s=Math.floor((left%60000)/1000);
      el.textContent=`⏳ ${m}:${s.toString().padStart(2,"0")}`;
    }
  },1000);
}

/* START TIMERS */
["daily_v1","daily_v2","daily_v3"].forEach(v=>startTimer(v,12*60*60*1000,v+"_timer"));
["gift_v1","gift_v2","gift_v3"].forEach(v=>startTimer(v,15*60*1000,v+"_timer"));
["unli_v1","unli_v2","unli_v3"].forEach(v=>startTimer(v,5*60*1000,v+"_timer"));

/* SIMULATED WITHDRAWAL */
window.withdraw=()=>{
  if(balance<=0) return alert("No balance");
  const gcash=document.getElementById("gcash").value||"Unknown";
  const w={user:tgName,amount:balance,gcash:gcash,status:"Pending",time:new Date().toLocaleString()};
  withdrawals.push(w);
  localStorage.setItem("withdrawals",JSON.stringify(withdrawals));
  balance=0;
  localStorage.setItem("balance",0);
  document.getElementById("balance").innerText="0.00";
  loadUserWithdrawals();
  loadAdminWithdrawals();
};

/* LOAD USER WITHDRAWALS */
function loadUserWithdrawals(){
  const tbody=document.getElementById("userHistory");
  if(!tbody) return;
  tbody.innerHTML="";
  withdrawals.filter(w=>w.user===tgName).forEach(w=>{
    tbody.innerHTML+=`<tr>
      <td>${w.user}</td>
      <td>₱${w.amount}</td>
      <td>${w.gcash}</td>
      <td>${w.status}</td>
      <td>${w.time}</td>
    </tr>`;
  });
}

/* LOAD ADMIN DASHBOARD */
function loadAdminWithdrawals(){
  const tbody=document.getElementById("adminTable");
  if(!tbody) return;
  tbody.innerHTML="";
  withdrawals.forEach((w,i)=>{
    tbody.innerHTML+=`<tr>
      <td>${w.user}</td>
      <td>₱${w.amount}</td>
      <td>${w.gcash}</td>
      <td>${w.status}</td>
      <td>
        <button onclick="adminUpdate(${i},'Approved')">✔</button>
        <button onclick="adminUpdate(${i},'Denied')">✖</button>
      </td>
    </tr>`;
  });
}

/* ADMIN UPDATE */
window.adminUpdate=(i,s)=>{
  withdrawals[i].status=s;
  localStorage.setItem("withdrawals",JSON.stringify(withdrawals));
  loadUserWithdrawals();
  loadAdminWithdrawals();
};

/* CLOCK */
setInterval(()=>document.getElementById("clock")?.innerText=new Date().toLocaleString(),1000);
