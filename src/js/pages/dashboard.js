import { CircleCheck, CircleDot, Hand, Inbox, Loader, Plus, RefreshCw, Timer, WifiOff } from "lucide";
import { iniciarPagina } from "../components/app-shell.js";
import { avatar } from "../components/avatar.js";
import { badgePrioridade, badgeStatus } from "../components/badges.js";
import { confirmar } from "../components/confirm.js";
import { estadoVazio } from "../components/empty-state.js";
import { skeletonCards, skeletonLinhasLista } from "../components/skeleton.js";
import { toast } from "../components/toast.js";
import { assumirChamado, observarChamados } from "../services/chamados.js";
import { PRIORIDADES, categoriaInfo, prioridadeInfo } from "../utils/constants.js";
import { $, h, render } from "../utils/dom.js";
import {
    formatarDataHora,
    formatarDuracao,
    formatarNumero,
    formatarNumeroChamado,
    plural,
    primeiroNome,
    saudacao,
    tempoRelativo,
} from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { logError } from "../utils/logger.js";
import { animarNumero, destacar, pulsar, stagger } from "../utils/motion.js";

const MAX_RECENTES = 5;
const MAX_AGUARDANDO = 4;
const JANELA_MEDIA_DIAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

const dataPorExtenso = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

const perfil = await iniciarPagina({ pagina: "dashboard" });
const ehEquipe = perfil.role === "tecnico" || perfil.role === "admin";

const el = {
    main: $("#conteudo"),
    data: $("#dash-data"),
    titulo: $("#dash-titulo"),
    subtitulo: $("#dash-subtitulo"),
    novo: $("#dash-novo"),
    painel: $("#dash-painel"),
    stats: $("#dash-stats"),
    recentes: $("#dash-recentes"),
    lateral: $("#dash-lateral"),
    erro: $("#dash-erro"),
};

let pararDeObservar = null;
let primeiraCarga = true;
let cards = null; // stat cards criados uma vez e atualizados em tempo real
let blocoAguardando = null;
let blocoPrioridades = null;

const urlChamado = (c) => `chamado.html?id=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.numero ?? "")}`;

/* ---------- Cabeçalho ---------- */

function desenharCabecalhoFixo() {
    const hoje = dataPorExtenso.format(new Date());
    el.data.textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);
    el.titulo.textContent = `${saudacao()}, ${primeiroNome(perfil.nome) || "boas-vindas"}`;
    el.novo.prepend(icon(Plus));
}

function frasePorPapel(chamados) {
    if (ehEquipe) {
        const aguardando = chamados.filter((c) => c.status === "aberto").length;
        const comigo = chamados.filter((c) => c.status === "analise" && c.tecnicoId === perfil.uid).length;
        const inicio = aguardando
            ? `${plural(aguardando, "chamado")} ${aguardando === 1 ? "aguarda" : "aguardam"} atendimento.`
            : "Nenhum chamado aguardando atendimento.";
        const fim = comigo ? ` ${formatarNumero(comigo)} em análise com você.` : "";
        return inicio + fim;
    }

    if (!chamados.length) return "Precisa de ajuda com algo? Abra seu primeiro chamado.";
    const andamento = chamados.filter((c) => c.status !== "resolvido").length;
    return andamento
        ? `Você tem ${plural(andamento, "chamado")} em andamento.`
        : "Nenhum chamado em andamento. Tudo em dia!";
}

/* ---------- Métricas ---------- */

function calcularResumo(chamados) {
    const limite = Date.now() - JANELA_MEDIA_DIAS * DIA_MS;
    const duracoes = chamados
        .filter((c) => c.status === "resolvido" && c.dataResolucao && c.dataCriacao && c.dataResolucao.getTime() >= limite)
        .map((c) => c.dataResolucao - c.dataCriacao)
        .filter((ms) => ms >= 0);

    return {
        aberto: chamados.filter((c) => c.status === "aberto").length,
        analise: chamados.filter((c) => c.status === "analise").length,
        resolvido: chamados.filter((c) => c.status === "resolvido").length,
        // média em minutos (animável como inteiro); null quando não há base
        tempo: duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length / 60000) : null,
        baseTempo: duracoes.length,
    };
}

