import { movimentoReduzido } from "../core/theme.js";

/** Aplica entrada escalonada aos filhos (usa a classe .stagger e a variável --i). */
export function stagger(container, { max = 12 } = {}) {
    [...container.children].forEach((filho, i) => {
        filho.style.setProperty("--i", Math.min(i, max));
    });
    container.classList.remove("stagger");
    void container.offsetWidth; // reinicia a animação se já tinha rodado
    container.classList.add("stagger");
}

/** Anima o texto de um elemento de um número até outro (contador). */
export function animarNumero(el, destino, { duracao = 900, formatar = (n) => String(n) } = {}) {
    const origem = Number(el.dataset.valor ?? 0);
    el.dataset.valor = String(destino);

    if (movimentoReduzido() || origem === destino) {
        el.textContent = formatar(destino);
        return;
    }

    const inicio = performance.now();
    const passo = (agora) => {
        const t = Math.min((agora - inicio) / duracao, 1);
        const suave = 1 - Math.pow(1 - t, 3); // ease-out cúbico
        el.textContent = formatar(Math.round(origem + (destino - origem) * suave));
        if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
}

/** Dispara uma classe de animação de uso único (.is-pulsing, .is-shaking, .is-highlight). */
export function tocar(el, classe) {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
    el.addEventListener("animationend", () => el.classList.remove(classe), { once: true });
}

export const pulsar = (el) => tocar(el, "is-pulsing");
export const tremer = (el) => tocar(el, "is-shaking");
export const destacar = (el) => tocar(el, "is-highlight");

/**
 * Executa uma mudança de DOM dentro de uma View Transition (mesmo documento),
 * com fallback direto quando não há suporte ou o movimento está reduzido.
 */
export function comTransicao(atualizar) {
    if (!document.startViewTransition || movimentoReduzido()) {
        atualizar();
        return Promise.resolve();
    }
    return document.startViewTransition(atualizar).finished.catch(() => {});
}
