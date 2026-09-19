// Abas acessíveis com indicador deslizante.
// Marcação esperada:
//   <div class="tabs" role="tablist" aria-label="...">
//     <button class="tabs__tab" role="tab" aria-selected="true" data-value="fila">Fila</button>
//     <button class="tabs__tab" role="tab" aria-selected="false" data-value="historico">Histórico</button>
//   </div>
// Uso: const abas = criarAbas(el, { aoMudar: (valor) => ... });  abas.selecionar("historico")

export function criarAbas(container, { aoMudar } = {}) {
    const abas = () => [...container.querySelectorAll('[role="tab"]')];

    let indicador = container.querySelector(".tabs__indicator");
    if (!indicador) {
        indicador = document.createElement("span");
        indicador.className = "tabs__indicator";
        indicador.setAttribute("aria-hidden", "true");
        container.prepend(indicador);
    }

    function posicionar() {
        const ativa = abas().find((a) => a.getAttribute("aria-selected") === "true");
        if (!ativa) return;
        container.style.setProperty("--indicator-x", `${ativa.offsetLeft}px`);
        container.style.setProperty("--indicator-w", `${ativa.offsetWidth}px`);
    }

    function selecionar(valor, { focar = false, notificar = true } = {}) {
        for (const aba of abas()) {
            const ativa = aba.dataset.value === valor;
            aba.setAttribute("aria-selected", String(ativa));
            aba.tabIndex = ativa ? 0 : -1;
            if (ativa && focar) aba.focus();
        }
        posicionar();
        if (notificar) aoMudar?.(valor);
    }

    container.addEventListener("click", (e) => {
        const aba = e.target.closest('[role="tab"]');
        if (aba && aba.getAttribute("aria-selected") !== "true") selecionar(aba.dataset.value);
    });

    // Setas esquerda/direita, Home/End (padrão WAI-ARIA)
    container.addEventListener("keydown", (e) => {
        const lista = abas();
        const atual = lista.indexOf(document.activeElement);
        if (atual < 0) return;
        let proxima = null;
        if (e.key === "ArrowRight") proxima = lista[(atual + 1) % lista.length];
        if (e.key === "ArrowLeft") proxima = lista[(atual - 1 + lista.length) % lista.length];
        if (e.key === "Home") proxima = lista[0];
        if (e.key === "End") proxima = lista[lista.length - 1];
        if (proxima) {
            e.preventDefault();
            selecionar(proxima.dataset.value, { focar: true });
        }
    });

    new ResizeObserver(posicionar).observe(container);
    document.fonts?.ready.then(posicionar);

    const inicial = abas().find((a) => a.getAttribute("aria-selected") === "true") || abas()[0];
    if (inicial) selecionar(inicial.dataset.value, { notificar: false });

    return { selecionar, posicionar };
}
