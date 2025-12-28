let balance = 0
const toast = document.getElementById('toast')

// Telegram username placeholder (Mini App ready)
document.getElementById('tgUser').innerText =
  window.Telegram?.WebApp?.initDataUnsafe?.user?.username
  ? '@' + Telegram.WebApp.initDataUnsafe.user.username
  : '@guest'

// CPM Smart Rotation Pool
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

// Parallel preload
window.onload = () => {
  try{
    show_10276123({type:'inApp',inAppSettings:{frequency:1,capping:0.05}})
    show_10337795({type:'inApp',inAppSettings:{frequency:1,capping:0.05}})
    show_10337853({type:'inApp',inAppSettings:{frequency:1,capping:0.05}})
  }catch(e){}
}

function openPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function rewardAd(key,amt,cd){
  if(lock(key,cd)) return
  pickAd().fn().then(()=> reward(amt))
}

function rewardPopup(key,amt,cd){
  if(lock(key,cd)) return
  pickAd().fn('pop').then(()=> reward(amt))
}

function showUnlimited(key){
  if(lock(key,300)) return
  pickAd().fn()
}

function reward(amt){
  balance += amt
  document.getElementById('balance').innerText = balance.toFixed(2)
  showToast(`🍋 Congratulations gain ₱${amt} 🎉🍋`)
}

function showToast(msg){
  toast.innerText = msg
  toast.classList.add('show')
  setTimeout(()=>toast.classList.remove('show'),2000)
}

function lock(k,s){
  const t = localStorage.getItem(k)
  if(t && Date.now()<t) return true
  localStorage.setItem(k, Date.now()+s*1000)
  cooldown(k)
  return false
}

function cooldown(k){
  const el = document.getElementById('cd-'+k)
  if(!el) return
  const i = setInterval(()=>{
    const t = localStorage.getItem(k)-Date.now()
    if(t<=0){ el.innerText='Ready'; clearInterval(i) }
    else el.innerText = `Cooldown ${Math.ceil(t/1000)}s`
  },1000)
}
