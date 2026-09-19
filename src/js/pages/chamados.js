// Lista de chamados (Fila / Histórico) em tempo real, com busca, filtros,
// ordenação e paginação. Todo o estado da tela vive na URL.

import { CircleAlert, FilterX, Inbox, Plus, RotateCw, Search, SearchX, Archive } from "lucide";
import { iniciarPagina } from "../components/app-shell.js";
import { avatar } from "../components/avatar.js";
import { badgeCategoria, badgePrioridade, badgeStatus } from "../components/badges.js";
import { estadoVazio } from "../components/empty-state.js";
import { carregando, skeletonLinhasLista } from "../components/skeleton.js";
import { criarAbas } from "../components/tabs.js";
import { toast } from "../components/toast.js";
import { perfilEmCache } from "../core/session.js";
import { observarChamados } from "../services/chamados.js";
import { CATEGORIAS, PRIORIDADES, STATUS, prioridadeInfo } from "../utils/constants.js";
import { h, render } from "../utils/dom.js";
import { formatarDataHora, formatarNumero, formatarNumeroChamado, normalizarBusca, plural, tempoRelativo } from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { destacar, stagger } from "../utils/motion.js";

const POR_PAGINA = 20;

const ABAS = {
    fila: { status: ["aberto", "analise"], nome: "fila", naAba: "na fila" },
    historico: { status: ["resolvido"], nome: "histórico", naAba: "no histórico" },
};

const ORDENS = {
    recentes: "Mais recentes",
    antigos: "Mais antigos",
    prioridade: "Prioridade maior",
};

const PADRAO = { aba: "fila", q: "", status: "", prioridade: "", categoria: "", ordem: "recentes", pagina: 1 };

const $ = (id) => document.getElementById(id);
const el = {
    titulo: $("lc-titulo"),
    subtitulo: $("lc-subtitulo"),
    acoes: $("lc-acoes"),
    abas: $("lc-abas"),
    countFila: $("lc-count-fila"),
    countHistorico: $("lc-count-historico"),
    resumo: $("lc-resumo"),
    toolbar: $("lc-toolbar"),
    anuncio: $("lc-anuncio"),
    painel: $("lc-painel"),
    rodape: $("lc-rodape"),
};

// ---------- Estado ↔ URL ----------

/** Categorias fora da lista (dados antigos em texto livre) contam como "Outros". */
function categoriaCanonica(valor) {
    const alvo = normalizarBusca(valor);
    return CATEGORIAS.find((c) => normalizarBusca(c.valor) === alvo)?.valor || "Outros";
}

function lerEstadoDaUrl() {
    const p = new URLSearchParams(location.search);
    const estado = { ...PADRAO };

    estado.aba = p.get("aba") in ABAS ? p.get("aba") : PADRAO.aba;
    estado.q = (p.get("q") || "").trim();

    // Contrato com o dashboard: ?status=resolvido → Histórico; aberto/analise → Fila filtrada
    const status = p.get("status");
    if (status === "resolvido") {
        estado.aba = "historico";
    } else if (status === "aberto" || status === "analise") {
        estado.aba = "fila";
        estado.status = status;
    }

    const prioridade = p.get("prioridade");
    if (PRIORIDADES.some((x) => x.valor === prioridade)) estado.prioridade = prioridade;

    const categoria = p.get("categoria");
    if (categoria) {
        const achada = CATEGORIAS.find((c) => normalizarBusca(c.valor) === normalizarBusca(categoria));
        if (achada) estado.categoria = achada.valor;
    }

    if (p.get("ordem") in ORDENS) estado.ordem = p.get("ordem");

    const pagina = Number.parseInt(p.get("pagina"), 10);
    if (pagina > 1) estado.pagina = Math.min(pagina, 50);

    return estado;
}

