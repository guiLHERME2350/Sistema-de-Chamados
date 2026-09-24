// Subcoleção chamados/{id}/mensagens.

import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "../core/firebase.js";
import { paraData } from "../utils/format.js";
import { silentError } from "../utils/logger.js";

/**
 * @typedef {Object} Mensagem
 * @property {string} id
 * @property {string} texto
 * @property {string} usuarioId
 * @property {string} usuarioNome
 * @property {Date|null} data
 * @property {boolean} editada
 * @property {boolean} pendente  escrita ainda não confirmada pelo servidor
 */

const ref = (chamadoId) => collection(db, "chamados", chamadoId, "mensagens");

/** @returns {Mensagem} */
function normalizar(snapshot) {
    const d = snapshot.data({ serverTimestamps: "estimate" });
    return {
        id: snapshot.id,
        texto: d.texto || "",
        usuarioId: d.usuarioId || "",
        usuarioNome: d.usuarioNome || "Usuário",
        data: paraData(d.data),
        editada: Boolean(d.editada),
        pendente: snapshot.metadata.hasPendingWrites,
    };
}

/**
 * Observa as mensagens em ordem cronológica.
 * @param {(mensagens: Mensagem[], novas: string[]) => void} callback  novas = ids adicionados após a 1ª carga
 * @returns {() => void}
 */
export function observarMensagens(chamadoId, callback, aoErrar = silentError) {
    let primeiro = true;
    return onSnapshot(
        query(ref(chamadoId), orderBy("data", "asc")),
        { includeMetadataChanges: true },
        (snapshot) => {
            const novas = primeiro
                ? []
                : snapshot.docChanges().filter((c) => c.type === "added").map((c) => c.doc.id);
            primeiro = false;
            callback(snapshot.docs.map(normalizar), novas);
        },
        aoErrar
    );
}

export function enviarMensagem(chamadoId, texto, perfil) {
    const conteudo = String(texto || "").trim();
    if (!conteudo) return Promise.reject(new Error("Mensagem vazia."));
    if (!perfil?.uid) return Promise.reject(new Error("Sem perfil para enviar a mensagem."));
    return addDoc(ref(chamadoId), {
        texto: conteudo,
        usuarioId: perfil.uid,
        usuarioNome: perfil.nome,
        data: serverTimestamp(),
    });
}

export function editarMensagem(chamadoId, mensagemId, texto) {
    return updateDoc(doc(db, "chamados", chamadoId, "mensagens", mensagemId), {
        texto,
        editada: true,
        dataEdicao: serverTimestamp(),
    });
}
