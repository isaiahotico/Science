/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();

const user = tg?.initDataUnsafe?.user;
document.getElementById("userBar").innerText =
  "👤 User: " + (user?.username ? "@"+user.username : user?.first_name || "Guest");

/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, setDoc,
  onSnapshot, query, orderBy, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
signInAnonymously(getAuth(app));

/* ================= YOUTUBE ================= */
let player;
let playlist = [];

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    playerVars: {
      playsinline: 1,
      origin: location.origin
    },
    events: {
      onStateChange: e => {
        if (e.data === YT.PlayerState.ENDED) nextRandom();
      }
    }
  });
};

/* ================= HELPERS ================= */
const extractId = url => {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([^?&]+)/);
  return m ? m[1] : null;
};

const pickRandom = arr =>
  arr[Math.floor(Math.random() * arr.length)];

/* ================= GLOBAL STATE ================= */
const stateRef = doc(db,"global","state");

if (!(await getDoc(stateRef)).exists()) {
  await setDoc(stateRef,{
    currentVideoId:"",
    played:[],
    updatedAt:Date.now()
  });
}

/* ================= ADD & PLAY (FIXED VIEW ISSUE) ================= */
window.addVideo = async () => {
  const id = extractId(ytUrl.value);
  if (!id) return alert("Invalid YouTube link");

  await addDoc(collection(db,"playlist"),{
    videoId:id,
    createdAt:Date.now()
  });

  // 🔥 THIS IS WHAT COUNTS THE VIEW
  await setDoc(stateRef,{
    currentVideoId:id,
    played:[id],
    updatedAt:Date.now()
  },{merge:true});

  ytUrl.value="";
};

/* ================= GLOBAL SYNC (FAST) ================= */
onSnapshot(stateRef,snap=>{
  const d=snap.data();
  if (!d?.currentVideoId || !player) return;

  if (player.getVideoData().video_id !== d.currentVideoId) {
    player.loadVideoById(d.currentVideoId);
  }
});

/* ================= PLAYLIST SYNC ================= */
onSnapshot(
  query(collection(db,"playlist"),orderBy("createdAt")),
  snap=>{
    playlist=[];
    playlistEl.innerHTML="";
    snap.forEach((doc,i)=>{
      const id=doc.data().videoId;
      playlist.push(id);
      playlistEl.innerHTML+=`
        <tr>
          <td>${i+1}</td>
          <td>${id}</td>
          <td><button onclick="playNow('${id}')">▶️</button></td>
        </tr>`;
    });
});

/* ================= DIRECT PLAY ================= */
window.playNow = async id => {
  await setDoc(stateRef,{
    currentVideoId:id,
    updatedAt:Date.now()
  },{merge:true});
};

/* ================= PURE RANDOM NEXT ================= */
window.nextRandom = async () => {
  const snap = await getDoc(stateRef);
  let played = snap.data().played || [];

  if (played.length >= playlist.length) played = [];

  const remaining = playlist.filter(v => !played.includes(v));
  const next = pickRandom(remaining);

  played.push(next);

  await setDoc(stateRef,{
    currentVideoId:next,
    played,
    updatedAt:Date.now()
  },{merge:true});
};
