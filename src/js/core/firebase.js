import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBEaI6PRIxmMHaW_VkAH_oozN1-Z9RPh9k",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sistemadechamados-2c271.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sistemadechamados-2c271",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sistemadechamados-2c271.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "215120397344",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:215120397344:web:67165311411c68fecce845",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// App Check (reCAPTCHA v3): só ativa se a site key estiver configurada.
// Sem a key, o app funciona normalmente — ative após registrar o site no Console.
if (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY) {
    import("firebase/app-check")
        .then(({ initializeAppCheck, ReCaptchaV3Provider }) =>
            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY),
                isTokenAutoRefreshEnabled: true,
            })
        )
        .catch(() => {});
}