function escreverEstadoNaUrl() {
    const p = new URLSearchParams();
    for (const chave of ["aba", "q", "status", "prioridade", "categoria", "ordem", "pagina"]) {
        const valor = estado[chave];
        if (valor !== PADRAO[chave] && valor !== "") p.set(chave, String(valor));
    }
    const busca = p.toString();
    const url = `${location.pathname}${busca ? `?${busca}` : ""}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) {
        history.replaceState(history.state, "", url);
    }
}

const estado = lerEstadoDaUrl();

const temFiltros = () => Boolean(estado.q || estado.status || estado.prioridade || estado.categoria);

// ---------- Dados ----------

let perfil = null;
let staff = false;
let chamados = [];
let situacao = "carregando"; // "carregando" | "pronto" | "erro"
let pararDeObservar = null;
const indiceBusca = new WeakMap();

function textoDeBusca(c) {
    let texto = indiceBusca.get(c);
    if (!texto) {
        const numero = c.numero ?? "";
        texto = normalizarBusca(
            [`#${numero}`, formatarNumeroChamado(c.numero), c.titulo, c.usuarioNome, c.categoria, c.tecnicoNome].join(" ")
        );
        indiceBusca.set(c, texto);
    }
    return texto;
}

function daAba(lista, aba = estado.aba) {
    return lista.filter((c) => ABAS[aba].status.includes(c.status));
}

function aplicarFiltros(lista) {
    const termos = normalizarBusca(estado.q).split(/\s+/).filter(Boolean);
    return lista.filter((c) => {
        if (estado.aba === "fila" && estado.status && c.status !== estado.status) return false;
        if (estado.prioridade && c.prioridade !== estado.prioridade) return false;
        if (estado.categoria && categoriaCanonica(c.categoria) !== estado.categoria) return false;
        if (termos.length) {
            const texto = textoDeBusca(c);
            return termos.every((t) => texto.includes(t));
        }
        return true;
    });
}

const tempo = (d) => d?.getTime() ?? 0;

function ordenar(lista) {
    const copia = [...lista];
    if (estado.ordem === "antigos") return copia.sort((a, b) => tempo(a.dataCriacao) - tempo(b.dataCriacao));
    if (estado.ordem === "prioridade") {
        return copia.sort(
            (a, b) =>
                prioridadeInfo(b.prioridade).peso - prioridadeInfo(a.prioridade).peso ||
                tempo(b.dataCriacao) - tempo(a.dataCriacao)
        );
    }
    return copia.sort((a, b) => tempo(b.dataCriacao) - tempo(a.dataCriacao));
}

// ---------- Cabeçalho, abas e barra de ferramentas ----------

function montarCabecalho(p) {
    const usuario = p?.role === "usuario";
    const titulo = !p ? "Chamados" : usuario ? "Meus chamados" : "Todos os chamados";
    el.titulo.textContent = titulo;
    el.subtitulo.textContent = usuario
        ? "Acompanhe o andamento das suas solicitações."
        : "Todos os chamados registrados no HelpDesk, atualizados em tempo real.";
    document.title = `${titulo} · HelpDesk`;
    render(el.acoes, h("a", { class: "btn btn--primary", href: "abrir-chamado.html" }, icon(Plus), "Novo chamado"));
}

const abas = criarAbas(el.abas, {
    aoMudar: (valor) => {
        estado.aba = valor;
        estado.status = "";
        estado.pagina = 1;
        sincronizarControles();
        atualizar({ animar: true, anunciar: true });
    },
});

let controles = null;
let temporizadorBusca = 0;

function campoSelect({ id, rotulo, opcoes, valor, aoMudar }) {
    const select = h(
        "select",
        { class: "select", id, onChange: (e) => aoMudar(e.target.value) },
        opcoes.map(([v, texto]) => h("option", { value: v, selected: v === valor }, texto))
    );
    const campo = h("div", { class: "lc-filtro" }, h("label", { class: "sr-only", for: id }, rotulo), select);
    return { campo, select };
}

