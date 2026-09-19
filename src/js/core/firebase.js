import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBEaI6PRIxmMHaW_VkAH_oozN1-Z9RPh9k",
    authDomain: "sistemadechamados-2c271.firebaseapp.com",
    projectId: "sistemadechamados-2c271",
    storageBucket: "sistemadechamados-2c271.firebasestorage.app",
    messagingSenderId: "215120397344",
    appId: "1:215120397344:web:67165311411c68fecce845",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
