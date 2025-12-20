/* Telegram */
const tg = window.Telegram?.WebApp;
tg?.expand();
const username = tg?.initDataUnsafe?.user?.username || "Telegram User";
document.getElementById("tgName").innerText = username;

/* Storage helpers */
const get = k => JSON.parse(localStorage.getItem(k) || "0");
const set = (k,v) => localStorage.setItem(k, JSON.stringify(v));

let balance = get("balance");
document.getElementById("balance").innerText = balance.toFixed(2);

/* Reward */
function reward(amount){
  balance += amount;
  set("balance", balance);
  document.getElementById("balance").innerText = balance.toFixed(2);
  alert(`🍋 Congratulations gain ₱${amount.toFixed(2)} 🎉🍋`);
}

/* Cooldown */
function ready(key, ms){
  const last = get(key);
  return Date.now() - last > ms;
}
function mark(key){ set(key, Date.now()); }

/* DAILY – 12 HOURS */
function dailyAd(v){
  const key = "daily_"+v;
  if(!ready(key, 12*60*60*1000))
    return alert("⏳ Cooldown: 12 hours");
  (v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853)()
  .then(()=>{ reward(0.01); mark(key); });
}

/* GIFT – 15 MIN */
function giftAd(v){
  const key = "gift_"+v;
  if(!ready(key, 15*60*1000))
    return alert("⏳ Cooldown: 15 minutes");
  (v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853)("pop")
  .then(()=>{ reward(0.012); mark(key); });
}

/* UNLIMITED – 5 MIN */
function unliAd(v){
  const key = "unli_"+v;
  if(!ready(key, 5*60*1000))
    return alert("⏳ Cooldown: 5 minutes");
  (v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853)()
  .then(()=> mark(key));
}

/* Withdraw (local log) */
function withdraw(){
  if(balance <= 0) return alert("No balance");
  document.getElementById("withdrawLog").innerHTML +=
    `<p>Pending ₱${balance.toFixed(2)} — ${new Date().toLocaleString()}</p>`;
  balance = 0;
  set("balance", 0);
  document.getElementById("balance").innerText = "0.00";
}

/* Clock */
setInterval(()=>{
  document.getElementById("time").innerText = new Date().toLocaleString();
},1000);