function montarToolbar() {
    const aplicar = (mudanca) => {
        Object.assign(estado, mudanca, { pagina: 1 });
        atualizar({ animar: true, anunciar: true });
    };

    const busca = h("input", {
        class: "input",
        id: "lc-busca",
        type: "search",
        value: estado.q,
        autocomplete: "off",
        spellcheck: "false",
        enterkeyhint: "search",
        placeholder: staff ? "Buscar por título, nº, solicitante ou categoria" : "Buscar por título, nº ou categoria",
        "aria-describedby": "lc-busca-dica",
    });
    busca.addEventListener("input", () => {
        clearTimeout(temporizadorBusca);
        temporizadorBusca = setTimeout(() => aplicar({ q: busca.value.trim() }), 250);
    });
    busca.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && busca.value) {
            e.preventDefault();
            e.stopPropagation();
            clearTimeout(temporizadorBusca);
            busca.value = "";
            aplicar({ q: "" });
        }
    });

    const status = campoSelect({
        id: "lc-status",
        rotulo: "Filtrar por status",
        valor: estado.status,
        opcoes: [["", "Todos os status"], ...ABAS.fila.status.map((s) => [s, STATUS[s].label])],
        aoMudar: (v) => aplicar({ status: v }),
    });
    const prioridade = campoSelect({
        id: "lc-prioridade",
        rotulo: "Filtrar por prioridade",
        valor: estado.prioridade,
        opcoes: [["", "Todas as prioridades"], ...PRIORIDADES.map((p) => [p.valor, p.valor])],
        aoMudar: (v) => aplicar({ prioridade: v }),
    });
    const categoria = campoSelect({
        id: "lc-categoria",
        rotulo: "Filtrar por categoria",
        valor: estado.categoria,
        opcoes: [["", "Todas as categorias"], ...CATEGORIAS.map((c) => [c.valor, c.valor])],
        aoMudar: (v) => aplicar({ categoria: v }),
    });
    const ordem = campoSelect({
        id: "lc-ordem",
        rotulo: "Ordenar por",
        valor: estado.ordem,
        opcoes: Object.entries(ORDENS),
        aoMudar: (v) => aplicar({ ordem: v }),
    });

    const limpar = h(
        "button",
        { class: "btn btn--ghost lc-limpar", type: "button", hidden: true, onClick: () => limparFiltros() },
        icon(FilterX),
        "Limpar filtros"
    );

    render(
        el.toolbar,
        h(
            "div",
            { class: "lc-busca" },
            h("label", { class: "sr-only", for: "lc-busca" }, "Buscar chamados"),
            h("div", { class: "input-wrap" }, icon(Search), busca),
            h("span", { class: "sr-only", id: "lc-busca-dica" }, "Os resultados são filtrados enquanto você digita. Esc limpa a busca.")
        ),
        h("div", { class: "lc-filtros" }, status.campo, prioridade.campo, categoria.campo, ordem.campo, limpar)
    );
    el.toolbar.addEventListener("submit", (e) => {
        e.preventDefault();
        clearTimeout(temporizadorBusca);
        aplicar({ q: busca.value.trim() });
    });

    controles = { busca, status: status.select, statusCampo: status.campo, prioridade: prioridade.select, categoria: categoria.select, ordem: ordem.select, limpar };
}

/** Reflete o estado nos controles (após trocar de aba ou limpar filtros). */
function sincronizarControles() {
    if (!controles) return;
    controles.busca.value = estado.q;
    controles.status.value = estado.status;
    controles.prioridade.value = estado.prioridade;
    controles.categoria.value = estado.categoria;
    controles.ordem.value = estado.ordem;
    controles.statusCampo.hidden = estado.aba !== "fila";
    controles.limpar.hidden = !temFiltros();
}

function limparFiltros({ focar = true } = {}) {
    Object.assign(estado, { q: "", status: "", prioridade: "", categoria: "", pagina: 1 });
    clearTimeout(temporizadorBusca);
    sincronizarControles();
    atualizar({ animar: true, anunciar: true });
    if (focar) controles?.busca.focus();
}

// ---------- Tabela ----------

function colunas() {
    return [
        { chave: "numero", rotulo: "Nº" },
        { chave: "titulo", rotulo: "Título" },
        { chave: "categoria", rotulo: "Categoria" },
        { chave: "prioridade", rotulo: "Prioridade" },
        { chave: "status", rotulo: "Status" },
        staff && { chave: "tecnico", rotulo: "Técnico" },
        { chave: "abertura", rotulo: "Abertura" },
        estado.aba === "historico" && { chave: "resolucao", rotulo: "Resolução" },
    ].filter(Boolean);
}

function celulaData(data) {
    if (!data) return h("span", { class: "muted" }, "—");
    return h(
        "time",
        { class: "lc-tempo", datetime: data.toISOString(), title: formatarDataHora(data), dataset: { rel: String(data.getTime()) } },
        tempoRelativo(data)
    );
}

