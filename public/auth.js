// auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: 'AIzaSyBBAbq0_GYTPQkKlOEX3MJp9Vzj3ZzyJ6I',
  authDomain: 'app-facil-87595.firebaseapp.com',
  projectId: 'app-facil-87595',
  storageBucket: 'app-facil-87595.firebasestorage.app',
  messagingSenderId: '775213961118',
  appId: '1:775213961118:web:9ee69152052367b5e1d08f',
  measurementId: 'G-WXKQRJY766'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.checkToken = async function() {
  const token = document.getElementById("tokenInput").value.trim();
  if (!token) {
    alert("Digite um token.");
    return;
  }
  const docRef = doc(db, "tokens", token);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("homeScreen").style.display = "block";
  } else {
    alert("Token inválido.");
  }
};