import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDDTOTQDYxbpRT547Cf0-hO014pl3T3JUo",
    authDomain: "studymeter.app",
    projectId: "mi-planner-88ef4",
    storageBucket: "mi-planner-88ef4.firebasestorage.app",
    messagingSenderId: "252241778516",
    appId: "1:252241778516:web:e87349948d01f34ca59ac1",
    measurementId: "G-JGWJFMWD9M"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
