// Notificações não bloqueantes (substituem alert()).
//   toast.success("Chamado criado", { message: "Número #0042" })
//   toast.error("Não foi possível enviar")
//   toast.info("...", { action: { label: "Desfazer", onClick } , duration: 8000 })
//   toast.flash("success", "Chamado criado")  → exibido na PRÓXIMA página carregada

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide";
import { h } from "../utils/dom.js";
import { icon } from "../utils/icons.js";

const ICONES = { success: CircleCheck, error: CircleAlert, info: Info, warning: TriangleAlert };
const CHAVE_FLASH = "hd:flash";

let regiao;

function obterRegiao() {
    if (regiao?.isConnected) return regiao;
    regiao = h("div", { class: "toast-region", role: "region", "aria-label": "Notificações" });
    // Duas regiões vivas: erros interrompem o leitor de tela, o resto espera
    regiao.politeLive = h("div", { class: "sr-only", "aria-live": "polite" });
    regiao.assertiveLive = h("div", { class: "sr-only", "aria-live": "assertive" });
    document.body.append(regiao, regiao.politeLive, regiao.assertiveLive);
    return regiao;
}

function mostrar(tom, titulo, { message, action, duration = 5000 } = {}) {
    const alvo = obterRegiao();

    const fechar = () => {
        if (el.classList.contains("is-leaving")) return;
        el.classList.add("is-leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 400); // garantia quando a animação está desligada
    };

    const el = h(
        "div",
        { class: "toast", dataset: { tone: tom } },
        h("span", { class: "toast__icon" }, icon(ICONES[tom] || Info)),
        h(
            "div",
            { class: "toast__body" },
            h("strong", { class: "toast__title" }, titulo),
            message && h("span", { class: "toast__message" }, message)
        ),
        h(
            "div",
            { class: "toast__actions" },
            action &&
                h(
                    "button",
                    {
                        class: "btn btn--ghost btn--sm",
                        type: "button",
                        onClick: () => {
                            action.onClick?.();
                            fechar();
                        },
                    },
                    action.label
                ),
            h(
                "button",
                { class: "btn btn--ghost btn--icon btn--sm", type: "button", "aria-label": "Fechar notificação", onClick: fechar },
                icon(X, { size: 16 })
            )
        ),
        duration > 0 && h("span", { class: "toast__progress", style: { animationDuration: `${duration}ms` } })
    );

    alvo.append(el);

    const live = tom === "error" ? alvo.assertiveLive : alvo.politeLive;
    live.textContent = message ? `${titulo}. ${message}` : titulo;

    if (duration > 0) {
        let restante = duration;
        let inicio = Date.now();
        let timer = setTimeout(fechar, restante);
        el.addEventListener("mouseenter", () => {
            clearTimeout(timer);
            restante -= Date.now() - inicio;
        });
        el.addEventListener("mouseleave", () => {
            inicio = Date.now();
            timer = setTimeout(fechar, Math.max(restante, 1000));
        });
    }

    return { fechar };
}

function flash(tom, titulo, opcoes = {}) {
    try {
        sessionStorage.setItem(CHAVE_FLASH, JSON.stringify({ tom, titulo, message: opcoes.message }));
    } catch {
        // sem sessionStorage: a mensagem se perde, mas a navegação segue
    }
}

/** Mostra o toast agendado por toast.flash() na página anterior. Chamado pelo shell. */
export function exibirFlashPendente() {
    try {
        const pendente = JSON.parse(sessionStorage.getItem(CHAVE_FLASH) || "null");
        if (!pendente) return;
        sessionStorage.removeItem(CHAVE_FLASH);
        mostrar(pendente.tom, pendente.titulo, { message: pendente.message });
    } catch {
        // ignora flash corrompido
    }
}

export const toast = {
    success: (titulo, opcoes) => mostrar("success", titulo, opcoes),
    error: (titulo, opcoes) => mostrar("error", titulo, opcoes),
    info: (titulo, opcoes) => mostrar("info", titulo, opcoes),
    warning: (titulo, opcoes) => mostrar("warning", titulo, opcoes),
    flash,
};
