// Sessão: login, logout e guarda de páginas por papel.
// O perfil (coleção "users") é buscado uma vez e fica em cache no sessionStorage,
// para que a navegação entre páginas não refaça a consulta.

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase.js";

const CHAVE_CACHE = "hd:perfil";

export const TODOS_OS_PAPEIS = ["usuario", "tecnico", "admin"];

/**
 * @typedef {Object} Perfil
 * @property {string} uid
 * @property {string} nome
 * @property {string} email
 * @property {"usuario"|"tecnico"|"admin"} role
 */

/** Resolve com o usuário do Firebase Auth (ou null) assim que o estado inicial for conhecido. */
function aguardarAuth() {
    return new Promise((resolve) => {
        const parar = onAuthStateChanged(auth, (usuario) => {
            parar();
            resolve(usuario);
        });
    });
}

/** Perfil em cache, se houver — permite desenhar o shell antes da confirmação do login. */
export function perfilEmCache() {
    try {
        const perfil = JSON.parse(sessionStorage.getItem(CHAVE_CACHE) || "null");
        return perfil?.uid ? perfil : null;
    } catch {
        return null;
    }
}

function salvarCache(perfil) {
    try {
        sessionStorage.setItem(CHAVE_CACHE, JSON.stringify(perfil));
    } catch {
        // sem cache: cada página consulta o Firestore
    }
}

function limparCache() {
    try {
        sessionStorage.removeItem(CHAVE_CACHE);
    } catch {
        // nada a limpar
    }
}

// TODO(backend): trocar a varredura da coleção por doc(db, "users", uid).
async function buscarPerfil(usuario) {
    const emailAtual = usuario.email?.trim().toLowerCase();
    const snapshot = await getDocs(collection(db, "users"));
    const documento = snapshot.docs.find(
        (d) => String(d.data().Email || "").trim().toLowerCase() === emailAtual
    );

    if (!documento) return null;

    const dados = documento.data();
    return {
        uid: usuario.uid,
        nome: dados.Nome || usuario.email,
        email: dados.Email || usuario.email,
        role: dados.role,
    };
}

/**
 * Garante que há alguém logado e com um dos papéis permitidos.
 * Redireciona para o login (sem sessão) ou para o dashboard (sem permissão).
 * @param {string[]} papeis
 * @returns {Promise<Perfil>}
 */
export async function exigirSessao(papeis = TODOS_OS_PAPEIS) {
    const usuario = await aguardarAuth();

    if (!usuario) {
        limparCache();
        window.location.replace("index.html");
        return new Promise(() => {}); // a página não continua
    }

    let perfil = perfilEmCache();
    if (!perfil || perfil.uid !== usuario.uid) {
        perfil = await buscarPerfil(usuario);
        if (!perfil) {
            console.error("Usuário não encontrado na coleção users.");
            await sair();
            return new Promise(() => {});
        }
        salvarCache(perfil);
    }

    if (!papeis.includes(perfil.role)) {
        window.location.replace("dashboard.html");
        return new Promise(() => {});
    }

    return perfil;
}

/** Faz login e já deixa o perfil em cache. Lança o erro do Firebase em caso de falha. */
export async function entrar(email, senha) {
    const { user } = await signInWithEmailAndPassword(auth, email, senha);
    const perfil = await buscarPerfil(user);
    if (!perfil) {
        await signOut(auth);
        const erro = new Error("Perfil não encontrado.");
        erro.code = "app/perfil-nao-encontrado";
        throw erro;
    }
    salvarCache(perfil);
    return perfil;
}

export async function sair() {
    limparCache();
    await signOut(auth);
    window.location.replace("index.html");
}

/** Na tela de login: se já existe sessão, vai direto para o dashboard. */
export async function redirecionarSeLogado() {
    const usuario = await aguardarAuth();
    if (usuario) window.location.replace("dashboard.html");
}
