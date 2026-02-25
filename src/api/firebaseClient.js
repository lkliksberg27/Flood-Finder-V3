import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCfoIbFD9CtJ0BJHwT3ybjvPH84DJ_IwbU",
  authDomain: "flood-finder-v3.firebaseapp.com",
  projectId: "flood-finder-v3",
  storageBucket: "flood-finder-v3.firebasestorage.app",
  messagingSenderId: "427348600454",
  appId: "1:427348600454:web:735b1e563816463b62d307",
  measurementId: "G-0P3F9KJD1E"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
