// Paleta de comandos (Ctrl+K, "/" ou botões [data-abrir-paleta]).
// Carregada sob demanda pelo app-shell: abrirPaleta(perfil).
// Busca páginas do menu, ações rápidas e chamados (carregados uma vez por página).

import {
    ArrowDown,
    ArrowUp,
    CornerDownLeft,
    FileText,
    LogOut,
    Moon,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Search,
    SearchX,
    Sun,
} from "lucide";
import "../../styles/components/command-palette.css";
import { sair } from "../core/session.js";
import { alternarTema, getPrefs, setPref, temaAtual } from "../core/theme.js";
import { listarChamados } from "../services/chamados.js";
import { MENU } from "../utils/constants.js";
import { h, render } from "../utils/dom.js";
import { formatarNumeroChamado, normalizarBusca } from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { badgeStatus } from "./badges.js";
import { skeleton } from "./skeleton.js";

const MAX_CHAMADOS = 8;
const MAX_CHAMADOS_SEM_BUSCA = 5;

let dialogo = null;
let campo = null;
let listbox = null;
let statusVivo = null;
let perfilAtual = null;

let resultados = []; // itens visíveis, na ordem da lista
let selecionado = 0;

// Chamados: carregados uma vez (na primeira abertura da página)
let chamados = null;
let carregandoChamados = null;
let erroChamados = false;

/* ---------- Busca tolerante ---------- */

function termosDe(consulta) {
    return normalizarBusca(consulta).split(/\s+/).filter(Boolean);
}

