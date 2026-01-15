/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const username = user?.username || user?.first_name || "Guest";
document.getElementById("userBar").innerText = "👤 " + username;

/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, get, child, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAj6o2HbMEC472gDoNuFSDmdOSJj8k9S_U",
  authDomain: "fir-493d0.firebaseapp.com",
  databaseURL: "https://fir-493d0-default-rtdb.firebaseio.com",
  projectId: "fir-493d0",
  storageBucket: "fir-493d0.appspot.com",
  messagingSenderId: "935141131610",
  appId: "1:935141131610:web:7998e21d07d7b4c71b5f63"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ================= YOUTUBE ================= */
let player;
let playlist = [];
let currentVideoId = null;
let startedAt = null;

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", {
    playerVars:{playsinline:1, autoplay:0},
    events:{
      onReady:()=>{syncTime(); initPoints();},
      onStateChange:e=>{
        if(e.data===YT.PlayerState.ENDED){
          earnPoints(5); // earn 5 points per video watched
          nextRandom();
        }
      }
    }
  });
};

/* ================= HELPERS ================= */
const extractId = url => url.match(/(?:v=|youtu\.be\/|shorts\/)([^?&]+)/)?.[1];
const pickRandom = arr => arr[Math.floor(Math.random()*arr.length)];

/* ================= GLOBAL STATE REFS ================= */
const playlistRef = ref(db, "playlist");
const stateRef = ref(db, "global/state");
const viewersRef = ref(db, "global/viewers");
const usersRef = ref(db, "users");

/* ================= VIEWERS ================= */
const uid = username;
set(ref(db,"global/viewers/"+uid),{joinedAt:Date.now()});
window.addEventListener("beforeunload",()=>{set(ref(db,"global/viewers/"+uid),null);});
onValue(viewersRef,snap=>{
  document.getElementById("viewers").innerText = `👀 ${snap.numChildren()} watching`;
});

/* ================= POINTS SYSTEM ================= */
let points = 0;
async function initPoints(){
  const snap = await get(child(usersRef,username));
  if(!snap.exists()) {
    await set(ref(db,"users/"+username),{points:0});
    points=0;
  } else points = snap.val().points || 0;
  updatePointsUI();
}
function updatePointsUI(){ document.getElementById("points").innerText = `⭐ ${points} points`; }
function earnPoints(amount){
  points += amount;
  update(ref(db,"users/"+username),{points});
  updatePointsUI();
}
async function spendPoints(amount){
  if(points<amount) return false;
  points -= amount;
  await update(ref(db,"users/"+username),{points});
  updatePointsUI();
  return true;
}

/* ================= PLAYLIST TABLE ================= */
const playlistEl = document.getElementById("playlist");
onValue(playlistRef,snap=>{
  playlist=[];
  playlistEl.innerHTML="";
  snap.forEach(childSnap=>{
    const data = childSnap.val();
    playlist.push(data.videoId);
    playlistEl.innerHTML += `
      <tr>
        <td>${playlistEl.rows.length+1}</td>
        <td>${data.videoId}</td>
        <td>${data.addedBy||"Guest"}</td>
        <td><button onclick="playNow('${data.videoId}')" class="playBtn">▶️ Play</button></td>
      </tr>`;
  });
});

/* ================= ADD URL ================= */
document.getElementById("addBtn").addEventListener("click", async ()=>{
  const url = document.getElementById("ytUrl").value;
  const id = extractId(url);
  if(!id) return alert("Invalid YouTube link");

  // Check user quota (5 free, 20 points per video after)
  const snap = await get(playlistRef);
  const userVideos = [];
  snap.forEach(childSnap=>{ if(childSnap.val().addedBy===username) userVideos.push(childSnap.val()); });
  if(userVideos.length >= 5){
    const ok = await spendPoints(20);
    if(!ok) return alert("Not enough points! Watch videos to earn more.");
  }

  // Add video
  await push(playlistRef,{
    videoId:id,
    addedBy:username,
    createdAt:Date.now()
  });

  document.getElementById("ytUrl").value="";
});

/* ================= PLAY VIDEO ================= */
document.getElementById("playBtn").addEventListener("click", async ()=>{
  const url = document.getElementById("ytUrl").value;
  const id = extractId(url);
  if(!id) return alert("Invalid YouTube link");

  await set(stateRef,{
    currentVideoId:id,
    startedAt:Date.now(),
    played:[id]
  });

  document.getElementById("ytUrl").value="";
});

/* ================= GLOBAL SYNC ================= */
onValue(stateRef,snap=>{
  const d = snap.val();
  if(!d?.currentVideoId || !player) return;

  currentVideoId = d.currentVideoId;
  startedAt = d.startedAt;

  if(player.getVideoData().video_id!==currentVideoId){
    player.loadVideoById(currentVideoId);
    player.playVideo();
  } else syncTime();
});

/* ================= EXACT SECOND SYNC ================= */
function syncTime(){
  if(!startedAt || !player?.getCurrentTime) return;
  const seek = (Date.now() - startedAt)/1000;
  if(Math.abs(player.getCurrentTime()-seek)>1) player.seekTo(seek,true);
}

/* ================= DIRECT PLAY ================= */
window.playNow = async id=>{
  await set(stateRef,{
    currentVideoId:id,
    startedAt:Date.now(),
    played:[id]
  });
};

/* ================= RANDOM NEXT ================= */
async function nextRandom(){
  const snap = await get(stateRef);
  let played = snap.val()?.played || [];

  if(played.length>=playlist.length) played=[];
  const remaining = playlist.filter(v=>!played.includes(v));
  const next = pickRandom(remaining);
  played.push(next);

  await set(stateRef,{currentVideoId:next, startedAt:Date.now(), played});
}
