import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, onSnapshot, query, orderBy, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
const username = user?.username || user?.first_name || "Guest";
document.getElementById("userBar").innerText = "👤 " + username;

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyAj6o2HbMEC472gDoNuFSDmdOSJj8k9S_U",
  authDomain: "fir-493d0.firebaseapp.com",
  projectId: "fir-493d0",
  storageBucket: "fir-493d0.appspot.com",
  messagingSenderId: "935141131610",
  appId: "1:935141131610:web:7998e21d07d7b4c71b5f63"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= YOUTUBE PLAYER ================= */
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
          earnPoints(5); // Earn points
          nextRandom();
        }
      }
    }
  });
};

/* ================= HELPERS ================= */
const extractId = url => url.match(/(?:v=|youtu\.be\/|shorts\/)([^?&]+)/)?.[1];
const pickRandom = arr => arr[Math.floor(Math.random()*arr.length)];

/* ================= FIRESTORE REFS ================= */
const playlistCol = collection(db,"playlist");
const stateDoc = doc(db,"global","state");
const usersCol = collection(db,"users");

/* ================= POINTS SYSTEM ================= */
let points = 0;
async function initPoints(){
  const userDoc = doc(db,"users",username);
  const snap = await getDoc(userDoc);
  if(!snap.exists()) await setDoc(userDoc,{points:0});
  else points = snap.data().points || 0;
  updatePointsUI();
}
function updatePointsUI(){ document.getElementById("points").innerText = `⭐ ${points} points`; }
function earnPoints(amount){
  points += amount;
  setDoc(doc(db,"users",username),{points},{merge:true});
  updatePointsUI();
}
async function spendPoints(amount){
  if(points<amount) return false;
  points -= amount;
  await setDoc(doc(db,"users",username),{points},{merge:true});
  updatePointsUI();
  return true;
}

/* ================= PLAYLIST TABLE ================= */
const playlistEl = document.getElementById("playlist");
onSnapshot(query(playlistCol,orderBy("createdAt")), snap=>{
  playlist=[];
  playlistEl.innerHTML="";
  snap.forEach((d,i)=>{
    const data = d.data();
    playlist.push(data.videoId);
    playlistEl.innerHTML += `
      <tr>
        <td>${i+1}</td>
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

  const snap = await playlistCol.get();
  const userVideos = snap.docs.filter(d=>d.data().addedBy===username);
  if(userVideos.length >=5){
    const ok = await spendPoints(20);
    if(!ok) return alert("Not enough points! Watch videos to earn more.");
  }

  await addDoc(playlistCol,{
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

  await setDoc(stateDoc,{
    currentVideoId:id,
    startedAt:serverTimestamp(),
    played:[id]
  },{merge:true});

  document.getElementById("ytUrl").value="";
});

/* ================= GLOBAL SYNC ================= */
onSnapshot(stateDoc, snap=>{
  const d = snap.data();
  if(!d?.currentVideoId || !player) return;

  currentVideoId = d.currentVideoId;
  startedAt = d.startedAt?.toMillis?.();

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
  await setDoc(stateDoc,{
    currentVideoId:id,
    startedAt:serverTimestamp(),
    played:[id]
  },{merge:true});
};

/* ================= RANDOM NEXT ================= */
async function nextRandom(){
  const snap = await stateDoc.get();
  let played = snap.data()?.played || [];

  if(played.length>=playlist.length) played=[];
  const remaining = playlist.filter(v=>!played.includes(v));
  const next = pickRandom(remaining);
  played.push(next);

  await setDoc(stateDoc,{currentVideoId:next, startedAt:serverTimestamp(), played},{merge:true});
}