/** Todas as palavras precisam aparecer no texto. Retorna uma pontuação (0 = não casou). */
function pontuar(texto, termos) {
    if (!termos.length) return 1;
    const alvo = normalizarBusca(texto);
    let pontos = 0;
    for (const t of termos) {
        const i = alvo.indexOf(t);
        if (i < 0) return 0;
        pontos += i === 0 ? 3 : /[\s#\-/(]/.test(alvo[i - 1]) ? 2 : 1;
    }
    return pontos;
}

/**
 * Quebra o texto em nós, com <mark> nos trechos que casaram com os termos.
 * O mapeamento índice-normalizado → índice-original preserva acentos no destaque.
 */
function destacarTexto(texto, termos) {
    const original = String(texto ?? "");
    if (!termos.length || !original) return [original];

    let norm = "";
    const mapa = []; // posição no texto normalizado → posição no original
    for (let i = 0; i < original.length; i++) {
        const n = normalizarBusca(original[i]);
        for (let k = 0; k < n.length; k++) mapa.push(i);
        norm += n;
    }

    const marcados = new Array(original.length).fill(false);
    for (const t of termos) {
        let de = norm.indexOf(t);
        while (de >= 0) {
            for (let j = de; j < de + t.length; j++) marcados[mapa[j]] = true;
            de = norm.indexOf(t, de + t.length);
        }
    }

    const nos = [];
    let trecho = "";
    let emMarca = false;
    const fechar = () => {
        if (trecho) nos.push(emMarca ? h("mark", {}, trecho) : trecho);
        trecho = "";
    };
    for (let i = 0; i < original.length; i++) {
        if (marcados[i] !== emMarca) {
            fechar();
            emMarca = marcados[i];
        }
        trecho += original[i];
    }
    fechar();
    return nos;
}

/* ---------- Itens ---------- */

function rotuloMenu(item, role) {
    return typeof item.label === "function" ? item.label(role) : item.label;
}

function itensPaginas() {
    const role = perfilAtual?.role;
    return MENU.filter((item) => item.roles.includes(role)).map((item) => ({
        grupo: "paginas",
        chave: `pagina-${item.id}`,
        rotulo: rotuloMenu(item, role),
        busca: `${rotuloMenu(item, role)} ${item.id.replace(/-/g, " ")}`,
        icone: item.icon,
        dica: "Ir para",
        href: item.href,
    }));
}

function itensAcoes() {
    const escuro = temaAtual() === "dark";
    const recolhido = getPrefs().sidebar === "collapsed";
    const acoes = [
        {
            chave: "acao-novo",
            rotulo: "Novo chamado",
            busca: "novo chamado abrir criar",
            icone: Plus,
            href: "abrir-chamado.html",
        },
        {
            chave: "acao-tema",
            rotulo: escuro ? "Usar tema claro" : "Usar tema escuro",
            busca: "alternar tema claro escuro modo aparencia",
            icone: escuro ? Sun : Moon,
            executar: alternarTema,
        },
        // Recolher só faz sentido onde a sidebar expandida existe
        window.matchMedia("(min-width: 1024px)").matches && {
            chave: "acao-menu",
            rotulo: recolhido ? "Expandir menu lateral" : "Recolher menu lateral",
            busca: "recolher expandir menu lateral sidebar",
            icone: recolhido ? PanelLeftOpen : PanelLeftClose,
            executar: () => setPref("sidebar", recolhido ? "expanded" : "collapsed"),
        },
        {
            chave: "acao-sair",
            rotulo: "Sair",
            busca: "sair logout desconectar encerrar sessao",
            icone: LogOut,
            tom: "danger",
            executar: () => sair(),
        },
    ];
    return acoes.filter(Boolean).map((a) => ({ grupo: "acoes", dica: "Ação", ...a }));
}

function itemChamado(c) {
    const numero = formatarNumeroChamado(c.numero);
    return {
        grupo: "chamados",
        chave: `chamado-${c.id}`,
        rotulo: c.titulo,
        numero,
        busca: `${c.titulo} ${numero} ${c.numero ?? ""}`,
        icone: FileText,
        status: c.status,
        href: `chamado.html?id=${encodeURIComponent(c.id)}&n=${c.numero ?? ""}`,
        chamado: c,
    };
}

/** Chamados que casam com a busca: número exato primeiro, depois pontuação e recência. */
function buscarChamados(termos) {
    if (!chamados) return [];
    if (!termos.length) return chamados.slice(0, MAX_CHAMADOS_SEM_BUSCA).map(itemChamado);

    const pontuados = [];
    for (const c of chamados) {
        let pontos = 0;
        const casaTodos = termos.every((t) => {
            const digitos = t.replace(/^#/, "");
            if (/^\d+$/.test(digitos) && c.numero != null) {
                const n = String(c.numero);
                const alvo = String(Number(digitos));
                if (n === alvo) return (pontos += 10);
                if (n.startsWith(alvo)) return (pontos += 4);
            }
            const p = pontuar(`${c.titulo} ${formatarNumeroChamado(c.numero)}`, [t]);
            pontos += p;
            return p > 0;
        });
        if (casaTodos) pontuados.push({ c, pontos });
    }
    return pontuados
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, MAX_CHAMADOS)
        .map(({ c }) => itemChamado(c));
}

function filtrar(itens, termos) {
    return itens
        .map((item, ordem) => ({ item, ordem, pontos: pontuar(item.busca, termos) }))
        .filter((x) => x.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem)
        .map((x) => x.item);
}

/* ---------- Desenho ---------- */

const GRUPOS = { paginas: "Páginas", acoes: "Ações", chamados: "Chamados" };

function opcao(item, indice, termos) {
    const termosDestaque = termos.map((t) => t.replace(/^#/, "")).filter(Boolean);
    return h(
        "div",
        {
            class: "paleta__item",
            id: `paleta-opcao-${indice}`,
            role: "option",
            "aria-selected": "false",
            dataset: { indice: String(indice), ...(item.tom ? { tone: item.tom } : {}) },
        },
        h("span", { class: "paleta__icone" }, icon(item.icone)),
        h(
            "span",
            { class: "paleta__texto" },
            item.numero && h("span", { class: "paleta__numero mono" }, destacarTexto(item.numero, termosDestaque)),
            h("span", { class: "paleta__rotulo" }, destacarTexto(item.rotulo, termos))
        ),
        item.status ? badgeStatus(item.status) : h("span", { class: "paleta__dica" }, item.dica),
        h("span", { class: "paleta__enter", "aria-hidden": "true" }, icon(CornerDownLeft))
    );
}

function grupo(chave, filhos) {
    const idRotulo = `paleta-grupo-${chave}`;
    return h(
        "div",
        { class: "paleta__grupo", role: "group", "aria-labelledby": idRotulo },
        h("div", { class: "paleta__grupo-titulo", id: idRotulo, role: "presentation" }, GRUPOS[chave]),
        filhos
    );
}

function linhasSkeleton() {
    return Array.from({ length: 3 }, () =>
        h(
            "div",
            { class: "paleta__item paleta__item--skeleton", "aria-hidden": "true" },
            skeleton({ w: "32px", h: "32px", r: "8px" }),
            h("span", { class: "paleta__texto" }, skeleton({ w: "48px", h: "10px" }), skeleton({ w: "70%", h: "12px" }))
        )
    );
}

let anuncio = 0;
function anunciar(texto) {
    clearTimeout(anuncio);
    anuncio = setTimeout(() => (statusVivo.textContent = texto), 350);
}

function atualizar() {
    const termos = termosDe(campo.value);
    const paginas = filtrar(itensPaginas(), termos);
    const acoes = filtrar(itensAcoes(), termos);
    const listaChamados = buscarChamados(termos);

    resultados = [...paginas, ...acoes, ...listaChamados];
    let i = 0;
    const blocos = [];
    if (paginas.length) blocos.push(grupo("paginas", paginas.map((it) => opcao(it, i++, termos))));
    if (acoes.length) blocos.push(grupo("acoes", acoes.map((it) => opcao(it, i++, termos))));

    if (carregandoChamados && !chamados && !erroChamados) {
        blocos.push(
            h(
                "div",
                { class: "paleta__grupo", role: "group", "aria-label": "Chamados (carregando)", "aria-busy": "true" },
                h("div", { class: "paleta__grupo-titulo", role: "presentation" }, "Chamados"),
                linhasSkeleton()
            )
        );
    } else if (listaChamados.length) {
        blocos.push(grupo("chamados", listaChamados.map((it) => opcao(it, i++, termos))));
    } else if (erroChamados && termos.length) {
        blocos.push(h("p", { class: "paleta__aviso", role: "presentation" }, "Não foi possível carregar os chamados."));
    }

    if (!resultados.length && !(carregandoChamados && !chamados)) {
        render(
            listbox,
            h(
                "div",
                { class: "paleta__vazio", role: "presentation" },
                icon(SearchX),
                h("strong", {}, "Nada encontrado"),
                h("span", {}, `Nenhum resultado para “${campo.value.trim()}”.`)
            )
        );
    } else {
        render(listbox, blocos);
    }

    selecionar(0, { rolar: false });
    listbox.scrollTop = 0;

    if (termos.length) {
        anunciar(resultados.length ? `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"}.` : "Nenhum resultado.");
    }
}

function opcoes() {
    return listbox.querySelectorAll('[role="option"]');
}

function selecionar(indice, { rolar = true } = {}) {
    const lista = opcoes();
    if (!lista.length) {
        selecionado = -1;
        campo.removeAttribute("aria-activedescendant");
        return;
    }
    selecionado = (indice + lista.length) % lista.length;
    lista.forEach((el, i) => el.setAttribute("aria-selected", String(i === selecionado)));
    const atual = lista[selecionado];
    campo.setAttribute("aria-activedescendant", atual.id);
    if (rolar) atual.scrollIntoView({ block: "nearest" });
}

/* ---------- Execução ---------- */

function fechar() {
    if (dialogo?.open) dialogo.close();
}

function executar(indice = selecionado) {
    const item = resultados[indice];
    if (!item) return;
    fechar();
    if (item.href) {
        window.location.href = item.href;
    } else {
        item.executar?.();
    }
}

/* ---------- Montagem ---------- */

function montar() {
    campo = h("input", {
        class: "paleta__campo",
        type: "text",
        role: "combobox",
        "aria-expanded": "true",
        "aria-controls": "paleta-lista",
        "aria-autocomplete": "list",
        "aria-label": "Buscar páginas, ações ou chamados",
        placeholder: "Buscar páginas, ações ou chamados…",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false",
        enterkeyhint: "go",
    });

    listbox = h("div", { class: "paleta__lista", id: "paleta-lista", role: "listbox", "aria-label": "Resultados" });
    statusVivo = h("div", { class: "sr-only", role: "status", "aria-live": "polite" });

    dialogo = h(
        "dialog",
        { class: "dialog paleta", "aria-label": "Paleta de comandos" },
        h(
            "div",
            { class: "paleta__busca" },
            icon(Search),
            campo,
            h("kbd", { class: "paleta__esc" }, "Esc"),
            h("button", { class: "btn btn--ghost btn--sm paleta__fechar", type: "button", onClick: fechar }, "Cancelar")
        ),
        listbox,
        statusVivo,
        h(
            "footer",
            { class: "paleta__rodape", "aria-hidden": "true" },
            h("span", {}, h("kbd", {}, icon(ArrowUp)), h("kbd", {}, icon(ArrowDown)), "navegar"),
            h("span", {}, h("kbd", {}, icon(CornerDownLeft)), "abrir"),
            h("span", {}, h("kbd", {}, "Esc"), "fechar"),
            h("span", { class: "paleta__rodape-dica" }, "Dica: digite o número, ex.: ", h("kbd", {}, "#12"))
        )
    );

    campo.addEventListener("input", atualizar);

    campo.addEventListener("keydown", (e) => {
        if (e.isComposing) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selecionar(selecionado + 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selecionar(selecionado - 1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            executar();
        } else if (e.key === "Tab") {
            e.preventDefault(); // o foco fica no campo; setas escolhem o resultado
        }
    });

    // O mouse também escolhe (sem roubar o foco do campo)
    listbox.addEventListener("pointermove", (e) => {
        const alvo = e.target.closest('[role="option"]');
        if (alvo && Number(alvo.dataset.indice) !== selecionado) selecionar(Number(alvo.dataset.indice), { rolar: false });
    });
    listbox.addEventListener("mousedown", (e) => e.preventDefault());
    listbox.addEventListener("click", (e) => {
        const alvo = e.target.closest('[role="option"]');
        if (alvo) executar(Number(alvo.dataset.indice));
    });

    // Clique no fundo fecha
    dialogo.addEventListener("click", (e) => {
        if (e.target === dialogo) fechar();
    });

    document.body.append(dialogo);
}

function carregarChamados() {
    if (chamados || carregandoChamados || !perfilAtual) return;
    erroChamados = false;
    carregandoChamados = listarChamados(perfilAtual)
        .then((lista) => {
            chamados = lista;
        })
        .catch((erro) => {
            console.error(erro);
            erroChamados = true;
        })
        .finally(() => {
            carregandoChamados = null;
            if (dialogo?.open) {
                const anterior = resultados[selecionado]?.chave;
                atualizar();
                // mantém a seleção se o usuário já tinha escolhido algo
                const i = resultados.findIndex((r) => r.chave === anterior);
                if (i > 0) selecionar(i, { rolar: false });
            }
        });
}

/**
 * Abre a paleta (ou só devolve o foco a ela, se já estiver aberta).
 * @param {import("../core/session.js").Perfil} perfil
 */
export function abrirPaleta(perfil) {
    if (perfil) perfilAtual = perfil;
    if (!dialogo) montar();

    if (dialogo.open) {
        campo.focus();
        campo.select();
        return;
    }

    campo.value = "";
    statusVivo.textContent = "";
    carregarChamados();
    atualizar();
    dialogo.showModal();
    campo.focus();
}
