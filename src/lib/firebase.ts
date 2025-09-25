// src/lib/firebase.ts
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: "cosmic-raid-app.firebaseapp.com",
  projectId: "cosmic-raid-app",
  storageBucket: "cosmic-raid-app.firebasestorage.app",
  messagingSenderId: "412519609799",
  appId: "1:412519609799:web:4c39c37bca30f7f50655e2",
  measurementId: "G-9T9MRKLE79"
};

// Client-side initialization.
function getClientApp() {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

const app = getClientApp();
const auth = getAuth(app);
const db = getFirestore(app);


export { db, auth, getClientApp };
