import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
console.log("Firebase conectado!");
console.log(auth);
console.log(db);


const formulario = document.querySelector("form");

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("emailusuario").value.trim();
    const senha = document.getElementById("senhausuario").value.trim();

    if (!email || !senha) {
        alert("Preencha todos os campos!");
        return;
    }

    try {

        await signInWithEmailAndPassword(auth, email, senha);

        alert("Login realizado com sucesso!");

        window.location.href = "dashboard.html";

    } catch (error) {

        alert("E-mail ou senha inválidos.");

        console.error(error);

    }
});
