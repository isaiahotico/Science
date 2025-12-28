/* ===============================
   Telegram Mini App REAL Login
================================ */
const tg = window.Telegram?.WebApp
if(tg){
  tg.ready()
  const u = tg.initDataUnsafe?.user
  document.getElementById('user').innerText =
    u ? '@' + (u.username || u.first_name) : '@unknown'
}else{
  document.getElementById('user').innerText='@guest'
}

/* ===============================
   Wallet + UI
================================ */
let balance = 0
const toast = document.getElementById('toast')

function openPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function showToast(msg){
  toast.innerText = msg
  toast.classList.add('show')
  setTimeout(()=>toast.classList.remove('show'),2000)
}

function reward(amt){
  balance += amt
  document.getElementById('balance').innerText = balance.toFixed(2)
  showToast(`🍋 Congratulations gain ₱${amt} 🎉🍋`)
}

/* ===============================
   CPM Smart Rotation
================================ */
const adPool = [
  { fn: () => show_10276123(), weight: 3 },
  { fn: () => show_10337795(), weight: 2 },
  { fn: () => show_10337853(), weight: 1 }
]

function pickAd(){
  const bag=[]
  adPool.forEach(a=>{for(let i=0;i<a.weight;i++) bag.push(a)})
  return bag[Math.floor(Math.random()*bag.length)]
}

/* ===============================
   Parallel Preload
================================ */
window.onload = ()=>{
  try{
    show_10276123({type:'inApp',inAppSettings:{frequency:1,capping:0.05}})
    show_10337795({type:'inApp',inAppSettings:{frequency:1,capping:0.05}})
    show_10337853({type:'inApp',inAppSettings:{frequency:1,capping:0.05}})
  }catch(e){}
}

/* ===============================
   Ads + 5-Minute Cooldown
================================ */
const COOLDOWN = 300

function rewardAd(key,amt){
  if(lock(key)) return
  pickAd().fn().then(()=>reward(amt))
}

function rewardPopup(key,amt){
  if(lock(key)) return
  pickAd().fn('pop').then(()=>reward(amt))
}

function showUnlimited(key){
  if(lock(key)) return
  pickAd().fn().then(()=>showToast('🍍 Ad viewed'))
}

/* ===============================
   Cooldown Engine
================================ */
function lock(k){
  const t = localStorage.getItem(k)
  if(t && Date.now()<t) return true
  localStorage.setItem(k,Date.now()+COOLDOWN*1000)
  tick(k)
  return false
}

function tick(k){
  const el=document.getElementById('cd-'+k)
  if(!el) return
  const i=setInterval(()=>{
    const t=localStorage.getItem(k)-Date.now()
    if(t<=0){
      el.innerText='Ready'
      clearInterval(i)
    }else{
      el.innerText=`Cooldown ${Math.ceil(t/60)} min`
    }
  },1000)
}
