// Styleguide (só desenvolvimento): exibe os componentes da fundação com todos os estados.
// Não usa sessão nem app-shell — abre direto no navegador.

import {
    Bell,
    Check,
    CircleAlert,
    CircleCheck,
    CircleDot,
    Clock,
    Flame,
    Inbox,
    LifeBuoy,
    Loader,
    Mail,
    Moon,
    Play,
    Plus,
    RefreshCw,
    Search,
    Send,
    Shuffle,
    Sun,
    Trash2,
    TriangleAlert,
    UserX,
} from "lucide";
import { avatar } from "../components/avatar.js";
import { badgeCategoria, badgePrioridade, badgeStatus } from "../components/badges.js";
import { confirmar } from "../components/confirm.js";
import { estadoVazio } from "../components/empty-state.js";
import { carregando, skeleton, skeletonCards, skeletonLinhas, skeletonLinhasLista } from "../components/skeleton.js";
import { criarAbas } from "../components/tabs.js";
import { toast } from "../components/toast.js";
import { alternarTema, getPrefs, setPref, temaAtual } from "../core/theme.js";
import { CATEGORIAS, PRIORIDADES, STATUS, prioridadeInfo } from "../utils/constants.js";
import { $, $$, h, render } from "../utils/dom.js";
import { formatarDataHora, formatarNumero, formatarNumeroChamado, tempoRelativo } from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { animarNumero, comTransicao, destacar, pulsar, stagger, tremer } from "../utils/motion.js";

// ---------- Auxiliares de layout ----------
const demo = (nome) => $(`[data-demo="${nome}"]`);
const bloco = (titulo, ...filhos) =>
    h("div", { class: "sg-block" }, titulo && h("h3", { class: "sg-block__title" }, titulo), ...filhos);
const linha = (...filhos) => h("div", { class: "cluster sg-row" }, ...filhos);
const botao = (classe, rotulo, attrs = {}) => h("button", { class: `btn ${classe}`, type: "button", ...attrs }, rotulo);
const raiz = document.documentElement;
const token = (nome) => getComputedStyle(raiz).getPropertyValue(nome).trim();

// ==========================================================
// Barra do topo: tema, movimento, densidade
// ==========================================================
$("#sg-marca").append(icon(LifeBuoy));

const botaoTema = $("#alternar-tema");
const seletorMovimento = $("#pref-motion");
const seletorDensidade = $("#pref-density");

function sincronizarControles() {
    const prefs = getPrefs();
    const escuro = temaAtual() === "dark";
    render(botaoTema, icon(escuro ? Sun : Moon));
    botaoTema.setAttribute("aria-label", escuro ? "Ativar tema claro" : "Ativar tema escuro");
    botaoTema.title = botaoTema.getAttribute("aria-label");
    seletorMovimento.value = prefs.motion;
    seletorDensidade.value = prefs.density;
    $('meta[name="theme-color"]')?.setAttribute("content", token("--bg"));
    atualizarCores();
}

botaoTema.addEventListener("click", alternarTema);
seletorMovimento.addEventListener("change", () => setPref("motion", seletorMovimento.value));
seletorDensidade.addEventListener("change", () => setPref("density", seletorDensidade.value));
window.addEventListener("hd:prefs", sincronizarControles);
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => requestAnimationFrame(sincronizarControles));

// ==========================================================
// Navegação por seções
// ==========================================================
const secoes = $$(".sg-section");
const listaNav = $("#sg-nav-lista");
render(
    listaNav,
    secoes.map((s) => h("li", {}, h("a", { class: "sg-nav__link", href: `#${s.id}` }, $("h2", s).textContent)))
);

// Destaca a seção visível (a mais próxima do topo)
const visiveis = new Set();
const observadorNav = new IntersectionObserver(
    (entradas) => {
        for (const e of entradas) e.isIntersecting ? visiveis.add(e.target) : visiveis.delete(e.target);
        const atual = secoes.find((s) => visiveis.has(s));
        if (!atual) return;
        for (const link of $$(".sg-nav__link", listaNav)) {
            if (link.hash === `#${atual.id}`) {
                link.setAttribute("aria-current", "true");
                // No mobile a navegação é uma faixa horizontal: mantém o item ativo à vista
                if (listaNav.scrollWidth > listaNav.clientWidth) listaNav.scrollTo({ left: link.offsetLeft - 16 });
            } else link.removeAttribute("aria-current");
        }
    },
    { rootMargin: "-15% 0px -70% 0px" }
);
secoes.forEach((s) => observadorNav.observe(s));

