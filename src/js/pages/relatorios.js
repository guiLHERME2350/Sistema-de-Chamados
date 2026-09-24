import {
    CircleCheck,
    CircleDot,
    Download,
    Hourglass,
    MessageSquareReply,
    Percent,
    RefreshCw,
    Ticket,
    Trophy,
    CircleAlert,
    CalendarRange,
} from "lucide";
import { iniciarPagina } from "../components/app-shell.js";
import { avatar } from "../components/avatar.js";
import { estadoVazio } from "../components/empty-state.js";
import { carregando, skeleton } from "../components/skeleton.js";
import { toast } from "../components/toast.js";
import { movimentoReduzido } from "../core/theme.js";
import { listarChamados } from "../services/chamados.js";
import { CATEGORIAS, PRIORIDADES, STATUS, STATUS_ORDEM } from "../utils/constants.js";
import { $, h, render } from "../utils/dom.js";
import {
    formatarDataCurta,
    formatarDataHora,
    formatarDuracao,
    formatarNumero,
    formatarNumeroChamado,
    plural,
} from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { logError } from "../utils/logger.js";
import { animarNumero, stagger } from "../utils/motion.js";

const DIA = 24 * 60 * 60 * 1000;
const PERIODOS = ["7", "30", "90", "tudo"];
const PERIODO_PADRAO = "30";
const MAX_DIAS_DIARIO = 120; // acima disso a série temporal agrupa por semana
const MAX_TECNICOS = 8;

const el = {
    subtitulo: $("#rel-subtitulo"),
    periodo: $("#rel-periodo"),
    exportar: $("#rel-exportar"),
    anuncio: $("#rel-anuncio"),
    kpis: $("#rel-kpis"),
    corpo: $("#rel-corpo"),
};

let chamados = null;
let ChartJS = null;
const graficos = new Map(); // id → instância do Chart
let ultimoCalculo = null;

/* ---------- Período (estado na URL) ---------- */

function periodoDaUrl() {
    const valor = new URLSearchParams(location.search).get("periodo");
    return PERIODOS.includes(valor) ? valor : PERIODO_PADRAO;
}

let periodo = periodoDaUrl();

function descreverPeriodo(p) {
    return p === "tudo" ? "todo o histórico" : `últimos ${p} dias`;
}

function inicioDoDia(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function inicioDoPeriodo(p, agora = new Date()) {
    if (p === "tudo") return null;
    const d = inicioDoDia(agora);
    d.setDate(d.getDate() - (Number(p) - 1));
    return d;
}

/* ---------- Cálculos ---------- */

const media = (valores) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);

function contarPor(lista, chave) {
    const mapa = new Map();
    for (const item of lista) {
        const k = chave(item);
        mapa.set(k, (mapa.get(k) || 0) + 1);
    }
    return mapa;
}

function calcular(todos, p) {
    const agora = new Date();
    const inicio = inicioDoPeriodo(p, agora);
    const noPeriodo = (d) => !!d && (!inicio || d >= inicio);

    const criados = todos.filter((c) => noPeriodo(c.dataCriacao));
    const resolvidos = todos.filter((c) => c.status === "resolvido" && noPeriodo(c.dataResolucao));
    const criadosResolvidos = criados.filter((c) => c.status === "resolvido");

    const temposResposta = criados
        .filter((c) => c.dataAssumido && c.dataCriacao)
        .map((c) => c.dataAssumido - c.dataCriacao)
        .filter((ms) => ms >= 0);
    const temposResolucao = resolvidos
        .filter((c) => c.dataCriacao)
        .map((c) => c.dataResolucao - c.dataCriacao)
        .filter((ms) => ms >= 0);

    const kpis = {
        total: criados.length,
        abertos: todos.filter((c) => c.status !== "resolvido").length,
        resolvidos: resolvidos.length,
        taxa: criados.length ? Math.round((criadosResolvidos.length / criados.length) * 100) : null,
        resposta: media(temposResposta),
        resolucao: media(temposResolucao),
        amostraResposta: temposResposta.length,
        amostraResolucao: temposResolucao.length,
    };

    return {
        inicio,
        agora,
        criados,
        resolvidos,
        kpis,
        serie: serieTemporal(criados, resolvidos, inicio, agora, todos),
        categorias: porCategoria(criados),
        prioridades: porPrioridade(criados),
        status: porStatus(criados),
        tecnicos: rankingTecnicos(resolvidos),
    };
}

