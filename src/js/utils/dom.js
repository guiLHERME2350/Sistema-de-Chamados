// Criação de elementos sem innerHTML: textos entram como nós de texto,
// então conteúdo digitado pelo usuário nunca é interpretado como HTML.

/**
 * h("a", { class: "btn", href: "#", onClick: fn, dataset: { id: 1 } }, "Texto", outroNo)
 * - class / className, style (string ou objeto), dataset, on<Evento>
 * - atributos com valor false/null/undefined são ignorados; true vira atributo vazio
 * - filhos: string, number, Node, arrays (achatados), null/false (ignorados)
 */
export function h(tag, attrs = {}, ...filhos) {
    const el = document.createElement(tag);

    for (const [chave, valor] of Object.entries(attrs || {})) {
        if (valor === false || valor === null || valor === undefined) continue;

        if (chave === "class" || chave === "className") {
            el.className = Array.isArray(valor) ? valor.filter(Boolean).join(" ") : valor;
        } else if (chave === "style" && typeof valor === "object") {
            for (const [prop, v] of Object.entries(valor)) {
                if (prop.startsWith("--")) el.style.setProperty(prop, v);
                else el.style[prop] = v;
            }
        } else if (chave === "dataset") {
            Object.assign(el.dataset, valor);
        } else if (chave.startsWith("on") && typeof valor === "function") {
            el.addEventListener(chave.slice(2).toLowerCase(), valor);
        } else if (valor === true) {
            el.setAttribute(chave, "");
        } else {
            el.setAttribute(chave, String(valor));
        }
    }

    anexar(el, filhos);
    return el;
}

function anexar(el, filhos) {
    for (const filho of filhos.flat(Infinity)) {
        if (filho === null || filho === undefined || filho === false) continue;
        el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
    }
}

/** Substitui todo o conteúdo de um elemento. */
export function render(alvo, ...filhos) {
    alvo.replaceChildren();
    anexar(alvo, filhos);
    return alvo;
}

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];
