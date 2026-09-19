// Acesso à coleção "chamados". As páginas nunca importam o Firestore diretamente.
// Os documentos são normalizados: Timestamps viram Date e os nomes ficam consistentes.

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "../core/firebase.js";
import { paraData } from "../utils/format.js";

/**
 * @typedef {Object} Chamado
 * @property {string} id
 * @property {number|null} numero
 * @property {string} titulo
 * @property {string} categoria
 * @property {string} descricao
 * @property {string} prioridade
 * @property {"aberto"|"analise"|"resolvido"} status
 * @property {string} usuarioId
 * @property {string} usuarioNome
 * @property {string} usuarioEmail
 * @property {string|null} tecnicoId
 * @property {string|null} tecnicoNome
 * @property {Date|null} dataCriacao
 * @property {Date|null} dataAssumido
 * @property {Date|null} dataResolucao
 */

const colecao = collection(db, "chamados");

/** @returns {Chamado} */
function normalizar(snapshot) {
    const d = snapshot.data();
    return {
        id: snapshot.id,
        numero: d.numeroChamado ?? null,
        titulo: d.titulo || "(sem título)",
        categoria: d.categoria || "",
        descricao: d.descricao || "",
        prioridade: d.prioridade || "",
        status: d.status || "aberto",
        usuarioId: d.usuarioId || "",
        usuarioNome: d.usuarioNome || "",
        usuarioEmail: d.usuarioEmail || "",
        tecnicoId: d.tecnicoId || null,
        tecnicoNome: d.tecnicoNome || null,
        // serverTimestamp ainda pendente (escrita local) → usa a hora atual
        dataCriacao: paraData(d.dataCriacao) || (snapshot.metadata?.hasPendingWrites ? new Date() : null),
        dataAssumido: paraData(d.dataAssumido),
        dataResolucao: paraData(d.dataResolucao),
    };
}

// Ordenação no cliente evita exigir índices compostos no Firestore.
function maisRecentesPrimeiro(a, b) {
    return (b.dataCriacao?.getTime() ?? 0) - (a.dataCriacao?.getTime() ?? 0);
}

/** Usuário comum só enxerga os próprios chamados; técnico e admin veem todos. */
function consultaPorPerfil(perfil) {
    return perfil.role === "usuario"
        ? query(colecao, where("usuarioId", "==", perfil.uid))
        : query(colecao);
}

/** @returns {Promise<Chamado[]>} */
export async function listarChamados(perfil) {
    const snapshot = await getDocs(consultaPorPerfil(perfil));
    return snapshot.docs.map(normalizar).sort(maisRecentesPrimeiro);
}

/**
 * Observa os chamados em tempo real.
 * @param {(chamados: Chamado[], mudancas: {tipo: string, id: string}[]) => void} callback
 * @returns {() => void} função para parar de observar
 */
export function observarChamados(perfil, callback, aoErrar = console.error) {
    let primeiro = true;
    return onSnapshot(
        consultaPorPerfil(perfil),
        (snapshot) => {
            const chamados = snapshot.docs.map(normalizar).sort(maisRecentesPrimeiro);
            const mudancas = primeiro
                ? []
                : snapshot.docChanges().map((c) => ({ tipo: c.type, id: c.doc.id }));
            primeiro = false;
            callback(chamados, mudancas);
        },
        aoErrar
    );
}

/** @returns {Promise<Chamado|null>} */
export async function obterChamado(id) {
    const snapshot = await getDoc(doc(db, "chamados", id));
    return snapshot.exists() ? normalizar(snapshot) : null;
}

/**
 * @param {(chamado: Chamado|null) => void} callback
 * @returns {() => void}
 */
export function observarChamado(id, callback, aoErrar = console.error) {
    return onSnapshot(
        doc(db, "chamados", id),
        (snapshot) => callback(snapshot.exists() ? normalizar(snapshot) : null),
        aoErrar
    );
}

/** Usuário comum só pode abrir os próprios chamados. */
export function podeVerChamado(chamado, perfil) {
    return perfil.role !== "usuario" || chamado.usuarioId === perfil.uid;
}

/**
 * Cria o chamado com número sequencial (contador em Configurações/Contadorchamados).
 * @returns {Promise<{id: string, numero: number}>}
 */
export async function criarChamado({ titulo, categoria, descricao, prioridade }, perfil) {
    const contadorRef = doc(db, "Configurações", "Contadorchamados");

    const numero = await runTransaction(db, async (transacao) => {
        const contador = await transacao.get(contadorRef);
        const novo = (contador.exists() ? Number(contador.data().ultimoNumero) || 0 : 0) + 1;
        if (contador.exists()) transacao.update(contadorRef, { ultimoNumero: novo });
        else transacao.set(contadorRef, { ultimoNumero: novo });
        return novo;
    });

    const ref = await addDoc(colecao, {
        numeroChamado: numero,
        titulo,
        categoria,
        descricao,
        prioridade,
        status: "aberto",
        usuarioId: perfil.uid,
        usuarioNome: perfil.nome,
        usuarioEmail: perfil.email,
        dataCriacao: serverTimestamp(),
    });

    return { id: ref.id, numero };
}

/** Técnico/admin assume o chamado → status "analise". */
export function assumirChamado(id, perfil) {
    return updateDoc(doc(db, "chamados", id), {
        status: "analise",
        tecnicoId: perfil.uid,
        tecnicoNome: perfil.nome,
        dataAssumido: serverTimestamp(),
    });
}

/** Marca como resolvido. */
export function resolverChamado(id) {
    return updateDoc(doc(db, "chamados", id), {
        status: "resolvido",
        dataResolucao: serverTimestamp(),
    });
}

/** Volta um chamado resolvido para "analise" (mantém o técnico). */
export function reabrirChamado(id) {
    return updateDoc(doc(db, "chamados", id), {
        status: "analise",
        dataResolucao: null,
    });
}

/**
 * Muda o status aplicando as regras de cada transição (usado pelo Kanban).
 * aberto → analise: assume · analise → resolvido: resolve · resolvido → analise: reabre
 * analise → aberto: devolve para a fila (remove o técnico)
 */
export function moverChamado(chamado, novoStatus, perfil) {
    if (chamado.status === novoStatus) return Promise.resolve();
    if (novoStatus === "analise" && chamado.status === "aberto") return assumirChamado(chamado.id, perfil);
    if (novoStatus === "analise" && chamado.status === "resolvido") return reabrirChamado(chamado.id);
    if (novoStatus === "resolvido") {
        // Resolver direto da fila também registra quem atendeu
        const extras = chamado.tecnicoId
            ? {}
            : { tecnicoId: perfil.uid, tecnicoNome: perfil.nome, dataAssumido: serverTimestamp() };
        return updateDoc(doc(db, "chamados", chamado.id), {
            status: "resolvido",
            dataResolucao: serverTimestamp(),
            ...extras,
        });
    }
    if (novoStatus === "aberto") {
        return updateDoc(doc(db, "chamados", chamado.id), {
            status: "aberto",
            tecnicoId: null,
            tecnicoNome: null,
            dataAssumido: null,
            dataResolucao: null,
        });
    }
    return Promise.reject(new Error(`Transição inválida: ${chamado.status} → ${novoStatus}`));
}