function serieTemporal(criados, resolvidos, inicio, agora, todos) {
    const fim = inicioDoDia(agora);
    let comeco = inicio;
    if (!comeco) {
        const datas = todos.map((c) => c.dataCriacao?.getTime()).filter(Boolean);
        comeco = inicioDoDia(datas.length ? Math.min(...datas) : agora);
    }
    const dias = Math.round((fim - comeco) / DIA) + 1;
    const passo = dias > MAX_DIAS_DIARIO ? 7 : 1;
    const qtd = Math.ceil(dias / passo);

    const buckets = Array.from({ length: qtd }, (_, i) => {
        const d = new Date(comeco);
        d.setDate(d.getDate() + i * passo);
        return { data: d, criados: 0, resolvidos: 0 };
    });
    const indice = (d) => Math.floor(Math.round((inicioDoDia(d) - comeco) / DIA) / passo);

    for (const c of criados) buckets[indice(c.dataCriacao)] && buckets[indice(c.dataCriacao)].criados++;
    for (const c of resolvidos) buckets[indice(c.dataResolucao)] && buckets[indice(c.dataResolucao)].resolvidos++;

    return { buckets, semanal: passo === 7 };
}

function porCategoria(lista) {
    const mapa = contarPor(lista, (c) => c.categoria || "Outros");
    const ordem = CATEGORIAS.map((c) => c.valor);
    return [...mapa.entries()]
        .map(([rotulo, valor]) => ({ rotulo, valor }))
        .sort((a, b) => b.valor - a.valor || ordem.indexOf(a.rotulo) - ordem.indexOf(b.rotulo));
}

function porPrioridade(lista) {
    const mapa = contarPor(lista, (c) => c.prioridade || "Sem prioridade");
    const itens = PRIORIDADES.map((p) => ({ rotulo: p.valor, tom: p.tone, valor: mapa.get(p.valor) || 0 }));
    for (const [rotulo, valor] of mapa) {
        if (!PRIORIDADES.some((p) => p.valor === rotulo)) itens.push({ rotulo, tom: "neutral", valor });
    }
    return itens.filter((i) => i.valor > 0);
}

function porStatus(lista) {
    const mapa = contarPor(lista, (c) => c.status);
    return STATUS_ORDEM.map((s) => ({ rotulo: STATUS[s].label, tom: STATUS[s].tone, valor: mapa.get(s) || 0 }));
}

function rankingTecnicos(resolvidos) {
    const mapa = new Map();
    for (const c of resolvidos) {
        const nome = c.tecnicoNome || "Sem técnico atribuído";
        const item = mapa.get(nome) || { nome, valor: 0, tempos: [] };
        item.valor++;
        if (c.dataCriacao) item.tempos.push(c.dataResolucao - c.dataCriacao);
        mapa.set(nome, item);
    }
    return [...mapa.values()]
        .map((t) => ({ ...t, media: media(t.tempos) }))
        .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"))
        .slice(0, MAX_TECNICOS);
}

/* ---------- KPIs ---------- */

const KPIS = [
    { id: "total", rotulo: "Chamados no período", tom: "brand", icone: Ticket },
    { id: "abertos", rotulo: "Abertos agora", tom: "info", icone: CircleDot },
    { id: "resolvidos", rotulo: "Resolvidos no período", tom: "success", icone: CircleCheck },
    { id: "taxa", rotulo: "Taxa de resolução", tom: "warning", icone: Percent },
    { id: "resposta", rotulo: "1ª resposta (média)", tom: "orange", icone: MessageSquareReply },
    { id: "resolucao", rotulo: "Tempo de resolução (média)", tom: "danger", icone: Hourglass },
];