function pessoa(nome, vazio) {
    if (!nome) return h("span", { class: "muted" }, vazio);
    return h("span", { class: "lc-pessoa" }, avatar(nome, { tamanho: "sm" }), h("span", { class: "truncate" }, nome));
}

const CELULAS = {
    numero: (c) => {
        const numero = h("span", { class: "lc-numero" }, formatarNumeroChamado(c.numero));
        numero.style.viewTransitionName = `chamado-${c.id}`;
        return h(
            "a",
            { class: "row-link mono", href: `chamado.html?id=${encodeURIComponent(c.id)}&n=${c.numero ?? ""}` },
            numero,
            h("span", { class: "sr-only" }, ` — ${c.titulo}`)
        );
    },
    titulo: (c) =>
        h(
            "div",
            { class: "lc-titulo" },
            h("span", { class: "lc-titulo__texto", title: c.titulo }, c.titulo),
            staff && h("span", { class: "lc-titulo__meta" }, pessoa(c.usuarioNome, "Solicitante desconhecido"))
        ),
    categoria: (c) => badgeCategoria(c.categoria),
    prioridade: (c) => badgePrioridade(c.prioridade),
    status: (c) => badgeStatus(c.status),
    tecnico: (c) => pessoa(c.tecnicoNome, "Não atribuído"),
    abertura: (c) => celulaData(c.dataCriacao),
    resolucao: (c) => celulaData(c.dataResolucao),
};

// Linhas reaproveitadas entre atualizações em tempo real (só recria o que mudou)
const cacheLinhas = new Map();

function assinatura(c, cols) {
    return JSON.stringify([
        cols.map((x) => x.chave).join(),
        c.numero, c.titulo, c.categoria, c.prioridade, c.status, c.usuarioNome, c.tecnicoNome,
        tempo(c.dataCriacao), tempo(c.dataResolucao),
    ]);
}

function linha(c, cols) {
    const sig = assinatura(c, cols);
    const cache = cacheLinhas.get(c.id);
    if (cache?.sig === sig) return cache.tr;

    const tr = h(
        "tr",
        { dataset: { id: c.id } },
        cols.map((col) =>
            h(
                "td",
                { class: ["lc-col", `lc-col--${col.chave}`, col.chave === "titulo" && "cell-full"], dataset: { label: col.rotulo } },
                CELULAS[col.chave](c)
            )
        )
    );
    tr.addEventListener("animationend", () => tr.classList.remove("lc-entrando"));
    cacheLinhas.set(c.id, { sig, tr });
    return tr;
}

let tabela = null; // { chaveCols, table, tbody }

function obterTabela(cols) {
    const chaveCols = cols.map((c) => c.chave).join();
    if (tabela?.chaveCols === chaveCols) return tabela;

    const tbody = h("tbody");
    const table = h(
        "table",
        { class: "table table--responsive lc-tabela" },
        h("caption", { class: "sr-only" }, `${el.titulo.textContent} — ${ABAS[estado.aba].nome}`),
        h("thead", {}, h("tr", {}, cols.map((c) => h("th", { scope: "col", class: `lc-col--${c.chave}` }, c.rotulo)))),
        tbody
    );
    tabela = { chaveCols, table, tbody, wrap: h("div", { class: "table-wrap lc-wrap" }, table) };
    return tabela;
}

function atualizarTempos() {
    const agora = new Date();
    for (const t of el.painel.querySelectorAll("time[data-rel]")) {
        t.textContent = tempoRelativo(new Date(Number(t.dataset.rel)), agora);
    }
}

// ---------- Renderização ----------

function anunciar(texto) {
    el.anuncio.textContent = "";
    requestAnimationFrame(() => {
        el.anuncio.textContent = texto;
    });
}

function mostrarSkeleton() {
    el.painel.setAttribute("aria-busy", "true");
    delete el.painel.dataset.vazio;
    tabela = null;
    render(el.painel, h("div", { class: "lc-skeleton" }, carregando(skeletonLinhasLista(6))));
    el.rodape.hidden = true;
    el.resumo.textContent = "";
}

