import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore, doc, setDoc, updateDoc, onSnapshot,
collection, addDoc, query, where, limit, getDocs, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔥 TELEGRAM FAST INIT */
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const tgUser = tg.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "@Guest";
const uid = tgUser?.id?.toString() || "dev";

userBar.innerText = `👤 ${username}`;

/* 🔥 FIREBASE */
const app = initializeApp({
apiKey:"AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
authDomain:"paper-house-inc.firebaseapp.com",
projectId:"paper-house-inc"
});

const db = getFirestore(app);
const uRef = doc(db,"users",uid);

let uData = { balance:0, cooldowns:{}, refBy:null };

onSnapshot(uRef,s=>{
if(!s.exists()){
setDoc(uRef,{username,balance:0,cooldowns:{},refBy:null});
return;
}
uData=s.data();
balanceDisplay.innerText=`₱${uData.balance.toFixed(3)}`;
my-ref-id.innerText=username;
current-ref.innerText=uData.refBy||"None";
});

/* NAV */
window.go=p=>{
["ads","signin","gifts","referral","withdraw","admin"].forEach(x=>{
document.getElementById(x)?.classList.add("hidden");
});
if(p==="main") return;
document.getElementById(p).classList.remove("hidden");
renderTasks(p);
if(p==="withdraw") loadHistory();
};

/* ADMIN AUTH */
window.adminAuth=()=>prompt("Admin Password")==="Propetas12"
?go("admin"):alert("Denied");

/* ADS SAFE */
function showAd(zone){
try{ window[zone]?.({type:"inApp"}); }catch{}
}

/* TASK RENDER */
const TASKS={
ads:{reward:.02,zone:"show_10276123"},
signin:{reward:.025,zone:"show_10337795"},
gifts:{reward:.02,zone:"show_10337853"}
};

function renderTasks(p){
const box=document.getElementById(p);
box.innerHTML="";
if(!TASKS[p]) return;
for(let i=1;i<=3;i++){
box.innerHTML+=`
<div class="card">
<button class="btn btn-task"
onclick="play('${TASKS[p].zone}',${TASKS[p].reward})">
🤑 Task ${i}
</button>
</div>`;
}
}

window.play=async(zone,amt)=>{
showAd(zone);
await updateDoc(uRef,{ balance:increment(amt) });
alert("🎉 Reward added!");
};

/* REFERRAL */
window.setReferrer=async()=>{
const v=ref-input.value.trim();
if(v===username) return alert("Invalid");
await updateDoc(uRef,{refBy:v});
};

/* WITHDRAW */
window.handleWD=async()=>{
const amt=+wd-amt.value;
if(amt<=0||amt>uData.balance) return alert("Invalid");
await updateDoc(uRef,{balance:increment(-amt)});
await addDoc(collection(db,"withdrawals"),{
uid,name:username,amount:amt,address:wd-addr.value,
method:wd-method.value,status:"Pending",date:new Date().toISOString()
});
};

/* HISTORY */
function loadHistory(){
const q=query(collection(db,"withdrawals"),where("uid","==",uid),limit(10));
onSnapshot(q,s=>{
let h="<table><tr><th>Date</th><th>₱</th><th>Status</th></tr>";
s.forEach(d=>{
const w=d.data();
h+=`<tr><td>${w.date}</td><td>${w.amount}</td><td>${w.status}</td></tr>`;
});
wd-history.innerHTML=h+"</table>";
});
}

/* ADMIN */
onSnapshot(collection(db,"withdrawals"),s=>{
let h="<table><tr><th>User</th><th>Amount</th><th>Action</th></tr>";
s.forEach(d=>{
const w=d.data();
h+=`<tr><td>${w.name}</td><td>${w.amount}</td>
<td>${w.status==="Pending"
?`<button onclick="upd('${d.id}','Paid')">✔</button>
<button onclick="upd('${d.id}','Denied')">❌</button>`
:w.status}</td></tr>`;
});
admin-table.innerHTML=h+"</table>";
});

window.upd=(id,st)=>updateDoc(doc(db,"withdrawals",id),{status:st});
