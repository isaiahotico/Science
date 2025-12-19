import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase
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

const pass = prompt("Enter Admin Password");
if(pass!=="Propetas6") location.href="index.html";

const withdrawCol = collection(db,"withdrawals");
const tbody = document.querySelector('#adminTable tbody');

// Real-time updates
onSnapshot(withdrawCol,qSnap=>{
  tbody.innerHTML="";
  qSnap.forEach(doc=>{
    const d = doc.data();
    const time = d.timestamp?.toDate().toLocaleString()||"";
    tbody.innerHTML += `<tr>
      <td>${d.username}</td>
      <td>${d.amount}</td>
      <td>${d.gcash}</td>
      <td>${d.status}</td>
      <td>${time}</td>
      <td>
        ${d.status==="Pending"?`<button onclick="approve('${doc.id}',${d.amount},'${d.uid}')">Approve</button>
        <button onclick="deny('${doc.id}')">Deny</button>`:""}
      </td>
    </tr>`;
  });
});

// Approve
window.approve = async (id,amount,uid)=>{
  const userRef = doc(db,"users",uid);
  await updateDoc(doc(db,"withdrawals",id),{status:"Approved"});
  alert("Withdrawal Approved!");
}

// Deny
window.deny = async (id)=>{
  await updateDoc(doc(db,"withdrawals",id),{status:"Denied"});
  alert("Withdrawal Denied!");
}
