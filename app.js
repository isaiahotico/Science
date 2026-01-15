import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, onSnapshot, query, orderBy, getDocs, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
          earnPoints(5); // Earn points per video watched
          nextRandom();
        }
      }
    }
  });
};

/* ================= HELPERS ================= */
const extractId = url => {
  const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};
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

/* ================= PLAYLIST TABLE (GLOBAL) ================= */
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

/* ================= ADD URL GLOBAL ================= */
document.getElementById("addBtn").addEventListener("click", async ()=>{
  const url = document.getElementById("ytUrl").value.trim();
  if(!url) return alert("Please paste a YouTube link.");
  const videoId = extractId(url);
  if(!videoId) return alert("Invalid YouTube link.");

  try{
    // Count user videos for points
    const snapshot = await getDocs(query(playlistCol, orderBy("createdAt")));
    const userVideos = snapshot.docs.filter(d=>d.data().addedBy===username);

    if(userVideos.length>=5){
      const ok = await spendPoints(20);
      if(!ok) return alert("Not enough points! Watch videos to earn more.");
    }

    // Add video globally
    await addDoc(playlistCol,{
      videoId: videoId,
      addedBy: username,
      createdAt: Date.now()
    });

    // Auto-update global state
    await setDoc(stateDoc,{
      currentVideoId: videoId,
      startedAt: serverTimestamp(),
      played: [videoId]
    },{merge:true});

    document.getElementById("ytUrl").value="";
  }catch(err){
    console.error("Failed to add video:", err);
    alert("Failed to add video. Check console.");
  }
});

/* ================= PLAY VIDEO ================= */
document.getElementById("playBtn").addEventListener("click", async ()=>{
  const url = document.getElementById("ytUrl").value.trim();
  const videoId = extractId(url);
  if(!videoId) return alert("Invalid YouTube link.");

  await setDoc(stateDoc,{
    currentVideoId: videoId,
    startedAt: serverTimestamp(),
    played: [videoId]
  },{merge:true});

  document.getElementById("ytUrl").value="";
});

/* ================= GLOBAL SYNC ================= */
onSnapshot(stateDoc,snap=>{
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
window.playNow = async videoId=>{
  await setDoc(stateDoc,{
    currentVideoId: videoId,
    startedAt: serverTimestamp(),
    played:[videoId]
  },{merge:true});
};

/* ================= RANDOM NEXT ================= */
async function nextRandom(){
  const snap = await getDoc(stateDoc);
  let played = snap.data()?.played || [];
  if(played.length>=playlist.length) played=[];
  const remaining = playlist.filter(v=>!played.includes(v));
  const next = pickRandom(remaining);
  played.push(next);
  await setDoc(stateDoc,{
    currentVideoId: next,
    startedAt: serverTimestamp(),
    played
  },{merge:true});
}
