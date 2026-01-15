/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser
  ? `@${tgUser.username || tgUser.first_name}`
  : "Guest";

document.getElementById("userBar").innerText =
  "👤 User: " + username;

/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc
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
    height: "360",
    width: "100%",
    playerVars: { playsinline: 1 },
    events: {
      onStateChange: e => {
        if (e.data === YT.PlayerState.ENDED) {
          nextRandom();
        }
      }
    }
  });
};

/* ================= HELPERS ================= */
const extractId = url => {
  const m = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
  return m ? m[1] : null;
};

const randomFrom = arr =>
  arr[Math.floor(Math.random() * arr.length)];

/* ================= PLAYLIST ================= */
window.addVideo = async () => {
  const id = extractId(ytUrl.value);
  if (!id) return alert("Invalid YouTube URL");

  await addDoc(collection(db, "playlist"), {
    videoId: id,
    createdAt: Date.now()
  });
  ytUrl.value = "";
};

/* ================= GLOBAL STATE ================= */
const stateRef = doc(db, "global", "state");

const stateSnap = await getDoc(stateRef);
if (!stateSnap.exists()) {
  await setDoc(stateRef, {
    currentIndex: 0,
    currentVideoId: "",
    updatedAt: Date.now(),
    played: []
  });
}

/* ================= GLOBAL SYNC ================= */
onSnapshot(stateRef, snap => {
  const d = snap.data();
  if (!d?.currentVideoId) return;

  if (
    player &&
    player.getVideoData().video_id !== d.currentVideoId
  ) {
    player.loadVideoById(d.currentVideoId);
  }
});

/* ================= PLAYLIST SYNC ================= */
const q = query(collection(db, "playlist"), orderBy("createdAt"));
onSnapshot(q, snap => {
  playlist = [];
  playlistEl.innerHTML = "";

  snap.forEach((doc, i) => {
    const id = doc.data().videoId;
    playlist.push(id);
    playlistEl.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${id}</td>
        <td><button onclick="playDirect('${id}')">▶️</button></td>
      </tr>`;
  });
});

/* ================= PLAY DIRECT ================= */
window.playDirect = async videoId => {
  await setDoc(stateRef, {
    currentVideoId: videoId,
    updatedAt: Date.now(),
    played: [videoId]
  }, { merge: true });
};

/* ================= PURE RANDOM NEXT ================= */
window.nextRandom = async () => {
  const snap = await getDoc(stateRef);
  const state = snap.data();

  let played = state.played || [];

  // Reset if all watched
  if (played.length >= playlist.length) {
    played = [];
  }

  const remaining = playlist.filter(v => !played.includes(v));
  const next = randomFrom(remaining);

  played.push(next);

  await setDoc(stateRef, {
    currentVideoId: next,
    updatedAt: Date.now(),
    played
  }, { merge: true });
};