function criarStat({ chave, rotulo, tom, icone, href, meta }) {
    const valor = h("strong", { class: "stat__value num" }, "0");
    const metaEl = h("span", { class: "stat__meta" }, meta);
    const card = h(
        "a",
        { class: ["card card--interactive stat", chave === "tempo" && "stat--tempo"], dataset: { tone: tom }, href },
        h("span", { class: "stat__label" }, rotulo),
        valor,
        h("span", { class: "stat__icon" }, icon(icone)),
        metaEl
    );
    return { card, valor, meta: metaEl, rotulo };
}

function montarStats() {
    const rotuloMeus = ehEquipe ? "" : " seus";
    cards = {
        aberto: criarStat({ chave: "aberto", rotulo: "Abertos", tom: "info", icone: CircleDot, href: "chamados.html?status=aberto", meta: "Aguardando um técnico" }),
        analise: criarStat({ chave: "analise", rotulo: "Em análise", tom: "warning", icone: Loader, href: "chamados.html?status=analise", meta: "Em atendimento agora" }),
        resolvido: criarStat({ chave: "resolvido", rotulo: "Resolvidos", tom: "success", icone: CircleCheck, href: "chamados.html?status=resolvido", meta: `Todos os${rotuloMeus} concluídos` }),
        tempo: criarStat({ chave: "tempo", rotulo: "Tempo médio de resolução", tom: "brand", icone: Timer, href: "chamados.html?status=resolvido", meta: `Últimos ${JANELA_MEDIA_DIAS} dias` }),
    };
    render(el.stats, Object.values(cards).map((c) => c.card));
    el.stats.removeAttribute("role");
    el.stats.removeAttribute("aria-live");
    stagger(el.stats);
}

function atualizarStats(resumo) {
    if (!cards) montarStats();

    for (const chave of ["aberto", "analise", "resolvido"]) {
        const { card, valor, rotulo } = cards[chave];
        const anterior = Number(valor.dataset.valor ?? 0);
        animarNumero(valor, resumo[chave], { formatar: formatarNumero });
        card.setAttribute("aria-label", `${rotulo}: ${formatarNumero(resumo[chave])}. Ver lista filtrada.`);
        if (!primeiraCarga && anterior !== resumo[chave]) pulsar(card);
    }

    const t = cards.tempo;
    const anteriorTempo = t.valor.dataset.valor;
    if (resumo.tempo === null) {
        t.valor.dataset.valor = "0";
        t.valor.textContent = "—";
        t.meta.textContent = `Sem resoluções nos últimos ${JANELA_MEDIA_DIAS} dias`;
        t.card.setAttribute("aria-label", `Tempo médio de resolução: sem dados nos últimos ${JANELA_MEDIA_DIAS} dias.`);
    } else {
        animarNumero(t.valor, resumo.tempo, { formatar: (min) => formatarDuracao(min * 60000) });
        t.meta.textContent = `Últimos ${JANELA_MEDIA_DIAS} dias · ${plural(resumo.baseTempo, "chamado")}`;
        t.card.setAttribute("aria-label", `Tempo médio de resolução: ${formatarDuracao(resumo.tempo * 60000)}, últimos ${JANELA_MEDIA_DIAS} dias.`);
    }
    if (!primeiraCarga && anteriorTempo !== t.valor.dataset.valor) pulsar(t.card);
}

/* ---------- Itens de lista ---------- */

function tempoEl(data, prefixo = "") {
    return h(
        "time",
        { class: "dash-item__tempo", datetime: data ? data.toISOString() : null, title: formatarDataHora(data), dataset: { tempo: "", prefixo } },
        prefixo + tempoRelativo(data)
    );
}

function numeroEl(c, { transicao = true } = {}) {
    const num = h("span", { class: "dash-item__numero mono" }, formatarNumeroChamado(c.numero));
    if (transicao) num.style.viewTransitionName = `chamado-${c.id}`;
    return num;
}

function itemRecente(c) {
    const cat = categoriaInfo(c.categoria);
    return h(
        "li",
        { class: "dash-item", dataset: { id: c.id } },
        h(
            "a",
            { class: "dash-item__link", href: urlChamado(c) },
            numeroEl(c),
            h("span", { class: "dash-item__titulo truncate" }, c.titulo)
        ),
        h(
            "div",
            { class: "dash-item__badges" },
            badgeStatus(c.status),
            c.prioridade && badgePrioridade(c.prioridade)
        ),
        h(
            "div",
            { class: "dash-item__meta" },
            ehEquipe &&
                c.usuarioNome &&
                h("span", { class: "dash-item__pessoa" }, avatar(c.usuarioNome, { tamanho: "sm" }), h("span", { class: "truncate" }, c.usuarioNome)),
            h("span", { class: "dash-item__categoria" }, icon(cat.icon), c.categoria || cat.valor),
            tempoEl(c.dataCriacao)
        )
    );
}

