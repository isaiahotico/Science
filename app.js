// -------------------- Global Variables --------------------
let balance = 0;
let telegramUsername = "Guest";
const COOLDOWN_MS = 12*60*60*1000; // 12 hours
const cooldowns = { V1:0, V2:0, V3:0, giftBtn1:0, giftBtn2:0, unlimitedBtn1:0, unlimitedBtn2:0 };

// -------------------- Ads Config (high CPM) --------------------
const adsList = {
  V1:['10276123','10276124'],
  V2:['10337795','10337796'],
  V3:['10337853','10337854'],
  giftBtn1:['10400001'], giftBtn2:['10400002'],
  unlimitedBtn1:['10500001'], unlimitedBtn2:['10500002']
};

// -------------------- Telegram Mini App --------------------
function initTelegramUser(){
  if(window.Telegram?.WebApp){
    telegramUsername = Telegram.WebApp.initDataUnsafe.user?.username || "Guest";
  }
  document.getElementById('telegramUser').innerText = "Telegram: " + telegramUsername;
}

// -------------------- Reward Popup --------------------
function showRewardPopup(message){
  const popup = document.getElementById('rewardPopup');
  popup.innerHTML = message;
  popup.style.display='block';
  setTimeout(()=>{ popup.style.display='none'; }, 2500);
}

// -------------------- Update Cooldowns --------------------
function updateCooldowns(){
  const now = Date.now();
  Object.keys(cooldowns).forEach(id=>{
    const cdDiv = document.getElementById('cd'+id);
    if(cdDiv){
      if(cooldowns[id]){
        let diff = COOLDOWN_MS - (now - cooldowns[id]);
        if(diff>0){
          let hrs = Math.floor(diff/3600000);
          let mins = Math.floor((diff%3600000)/60000);
          cdDiv.innerHTML = `Cooldown: ${hrs}h ${mins}m`;
        } else {
          cdDiv.innerHTML = 'Ready!';
        }
      } else {
        cdDiv.innerHTML = 'Ready!';
      }
    }
  });
}

// -------------------- Watch Ad / Auto Reward --------------------
function watchAd(buttonId){
  const now = Date.now();
  if(cooldowns[buttonId] && now - cooldowns[buttonId] < COOLDOWN_MS){
    alert('Cooldown active! Come back later.');
    return;
  }

  // Parallel high CPM ad injection
  const zones = adsList[buttonId] || [];
  zones.forEach(zoneId=>{
    const script = document.createElement('script');
    script.src = `//libtl.com/sdk.js`;
    script.setAttribute('data-zone', zoneId);
    script.setAttribute('data-sdk', `show_${zoneId}`);
    document.body.appendChild(script);
  });

  // Auto reward immediately
  balance += 0.01;
  document.getElementById('balance').innerText = `Balance: ${balance.toFixed(2)} PHP`;
  cooldowns[buttonId] = now;
  showRewardPopup(`🍋 +0.01 PHP from ${buttonId}! 🎉`);
  updateCooldowns();
}

// -------------------- Initialize --------------------
window.onload = function(){
  initTelegramUser();
  updateCooldowns();
  setInterval(updateCooldowns, 60000);

  // Assign buttons
  ['V1','V2','V3','giftBtn1','giftBtn2','unlimitedBtn1','unlimitedBtn2'].forEach(id=>{
    const btn = document.getElementById(id);
    if(btn){
      btn.onclick = ()=>watchAd(id);
    }
  });
};
