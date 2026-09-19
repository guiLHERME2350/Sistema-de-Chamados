import { Inbox } from "lucide";
import { h } from "../utils/dom.js";
import { icon } from "../utils/icons.js";

/**
 * estadoVazio({ icone: Inbox, titulo: "Nenhum chamado", texto: "...", acao: { label: "Abrir chamado", href: "abrir-chamado.html" } })
 * acao também aceita onClick no lugar de href.
 */
export function estadoVazio({ icone = Inbox, titulo, texto, acao, tom } = {}) {
    let botao = null;
    if (acao) {
        const attrs = { class: `btn ${acao.variante || "btn--primary"}` };
        botao = acao.href
            ? h("a", { ...attrs, href: acao.href }, acao.icone && icon(acao.icone), acao.label)
            : h("button", { ...attrs, type: "button", onClick: acao.onClick }, acao.icone && icon(acao.icone), acao.label);
    }

    return h(
        "div",
        { class: "empty-state", dataset: tom ? { tone: tom } : {} },
        h("div", { class: "empty-state__icon" }, icon(icone)),
        titulo && h("h3", { class: "empty-state__title" }, titulo),
        texto && h("p", { class: "empty-state__text" }, texto),
        botao
    );
}