const kpiEls = {};

function montarKpis() {
    render(
        el.kpis,
        KPIS.map((k) => {
            const valor = h("strong", { class: "stat__value num" }, "—");
            const meta = h("span", { class: "stat__meta" }, "");
            kpiEls[k.id] = { valor, meta };
            return h(
                "article",
                { class: "card stat", dataset: { tone: k.tom } },
                h("span", { class: "stat__label" }, k.rotulo),
                valor,
                h("span", { class: "stat__icon" }, icon(k.icone)),
                meta
            );
        })
    );
    stagger(el.kpis);
}

function kpiSkeleton() {
    render(
        el.kpis,
        KPIS.map(() =>
            h(
                "div",
                { class: "skeleton-card", "aria-hidden": "true" },
                skeleton({ w: "60%", h: "12px" }),
                skeleton({ w: "45%", h: "28px" }),
                skeleton({ w: "80%", h: "10px" })
            )
        )
    );
}

function atualizarKpis({ kpis }) {
    if (!kpiEls.total?.valor.isConnected) montarKpis();

    const numero = (id, n, meta) => {
        animarNumero(kpiEls[id].valor, n, { formatar: formatarNumero });
        kpiEls[id].meta.textContent = meta;
    };
    const duracao = (id, ms, amostra) => {
        const alvo = kpiEls[id].valor;
        if (ms === null) {
            alvo.dataset.valor = "0";
            alvo.textContent = "—";
            kpiEls[id].meta.textContent = "Sem dados no período";
            return;
        }
        animarNumero(alvo, Math.round(ms), { formatar: formatarDuracao });
        kpiEls[id].meta.textContent = `Base: ${plural(amostra, "chamado")}`;
    };

    numero("total", kpis.total, `Criados nos ${descreverPeriodo(periodo)}`);
    numero("abertos", kpis.abertos, "Abertos ou em análise, independente do período");
    numero("resolvidos", kpis.resolvidos, "Com data de resolução no período");

    if (kpis.taxa === null) {
        kpiEls.taxa.valor.dataset.valor = "0";
        kpiEls.taxa.valor.textContent = "—";
        kpiEls.taxa.meta.textContent = "Sem chamados no período";
    } else {
        animarNumero(kpiEls.taxa.valor, kpis.taxa, { formatar: (n) => `${n}%` });
        kpiEls.taxa.meta.textContent = "Dos criados no período, já resolvidos";
    }

    duracao("resposta", kpis.resposta, kpis.amostraResposta);
    duracao("resolucao", kpis.resolucao, kpis.amostraResolucao);
}

/* ---------- Chart.js (carregado sob demanda) ---------- */

async function carregarChartJs() {
    if (ChartJS) return ChartJS;
    const {
        Chart,
        LineController,
        LineElement,
        PointElement,
        BarController,
        BarElement,
        DoughnutController,
        ArcElement,
        CategoryScale,
        LinearScale,
        Tooltip,
        Legend,
        Filler,
    } = await import("chart.js");
    Chart.register(
        LineController,
        LineElement,
        PointElement,
        BarController,
        BarElement,
        DoughnutController,
        ArcElement,
        CategoryScale,
        LinearScale,
        Tooltip,
        Legend,
        Filler
    );
    ChartJS = Chart;
    return Chart;
}

function lerTokens() {
    const estilo = getComputedStyle(document.documentElement);
    const v = (nome) => estilo.getPropertyValue(nome).trim();
    return {
        brand: v("--brand"),
        info: v("--info"),
        warning: v("--warning"),
        success: v("--success"),
        danger: v("--danger"),
        orange: v("--orange"),
        neutral: v("--text-muted"),
        muted: v("--text-muted"),
        text: v("--text"),
        border: v("--border"),
        borderStrong: v("--border-strong"),
        surface: v("--surface-1"),
        fonte: v("--font-sans"),
    };
}