function mostrarErro() {
    el.painel.removeAttribute("aria-busy");
    delete el.painel.dataset.vazio;
    tabela = null;
    el.rodape.hidden = true;
    el.resumo.textContent = "";
    render(
        el.painel,
        estadoVazio({
            icone: CircleAlert,
            tom: "danger",
            titulo: "Não foi possível carregar os chamados",
            texto: "Verifique sua conexão e tente novamente.",
            acao: { label: "Tentar novamente", icone: RotateCw, variante: "btn--secondary", onClick: () => observar() },
        })
    );
}

function vazio(listaAba) {
    const usuario = !staff;
    const aba = estado.aba;

    if (chamados.length === 0) {
        return estadoVazio({
            icone: Inbox,
            titulo: usuario ? "Você ainda não abriu nenhum chamado" : "Nenhum chamado registrado",
            texto: usuario
                ? "Precisa de ajuda com equipamento, sistema ou acesso? Abra um chamado e acompanhe tudo por aqui."
                : "Quando alguém abrir um chamado, ele aparece aqui em tempo real.",
            acao: usuario && { label: "Abrir meu primeiro chamado", href: "abrir-chamado.html", icone: Plus },
        });
    }

    if (listaAba.length === 0) {
        if (aba === "fila") {
            return estadoVazio({
                icone: Inbox,
                tom: "success",
                titulo: "Fila vazia",
                texto: usuario
                    ? "Você não tem chamados abertos ou em análise. Todos os seus pedidos já foram resolvidos."
                    : "Nenhum chamado aberto ou em análise. Tudo em dia!",
                acao: usuario && { label: "Abrir chamado", href: "abrir-chamado.html", icone: Plus, variante: "btn--secondary" },
            });
        }
        return estadoVazio({
            icone: Archive,
            titulo: "Nenhum chamado resolvido ainda",
            texto: usuario
                ? "Quando um técnico resolver um chamado seu, ele fica guardado aqui."
                : "Os chamados resolvidos ficam guardados aqui para consulta.",
        });
    }

    return estadoVazio({
        icone: SearchX,
        titulo: "Nenhum resultado",
        texto: `Nenhum chamado ${ABAS[aba].naAba} corresponde à busca e aos filtros aplicados.`,
        acao: { label: "Limpar filtros", icone: FilterX, variante: "btn--secondary", onClick: () => limparFiltros() },
    });
}

function textoContagem(n) {
    return n === 0 ? "Nenhum chamado encontrado" : plural(n, "chamado encontrado", "chamados encontrados");
}

/**
 * Redesenha a lista a partir do estado.
 * @param {{ animar?: boolean, anunciar?: boolean, mudancas?: {tipo: string, id: string}[], focarIndice?: number }} opcoes
 */
