import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyArxUZCUVaRtsN7yx_tBuq4uSTRbSXsDks",
  authDomain: "portfolio-182f6.firebaseapp.com",
  projectId: "portfolio-182f6",
  storageBucket: "portfolio-182f6.firebasestorage.app",
  messagingSenderId: "9112378004",
  appId: "1:9112378004:web:587cb4d4c0409b8e31f281",
  measurementId: "G-RRGCD2QLLB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