/** Mantém o foco no mesmo chamado (ou num ponto estável) após redesenhar uma lista. */
function redesenharPreservandoFoco(container, desenhar, fallback) {
    const ativo = document.activeElement;
    const tinhaFoco = container.contains(ativo);
    const id = ativo?.closest?.("[data-id]")?.dataset.id;
    const ehBotao = ativo?.tagName === "BUTTON";

    desenhar();

    if (!tinhaFoco) return;
    const item = id && container.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const alvo = item?.querySelector(ehBotao ? "button" : "a") || fallback?.();
    alvo?.focus({ preventScroll: true });
}

/* ---------- Chamados recentes ---------- */

function desenharRecentes(chamados, idsMudados) {
    if (!chamados.length) {
        render(
            el.recentes,
            estadoVazio({
                icone: Inbox,
                titulo: ehEquipe ? "Nenhum chamado por aqui" : "Você ainda não abriu chamados",
                texto: ehEquipe
                    ? "Quando alguém abrir um chamado, ele aparece aqui em tempo real."
                    : "Descreva o problema e um técnico vai te ajudar. Você acompanha tudo por aqui.",
                acao: ehEquipe ? null : { label: "Abrir meu primeiro chamado", href: "abrir-chamado.html", icone: Plus },
            })
        );
        return;
    }

    const recentes = chamados.slice(0, MAX_RECENTES);
    let lista;
    redesenharPreservandoFoco(
        el.recentes,
        () => {
            lista = h("ul", { class: "dash-lista", role: "list" }, recentes.map(itemRecente));
            render(el.recentes, lista);
        },
        () => $("#dash-recentes-titulo")
    );

    if (primeiraCarga) stagger(lista);
    for (const li of lista.children) {
        if (idsMudados.has(li.dataset.id)) destacar(li);
    }
}

/* ---------- Aguardando atendimento (técnico/admin) ---------- */

function ordenarFila(a, b) {
    const peso = prioridadeInfo(b.prioridade).peso - prioridadeInfo(a.prioridade).peso;
    if (peso) return peso;
    return (a.dataCriacao?.getTime() ?? 0) - (b.dataCriacao?.getTime() ?? 0);
}

async function assumir(c, botao) {
    const numero = formatarNumeroChamado(c.numero);
    const ok = await confirmar({
        titulo: `Assumir o chamado ${numero}?`,
        mensagem: `“${c.titulo}” passa para Em análise e fica sob sua responsabilidade.`,
        confirmar: "Assumir",
        tom: "brand",
    });
    if (!ok) return;

    botao.setAttribute("aria-busy", "true");
    botao.disabled = true;
    try {
        await assumirChamado(c.id, perfil);
        toast.success("Chamado assumido", {
            message: `${numero} agora está com você.`,
            action: { label: "Abrir", onClick: () => location.assign(urlChamado(c)) },
            duration: 8000,
        });
    } catch (erro) {
        logError(erro, "dashboard:assumir");
        toast.error("Não foi possível assumir o chamado", { message: "Verifique sua conexão e tente novamente." });
    } finally {
        if (botao.isConnected) {
            botao.removeAttribute("aria-busy");
            botao.disabled = false;
        }
    }
}

function itemAguardando(c, comTransicao) {
    const numero = formatarNumeroChamado(c.numero);
    return h(
        "li",
        { class: "dash-item dash-item--fila", dataset: { id: c.id } },
        h(
            "a",
            { class: "dash-item__link", href: urlChamado(c) },
            numeroEl(c, { transicao: comTransicao }),
            h("span", { class: "dash-item__titulo truncate" }, c.titulo)
        ),
        h(
            "div",
            { class: "dash-item__meta" },
            c.prioridade && badgePrioridade(c.prioridade),
            c.usuarioNome && h("span", { class: "dash-item__pessoa" }, avatar(c.usuarioNome, { tamanho: "sm" }), h("span", { class: "truncate" }, c.usuarioNome)),
            tempoEl(c.dataCriacao, "aberto ")
        ),
        h(
            "button",
            {
                class: "btn btn--secondary dash-item__acao",
                type: "button",
                "aria-label": `Assumir chamado ${numero}`,
                onClick: (e) => assumir(c, e.currentTarget),
            },
            icon(Hand),
            h("span", {}, "Assumir")
        )
    );
}

