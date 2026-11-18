import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ⚠️ 아래 값을 Firebase 콘솔에서 복사한 본인의 설정값으로 교체하세요!
const firebaseConfig = {
  apiKey: "AIzaSyD1lm7ayQ4bADt1n1IFjsgLIjQyT9KN2Lw",
  authDomain: "patient-safety-acd93.firebaseapp.com",
  projectId: "patient-safety-acd93",
  storageBucket: "patient-safety-acd93.firebasestorage.app",
  messagingSenderId: "48763502592",
  appId: "1:48763502592:web:b260b561550a5cde7b58e5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);