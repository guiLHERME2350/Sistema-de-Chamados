import { h } from "../utils/dom.js";
import { iniciais } from "../utils/format.js";

/** Matiz estável derivada do nome: a mesma pessoa sempre tem a mesma cor. */
function matiz(texto = "") {
    let hash = 0;
    for (const c of String(texto)) hash = (hash * 31 + c.charCodeAt(0)) % 360;
    return hash;
}

/** @param {string} nome @param {{ tamanho?: "sm"|"lg"|"xl" }} [opcoes] */
export function avatar(nome, { tamanho } = {}) {
    return h(
        "span",
        {
            class: ["avatar", tamanho && `avatar--${tamanho}`],
            style: { "--hue": matiz(nome) },
            title: nome || null,
            "aria-hidden": "true",
        },
        iniciais(nome)
    );
}
