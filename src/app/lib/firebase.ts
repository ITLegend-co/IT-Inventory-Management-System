import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAm2SDI45U4rIvesnduuFQkBigODWkDj0w",
  authDomain: "inventory-5a95d.firebaseapp.com",
  projectId: "inventory-5a95d",
  storageBucket: "inventory-5a95d.firebasestorage.app",
  messagingSenderId: "98816581241",
  appId: "1:98816581241:web:b6cf014c9a3f7f2a493ea8",
  databaseURL: "https://inventory-5a95d-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const FIREBASE_API_KEY = firebaseConfig.apiKey;