function montarBlocoAguardando() {
    const contador = h("span", { class: "count", "aria-hidden": "true" }, "0");
    const titulo = h("h2", { class: "card__title", id: "dash-aguardando-titulo", tabindex: "-1" }, "Aguardando atendimento ");
    titulo.append(contador);
    const corpo = h("div", { class: "dash-bloco__corpo" });
    const secao = h(
        "section",
        { class: "card card--flush dash-bloco", "aria-labelledby": "dash-aguardando-titulo" },
        h("div", { class: "dash-bloco__header" }, titulo, h("a", { class: "dash-link", href: "fila.html" }, "Ver fila ", h("span", { "aria-hidden": "true" }, "→"))),
        corpo
    );
    return { secao, corpo, contador, titulo };
}

function desenharAguardando(chamados, idsMudados, idsRecentes) {
    blocoAguardando ??= montarBlocoAguardando();
    const abertos = chamados.filter((c) => c.status === "aberto").sort(ordenarFila);
    blocoAguardando.contador.textContent = formatarNumero(abertos.length);

    if (!abertos.length) {
        redesenharPreservandoFoco(
            blocoAguardando.corpo,
            () =>
                render(
                    blocoAguardando.corpo,
                    h(
                        "div",
                        { class: "dash-fila-vazia" },
                        h("span", { class: "dash-fila-vazia__icone" }, icon(CircleCheck)),
                        h("div", {}, h("strong", {}, "Fila em dia"), h("p", { class: "muted text-sm" }, "Nenhum chamado aguardando atendimento."))
                    )
                ),
            () => blocoAguardando.titulo
        );
        return;
    }

    let lista;
    redesenharPreservandoFoco(
        blocoAguardando.corpo,
        () => {
            // O mesmo chamado pode estar nos recentes: view-transition-name precisa ser único
            lista = h("ul", { class: "dash-lista", role: "list" }, abertos.slice(0, MAX_AGUARDANDO).map((c) => itemAguardando(c, !idsRecentes.has(c.id))));
            const resto = abertos.length - MAX_AGUARDANDO;
            render(
                blocoAguardando.corpo,
                lista,
                resto > 0 && h("p", { class: "dash-bloco__rodape muted text-sm" }, `+ ${plural(resto, "outro")} na fila`)
            );
        },
        () => blocoAguardando.corpo.querySelector("button") || blocoAguardando.titulo
    );

    if (primeiraCarga) stagger(lista);
    for (const li of lista.children) {
        if (idsMudados.has(li.dataset.id)) destacar(li);
    }
}

/* ---------- Pendentes por prioridade ---------- */

function montarBlocoPrioridades() {
    const linhas = new Map();
    const itens = [...PRIORIDADES].reverse().map((p) => {
        const barra = h("span", { class: "dash-barra__preenchimento" });
        const valor = h("span", { class: "dash-barra__valor num" }, "0");
        const item = h(
            "li",
            { class: "dash-barra", dataset: { tone: p.tone }, title: p.dica },
            h("span", { class: "dash-barra__rotulo" }, p.valor),
            h("span", { class: "dash-barra__trilho", "aria-hidden": "true" }, barra),
            valor
        );
        linhas.set(p.valor, { item, barra, valor });
        return item;
    });

    const total = h("span", { class: "muted text-sm num" });
    const lista = h("ul", { class: "dash-barras", role: "list" }, itens);
    const vazio = h("p", { class: "muted text-sm dash-barras__vazio", hidden: true }, "Nada pendente no momento.");
    const secao = h(
        "section",
        { class: "card dash-bloco dash-bloco--prioridades", "aria-labelledby": "dash-prio-titulo" },
        h("div", { class: "card__header" }, h("h2", { class: "card__title", id: "dash-prio-titulo" }, ehEquipe ? "Pendentes por prioridade" : "Seus pendentes por prioridade"), total),
        lista,
        vazio
    );
    return { secao, linhas, total, vazio };
}

