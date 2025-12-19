import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
 apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
 authDomain: "paper-house-inc.firebaseapp.com",
 projectId: "paper-house-inc",
 storageBucket: "paper-house-inc.firebasestorage.app",
 messagingSenderId: "658389836376",
 appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram user
const tg = window.Telegram.WebApp;
tg.ready();
const user = tg.initDataUnsafe.user;
const uid = user?.id || "guest";
document.getElementById('username').innerText = user?.username || "Guest";

const userRef = doc(db,"users",uid);

// Load user wallet
async function loadUser(){
 const d = await getDoc(userRef);
 if(!d.exists()) await setDoc(userRef,{balance:0});
 onSnapshot(userRef,s=>{
  document.getElementById('balance').innerText = (s.data().balance||0).toFixed(3);
 });
}
loadUser();

// Add balance
window.addBalance = async v=>{
 const d = await getDoc(userRef);
 await setDoc(userRef,{balance:(d.data().balance||0)+v},{merge:true});
}

// Cooldown
window.startCooldown=(k,s)=>localStorage.setItem(k,Date.now()+s*1000);
window.cooldownReady=(k,s)=>{
 const t=localStorage.getItem(k);
 if(t && Date.now()<t){alert("Cooldown active");return false;}
 return true;
}

// CPM ads rotation
const adsCPM = [
  {id:'10276123', fn: window.show_10276123, reward:0.04, type:'interstitial', cooldown:180},
  {id:'10337795', fn: window.show_10337795, reward:0.04, type:'interstitial', cooldown:180},
  {id:'10337853', fn: window.show_10337853, reward:0.04, type:'interstitial', cooldown:180},
];

const dailyAds = [
  {id:'10276123', fn: window.show_10276123, reward:0.015, type:'pop', cooldown:900},
  {id:'10337795', fn: window.show_10337795, reward:0.015, type:'pop', cooldown:900},
  {id:'10337853', fn: window.show_10337853, reward:0.015, type:'pop', cooldown:900},
];

const globalAdsList = [
  {fn: window.show_10276123},
  {fn: window.show_10337795},
  {fn: window.show_10337853},
];

// Watch Ads CPM
window.watchAdsCPM = async ()=>{
  for(let ad of adsCPM){
    if(cooldownReady(ad.id, ad.cooldown)){
      try {
        await ad.fn(ad.type || 'interstitial');
        addBalance(ad.reward);
        alert(`Gained ${ad.reward.toFixed(3)} peso 🎉`);
        startCooldown(ad.id, ad.cooldown);
      } catch(e){ console.warn(`Ad ${ad.id} failed`); }
    }
  }
}

// Daily gifts
window.dailyGiftCPM = async (slot)=>{
  let ad = dailyAds[slot==='I'?0:slot==='II'?1:2];
  if(cooldownReady(ad.id, ad.cooldown)){
    try {
      await ad.fn('pop');
      new AdexiumWidget({wid:'0f0f814f-d491-4578-9343-531b503ff453', adFormat:'interstitial'}).autoMode();
      addBalance(ad.reward);
      alert(`Congratulations here is your ${ad.reward.toFixed(3)} peso 🎉`);
      startCooldown(ad.id, ad.cooldown);
    } catch(e){ console.warn(`Daily Gift ${slot} failed.`); }
  } else alert("Daily Gift cooldown active");
}

// Global interstitial rotation
function globalInterstitialRotation(){
  for(let ad of globalAdsList){
    ad.fn({
      type:'inApp',
      inAppSettings:{frequency:2,capping:0.1,interval:30,timeout:5,everyPage:false}
    }).then(()=>{
      addBalance(0.01);
      alert("Congratulations Earn 0.01 peso 🎉");
      const links=[
       "https://t.me/RicreatorCoinbot?startapp=cad587",
       "https://t.me/Dollar_EarningBot?start=7398171299",
       "https://t.me/TheOnlyFunds_Bot?start=187632",
       "https://t.me/Stars_Miner_bot?start=33861",
       "https://t.me/core_xbot?start=2074039",
       "https://t.me/ProfitHubMining_Bot?start=511555"
      ];
      location.href = links[Math.floor(Math.random()*links.length)];
    }).catch(e=>console.warn("Global ad failed"));
  }
}
document.addEventListener('DOMContentLoaded',()=>{globalInterstitialRotation();});
