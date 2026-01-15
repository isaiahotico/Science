/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const user = tg?.initDataUnsafe?.user;
document.getElementById("userBar").innerText =
  "👤 " + (user?.username ? "@"+user.username : user?.first_name || "Guest");

/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, setDoc, deleteDoc,
  onSnapshot, query, orderBy, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAj6o2HbMEC472gDoNuFSDmdOSJj8k9S_U",
  authDomain: "fir-493d0.firebaseapp.com",
  projectId: "fir-493d0",
  storageBucket: "fir-493d0.firebasestorage.app",
  messagingSenderId: "935141131610",
  appId: "1:935141131610:web:7998e21d07d7b4c71b5f63"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
signInAnonymously(auth);

/* ================= YOUTUBE ================= */
let player;
let playlist = [];
let currentVideoId = null;
let startedAt = null;

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", {
    playerVars:{playsinline:1, autoplay:0},
    events:{
      onReady:syncTime,
      onStateChange:e=>{
        if(e.data===YT.PlayerState.ENDED) nextRandom();
      }
    }
  });
};

/* ================= HELPERS ================= */
const extractId = url =>
  url.match(/(?:v=|youtu\.be\/|shorts\/)([^?&]+)/)?.[1];

const pickRandom = arr => arr[Math.floor(Math.random()*arr.length)];

/* ================= GLOBAL STATE ================= */
const stateRef = doc(db,"global","state");
const playlistEl = document.getElementById("playlist");

/* ================= VIEWERS ================= */
onAuthStateChanged(auth, async u=>{
  if(!u) return;
  const viewerRef = doc(db,"global/viewers",u.uid);
  await setDoc(viewerRef,{joinedAt:Date.now()});
  window.addEventListener("beforeunload",()=>deleteDoc(viewerRef));
});

onSnapshot(collection(db,"global/viewers"),snap=>{
  document.getElementById("viewers").innerText = `👀 ${snap.size} watching`;
});

/* ================= PLAYLIST SYNC ================= */
function renderPlaylist(snapshot){
  playlist = [];
  playlistEl.innerHTML="";
  snapshot.forEach((d,i)=>{
    const id = d.data().videoId;
    playlist.push(id);
    playlistEl.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${id}</td>
        <td>
          <button onclick="playNow('${id}')" class="playBtn">▶️ Play</button>
        </td>
      </tr>`;
  });
}

onSnapshot(
  query(collection(db,"playlist"),orderBy("createdAt")),
  renderPlaylist
);

/* ================= ADD URL ================= */
document.getElementById("addBtn").addEventListener("click", async ()=>{
  const url = document.getElementById("ytUrl").value;
  const id = extractId(url);
  if(!id) return alert("Invalid YouTube link");

  await addDoc(collection(db,"playlist"),{
    videoId:id,
    createdAt:Date.now()
  });

  document.getElementById("ytUrl").value="";
});

/* ================= PLAY VIDEO ================= */
document.getElementById("playBtn").addEventListener("click", async ()=>{
  const url = document.getElementById("ytUrl").value;
  const id = extractId(url);
  if(!id) return alert("Invalid YouTube link");

  // Play globally
  await setDoc(stateRef,{
    currentVideoId:id,
    startedAt:serverTimestamp(),
    played:[id]
  },{merge:true});

  document.getElementById("ytUrl").value="";
});

/* ================= GLOBAL SYNC ================= */
onSnapshot(stateRef, snap=>{
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
  const now = Date.now();
  const seek = (now - startedAt)/1000;
  if(Math.abs(player.getCurrentTime() - seek) > 1){
    player.seekTo(seek, true);
  }
}

/* ================= DIRECT PLAY ================= */
window.playNow = async id=>{
  await setDoc(stateRef,{
    currentVideoId:id,
    startedAt:serverTimestamp(),
    played:[id]
  },{merge:true});
};

/* ================= RANDOM NEXT ================= */
window.nextRandom = async ()=>{
  const snap = await getDoc(stateRef);
  let played = snap.data().played||[];

  if(played.length >= playlist.length) played=[];
  const remaining = playlist.filter(v=>!played.includes(v));
  const next = pickRandom(remaining);

  played.push(next);

  await setDoc(stateRef,{
    currentVideoId:next,
    startedAt:serverTimestamp(),
    played
  },{merge:true});
};
