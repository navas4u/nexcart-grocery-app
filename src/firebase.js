// src/firebase.js - UPDATED
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC3PlOyCMnoBToiy4aMEtC9_2OloIZXDIc",
  authDomain: "nexcart-ace30.firebaseapp.com",
  projectId: "nexcart-ace30",
  storageBucket: "nexcart-ace30.firebasestorage.app",
  messagingSenderId: "1098073678577",
  appId: "1:1098073678577:web:380fde605e7dd9dd69bf50"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, auth, db, storage };