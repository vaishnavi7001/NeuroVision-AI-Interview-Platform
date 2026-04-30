
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
    authDomain: 'neurodev-57a41.firebaseapp.com',
    projectId: 'neurodev-57a41',
    storageBucket: 'neurodev-57a41.firebasestorage.app',
    messagingSenderId: '1012685138989',
    appId: '1:1012685138989:web:4f6800a0f164b2854d9ca4',
}

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider()

export {auth , provider}