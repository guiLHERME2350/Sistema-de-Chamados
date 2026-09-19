import { STATUS, categoriaInfo, prioridadeInfo } from "../utils/constants.js";
import { h } from "../utils/dom.js";
import { icon } from "../utils/icons.js";

/** <span class="badge" data-tone="info" data-status="aberto">● Aberto</span> */
export function badgeStatus(status) {
    const info = STATUS[status] || { label: status || "—", tone: "neutral" };
    return h(
        "span",
        { class: "badge", dataset: { tone: info.tone, status: status || "" } },
        h("span", { class: "badge__dot", "aria-hidden": "true" }),
        info.label
    );
}

export function badgePrioridade(valor, { outline = true } = {}) {
    const info = prioridadeInfo(valor);
    return h(
        "span",
        { class: ["badge", outline && "badge--outline"], dataset: { tone: info.tone }, title: info.dica || null },
        h("span", { class: "badge__dot", "aria-hidden": "true" }),
        info.valor
    );
}

export function badgeCategoria(valor) {
    const info = categoriaInfo(valor);
    return h("span", { class: "badge", dataset: { tone: "neutral" } }, icon(info.icon), valor || info.valor);
}

/** Atualiza um badge de status existente com transição de cor (sem recriar o nó). */
export function atualizarBadgeStatus(el, status) {
    const info = STATUS[status] || { label: status, tone: "neutral" };
    el.dataset.tone = info.tone;
    el.dataset.status = status;
    el.lastChild.textContent = info.label;
}