/** "#a855f7" → "rgba(168, 85, 247, a)". Outras notações voltam como estão. */
function comAlfa(cor, alfa) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(cor);
    if (!m) return cor;
    const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

function opcoesBase(t) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: movimentoReduzido() ? false : { duration: 600, easing: "easeOutQuart" },
        locale: "pt-BR",
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: t.surface,
                borderColor: t.borderStrong,
                borderWidth: 1,
                titleColor: t.text,
                bodyColor: t.muted,
                padding: 10,
                cornerRadius: 8,
                boxPadding: 4,
                usePointStyle: true,
                titleFont: { weight: "600" },
            },
        },
    };
}

function eixos(t, { horizontal = false } = {}) {
    const valor = {
        beginAtZero: true,
        ticks: { precision: 0, color: t.muted, callback: (v) => formatarNumero(v) },
        grid: { color: t.border },
        border: { display: false },
    };
    const categoria = { ticks: { color: t.muted, autoSkipPadding: 12, maxRotation: 0 }, grid: { display: false }, border: { color: t.border } };
    return horizontal ? { x: valor, y: categoria } : { x: categoria, y: valor };
}

const rotuloContagem = (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ": " : ""}${plural(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed, "chamado")}`;

function criarGrafico(id, canvas, config) {
    graficos.get(id)?.destroy();
    graficos.set(id, new ChartJS(canvas, config));
}

function destruirGraficos() {
    for (const g of graficos.values()) g.destroy();
    graficos.clear();
}

/* ---------- Cards de gráfico ---------- */

function tabelaDados(legenda, colunas, linhas) {
    return h(
        "details",
        { class: "rel-dados" },
        h("summary", {}, "Ver dados"),
        h(
            "div",
            { class: "table-wrap" },
            h(
                "table",
                { class: "table" },
                h("caption", { class: "sr-only" }, legenda),
                h("thead", {}, h("tr", {}, colunas.map((c, i) => h("th", { scope: "col", class: i ? "num-col" : null }, c)))),
                h(
                    "tbody",
                    {},
                    linhas.map((l) => h("tr", {}, l.map((v, i) => (i ? h("td", { class: "num num-col" }, v) : h("th", { scope: "row" }, v)))))
                )
            )
        )
    );
}

function cardGrafico({ id, titulo, meta, resumo, dados, largo = false, alto = false }) {
    const canvas = h("canvas", { role: "img", "aria-label": resumo, id: `grafico-${id}` });
    const card = h(
        "section",
        { class: ["card", "rel-card", largo && "rel-card--largo"], "aria-labelledby": `titulo-${id}` },
        h(
            "header",
            { class: "card__header" },
            h("h2", { class: "card__title", id: `titulo-${id}` }, titulo),
            meta && h("span", { class: "rel-card__meta" }, meta)
        ),
        h("div", { class: ["rel-grafico", alto && "rel-grafico--alto"] }, canvas),
        dados
    );
    return { card, canvas };
}

function listarTexto(itens) {
    return itens.map((i) => `${i.rotulo} ${formatarNumero(i.valor)}`).join(", ");
}

const canvases = {};

/** Monta os cards (DOM) e depois pinta os gráficos. */
function desenharGraficos(dados) {
    destruirGraficos();
    const { serie, categorias, prioridades, status, tecnicos } = dados;
    const cards = [];

    // 1) Criados × resolvidos
    const rotulosSerie = serie.buckets.map((b) => (serie.semanal ? `Sem. ${formatarDataCurta(b.data)}` : formatarDataCurta(b.data)));
    const totalCriados = serie.buckets.reduce((s, b) => s + b.criados, 0);
    const totalResolvidos = serie.buckets.reduce((s, b) => s + b.resolvidos, 0);
    const pico = serie.buckets.reduce((m, b) => (b.criados > m.criados ? b : m), serie.buckets[0] || { criados: 0 });
    const unidade = serie.semanal ? "semana" : "dia";
    const linha = cardGrafico({
        id: "serie",
        titulo: `Criados × resolvidos por ${unidade}`,
        meta: descreverPeriodo(periodo),
        largo: true,
        resumo:
            `Gráfico de linhas: chamados criados e resolvidos por ${unidade} nos ${descreverPeriodo(periodo)}. ` +
            `Total de ${plural(totalCriados, "criado")} e ${plural(totalResolvidos, "resolvido")}.` +
            (pico?.criados ? ` Pico de ${plural(pico.criados, "chamado")} em ${formatarDataCurta(pico.data)}.` : ""),
        dados: tabelaDados(
            `Criados e resolvidos por ${unidade}`,
            [serie.semanal ? "Semana de" : "Dia", "Criados", "Resolvidos"],
            serie.buckets.map((b, i) => [rotulosSerie[i], formatarNumero(b.criados), formatarNumero(b.resolvidos)])
        ),
    });
    const legendaSerie = h(
        "div",
        { class: "rel-legenda", "aria-hidden": "true" },
        h("span", { style: { "--cor": "var(--brand)" } }, "Criados"),
        h("span", { style: { "--cor": "var(--success)" } }, "Resolvidos")
    );
    linha.card.querySelector(".card__header").append(legendaSerie);
    cards.push(linha.card);

    // 2) Categorias
    const cat = cardGrafico({
        id: "categoria",
        titulo: "Por categoria",
        meta: "Chamados criados",
        resumo: `Gráfico de barras horizontais: chamados por categoria. ${listarTexto(categorias)}.`,
        dados: tabelaDados("Chamados por categoria", ["Categoria", "Chamados"], categorias.map((c) => [c.rotulo, formatarNumero(c.valor)])),
    });
    cat.card.querySelector(".rel-grafico").style.setProperty("--barras", Math.max(categorias.length, 3));
    cat.card.querySelector(".rel-grafico").classList.add("rel-grafico--barras");
    cards.push(cat.card);

    // 3) Prioridade
    const prio = cardGrafico({
        id: "prioridade",
        titulo: "Por prioridade",
        meta: "Chamados criados",
        resumo: `Gráfico de rosca: chamados por prioridade. ${listarTexto(prioridades)}.`,
        dados: tabelaDados("Chamados por prioridade", ["Prioridade", "Chamados"], prioridades.map((p) => [p.rotulo, formatarNumero(p.valor)])),
    });
    cards.push(prio.card);

    // 4) Status
    const st = cardGrafico({
        id: "status",
        titulo: "Por status",
        meta: "Situação atual dos criados",
        resumo: `Gráfico de barras: situação atual dos chamados criados no período. ${listarTexto(status)}.`,
        dados: tabelaDados("Chamados por status", ["Status", "Chamados"], status.map((s) => [s.rotulo, formatarNumero(s.valor)])),
    });
    cards.push(st.card);

    // 5) Ranking de técnicos (CSS puro)
    cards.push(cardRanking(tecnicos));

    render(el.corpo, h("div", { class: "rel-grid" }, cards));
    stagger(el.corpo.firstChild);

    Object.assign(canvases, { serie: linha.canvas, categoria: cat.canvas, prioridade: prio.canvas, status: st.canvas });
    pintarGraficos(dados);
}

/** (Re)cria as instâncias do Chart.js com as cores atuais dos tokens — usado também na troca de tema. */
function pintarGraficos(dados) {
    destruirGraficos();
    const t = lerTokens();
    ChartJS.defaults.font.family = t.fonte;
    ChartJS.defaults.color = t.muted;
    ChartJS.defaults.borderColor = t.border;

    const { serie, categorias, prioridades, status } = dados;
    const rotulosSerie = serie.buckets.map((b) => (serie.semanal ? `Sem. ${formatarDataCurta(b.data)}` : formatarDataCurta(b.data)));

    const gradiente = (cor) => (ctx) => {
        const { chart } = ctx;
        const area = chart.chartArea;
        if (!area) return comAlfa(cor, 0.15);
        const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, comAlfa(cor, 0.28));
        g.addColorStop(1, comAlfa(cor, 0));
        return g;
    };
    const conjunto = (label, dadosSerie, cor) => ({
        label,
        data: dadosSerie,
        borderColor: cor,
        backgroundColor: gradiente(cor),
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: serie.buckets.length > 45 ? 0 : 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: cor,
        pointBorderColor: t.surface,
    });


    const base = () => opcoesBase(t);

    criarGrafico("serie", canvases.serie, {
        type: "line",
        data: {
            labels: rotulosSerie,
            datasets: [
                conjunto("Criados", serie.buckets.map((b) => b.criados), t.brand),
                conjunto("Resolvidos", serie.buckets.map((b) => b.resolvidos), t.success),
            ],
        },
        options: {
            ...base(),
            interaction: { mode: "index", intersect: false },
            scales: eixos(t),
            plugins: {
                ...base().plugins,
                tooltip: {
                    ...base().plugins.tooltip,
                    callbacks: {
                        title: (itens) => (serie.semanal ? `Semana de ${formatarDataCurta(serie.buckets[itens[0].dataIndex].data)}` : formatarDataCurta(serie.buckets[itens[0].dataIndex].data)),
                        label: rotuloContagem,
                    },
                },
            },
        },
    });

    criarGrafico("categoria", canvases.categoria, {
        type: "bar",
        data: {
            labels: categorias.map((c) => c.rotulo),
            datasets: [
                {
                    label: "Chamados",
                    data: categorias.map((c) => c.valor),
                    backgroundColor: comAlfa(t.brand, 0.75),
                    hoverBackgroundColor: t.brand,
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 26,
                },
            ],
        },
        options: {
            ...base(),
            indexAxis: "y",
            scales: eixos(t, { horizontal: true }),
            plugins: { ...base().plugins, tooltip: { ...base().plugins.tooltip, callbacks: { label: (ctx) => ` ${plural(ctx.parsed.x, "chamado")}` } } },
        },
    });

    const totalPrio = prioridades.reduce((s, p) => s + p.valor, 0);
    criarGrafico("prioridade", canvases.prioridade, {
        type: "doughnut",
        data: {
            labels: prioridades.map((p) => p.rotulo),
            datasets: [
                {
                    data: prioridades.map((p) => p.valor),
                    backgroundColor: prioridades.map((p) => t[p.tom] || t.neutral),
                    borderColor: t.surface,
                    borderWidth: 3,
                    hoverOffset: 6,
                },
            ],
        },
        options: {
            ...base(),
            cutout: "66%",
            plugins: {
                ...base().plugins,
                legend: {
                    display: true,
                    position: "bottom",
                    labels: { color: t.muted, usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 14 },
                },
                tooltip: {
                    ...base().plugins.tooltip,
                    callbacks: {
                        label: (ctx) => ` ${plural(ctx.parsed, "chamado")} (${totalPrio ? Math.round((ctx.parsed / totalPrio) * 100) : 0}%)`,
                    },
                },
            },
        },
    });

    criarGrafico("status", canvases.status, {
        type: "bar",
        data: {
            labels: status.map((s) => s.rotulo),
            datasets: [
                {
                    label: "Chamados",
                    data: status.map((s) => s.valor),
                    backgroundColor: status.map((s) => comAlfa(t[s.tom], 0.75)),
                    hoverBackgroundColor: status.map((s) => t[s.tom]),
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 56,
                },
            ],
        },
        options: {
            ...base(),
            scales: eixos(t),
            plugins: { ...base().plugins, tooltip: { ...base().plugins.tooltip, callbacks: { label: (ctx) => ` ${plural(ctx.parsed.y, "chamado")}` } } },
        },
    });
}

function cardRanking(tecnicos) {
    const max = Math.max(1, ...tecnicos.map((t) => t.valor));
    const conteudo = tecnicos.length
        ? h(
              "ol",
              { class: "rel-ranking" },
              tecnicos.map((tec, i) =>
                  h(
                      "li",
                      { class: "rel-ranking__item" },
                      h("span", { class: "rel-ranking__pos num", "aria-hidden": "true" }, i + 1),
                      avatar(tec.nome, { tamanho: "sm" }),
                      h(
                          "div",
                          { class: "rel-ranking__info" },
                          h(
                              "div",
                              { class: "rel-ranking__linha" },
                              h("span", { class: "rel-ranking__nome truncate" }, tec.nome),
                              h("strong", { class: "num" }, formatarNumero(tec.valor), h("span", { class: "sr-only" }, " resolvidos"))
                          ),
                          h(
                              "span",
                              { class: "rel-ranking__barra", "aria-hidden": "true" },
                              h("span", { class: "rel-ranking__preenchimento", style: { "--p": String(tec.valor / max), "--i": String(i) } })
                          ),
                          h("span", { class: "rel-ranking__meta" }, `Resolução média: ${formatarDuracao(tec.media)}`)
                      )
                  )
              )
          )
        : h("p", { class: "rel-card__vazio" }, "Nenhum chamado resolvido no período.");

    return h(
        "section",
        { class: "card rel-card", "aria-labelledby": "titulo-ranking" },
        h(
            "header",
            { class: "card__header" },
            h("h2", { class: "card__title rel-card__titulo-icone", id: "titulo-ranking" }, icon(Trophy), "Técnicos que mais resolveram"),
            h("span", { class: "rel-card__meta" }, `Top ${MAX_TECNICOS}`)
        ),
        conteudo
    );
}

/* ---------- Exportação CSV ---------- */

function celulaCsv(valor) {
    let texto = valor === null || valor === undefined ? "" : String(valor);
    // Evita que o Excel interprete o conteúdo como fórmula
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const minutos = (a, b) => (a && b ? Math.round((b - a) / 60000) : "");

function exportarCsv() {
    if (!ultimoCalculo?.criados.length) return;
    const cabecalho = [
        "Número",
        "Título",
        "Categoria",
        "Prioridade",
        "Status",
        "Solicitante",
        "E-mail",
        "Técnico",
        "Criado em",
        "Assumido em",
        "Resolvido em",
        "1ª resposta (min)",
        "Resolução (min)",
    ];
    const linhas = ultimoCalculo.criados.map((c) => [
        formatarNumeroChamado(c.numero),
        c.titulo,
        c.categoria,
        c.prioridade,
        STATUS[c.status]?.label || c.status,
        c.usuarioNome,
        c.usuarioEmail,
        c.tecnicoNome || "",
        formatarDataHora(c.dataCriacao, ""),
        formatarDataHora(c.dataAssumido, ""),
        formatarDataHora(c.dataResolucao, ""),
        minutos(c.dataCriacao, c.dataAssumido),
        minutos(c.dataCriacao, c.dataResolucao),
    ]);

    const csv = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const hoje = new Date().toISOString().slice(0, 10);
    const sufixo = periodo === "tudo" ? "tudo" : `${periodo}d`;
    const link = h("a", { href: url, download: `chamados-${sufixo}-${hoje}.csv`, hidden: true });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast.success("CSV exportado", { message: plural(linhas.length, "chamado"), duration: 3000 });
}

/* ---------- Estados e fluxo ---------- */

function mostrarSkeleton() {
    kpiSkeleton();
    render(
        el.corpo,
        carregando(
            h(
                "div",
                { class: "rel-grid" },
                h("div", { class: "skeleton-card rel-card--largo", "aria-hidden": "true" }, skeleton({ w: "30%", h: "16px" }), skeleton({ h: "260px", r: "var(--radius-md)" })),
                [1, 2, 3, 4].map(() =>
                    h("div", { class: "skeleton-card", "aria-hidden": "true" }, skeleton({ w: "40%", h: "16px" }), skeleton({ h: "220px", r: "var(--radius-md)" }))
                )
            )
        )
    );
}

function mostrarErro(erro) {
    logError(erro, "relatorios:carregar");
    destruirGraficos();
    render(el.kpis);
    for (const k of Object.keys(kpiEls)) delete kpiEls[k];
    el.exportar.disabled = true;
    toast.error("Não foi possível carregar os relatórios", { message: "Verifique sua conexão e tente novamente." });
    render(
        el.corpo,
        h(
            "div",
            { class: "card" },
            estadoVazio({
                icone: CircleAlert,
                tom: "danger",
                titulo: "Erro ao carregar os dados",
                texto: "Os chamados não puderam ser lidos agora.",
                acao: { label: "Tentar novamente", icone: RefreshCw, variante: "btn--secondary", onClick: carregar },
            })
        )
    );
}

function atualizar({ anunciar = false } = {}) {
    if (!chamados || !ChartJS) return;
    const dados = calcular(chamados, periodo);
    ultimoCalculo = dados;

    el.subtitulo.textContent = `Indicadores dos ${descreverPeriodo(periodo)} · ${plural(dados.criados.length, "chamado")}`;
    el.exportar.disabled = dados.criados.length === 0;
    atualizarKpis(dados);

    if (!dados.criados.length && !dados.resolvidos.length) {
        destruirGraficos();
        render(
            el.corpo,
            h(
                "div",
                { class: "card anim-in" },
                estadoVazio({
                    icone: CalendarRange,
                    titulo: "Nenhum chamado neste período",
                    texto: periodo === "tudo" ? "Ainda não há chamados registrados." : "Tente um período maior para ver os gráficos.",
                    acao: periodo === "tudo" ? null : { label: "Ver todo o histórico", variante: "btn--secondary", onClick: () => trocarPeriodo("tudo") },
                })
            )
        );
    } else {
        desenharGraficos(dados);
    }

    if (anunciar) el.anuncio.textContent = `Mostrando ${descreverPeriodo(periodo)}: ${plural(dados.criados.length, "chamado")}.`;
}

function trocarPeriodo(novo) {
    periodo = PERIODOS.includes(novo) ? novo : PERIODO_PADRAO;
    const radio = el.periodo.querySelector(`input[value="${periodo}"]`);
    if (radio) radio.checked = true;
    const url = new URL(location.href);
    if (periodo === PERIODO_PADRAO) url.searchParams.delete("periodo");
    else url.searchParams.set("periodo", periodo);
    history.replaceState(null, "", url);
    atualizar({ anunciar: true });
}

async function carregar() {
    mostrarSkeleton();
    el.exportar.disabled = true;
    try {
        const [lista] = await Promise.all([listarChamados(perfil), carregarChartJs()]);
        chamados = lista;
        render(el.kpis);
        atualizar();
    } catch (erro) {
        mostrarErro(erro);
    }
}

/* ---------- Início ---------- */

el.periodo.querySelector(`input[value="${periodo}"]`).checked = true;
el.exportar.prepend(icon(Download));
mostrarSkeleton();

const perfil = await iniciarPagina({ pagina: "relatorios", papeis: ["admin"] });

el.periodo.addEventListener("change", (e) => {
    if (e.target.name === "periodo") trocarPeriodo(e.target.value);
});
el.exportar.addEventListener("click", exportarCsv);

// Troca de tema/movimento: redesenha com as novas cores
let agendado = 0;
const redesenhar = () => {
    cancelAnimationFrame(agendado);
    agendado = requestAnimationFrame(() => {
        if (ultimoCalculo && graficos.size) pintarGraficos(ultimoCalculo);
    });
};
window.addEventListener("hd:prefs", redesenhar);
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", redesenhar);

carregar();
