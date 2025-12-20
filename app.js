/* Telegram */
const tg = window.Telegram?.WebApp;
tg?.expand();
const username = tg?.initDataUnsafe?.user?.username || "Telegram User";
document.getElementById("tgName").innerText = username;

/* Storage */
const store = key => JSON.parse(localStorage.getItem(key) || "0");
const save = (key,val) => localStorage.setItem(key, JSON.stringify(val));

let balance = store("balance");
document.getElementById("balance").innerText = balance.toFixed(2);

/* Navigation */
function show(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* Reward */
function reward(amount){
  balance += amount;
  save("balance", balance);
  document.getElementById("balance").innerText = balance.toFixed(2);
  alert(`🍋 Congratulations gain ₱${amount.toFixed(2)} 🎉🍋`);
}

/* Cooldown checker */
function canWatch(key, cooldown){
  const last = store(key);
  return Date.now() - last > cooldown;
}
function setCooldown(key){
  save(key, Date.now());
}

/* DAILY – 12 HOURS */
function dailyAd(v){
  const key = "daily_"+v;
  if(!canWatch(key, 12*60*60*1000))
    return alert("⏳ Cooldown: 12 hours");
  (v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853)()
  .then(()=>{ reward(0.01); setCooldown(key); });
}

/* GIFT – 15 MIN */
function giftAd(v){
  const key = "gift_"+v;
  if(!canWatch(key, 15*60*1000))
    return alert("⏳ Cooldown: 15 minutes");
  (v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853)("pop")
  .then(()=>{ reward(0.012); setCooldown(key); });
}

/* UNLI – 5 MIN */
function unliAd(v){
  const key = "unli_"+v;
  if(!canWatch(key, 5*60*1000))
    return alert("⏳ Cooldown: 5 minutes");
  (v==="v1"?show_10276123:v==="v2"?show_10337795:show_10337853)()
  .then(()=> setCooldown(key));
}

/* Withdraw */
function withdraw(){
  if(balance <= 0) return alert("No balance");
  document.getElementById("withdrawLog").innerHTML +=
    `<p>Pending ₱${balance.toFixed(2)} - ${new Date().toLocaleString()}</p>`;
  balance = 0;
  save("balance", 0);
  document.getElementById("balance").innerText = "0.00";
}

/* Clock */
setInterval(()=>document.getElementById("time").innerText=new Date().toLocaleString(),1000);
