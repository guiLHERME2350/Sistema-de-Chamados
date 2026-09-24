// Sessão: login, logout e guarda de páginas por papel.
// O perfil (coleção "users") é buscado uma vez e fica em cache no sessionStorage,
// para que a navegação entre páginas não refaça a consulta.

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { logError } from "../utils/logger.js";

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

// Busca o perfil por UID (doc `users/{uid}`); mantém fallback por Email
// para bases antigas onde o doc ainda não usa o UID como ID.
async function buscarPerfil(usuario) {
    // 1. Caminho novo e barato: get direto, 1 leitura.
    try {
        const direto = await getDoc(doc(db, "users", usuario.uid));
        if (direto.exists()) {
            const dados = direto.data();
            const role = String(dados.role || "").trim().toLowerCase();
            if (!TODOS_OS_PAPEIS.includes(role)) {
                logError({ code: "app/papel-invalido" }, "session:buscarPerfil");
                return null;
            }
            return {
                uid: usuario.uid,
                nome: dados.Nome || dados.nome || usuario.email,
                email: dados.Email || dados.email || usuario.email,
                role,
            };
        }
    } catch {
        // sem permissão ou fora do ar: tenta o fallback abaixo
    }

    // 2. Fallback transitório: query filtrada por Email (exige índice simples,
    // 1 leitura por doc correspondente). Remover quando todos os users forem `users/{uid}`.
    const emailAtual = usuario.email?.trim().toLowerCase();
    if (!emailAtual) return null;
    const snapshot = await getDocs(
        query(collection(db, "users"), where("Email", "==", usuario.email), limit(5))
    );
    const documento =
        snapshot.docs.find(
            (d) => String(d.data().Email || "").trim().toLowerCase() === emailAtual
        ) || snapshot.docs[0];

    if (!documento) return null;

    const dados = documento.data();
    // O campo no Firestore pode vir com maiúscula/espaço ("Admin", "tecnico ").
    // Normaliza para o contrato do app: "usuario" | "tecnico" | "admin".
    const role = String(dados.role || "").trim().toLowerCase();
    if (!TODOS_OS_PAPEIS.includes(role)) {
        logError({ code: "app/papel-invalido" }, "session:buscarPerfil");
        return null;
    }
    return {
        uid: usuario.uid,
        nome: dados.Nome || dados.nome || usuario.email,
        email: dados.Email || dados.email || usuario.email,
        role,
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
    // Normaliza cache antigo ("Admin", "tecnico ") para o contrato em minúsculas.
    if (perfil) {
        perfil.role = String(perfil.role || "").trim().toLowerCase();
        if (perfil.uid !== usuario.uid || !TODOS_OS_PAPEIS.includes(perfil.role)) {
            perfil = null;
        }
    }
    if (!perfil) {
        perfil = await buscarPerfil(usuario);
        if (!perfil) {
            logError({ code: "app/perfil-nao-encontrado" }, "session:exigirSessao");
            await sair();
            return new Promise(() => {});
        }
        salvarCache(perfil);
    }

    if (!papeis.includes(perfil.role)) {
        // O papel pode ter sido promovido no Firestore depois do login
        // (ex.: usuario → admin) e o cache ainda tem o papel antigo.
        // Confere uma vez no servidor antes de expulsar para o dashboard.
        const atual = await buscarPerfil(usuario).catch(() => null);
        if (atual && atual.role !== perfil.role) {
            perfil = atual;
            salvarCache(perfil);
        }
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