// ==========================================================
// Cores
// ==========================================================
const GRUPOS_COR = [
    { titulo: "Superfícies", tokens: ["--bg", "--surface-1", "--surface-2", "--surface-3", "--border", "--border-strong"] },
    { titulo: "Texto", tokens: ["--text", "--text-muted", "--text-subtle", "--text-on-brand"], contraste: true },
    {
        titulo: "Marca e semântica",
        tokens: ["--brand", "--brand-hover", "--brand-strong", "--info", "--warning", "--success", "--danger", "--orange"],
        contraste: true,
    },
    {
        titulo: "Fundos suaves",
        tokens: ["--brand-soft", "--info-soft", "--warning-soft", "--success-soft", "--danger-soft", "--orange-soft", "--neutral-soft"],
    },
];

function hexParaRgb(hex) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const v = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

function luminancia([r, g, b]) {
    const canal = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(corA, corB) {
    const a = hexParaRgb(corA);
    const b = hexParaRgb(corB);
    if (!a || !b) return null;
    const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

function descreverValor(valor) {
    if (valor.startsWith("color-mix")) {
        const pct = /(\d+)%/.exec(valor);
        return `color-mix · ${pct ? pct[1] : "?"}%`;
    }
    return valor;
}

const swatches = [];

render(
    demo("cores"),
    GRUPOS_COR.map((grupo) =>
        bloco(
            grupo.titulo,
            h(
                "div",
                { class: "sg-swatches" },
                grupo.tokens.map((nome) => {
                    const valor = h("span", { class: "sg-swatch__valor mono" });
                    const selo = grupo.contraste ? h("span", { class: "badge sg-swatch__aa" }) : null;
                    swatches.push({ nome, valor, selo });
                    return h(
                        "figure",
                        { class: "sg-swatch" },
                        h("span", { class: "sg-swatch__cor", style: { background: `var(${nome})` } }),
                        h("figcaption", { class: "sg-swatch__info" }, h("code", {}, nome), valor, selo)
                    );
                })
            )
        )
    )
);

function atualizarCores() {
    const fundo = token("--surface-1");
    for (const { nome, valor, selo } of swatches) {
        const v = token(nome);
        valor.textContent = descreverValor(v);
        if (!selo) continue;
        // Texto sobre a marca é medido contra --brand, o resto contra --surface-1
        const razao = contraste(v, nome === "--text-on-brand" ? token("--brand") : fundo);
        if (razao === null) {
            selo.hidden = true;
            continue;
        }
        const nivel = razao >= 4.5 ? "AA" : razao >= 3 ? "AA grande" : "Falha";
        selo.hidden = false;
        selo.dataset.tone = razao >= 4.5 ? "success" : razao >= 3 ? "warning" : "danger";
        selo.textContent = `${nivel} ${razao.toFixed(1)}:1`;
        selo.title = `Contraste contra ${nome === "--text-on-brand" ? "--brand" : "--surface-1"}`;
    }
}

// ==========================================================
// Tipografia
// ==========================================================
const ESCALA = [
    ["--fs-2xl", "clamp(32px → 48px)", "Painel de chamados"],
    ["--fs-xl", "clamp(24px → 32px)", "Chamados em aberto"],
    ["--fs-lg", "20px", "Impressora do 2º andar não imprime"],
    ["--fs-md", "16px", "O técnico assumiu seu chamado e já está analisando o problema."],
    ["--fs-sm", "14px", "Aberto há 3 horas por Ana Souza · Categoria Impressora"],
    ["--fs-xs", "12px", "RÓTULO · METADADO · CONTADOR"],
];

render(
    demo("tipografia"),
    bloco(
        "Escala",
        h(
            "div",
            { class: "sg-type" },
            ESCALA.map(([nome, px, texto]) =>
                h(
                    "div",
                    { class: "sg-type__row" },
                    h("div", { class: "sg-type__meta" }, h("code", {}, nome), h("span", { class: "muted text-xs" }, px)),
                    h("p", { class: "sg-type__sample", style: { fontSize: `var(${nome})` } }, texto)
                )
            )
        )
    ),
    bloco(
        "Pesos",
        linha(
            [
                ["400", "Regular"],
                ["500", "Medium"],
                ["600", "Semibold"],
                ["700", "Bold"],
                ["800", "Extrabold"],
            ].map(([peso, nome]) => h("span", { class: "sg-weight", style: { fontWeight: peso } }, `${nome} ${peso}`))
        )
    ),
    bloco(
        "Monoespaçada (números e IDs)",
        h(
            "p",
            { class: "num sg-mono-sample" },
            `${formatarNumeroChamado(42)} · ${formatarDataHora(new Date())} · ${formatarNumero(12345)} chamados`
        )
    )
);

// ==========================================================
// Raios, sombras e espaço
// ==========================================================
render(
    demo("forma"),
    bloco(
        "Raios",
        h(
            "div",
            { class: "sg-shapes" },
            ["sm", "md", "lg", "xl", "full"].map((r) =>
                h("div", { class: "sg-shape", style: { borderRadius: `var(--radius-${r})` } }, h("code", {}, `--radius-${r}`))
            )
        )
    ),
    bloco(
        "Sombras",
        h(
            "div",
            { class: "sg-shapes" },
            ["sm", "md", "lg"].map((s) => h("div", { class: "sg-shape sg-shape--shadow", style: { boxShadow: `var(--shadow-${s})` } }, h("code", {}, `--shadow-${s}`)))
        )
    ),
    bloco(
        "Espaçamento (base 4)",
        h(
            "div",
            { class: "sg-spaces" },
            [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
                h(
                    "div",
                    { class: "sg-space" },
                    h("code", {}, `--space-${n}`),
                    h("span", { class: "sg-space__bar", style: { width: `var(--space-${n})` } })
                )
            )
        )
    )
);

// ==========================================================
// Botões
// ==========================================================
const botaoTesteCarregando = botao("btn--primary", [icon(Send), h("span", {}, "Enviar (testar carregamento)")], {
    onClick: (e) => {
        const b = e.currentTarget;
        b.setAttribute("aria-busy", "true");
        setTimeout(() => b.removeAttribute("aria-busy"), 1800);
    },
});

render(
    demo("botoes"),
    bloco(
        "Variantes",
        linha(
            botao("btn--primary", "Primário"),
            botao("btn--secondary", "Secundário"),
            botao("btn--ghost", "Fantasma"),
            botao("btn--danger", "Perigo"),
            botao("btn--success", "Sucesso")
        )
    ),
    bloco(
        "Tamanhos",
        linha(botao("btn--primary btn--sm", "Pequeno"), botao("btn--primary", "Padrão"), botao("btn--primary btn--lg", "Grande"))
    ),
    bloco(
        "Com ícone e só ícone",
        linha(
            botao("btn--primary", [icon(Plus), "Novo chamado"]),
            botao("btn--success", [icon(Check), "Resolver"]),
            botao("btn--danger", [icon(Trash2), "Excluir"]),
            botao("btn--secondary btn--icon", icon(Search), { "aria-label": "Buscar" }),
            botao("btn--ghost btn--icon", icon(Bell), { "aria-label": "Notificações" }),
            botao("btn--ghost btn--icon btn--sm", icon(RefreshCw), { "aria-label": "Atualizar" })
        )
    ),
    bloco(
        "Desabilitado",
        linha(
            botao("btn--primary", "Primário", { disabled: true }),
            botao("btn--secondary", "Secundário", { disabled: true }),
            botao("btn--danger", "Perigo", { disabled: true })
        )
    ),
    bloco(
        "Carregando (aria-busy)",
        linha(
            botao("btn--primary", h("span", {}, "Salvando"), { "aria-busy": "true" }),
            botao("btn--secondary", h("span", {}, "Carregando"), { "aria-busy": "true" }),
            botao("btn--danger", h("span", {}, "Excluindo"), { "aria-busy": "true" }),
            botaoTesteCarregando
        )
    ),
    bloco("Bloco (largura total)", h("div", { class: "sg-narrow" }, botao("btn--primary btn--lg btn--block", "Entrar")))
);

// ==========================================================
// Campos
// ==========================================================
function campo({ id, rotulo, opcional, dica, erro, iconeCampo, controle, contador, classe }) {
    const descritores = [dica && `${id}-dica`, erro && `${id}-erro`, contador && `${id}-contador`].filter(Boolean).join(" ") || null;
    controle.id = id;
    if (descritores) controle.setAttribute("aria-describedby", descritores);
    if (erro) controle.setAttribute("aria-invalid", "true");

    return h(
        "div",
        { class: ["field", erro && "is-invalid", classe] },
        contador
            ? h(
                  "div",
                  { class: "field__row" },
                  h("label", { class: "field__label", for: id }, rotulo),
                  h("span", { class: "field__counter", id: `${id}-contador` }, contador)
              )
            : h("label", { class: "field__label", for: id }, rotulo, opcional && h("span", { class: "optional" }, " (opcional)")),
        iconeCampo ? h("div", { class: "input-wrap" }, icon(iconeCampo), controle) : controle,
        dica && h("p", { class: "field__hint", id: `${id}-dica` }, dica),
        h("p", { class: "field__error", id: `${id}-erro` }, erro && [icon(CircleAlert, { size: 14 }), erro])
    );
}

const LIMITE = 200;
const textarea = h("textarea", { class: "textarea", maxlength: LIMITE, placeholder: "Descreva o que aconteceu, quando começou e o que já tentou." });
const campoDescricao = campo({ id: "sg-descricao", rotulo: "Descrição", controle: textarea, contador: `0/${LIMITE}`, dica: "Quanto mais detalhes, mais rápido o atendimento." });
const contador = $(".field__counter", campoDescricao);
textarea.addEventListener("input", () => {
    const n = textarea.value.length;
    contador.textContent = `${n}/${LIMITE}`;
    contador.classList.toggle("is-near", n >= LIMITE * 0.8);
});

// Campo de erro "vivo": corrige o erro ao digitar
const inputTitulo = h("input", { class: "input", type: "text", value: "Erro" });
const campoTitulo = campo({ id: "sg-titulo-erro", rotulo: "Título", controle: inputTitulo, erro: "Use pelo menos 5 caracteres." });
inputTitulo.addEventListener("input", () => {
    const valido = inputTitulo.value.trim().length >= 5;
    campoTitulo.classList.toggle("is-invalid", !valido);
    if (valido) inputTitulo.removeAttribute("aria-invalid");
    else inputTitulo.setAttribute("aria-invalid", "true");
});

render(
    demo("campos"),
    h(
        "div",
        { class: "sg-grid sg-grid--2" },
        campo({
            id: "sg-normal",
            rotulo: "Título do chamado",
            dica: "Resuma o problema em uma frase.",
            controle: h("input", { class: "input", type: "text", placeholder: "Ex.: Impressora não imprime" }),
        }),
        campo({
            id: "sg-foco",
            rotulo: "Foco (simulado)",
            classe: "sg-force-focus",
            controle: h("input", { class: "input", type: "text", value: "Campo em foco" }),
        }),
        campo({
            id: "sg-email",
            rotulo: "E-mail",
            iconeCampo: Mail,
            controle: h("input", { class: "input", type: "email", autocomplete: "email", placeholder: "nome@empresa.com" }),
        }),
        campoTitulo,
        campo({
            id: "sg-busca",
            rotulo: "Buscar",
            opcional: true,
            iconeCampo: Search,
            controle: h("input", { class: "input", type: "search", placeholder: "Número, título ou pessoa" }),
        }),
        campo({
            id: "sg-categoria",
            rotulo: "Categoria",
            controle: h("select", { class: "select" }, CATEGORIAS.map((c) => h("option", { value: c.valor }, c.valor))),
        }),
        campoDescricao,
        campo({
            id: "sg-desabilitado",
            rotulo: "Desabilitado",
            controle: h("input", { class: "input", type: "text", value: "Não editável", disabled: true }),
        })
    )
);

// ==========================================================
// Chips, segmentado, switch
// ==========================================================
const dicaPrioridade = h("p", { class: "field__hint", id: "sg-prioridade-dica", "aria-live": "polite" }, prioridadeInfo("Média").dica);

const segmentado = h(
    "div",
    { class: "segmented", role: "radiogroup", "aria-labelledby": "sg-prioridade-rotulo", "aria-describedby": "sg-prioridade-dica" },
    PRIORIDADES.map((p) =>
        h(
            "label",
            { class: "segmented__option", dataset: { tone: p.tone } },
            h("input", { type: "radio", name: "sg-prioridade", value: p.valor, checked: p.valor === "Média" }),
            p.valor
        )
    )
);
segmentado.addEventListener("change", (e) => {
    dicaPrioridade.textContent = prioridadeInfo(e.target.value).dica;
});

const interruptor = (rotulo, attrs = {}) =>
    h("label", { class: "switch" }, h("input", { type: "checkbox", role: "switch", ...attrs }), h("span", {}, rotulo));

render(
    demo("selecao"),
    bloco(
        null,
        h(
            "fieldset",
            { class: "field sg-fieldset" },
            h("legend", { class: "field__label" }, "Categoria"),
            h(
                "div",
                { class: "chip-group" },
                CATEGORIAS.map((c, i) =>
                    h("label", { class: "chip" }, h("input", { type: "radio", name: "sg-categoria-chip", value: c.valor, checked: i === 0 }), icon(c.icon), c.valor)
                )
            )
        )
    ),
    bloco(
        null,
        h("div", { class: "field" }, h("span", { class: "field__label", id: "sg-prioridade-rotulo" }, "Prioridade"), segmentado, dicaPrioridade)
    ),
    bloco(
        "Switch",
        h(
            "div",
            { class: "stack sg-switches" },
            interruptor("Notificações por e-mail", { checked: true }),
            interruptor("Som ao receber mensagem"),
            interruptor("Indisponível (desabilitado)", { disabled: true })
        )
    )
);

// ==========================================================
// Cards
// ==========================================================
const STATS = [
    { tom: "info", rotulo: "Abertos", valor: 18, icone: CircleDot, meta: "+3 desde ontem" },
    { tom: "warning", rotulo: "Em análise", valor: 7, icone: Loader, meta: "2 aguardando resposta" },
    { tom: "success", rotulo: "Resolvidos", valor: 132, icone: CircleCheck, meta: "Nos últimos 30 dias" },
    { tom: "danger", rotulo: "Muito alta", valor: 2, icone: TriangleAlert, meta: "Atenção imediata" },
    { tom: "orange", rotulo: "Alta", valor: 5, icone: Flame, meta: "Na fila" },
    { tom: "brand", rotulo: "Tempo médio", valor: 42, icone: Clock, meta: "Minutos até assumir" },
    { tom: "neutral", rotulo: "Sem técnico", valor: 4, icone: UserX, meta: "Aguardando atribuição" },
];

const statCard = ({ tom, rotulo, valor, icone, meta }) =>
    h(
        "div",
        { class: "card stat", dataset: { tone: tom } },
        h("span", { class: "stat__label" }, rotulo),
        h("strong", { class: "stat__value num", dataset: { destino: valor } }, "0"),
        h("span", { class: "stat__icon" }, icon(icone)),
        h("span", { class: "stat__meta" }, meta)
    );

const gradeStats = h("div", { class: "sg-grid sg-grid--stats" }, STATS.map(statCard));

render(
    demo("cards"),
    h(
        "div",
        { class: "sg-grid sg-grid--3" },
        h(
            "article",
            { class: "card" },
            h("div", { class: "card__header" }, h("h3", { class: "card__title" }, "Card padrão"), badgeStatus("aberto")),
            h("p", { class: "muted text-sm" }, "Superfície 1, borda e raio grande. Usado para agrupar conteúdo relacionado.")
        ),
        h(
            "a",
            {
                class: "card card--interactive",
                href: "#cards",
                onClick: (e) => {
                    e.preventDefault();
                    toast.info("Card interativo clicado");
                },
            },
            h("div", { class: "card__header" }, h("span", { class: "card__title num" }, formatarNumeroChamado(42)), badgePrioridade("Alta")),
            h("p", { class: "text-sm" }, "Impressora do 2º andar não imprime"),
            h("p", { class: "muted text-xs sg-card-meta" }, "Card interativo — passe o mouse ou foque com Tab.")
        ),
        h(
            "article",
            { class: "card card--flush" },
            h("div", { class: "sg-flush-head" }, h("h3", { class: "card__title" }, "Card flush")),
            h("p", { class: "muted text-sm sg-flush-body" }, "Sem padding — para tabelas e listas que encostam na borda.")
        )
    ),
    bloco("Stat cards (um por tom)", gradeStats)
);

// Contadores animam quando os stats aparecem na tela
new IntersectionObserver(
    (entradas, obs) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        for (const el of $$(".stat__value", gradeStats)) animarNumero(el, Number(el.dataset.destino), { formatar: formatarNumero });
    },
    { threshold: 0.3 }
).observe(gradeStats);

// ==========================================================
// Badges
// ==========================================================
render(
    demo("badges"),
    bloco("Status", linha(Object.keys(STATUS).map(badgeStatus), badgeStatus("desconhecido"))),
    bloco(
        "Prioridade",
        linha(PRIORIDADES.map((p) => badgePrioridade(p.valor))),
        linha(PRIORIDADES.map((p) => badgePrioridade(p.valor, { outline: false })))
    ),
    bloco("Categoria", linha(CATEGORIAS.map((c) => badgeCategoria(c.valor)))),
    bloco(
        "Tons e contadores",
        linha(
            ["brand", "info", "warning", "success", "danger", "orange", "neutral"].map((t) =>
                h("span", { class: "badge badge--outline", dataset: { tone: t } }, t)
            ),
            h("span", { class: "count" }, "3"),
            h("span", { class: "count" }, "128")
        )
    )
);

// ==========================================================
// Tabela
// ==========================================================
const agora = Date.now();
const CHAMADOS = [
    { numero: 42, titulo: "Impressora do 2º andar não imprime", categoria: "Impressora", prioridade: "Alta", status: "aberto", pessoa: "Ana Souza", data: agora - 35 * 60e3 },
    { numero: 41, titulo: "Sem acesso à pasta compartilhada do financeiro", categoria: "Acesso", prioridade: "Muito Alta", status: "analise", pessoa: "Bruno Lima", data: agora - 5 * 3600e3 },
    { numero: 40, titulo: "Outlook pedindo senha toda hora", categoria: "E-mail", prioridade: "Média", status: "analise", pessoa: "Carla Mendes", data: agora - 26 * 3600e3 },
    { numero: 39, titulo: "Wi-Fi da sala de reunião instável", categoria: "Rede", prioridade: "Baixa", status: "resolvido", pessoa: "Diego Rocha", data: agora - 4 * 86400e3 },
];

const tabela = h(
    "table",
    { class: "table table--responsive" },
    h("caption", { class: "sr-only" }, "Chamados de exemplo"),
    h(
        "thead",
        {},
        h("tr", {}, ["Nº", "Título", "Categoria", "Prioridade", "Status", "Solicitante", "Aberto"].map((c) => h("th", { scope: "col" }, c)))
    ),
    h(
        "tbody",
        {},
        CHAMADOS.map((c) =>
            h(
                "tr",
                {},
                h("td", { "data-label": "Nº", class: "num" }, formatarNumeroChamado(c.numero)),
                h(
                    "td",
                    { class: "cell-full" },
                    h(
                        "a",
                        {
                            class: "row-link",
                            href: "#tabela",
                            onClick: (e) => {
                                e.preventDefault();
                                toast.info(`Abriria o chamado ${formatarNumeroChamado(c.numero)}`);
                            },
                        },
                        c.titulo
                    )
                ),
                h("td", { "data-label": "Categoria" }, badgeCategoria(c.categoria)),
                h("td", { "data-label": "Prioridade" }, badgePrioridade(c.prioridade)),
                h("td", { "data-label": "Status" }, badgeStatus(c.status)),
                h("td", { "data-label": "Solicitante" }, h("span", { class: "cluster sg-pessoa" }, avatar(c.pessoa, { tamanho: "sm" }), c.pessoa)),
                h("td", { "data-label": "Aberto", class: "muted" }, h("time", { datetime: new Date(c.data).toISOString(), title: formatarDataHora(c.data) }, tempoRelativo(c.data)))
            )
        )
    )
);

render(demo("tabela"), h("div", { class: "card card--flush" }, h("div", { class: "table-wrap" }, tabela)));

// ==========================================================
// Abas
// ==========================================================
const ABAS = [
    { valor: "abertos", rotulo: "Abertos", status: "aberto" },
    { valor: "analise", rotulo: "Em análise", status: "analise" },
    { valor: "resolvidos", rotulo: "Resolvidos", status: "resolvido" },
];

const painelAbas = h("div", { class: "sg-tabpanel", role: "tabpanel", id: "sg-painel", tabindex: "0" });
const listaAbas = h(
    "div",
    { class: "tabs", role: "tablist", "aria-label": "Filtrar por status" },
    ABAS.map((a, i) =>
        h(
            "button",
            {
                class: "tabs__tab",
                role: "tab",
                type: "button",
                id: `sg-aba-${a.valor}`,
                "aria-selected": String(i === 0),
                "aria-controls": "sg-painel",
                dataset: { value: a.valor },
            },
            a.rotulo,
            h("span", { class: "count" }, String(CHAMADOS.filter((c) => c.status === a.status).length))
        )
    )
);

function mostrarAba(valor) {
    const aba = ABAS.find((a) => a.valor === valor);
    const itens = CHAMADOS.filter((c) => c.status === aba.status);
    painelAbas.setAttribute("aria-labelledby", `sg-aba-${valor}`);
    render(
        painelAbas,
        itens.length
            ? h(
                  "ul",
                  { class: "sg-tablist-items" },
                  itens.map((c) => h("li", {}, h("span", { class: "num muted" }, formatarNumeroChamado(c.numero)), " ", c.titulo))
              )
            : h("p", { class: "muted text-sm" }, "Nenhum chamado neste status.")
    );
    stagger(painelAbas.firstElementChild);
}

render(demo("abas"), h("div", { class: "stack" }, listaAbas, painelAbas));
criarAbas(listaAbas, { aoMudar: mostrarAba });
mostrarAba("abertos");

// ==========================================================
// Avatares
// ==========================================================
const NOMES = ["Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Rocha", "Elisa Prado", "Felipe Dias", "Gabi"];

render(
    demo("avatares"),
    bloco("Cores derivadas do nome", linha(NOMES.map((n) => avatar(n)))),
    bloco(
        "Tamanhos",
        h(
            "div",
            { class: "cluster sg-row sg-row--baseline" },
            ["sm", null, "lg", "xl"].map((t) => h("span", { class: "sg-avatar-size" }, avatar("Ana Souza", { tamanho: t }), h("code", {}, t || "padrão")))
        )
    ),
    bloco("Pilha", h("div", { class: "sg-avatar-stack" }, NOMES.slice(0, 4).map((n) => avatar(n)), h("span", { class: "count" }, "+3")))
);

// ==========================================================
// Skeletons
// ==========================================================
const alvoCarregamento = h("div", { class: "sg-load-target" });

function simularCarregamento() {
    render(alvoCarregamento, carregando(...skeletonLinhasLista(3)));
    setTimeout(() => {
        render(
            alvoCarregamento,
            h(
                "ul",
                { class: "sg-load-list stagger" },
                CHAMADOS.slice(0, 3).map((c, i) =>
                    h(
                        "li",
                        { style: { "--i": i } },
                        h("span", { class: "num muted" }, formatarNumeroChamado(c.numero)),
                        h("span", { class: "truncate" }, c.titulo),
                        badgeStatus(c.status)
                    )
                )
            )
        );
    }, 1600);
}

render(
    demo("skeletons"),
    h(
        "div",
        { class: "sg-grid sg-grid--2" },
        bloco("Linhas", h("div", { class: "card" }, carregando(skeleton({ w: "45%", h: "20px" }), ...skeletonLinhas(4)))),
        bloco("Avatar + texto", h("div", { class: "card cluster sg-skel-avatar" }, skeleton({ w: "48px", h: "48px", circle: true }), h("div", { class: "stack sg-flex-1" }, skeletonLinhas(2)))),
        bloco("Cards", h("div", { class: "sg-grid sg-grid--2" }, skeletonCards(2))),
        bloco("Lista", h("div", { class: "card card--flush" }, skeletonLinhasLista(3)))
    ),
    bloco(
        "Skeleton → conteúdo",
        h(
            "div",
            { class: "card card--flush" },
            h("div", { class: "sg-flush-head spread" }, h("span", { class: "card__title" }, "Últimos chamados"), botao("btn--secondary btn--sm", [icon(RefreshCw), "Recarregar"], { onClick: simularCarregamento })),
            alvoCarregamento
        )
    )
);
simularCarregamento();

// ==========================================================
// Estado vazio
// ==========================================================
render(
    demo("vazio"),
    h(
        "div",
        { class: "sg-grid sg-grid--2" },
        h(
            "div",
            { class: "card" },
            estadoVazio({
                icone: Inbox,
                titulo: "Nenhum chamado por aqui",
                texto: "Quando você abrir um chamado, ele aparece nesta lista com o status atualizado em tempo real.",
                acao: { label: "Abrir chamado", icone: Plus, onClick: () => toast.info("Iria para Abrir chamado") },
            })
        ),
        h(
            "div",
            { class: "card" },
            estadoVazio({
                icone: CircleAlert,
                titulo: "Não foi possível carregar",
                texto: "Verifique sua conexão e tente de novo.",
                acao: { label: "Tentar novamente", icone: RefreshCw, variante: "btn--secondary", onClick: () => toast.success("Carregado!") },
            })
        )
    )
);

// ==========================================================
// Toasts e confirmação
// ==========================================================
/** Mostra o resultado do diálogo como toast. */
async function perguntar(opcoes) {
    const ok = await confirmar(opcoes);
    toast.info(ok ? "Você confirmou" : "Você cancelou", { duration: 2500 });
}

render(
    demo("feedback"),
    bloco(
        "Toasts",
        linha(
            botao("btn--secondary", "Sucesso", { onClick: () => toast.success("Chamado criado", { message: `Número ${formatarNumeroChamado(43)}` }) }),
            botao("btn--secondary", "Erro", { onClick: () => toast.error("Não foi possível enviar", { message: "Verifique sua conexão e tente novamente." }) }),
            botao("btn--secondary", "Info com ação", {
                onClick: () =>
                    toast.info("Chamado movido para Em análise", {
                        action: { label: "Desfazer", onClick: () => toast.success("Movimento desfeito") },
                        duration: 8000,
                    }),
            }),
            botao("btn--secondary", "Aviso", { onClick: () => toast.warning("Sua sessão expira em 5 minutos") }),
            botao("btn--ghost", "Sem tempo (fixo)", { onClick: () => toast.info("Fica até ser fechado", { duration: 0 }) })
        )
    ),
    bloco(
        "confirmar()",
        linha(
            botao("btn--primary", "Marca", { onClick: () => perguntar({ titulo: `Assumir chamado ${formatarNumeroChamado(42)}?`, mensagem: "Ele sai da fila e passa a ser seu.", confirmar: "Assumir" }) }),
            botao("btn--success", "Sucesso", { onClick: () => perguntar({ titulo: `Resolver chamado ${formatarNumeroChamado(42)}?`, mensagem: "O solicitante será avisado.", confirmar: "Resolver", tom: "success" }) }),
            botao("btn--secondary", "Aviso", { onClick: () => perguntar({ titulo: "Reabrir chamado?", mensagem: "Ele volta para a fila como Aberto.", confirmar: "Reabrir", tom: "warning" }) }),
            botao("btn--danger", "Perigo", { onClick: () => perguntar({ titulo: "Excluir mensagem?", mensagem: "Essa ação não pode ser desfeita.", confirmar: "Excluir", tom: "danger" }) })
        )
    )
);

// ==========================================================
// Movimento
// ==========================================================
const numeroDemo = h("strong", { class: "num sg-counter" }, "0");
const statPulso = statCard({ tom: "success", rotulo: "Resolvidos hoje", valor: 12, icone: CircleCheck, meta: "Pulsa quando muda em tempo real" });
$(".stat__value", statPulso).textContent = "12";
$(".stat__value", statPulso).dataset.valor = "12";
const cardTremor = h("div", { class: "card sg-motion-card" }, h("p", { class: "text-sm" }, "Erro de login: ", h("strong", {}, "shake"), " curto."));
const itemDestaque = h("div", { class: "card sg-motion-card" }, h("p", { class: "text-sm" }, "Item recém-atualizado recebe um ", h("strong", {}, "destaque"), "."));
const listaStagger = h(
    "ul",
    { class: "sg-stagger-list" },
    Array.from({ length: 8 }, (_, i) => h("li", { style: { viewTransitionName: `sg-item-${i}` } }, h("span", { class: "num" }, String(i + 1).padStart(2, "0"))))
);

render(
    demo("movimento"),
    h(
        "div",
        { class: "sg-grid sg-grid--2" },
        bloco(
            "animarNumero()",
            h(
                "div",
                { class: "card stack" },
                numeroDemo,
                linha(
                    botao("btn--primary btn--sm", [icon(Shuffle), "Sortear"], {
                        onClick: () => animarNumero(numeroDemo, Math.floor(Math.random() * 10000), { formatar: formatarNumero }),
                    }),
                    botao("btn--ghost btn--sm", "Zerar", { onClick: () => animarNumero(numeroDemo, 0, { formatar: formatarNumero }) })
                )
            )
        ),
        bloco(
            "pulsar()",
            h(
                "div",
                { class: "stack" },
                statPulso,
                linha(
                    botao("btn--secondary btn--sm", [icon(Play), "Novo resolvido"], {
                        onClick: () => {
                            const valor = $(".stat__value", statPulso);
                            animarNumero(valor, Number(valor.dataset.valor) + 1, { duracao: 500 });
                            pulsar(statPulso);
                        },
                    })
                )
            )
        ),
        bloco("tremer()", h("div", { class: "stack" }, cardTremor, linha(botao("btn--secondary btn--sm", [icon(Play), "Tremer"], { onClick: () => tremer(cardTremor) })))),
        bloco("destacar()", h("div", { class: "stack" }, itemDestaque, linha(botao("btn--secondary btn--sm", [icon(Play), "Destacar"], { onClick: () => destacar(itemDestaque) })))),
        bloco(
            "stagger() e comTransicao()",
            h(
                "div",
                { class: "stack sg-span-2" },
                listaStagger,
                linha(
                    botao("btn--secondary btn--sm", [icon(Play), "Repetir entrada"], { onClick: () => stagger(listaStagger) }),
                    botao("btn--secondary btn--sm", [icon(Shuffle), "Embaralhar (View Transition)"], {
                        onClick: () =>
                            comTransicao(() => {
                                const itens = [...listaStagger.children].sort(() => Math.random() - 0.5);
                                listaStagger.classList.remove("stagger");
                                listaStagger.append(...itens);
                            }),
                    })
                )
            )
        )
    )
);
stagger(listaStagger);

// ---------- Início ----------
sincronizarControles();
stagger($(".sg-main"), { max: 6 });
