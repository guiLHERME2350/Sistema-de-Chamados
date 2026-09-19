// Importa as funções do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBEaI6PRIxmMHaW_VkAH_oozN1-Z9RPh9k",
  authDomain: "sistemadechamados-2c271.firebaseapp.com",
  projectId: "sistemadechamados-2c271",
  storageBucket: "sistemadechamados-2c271.firebasestorage.app",
  messagingSenderId: "215120397344",
  appId: "1:215120397344:web:67165311411c68fecce845"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta para usar em outros arquivos
export const auth = getAuth(app);
export const db = getFirestore(app);