function atualizar({ animar = false, anunciar: deveAnunciar = false, mudancas = [], focarIndice = null } = {}) {
    escreverEstadoNaUrl();
    if (controles) {
        controles.statusCampo.hidden = estado.aba !== "fila";
        controles.limpar.hidden = !temFiltros();
    }
    el.painel.setAttribute("aria-labelledby", `lc-aba-${estado.aba}`);
    if (situacao !== "pronto") return;

    el.painel.removeAttribute("aria-busy");
    el.countFila.textContent = formatarNumero(daAba(chamados, "fila").length);
    el.countHistorico.textContent = formatarNumero(daAba(chamados, "historico").length);

    const listaAba = daAba(chamados);
    const filtrados = ordenar(aplicarFiltros(listaAba));

    if (deveAnunciar) anunciar(textoContagem(filtrados.length));

    if (filtrados.length === 0) {
        tabela = null;
        el.rodape.hidden = true;
        el.resumo.textContent = listaAba.length ? `0 de ${plural(listaAba.length, "chamado")}` : "";
        // Não recria o estado vazio a cada snapshot (evita repetir a animação)
        const chave = `${chamados.length > 0}|${listaAba.length > 0}|${estado.aba}`;
        if (el.painel.dataset.vazio !== chave) {
            render(el.painel, vazio(listaAba));
            el.painel.dataset.vazio = chave;
        }
        return;
    }
    delete el.painel.dataset.vazio;

    const paginasTotais = Math.ceil(filtrados.length / POR_PAGINA);
    if (estado.pagina > paginasTotais) {
        estado.pagina = paginasTotais;
        escreverEstadoNaUrl();
    }
    const visiveis = filtrados.slice(0, estado.pagina * POR_PAGINA);

    const cols = colunas();
    const t = obterTabela(cols);
    if (el.painel.firstElementChild !== t.wrap) {
        render(el.painel, t.wrap);
        animar = true;
    }

    // Preserva o foco quando a linha focada é movida/recriada
    const focada = document.activeElement?.closest?.("tr[data-id]");
    const idFocado = focada && t.tbody.contains(focada) ? focada.dataset.id : null;

    const antigas = [...t.tbody.children];
    const novas = visiveis.map((c) => linha(c, cols));
    const mudouOrdem = antigas.length !== novas.length || novas.some((tr, i) => tr !== antigas[i]);

    if (animar) {
        t.tbody.replaceChildren(...novas);
        stagger(t.tbody);
    } else if (mudouOrdem) {
        t.tbody.classList.remove("stagger");
        t.tbody.replaceChildren(...novas);
    }

    // "Carregar mais": só as linhas novas entram com animação
    if (focarIndice !== null) {
        novas.slice(focarIndice).forEach((tr, i) => {
            tr.style.setProperty("--i", Math.min(i, 12));
            tr.classList.remove("lc-entrando");
            void tr.offsetWidth;
            tr.classList.add("lc-entrando");
        });
        novas[focarIndice]?.querySelector(".row-link")?.focus();
    } else if (idFocado && !t.tbody.contains(document.activeElement)) {
        t.tbody.querySelector(`tr[data-id="${CSS.escape(idFocado)}"] .row-link`)?.focus({ preventScroll: true });
    }

    for (const m of mudancas) {
        if (m.tipo === "removed") continue;
        destacar(t.tbody.querySelector(`tr[data-id="${CSS.escape(m.id)}"]`));
    }

    atualizarTempos();

    el.resumo.replaceChildren(
        "Mostrando ",
        h("strong", { class: "num" }, formatarNumero(visiveis.length)),
        " de ",
        h("strong", { class: "num" }, formatarNumero(filtrados.length)),
        temFiltros() ? ` (de ${formatarNumero(listaAba.length)} ${ABAS[estado.aba].naAba})` : ""
    );

    const restantes = filtrados.length - visiveis.length;
    el.rodape.hidden = restantes <= 0;
    if (restantes > 0) {
        render(
            el.rodape,
            h(
                "button",
                {
                    class: "btn btn--secondary",
                    type: "button",
                    onClick: () => {
                        const indice = visiveis.length;
                        estado.pagina += 1;
                        atualizar({ focarIndice: indice });
                        anunciar(`${plural(Math.min(restantes, POR_PAGINA), "chamado carregado", "chamados carregados")}`);
                    },
                },
                "Carregar mais",
                h("span", { class: "muted" }, `(${plural(restantes, "restante", "restantes")})`)
            )
        );
    }
}

// ---------- Tempo real ----------

function observar() {
    pararDeObservar?.();
    situacao = "carregando";
    mostrarSkeleton();

    let primeira = true;
    pararDeObservar = observarChamados(
        perfil,
        (lista, mudancas) => {
            chamados = lista;
            situacao = "pronto";
            atualizar({ animar: primeira, mudancas: primeira ? [] : mudancas });
            primeira = false;
        },
        (erro) => {
            console.error(erro);
            pararDeObservar = null;
            situacao = "erro";
            mostrarErro();
            toast.error("Erro ao carregar os chamados", {
                message: "A conexão com o servidor falhou.",
                action: { label: "Tentar novamente", onClick: () => observar() },
            });
        }
    );
}

function parar() {
    pararDeObservar?.();
    pararDeObservar = null;
}

// ---------- Início ----------

montarCabecalho(perfilEmCache());
abas.selecionar(estado.aba, { notificar: false });
mostrarSkeleton();

perfil = await iniciarPagina({ pagina: "chamados" });
staff = perfil.role === "tecnico" || perfil.role === "admin";
montarCabecalho(perfil);
montarToolbar();
sincronizarControles();
observar();

setInterval(atualizarTempos, 60_000);

window.addEventListener("pagehide", parar);
window.addEventListener("pageshow", (e) => {
    // Volta pelo cache do navegador (bfcache): retoma a observação
    if (e.persisted && !pararDeObservar) observar();
});
