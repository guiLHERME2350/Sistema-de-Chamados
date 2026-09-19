// Diálogo de confirmação com <dialog> nativo (foco preso, Esc fecha).
//   if (await confirmar({ titulo: "Resolver chamado #0042?", mensagem: "...", confirmar: "Resolver", tom: "success" })) { ... }

import { CircleCheck, CircleHelp, TriangleAlert } from "lucide";
import { h } from "../utils/dom.js";
import { icon } from "../utils/icons.js";

const ICONES = { danger: TriangleAlert, success: CircleCheck, brand: CircleHelp, warning: TriangleAlert };
const BOTOES = { danger: "btn--danger", success: "btn--success", brand: "btn--primary", warning: "btn--primary" };

/**
 * @param {{ titulo: string, mensagem?: string, confirmar?: string, cancelar?: string, tom?: "brand"|"danger"|"success"|"warning" }} opcoes
 * @returns {Promise<boolean>}
 */
export function confirmar({ titulo, mensagem, confirmar: rotuloOk = "Confirmar", cancelar = "Cancelar", tom = "brand" }) {
    return new Promise((resolve) => {
        const idTitulo = `dlg-t-${Date.now()}`;
        const idMsg = `dlg-m-${Date.now()}`;

        const btnOk = h("button", { class: `btn ${BOTOES[tom] || "btn--primary"}`, type: "submit", value: "ok" }, rotuloOk);

        const dialogo = h(
            "dialog",
            { class: "dialog", "aria-labelledby": idTitulo, "aria-describedby": mensagem ? idMsg : null },
            h(
                "form",
                { method: "dialog" },
                h(
                    "div",
                    { class: "dialog__body" },
                    h("span", { class: "dialog__icon", dataset: { tone: tom } }, icon(ICONES[tom] || CircleHelp)),
                    h("h2", { class: "dialog__title", id: idTitulo }, titulo),
                    mensagem && h("p", { class: "dialog__message", id: idMsg }, mensagem)
                ),
                h(
                    "div",
                    { class: "dialog__footer" },
                    h("button", { class: "btn btn--ghost", type: "submit", value: "cancelar" }, cancelar),
                    btnOk
                )
            )
        );

        dialogo.addEventListener("close", () => {
            resolve(dialogo.returnValue === "ok");
            setTimeout(() => dialogo.remove(), 300); // espera a animação de saída
        });

        // Clique no fundo fecha
        dialogo.addEventListener("click", (e) => {
            if (e.target === dialogo) dialogo.close("cancelar");
        });

        document.body.append(dialogo);
        dialogo.showModal();
        btnOk.focus();
    });
}
