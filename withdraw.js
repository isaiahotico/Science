import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, addDoc, collection, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const withdrawCol = collection(db,"withdrawals");

// Load balance
onSnapshot(userRef,s=>{
  document.getElementById('balance').innerText = (s.data().balance||0).toFixed(3);
});

// Withdraw function
window.withdraw = async ()=>{
  const gcash = document.getElementById('gcash').value;
  const amount = parseFloat(document.getElementById('amount').value);
  if(!gcash || !amount || amount<=0){
    alert("Enter valid GCash number and amount");
    return;
  }

  const userDoc = await getDoc(userRef);
  const balance = userDoc.data().balance || 0;
  if(amount>balance){
    alert("Insufficient balance");
    return;
  }

  // Deduct balance immediately
  await setDoc(userRef,{balance:balance-amount},{merge:true});

  // Add withdrawal request
  await addDoc(withdrawCol,{
    uid,
    username:user?.username||"Guest",
    gcash,
    amount,
    status:"Pending",
    timestamp:serverTimestamp()
  });
  alert("Withdrawal request sent!");

  document.getElementById('gcash').value = "";
  document.getElementById('amount').value = "";
};

// Real-time history
const tbody = document.querySelector('#history tbody');
onSnapshot(withdrawCol,qSnap=>{
  tbody.innerHTML="";
  qSnap.forEach(doc=>{
    const d = doc.data();
    if(d.uid===uid){
      const time = d.timestamp?.toDate().toLocaleString()||"";
      tbody.innerHTML += `<tr>
        <td>${d.username}</td>
        <td>${d.amount}</td>
        <td>${d.gcash}</td>
        <td>${d.status}</td>
        <td>${time}</td>
      </tr>`;
    }
  });
});
