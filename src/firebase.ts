import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  User,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';

// Credentials derived from firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0178091746",
  appId: "1:295127096207:web:38dc48053b27db780a89fa",
  apiKey: "AIzaSyB1NhTgWMxlm9Fh8-4Rwg9Dn6D6QKjZTXY",
  authDomain: "gen-lang-client-0178091746.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-ed8562c8-bf77-43a5-84cf-6f5d55101b6d",
  storageBucket: "gen-lang-client-0178091746.firebasestorage.app",
  messagingSenderId: "295127096207",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  serverTimestamp
};
export type { User };
