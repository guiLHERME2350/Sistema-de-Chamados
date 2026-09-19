import { h } from "../utils/dom.js";

/** Um bloco de skeleton. */
export function skeleton({ w = "100%", h: altura = "14px", r, circle = false } = {}) {
    return h("span", {
        class: ["skeleton", circle && "skeleton--circle"],
        style: { "--w": w, "--h": altura, ...(r ? { "--r": r } : {}) },
        "aria-hidden": "true",
    });
}

/** N linhas de texto com larguras variadas. */
export function skeletonLinhas(n = 3) {
    const larguras = ["92%", "78%", "85%", "64%", "70%"];
    return Array.from({ length: n }, (_, i) => skeleton({ w: larguras[i % larguras.length] }));
}

/** N cards genéricos (título + 2 linhas). */
export function skeletonCards(n = 3) {
    return Array.from({ length: n }, () =>
        h(
            "div",
            { class: "skeleton-card", "aria-hidden": "true" },
            skeleton({ w: "40%", h: "12px" }),
            skeleton({ w: "70%", h: "20px" }),
            skeleton({ w: "90%" })
        )
    );
}

/** N linhas de tabela/lista (avatar + textos + badge). */
export function skeletonLinhasLista(n = 5) {
    return Array.from({ length: n }, () =>
        h(
            "div",
            { class: "skeleton-row", "aria-hidden": "true" },
            skeleton({ w: "56px", h: "14px" }),
            h("div", { style: { flex: "1", display: "grid", gap: "8px" } }, skeleton({ w: "60%" }), skeleton({ w: "35%", h: "10px" })),
            skeleton({ w: "80px", h: "22px", r: "999px" })
        )
    );
}

/** Container acessível: anuncia "Carregando…" para leitores de tela. */
export function carregando(...filhos) {
    return h("div", { role: "status", "aria-live": "polite", class: "stack" }, h("span", { class: "sr-only" }, "Carregando…"), ...filhos);
}
