/* Telegram REAL login */
const tg = window.Telegram?.WebApp
if (tg) {
  tg.ready()
  const u = tg.initDataUnsafe?.user
  document.getElementById('user').innerText =
    u ? '@' + (u.username || u.first_name) : '@unknown'
} else {
  document.getElementById('user').innerText = '@guest'
}

/* Parallel preload */
window.addEventListener('load',()=>{
  try{
    show_10276123({type:'inApp'})
    show_10337795({type:'inApp'})
    show_10337853({type:'inApp'})
  }catch(e){}
})

let balance = 0
const COOLDOWN = 120 // ✅ 2 MINUTES FOR ALL
const toast = document.getElementById('toast')

function openPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function showToast(msg){
  toast.innerText = msg
  toast.style.display = 'block'
  setTimeout(()=>toast.style.display='none',2000)
}

/* CPM Smart Rotation (no zero CPM) */
const adPool = [
  { fn:()=>show_10276123(), w:3 },
  { fn:()=>show_10337795(), w:2 },
  { fn:()=>show_10337853(), w:1 }
]

function pickAd(){
  const bag=[]
  adPool.forEach(a=>{for(let i=0;i<a.w;i++) bag.push(a)})
  return bag[Math.floor(Math.random()*bag.length)]
}

function rewardAd(key,amt){
  if(lock(key)) return
  pickAd().fn().then(()=>{
    add(amt)
    showToast(`+₱${amt}`)
  })
}

function rewardPop(key,amt){
  if(lock(key)) return
  pickAd().fn().then(()=>{
    add(amt)
    showToast(`+₱${amt}`)
  })
}

function countAd(key){
  if(lock(key)) return
  pickAd().fn().then(()=>showToast('Ad viewed'))
}

function add(v){
  balance+=v
  document.getElementById('balance').innerText=balance.toFixed(2)
}

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
    if(t<=0){el.innerText='Ready';clearInterval(i)}
    else el.innerText=`Cooldown ${Math.ceil(t/1000)}s`
  },1000)
}