function desenharPrioridades(chamados) {
    blocoPrioridades ??= montarBlocoPrioridades();
    const pendentes = chamados.filter((c) => c.status !== "resolvido");
    const contagem = new Map(PRIORIDADES.map((p) => [p.valor, 0]));
    for (const c of pendentes) {
        if (contagem.has(c.prioridade)) contagem.set(c.prioridade, contagem.get(c.prioridade) + 1);
    }
    const maximo = Math.max(1, ...contagem.values());

    blocoPrioridades.total.textContent = plural(pendentes.length, "pendente");
    blocoPrioridades.vazio.hidden = pendentes.length > 0;

    for (const [valor, { item, barra, valor: valorEl }] of blocoPrioridades.linhas) {
        const n = contagem.get(valor);
        item.setAttribute("aria-label", `${valor}: ${plural(n, "chamado")}`);
        valorEl.textContent = formatarNumero(n);
        // A escala entra depois do primeiro paint para a barra "crescer"
        requestAnimationFrame(() => requestAnimationFrame(() => barra.style.setProperty("--escala", String(n / maximo))));
    }
}

function desenharLateral(chamados, idsMudados, idsRecentes) {
    if (ehEquipe) desenharAguardando(chamados, idsMudados, idsRecentes);
    desenharPrioridades(chamados);

    if (primeiraCarga || !el.lateral.contains(blocoPrioridades.secao)) {
        render(el.lateral, blocoAguardando?.secao, blocoPrioridades.secao);
        stagger(el.lateral);
    }
}

/* ---------- Ciclo de dados ---------- */

function aoReceber(chamados, mudancas) {
    const idsMudados = new Set(mudancas.filter((m) => m.tipo !== "removed").map((m) => m.id));
    const idsRecentes = new Set(chamados.slice(0, MAX_RECENTES).map((c) => c.id));

    el.subtitulo.textContent = frasePorPapel(chamados);
    atualizarStats(calcularResumo(chamados));
    desenharRecentes(chamados, idsMudados);
    desenharLateral(chamados, idsMudados, idsRecentes);

    el.main.removeAttribute("aria-busy");
    primeiraCarga = false;
}

function aoErrar(erro) {
    logError(erro, "dashboard:observar");
    pararDeObservar?.();
    pararDeObservar = null;
    toast.error("Não foi possível carregar o painel", { message: "Verifique sua conexão e tente novamente." });

    el.painel.hidden = true;
    el.erro.hidden = false;
    el.main.removeAttribute("aria-busy");
    if (el.subtitulo.querySelector(".skeleton")) el.subtitulo.textContent = "Não conseguimos carregar seus dados agora.";
    render(
        el.erro,
        h(
            "div",
            { class: "card", role: "alert" },
            estadoVazio({
                icone: WifiOff,
                tom: "danger",
                titulo: "Algo deu errado ao carregar",
                texto: "Pode ser uma instabilidade na conexão. Seus chamados continuam salvos.",
                acao: { label: "Tentar novamente", icone: RefreshCw, variante: "btn--secondary", onClick: tentarNovamente },
            })
        )
    );
}

function tentarNovamente() {
    el.erro.hidden = true;
    render(el.erro);
    el.painel.hidden = false;
    el.main.setAttribute("aria-busy", "true");

    // Volta ao estado de carregamento do zero
    primeiraCarga = true;
    cards = null;
    blocoAguardando = null;
    blocoPrioridades = null;
    render(el.stats, skeletonCards(4).map((c) => (c.classList.add("dash-stats__skeleton"), c)));
    render(el.recentes, h("div", { role: "status" }, h("span", { class: "sr-only" }, "Carregando…"), skeletonLinhasLista(4)));
    render(el.lateral);
    $("#dash-recentes-titulo").setAttribute("tabindex", "-1");
    $("#dash-recentes-titulo").focus();

    conectar();
}

function conectar() {
    pararDeObservar = observarChamados(perfil, aoReceber, aoErrar);
}

/* ---------- Início ---------- */

desenharCabecalhoFixo();
conectar();

// Tempo relativo ("há 5 minutos") envelhece sem recarregar
function atualizarTempos() {
    for (const t of document.querySelectorAll("[data-tempo]")) {
        const data = t.getAttribute("datetime");
        if (data) t.textContent = t.dataset.prefixo + tempoRelativo(new Date(data));
    }
}
let relogio = setInterval(atualizarTempos, 60_000);

window.addEventListener("pagehide", () => {
    pararDeObservar?.();
    pararDeObservar = null;
    clearInterval(relogio);
    relogio = 0;
});

// Voltando do bfcache: o observador e o relógio foram encerrados no pagehide
window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    if (!relogio) {
        atualizarTempos();
        relogio = setInterval(atualizarTempos, 60_000);
    }
    if (!pararDeObservar && el.erro.hidden) conectar();
});
