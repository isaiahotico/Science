import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore,doc,setDoc,updateDoc,getDoc,
collection,addDoc,onSnapshot,query,where,limit,getDocs,increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig={
apiKey:"AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
authDomain:"paper-house-inc.firebaseapp.com",
projectId:"paper-house-inc",
storageBucket:"paper-house-inc.appspot.com",
messagingSenderId:"658389836376",
appId:"1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app=initializeApp(firebaseConfig);
const db=getFirestore(app);

const tg=window.Telegram?.WebApp;
tg?.ready();

const tgUser=tg?.initDataUnsafe?.user;
const username=tgUser?`@${tgUser.username||tgUser.first_name}`:"@Guest";
const uid=tgUser?.id?.toString()||"dev";

let uData={balance:0,cooldowns:{},refBy:null};

const uRef=doc(db,"users",uid);

onSnapshot(uRef,s=>{
if(!s.exists()){
setDoc(uRef,{username,balance:0,cooldowns:{},refBy:null});
return;
}
uData=s.data();
userBar.innerText=`👤 ${username}`;
balanceDisplay.innerText=`₱${uData.balance.toFixed(3)}`;
my-ref-id.innerText=username;
current-ref.innerText=uData.refBy||"None";
});

window.go=id=>{
document.querySelectorAll("[id^=page-]").forEach(p=>p.classList.add("hidden"));
document.getElementById(id).classList.remove("hidden");
if(id==="page-withdraw") loadHistory();
if(id==="page-admin") loadAdmin();
};

window.adminAuth=()=>prompt("Admin password")==="Propetas12"?go("page-admin"):alert("Denied");

const TASKS=[
{box:"list-ads",key:"ads",reward:.02,cd:300000},
{box:"list-signin",key:"si",reward:.025,cd:10800000},
{box:"list-gifts",key:"gt",reward:.02,cd:1200000}
];

function render(){
TASKS.forEach(t=>{
const el=document.getElementById(t.box);
el.innerHTML="";
for(let i=1;i<=3;i++){
el.innerHTML+=`
<div class="card">
<button id="btn-${t.key}-${i}" class="btn btn-task" onclick="playAd('${t.key}',${i})">Task ${i}</button>
<div id="cd-${t.key}-${i}" class="cooldown"></div>
<button id="claim-${t.key}-${i}" class="btn btn-claim" onclick="claim('${t.key}',${i},${t.reward},${t.cd})">Claim ₱${t.reward}</button>
</div>`;
}
});
}
render();

window.playAd=(t,i)=>{
const sdk=[show_10276123,show_10337795,show_10337853][i-1];
sdk?.({type:"inApp"});
document.getElementById(`btn-${t}-${i}`).style.display="none";
document.getElementById(`claim-${t}-${i}`).style.display="block";
};

window.claim=async(t,i,amt,cd)=>{
await updateDoc(uRef,{
balance:increment(amt),
cooldowns:{...uData.cooldowns,[`${t}_${i}`]:Date.now()+cd}
});

if(uData.refBy){
const q=query(collection(db,"users"),where("username","==",uData.refBy),limit(1));
const snap=await getDocs(q);
snap.forEach(d=>updateDoc(d.ref,{balance:increment(amt*0.1)}));
}

alert("Reward added");
};

window.setReferrer=async()=>{
const v=document.getElementById("ref-input").value.trim();
if(v===username) return alert("Invalid");
await updateDoc(uRef,{refBy:v});
};

window.handleWD=async()=>{
const amt=+wd-amt.value;
if(amt<=0||amt>uData.balance) return alert("Invalid");
await updateDoc(uRef,{balance:increment(-amt)});
await addDoc(collection(db,"withdrawals"),{
uid,name:username,amount:amt,address:wd-addr.value,method:wd-method.value,status:"Pending",date:new Date().toISOString()
});
};

function loadHistory(){
const q=query(collection(db,"withdrawals"),where("uid","==",uid),limit(10));
onSnapshot(q,s=>{
let h="<table><tr><th>Date</th><th>₱</th><th>Status</th></tr>";
s.forEach(d=>{const w=d.data();h+=`<tr><td>${w.date}</td><td>${w.amount}</td><td>${w.status}</td></tr>`});
wd-history.innerHTML=h+"</table>";
});
}

function loadAdmin(){
onSnapshot(collection(db,"withdrawals"),s=>{
let h="<table><tr><th>User</th><th>Info</th><th>Action</th></tr>";
s.forEach(d=>{
const w=d.data();
h+=`<tr><td>${w.name}</td><td>${w.amount}</td>
<td>${w.status==="Pending"?`<button onclick="upd('${d.id}','Paid')">✔</button>`:w.status}</td></tr>`;
});
admin-table.innerHTML=h+"</table>";
});
}

window.upd=(id,st)=>updateDoc(doc(db,"withdrawals",id),{status:st});
