// Fila (Kanban) — técnico e admin.
// Três colunas em tempo real; os cartões mudam de status arrastando (Pointer Events,
// mouse e toque) ou pelo menu "Mover para…" (teclado). Mudanças de outras pessoas
// entram/saem com animação FLIP (só transform/opacity).

import { ArrowRightLeft, CircleAlert, History, Inbox, RotateCw, Search, User, X } from "lucide";
import { iniciarPagina } from "../components/app-shell.js";
import { avatar } from "../components/avatar.js";
import { badgeCategoria } from "../components/badges.js";
import { estadoVazio } from "../components/empty-state.js";
import { carregando, skeleton } from "../components/skeleton.js";
import { criarAbas } from "../components/tabs.js";
import { toast } from "../components/toast.js";
import { movimentoReduzido } from "../core/theme.js";
import { moverChamado, observarChamados } from "../services/chamados.js";
import { PRIORIDADES, STATUS, STATUS_ORDEM, prioridadeInfo } from "../utils/constants.js";
import { $, $$, h, render } from "../utils/dom.js";
import { formatarDataHora, formatarNumeroChamado, normalizarBusca } from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { destacar, stagger, tremer } from "../utils/motion.js";

const DIAS_RESOLVIDOS = 7;
const LIMIAR_MOUSE = 6; // px até virar arraste (abaixo disso é clique)
const LIMIAR_TOQUE = 10;
const ESPERA_TOQUE = 280; // toque longo inicia o arraste; antes disso o gesto é rolagem
const BORDA_AUTOSCROLL = 56;
const DURACAO = 280;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// Destinos oferecidos no quadro (moverChamado aceita todos estes)
const TRANSICOES = {
    aberto: ["analise", "resolvido"],
    analise: ["aberto", "resolvido"],
    resolvido: ["analise"],
};

const VAZIO = {
    aberto: "Fila zerada — nenhum chamado aguardando.",
    analise: "Nenhum chamado em atendimento agora.",
    resolvido: `Nenhum chamado resolvido nos últimos ${DIAS_RESOLVIDOS} dias.`,
};

const mqMobile = window.matchMedia("(max-width: 767px)");
const mqBottomNav = window.matchMedia("(max-width: 639px)");

const quadro = $("#kanban");
const regiaoAnuncio = $("#fila-anuncio");
const formFiltros = $("#fila-filtros");
const campoBusca = $("#fila-busca");
const campoPrioridade = $("#fila-prioridade");
const campoMeus = $("#fila-meus");

const estado = {
    perfil: null,
    chamados: new Map(), // id → chamado vindo do Firestore
    pendentes: new Map(), // id → campos otimistas ainda não confirmados
    filtros: { q: "", prioridade: "", meus: false },
    carregado: false,
};

/** @type {Record<string, {el: HTMLElement, lista: HTMLElement, vazio: HTMLElement, count: HTMLElement}>} */
let colunas = {};
const cardsEl = new Map(); // id → <li class="kcard">
const statusVisto = new Map(); // id → último status desenhado (detecta mudanças remotas)
const resolvidosAgora = new Set(); // resolvidos nesta sessão (dataResolucao ainda pendente no servidor)
let primeiroDesenho = true;
let pararObservacao = null;
let arraste = null;
let abas = null;
let observadorColunas = null;

/* ---------- Utilitários ---------- */

const ms = (d) => (d instanceof Date ? d.getTime() : 0);

function anunciar(texto) {
    regiaoAnuncio.textContent = "";
    setTimeout(() => (regiaoAnuncio.textContent = texto), 60);
}

function corDoTom(tom) {
    return tom === "neutral" ? "var(--text-subtle)" : `var(--${tom})`;
}

/** "há 3h", "há 2d" — versão compacta para os cartões */
function idadeCurta(data) {
    if (!(data instanceof Date)) return "—";
    const seg = Math.max(0, (Date.now() - data.getTime()) / 1000);
    if (seg < 60) return "agora";
    const min = Math.floor(seg / 60);
    if (min < 60) return `há ${min}min`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `há ${horas}h`;
    const dias = Math.floor(horas / 24);
    if (dias < 7) return `há ${dias}d`;
    if (dias < 30) return `há ${Math.floor(dias / 7)}sem`;
    if (dias < 365) {
        const meses = Math.floor(dias / 30);
        return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
    }
    const anos = Math.floor(dias / 365);
    return `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

/** Data de referência do "Resolvido": resolução → assumido → criação. */
function dataResolucao(c) {
    if (c.dataResolucao) return c.dataResolucao;
    if (c.status === "resolvido" && resolvidosAgora.has(c.id)) return new Date();
    return c.dataAssumido || c.dataCriacao;
}

function efetivo(c) {
    const p = estado.pendentes.get(c.id);
    return p ? { ...c, ...p.campos } : c;
}

function ordenacao(status) {
    if (status === "resolvido") return (a, b) => ms(dataResolucao(b)) - ms(dataResolucao(a));
    // Mais urgente primeiro; empate → o mais antigo primeiro
    return (a, b) =>
        prioridadeInfo(b.prioridade).peso - prioridadeInfo(a.prioridade).peso || ms(a.dataCriacao) - ms(b.dataCriacao);
}

function termosDaBusca() {
    return normalizarBusca(estado.filtros.q).split(/\s+/).filter(Boolean);
}

function passaFiltros(c, termos) {
    const { prioridade, meus } = estado.filtros;
    if (prioridade && c.prioridade !== prioridade) return false;
    // "Só os meus" não se aplica ao Aberto: ali ninguém assumiu ainda
    if (meus && c.status !== "aberto" && c.tecnicoId !== estado.perfil.uid) return false;
    if (!termos.length) return true;
    const alvo = normalizarBusca(`${c.titulo} ${formatarNumeroChamado(c.numero)}`);
    return termos.every((t) => {
        const digitos = t.replace(/^#/, "");
        if (/^\d+$/.test(digitos) && c.numero != null && String(c.numero).startsWith(String(Number(digitos)))) return true;
        return alvo.includes(t);
    });
}

function listasVisiveis() {
    const termos = termosDaBusca();
    const limite = Date.now() - DIAS_RESOLVIDOS * 864e5;
    const listas = { aberto: [], analise: [], resolvido: [] };
    for (const bruto of estado.chamados.values()) {
        const c = efetivo(bruto);
        if (!listas[c.status]) continue;
        if (c.status === "resolvido" && ms(dataResolucao(c)) < limite) continue;
        if (!passaFiltros(c, termos)) continue;
        listas[c.status].push(c);
    }
    for (const st of STATUS_ORDEM) listas[st].sort(ordenacao(st));
    return listas;
}

function filtrosAtivos() {
    const { q, prioridade, meus } = estado.filtros;
    return Boolean(q.trim() || prioridade || meus);
}

/* ---------- Colunas ---------- */

function montarColunas() {
    colunas = {};
    const els = STATUS_ORDEM.map((st) => {
        const info = STATUS[st];
        const idTitulo = `coluna-${st}-titulo`;
        const count = h("span", { class: "count", "aria-label": "0 chamados" }, "–");
        const lista = h("ul", { class: "kanban__lista", role: "list", "aria-labelledby": idTitulo });
        const vazio = h("div", { class: "kanban__vazio", hidden: true });
        colunas[st] = {
            lista,
            vazio,
            count,
            el: h(
                "section",
                { class: "kanban__col", id: `coluna-${st}`, dataset: { status: st, tone: info.tone }, "aria-labelledby": idTitulo },
                h(
                    "header",
                    { class: "kanban__cabecalho" },
                    h("span", { class: "kanban__icone" }, icon(info.icon)),
                    h(
                        "span",
                        { class: "kanban__rotulo" },
                        h("h2", { class: "kanban__titulo", id: idTitulo }, info.label),
                        st === "resolvido" && h("span", { class: "kanban__sub" }, `Últimos ${DIAS_RESOLVIDOS} dias`)
                    ),
                    count
                ),
                h("div", { class: "kanban__corpo" }, lista, vazio),
                st === "resolvido" &&
                    h(
                        "a",
                        { class: "kanban__historico", href: "chamados.html?status=resolvido" },
                        icon(History),
                        "Ver histórico completo"
                    )
            ),
        };
        return colunas[st].el;
    });
    render(quadro, els);
}

function cardSkeleton() {
    return h(
        "div",
        { class: "kcard kcard--skeleton" },
        h("div", { class: "kcard__topo" }, skeleton({ w: "52px", h: "12px" }), skeleton({ w: "40px", h: "12px" })),
        skeleton({ w: "92%", h: "16px" }),
        skeleton({ w: "64%", h: "16px" }),
        h("div", { class: "kcard__rodape" }, skeleton({ w: "45%", h: "12px" }), skeleton({ w: "24px", h: "24px", circle: true }))
    );
}

function mostrarSkeleton() {
    STATUS_ORDEM.forEach((st, i) => {
        render(colunas[st].lista, h("li", { class: "kanban__carregando" }, carregando(...Array.from({ length: 3 - i }, cardSkeleton))));
    });
}

/* ---------- Cartões ---------- */

function assinatura(c) {
    return [c.status, c.numero, c.titulo, c.categoria, c.prioridade, c.usuarioNome, c.tecnicoId, c.tecnicoNome, ms(c.dataCriacao), ms(dataResolucao(c))].join("|");
}

function textoIdade(c) {
    return c.status === "resolvido" ? `resolvido ${idadeCurta(dataResolucao(c))}` : idadeCurta(c.dataCriacao);
}

function preencherCard(li, c) {
    const prio = prioridadeInfo(c.prioridade);
    const num = formatarNumeroChamado(c.numero);
    const refIdade = c.status === "resolvido" ? dataResolucao(c) : c.dataCriacao;

    li._chamado = c;
    li.dataset.status = c.status;
    li.style.setProperty("--prio", corDoTom(prio.tone));

    const numero = h("span", { class: "kcard__numero mono" }, num);
    numero.style.viewTransitionName = `chamado-${c.id}`;

    li._idade = h(
        "time",
        { class: "kcard__idade", datetime: refIdade?.toISOString?.() || null, title: formatarDataHora(refIdade) },
        textoIdade(c)
    );

    render(
        li,
        h(
            "div",
            { class: "kcard__topo" },
            numero,
            h(
                "span",
                { class: "kcard__prioridade", title: prio.dica || null },
                h("span", { class: "kcard__prio-dot", "aria-hidden": "true" }),
                h("span", { class: "sr-only" }, "Prioridade "),
                c.prioridade ? prio.valor : "Sem prioridade"
            ),
            li._idade
        ),
        h(
            "h3",
            { class: "kcard__titulo" },
            h(
                "a",
                {
                    class: "kcard__link",
                    href: `chamado.html?id=${encodeURIComponent(c.id)}&n=${c.numero ?? ""}`,
                    draggable: "false",
                },
                h("span", { class: "sr-only" }, `Chamado ${num}: `),
                c.titulo
            )
        ),
        c.categoria && h("div", { class: "kcard__meta" }, badgeCategoria(c.categoria)),
        h(
            "div",
            { class: "kcard__rodape" },
            h(
                "span",
                { class: "kcard__solicitante", title: `Solicitante: ${c.usuarioNome || "—"}` },
                icon(User),
                h("span", { class: "sr-only" }, "Solicitante: "),
                h("span", { class: "truncate" }, c.usuarioNome || "—")
            ),
            c.tecnicoNome &&
                h(
                    "span",
                    { class: "kcard__tecnico", title: `Técnico: ${c.tecnicoNome}` },
                    avatar(c.tecnicoNome, { tamanho: "sm" }),
                    h("span", { class: "sr-only" }, `Técnico: ${c.tecnicoNome}`)
                ),
            h(
                "button",
                {
                    class: "btn btn--ghost btn--icon btn--sm kcard__mover",
                    type: "button",
                    "aria-haspopup": "menu",
                    "aria-expanded": "false",
                    "aria-controls": "fila-menu-mover",
                    "aria-label": `Mover chamado ${num} para…`,
                    title: "Mover para…",
                },
                icon(ArrowRightLeft)
            )
        )
    );
}

function criarCard(c) {
    const li = h("li", { class: "kcard", dataset: { id: c.id } });
    preencherCard(li, c);
    return li;
}

/* ---------- Desenho (reconciliação por id + FLIP) ---------- */

function capturarPosicoes() {
    const mapa = new Map();
    for (const [id, el] of cardsEl) if (el.isConnected) mapa.set(id, el.getBoundingClientRect());
    return mapa;
}

function lembrarFoco() {
    const ativo = document.activeElement;
    const card = ativo?.closest?.(".kcard");
    if (!card || !quadro.contains(card)) return null;
    const seletor = ativo.matches(".kcard__mover") ? ".kcard__mover" : ativo.matches(".kcard__link") ? ".kcard__link" : null;
    return { id: card.dataset.id, seletor };
}

function restaurarFoco(foco) {
    if (!foco) return;
    const card = cardsEl.get(foco.id);
    const alvo = card && (foco.seletor ? card.querySelector(foco.seletor) : card);
    if (alvo?.isConnected && document.activeElement !== alvo) alvo.focus();
}

function animarSaida(el, rectAntes) {
    el.classList.add("kcard--saindo");
    el.inert = true;
    el.setAttribute("aria-hidden", "true");
    el.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    const numero = el.querySelector(".kcard__numero");
    if (numero) numero.style.viewTransitionName = "none";

    const lista = el.parentElement;
    if (!rectAntes || !lista || movimentoReduzido()) {
        el.remove();
        return;
    }
    const base = lista.getBoundingClientRect();
    Object.assign(el.style, {
        top: `${rectAntes.top - base.top}px`,
        left: `${rectAntes.left - base.left}px`,
        width: `${rectAntes.width}px`,
    });
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.94)" }], {
        duration: DURACAO,
        easing: EASE,
        fill: "forwards",
    }).finished.then(
        () => el.remove(),
        () => el.remove()
    );
}

/**
 * Sincroniza o DOM com o estado. Cartões são reaproveitados por id, então
 * foco e animações sobrevivem às atualizações em tempo real.
 * @param {{ fantasma?: { id: string, rect: {left: number, top: number} } }} [opcoes]
 */
function desenhar({ fantasma = null } = {}) {
    if (!estado.carregado) return;

    const inicial = primeiroDesenho;
    const animar = !inicial && !movimentoReduzido();
    const listas = listasVisiveis();
    const antes = animar ? capturarPosicoes() : null;
    if (antes && fantasma) antes.set(fantasma.id, fantasma.rect);
    const foco = lembrarFoco();

    // Um arraste em andamento: o placeholder sai durante a reconciliação
    if (arraste?.ativo) {
        arraste.placeholder.remove();
        if (arraste.alvo) colunas[arraste.alvo].el.dataset.drop = "permitido";
        arraste.alvo = null;
    }

    const visiveis = new Set(STATUS_ORDEM.flatMap((st) => listas[st].map((c) => c.id)));
    const saindo = [];
    for (const [id, el] of cardsEl) {
        if (visiveis.has(id)) continue;
        saindo.push([el, antes?.get(id)]);
        cardsEl.delete(id);
    }

    const novos = [];
    const remotos = [];

    for (const st of STATUS_ORDEM) {
        const { lista, vazio, count } = colunas[st];
        if (inicial) render(lista);

        listas[st].forEach((c, i) => {
            let el = cardsEl.get(c.id);
            const sig = assinatura(c);
            if (!el) {
                el = criarCard(c);
                cardsEl.set(c.id, el);
                novos.push(el);
            } else if (el._assinatura !== sig) {
                preencherCard(el, c);
            }
            el._assinatura = sig;
            if (lista.children[i] !== el) lista.insertBefore(el, lista.children[i] || null);

            const anterior = statusVisto.get(c.id);
            if (!inicial && anterior !== c.status) remotos.push({ el, c, novo: anterior === undefined });
        });

        const n = listas[st].length;
        count.textContent = String(n);
        count.setAttribute("aria-label", `${n} ${n === 1 ? "chamado" : "chamados"}`);
        const contAba = $(`[data-count="${st}"]`);
        if (contAba) contAba.textContent = String(n);

        vazio.hidden = n > 0;
        if (!n) {
            render(
                vazio,
                icon(filtrosAtivos() ? Search : Inbox),
                h("span", {}, filtrosAtivos() ? "Nenhum chamado com esses filtros." : VAZIO[st])
            );
        }
    }

    for (const [el, rect] of saindo) animarSaida(el, rect);

    // Status já desenhados (inclui ocultos por filtro, para não "piscar" ao limpar filtros)
    for (const bruto of estado.chamados.values()) statusVisto.set(bruto.id, efetivo(bruto).status);

    restaurarFoco(foco);

    if (inicial) {
        primeiroDesenho = false;
        for (const st of STATUS_ORDEM) {
            const { lista } = colunas[st];
            stagger(lista);
            setTimeout(() => lista.classList.remove("stagger"), 900);
        }
    } else if (antes) {
        for (const [id, el] of cardsEl) {
            if (!el.isConnected) continue;
            const a = antes.get(id);
            const b = el.getBoundingClientRect();
            const dx = a ? a.left - b.left : 0;
            const dy = a ? a.top - b.top : 0;
            const longe = Math.hypot(dx, dy) > window.innerWidth * 1.5;
            if (!a || longe) {
                el.animate([{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], { duration: DURACAO, easing: EASE });
            } else if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
                const inicio = `translate(${dx}px, ${dy}px)` + (fantasma?.id === id ? " rotate(2deg) scale(1.03)" : "");
                el.animate([{ transform: inicio }, { transform: "none" }], { duration: DURACAO, easing: EASE });
            }
        }
    }

    // Mudanças de outras pessoas ganham destaque e são anunciadas
    if (remotos.length) {
        remotos.forEach(({ el }) => destacar(el));
        if (remotos.length <= 3) {
            anunciar(
                remotos
                    .map(({ c, novo }) =>
                        novo
                            ? `Novo chamado ${formatarNumeroChamado(c.numero)} em ${STATUS[c.status].label}.`
                            : `Chamado ${formatarNumeroChamado(c.numero)} agora está em ${STATUS[c.status].label}.`
                    )
                    .join(" ")
            );
        } else {
            anunciar(`${remotos.length} chamados foram atualizados.`);
        }
    }

    if (arraste?.ativo) atualizarAlvo();
}

function atualizarIdades() {
    for (const el of cardsEl.values()) {
        if (el._idade && el._chamado) el._idade.textContent = textoIdade(el._chamado);
    }
}

/* ---------- Mover (otimista + desfazer) ---------- */

function camposOtimistas(c, novoStatus) {
    const agora = new Date();
    const { uid, nome } = estado.perfil;
    if (novoStatus === "aberto") {
        return { status: "aberto", tecnicoId: null, tecnicoNome: null, dataAssumido: null, dataResolucao: null };
    }
    if (novoStatus === "analise") {
        return c.status === "aberto"
            ? { status: "analise", tecnicoId: uid, tecnicoNome: nome, dataAssumido: agora }
            : { status: "analise", dataResolucao: null };
    }
    return {
        status: "resolvido",
        dataResolucao: agora,
        ...(c.tecnicoId ? {} : { tecnicoId: uid, tecnicoNome: nome, dataAssumido: agora }),
    };
}

function mensagemErro(erro) {
    if (erro?.code === "permission-denied") return "Você não tem permissão para esta alteração.";
    if (erro?.code === "unavailable") return "Sem conexão com o servidor. Tente novamente.";
    return "Verifique sua conexão e tente novamente.";
}

async function mover(id, novoStatus, { fantasma = null, desfazendo = false } = {}) {
    const base = estado.chamados.get(id);
    if (!base) return;
    const atual = efetivo(base);
    const anterior = atual.status;
    if (anterior === novoStatus) return;

    const num = formatarNumeroChamado(atual.numero);
    const rotulo = STATUS[novoStatus].label;
    const token = Symbol("movimento");

    if (novoStatus === "resolvido") resolvidosAgora.add(id);
    estado.pendentes.set(id, { token, campos: camposOtimistas(atual, novoStatus) });
    statusVisto.set(id, novoStatus); // é nossa: não conta como mudança remota
    desenhar({ fantasma });
    anunciar(`Chamado ${num} movido para ${rotulo}.`);

    try {
        await moverChamado(atual, novoStatus, estado.perfil);
        if (estado.pendentes.get(id)?.token === token) estado.pendentes.delete(id);
        desenhar();
        if (desfazendo) {
            toast.info("Movimentação desfeita", { message: `${num} voltou para ${rotulo}.` });
        } else {
            toast.success(`${num} movido para ${rotulo}`, {
                duration: 7000,
                action: { label: "Desfazer", onClick: () => mover(id, anterior, { desfazendo: true }) },
            });
        }
    } catch (erro) {
        console.error(erro);
        if (estado.pendentes.get(id)?.token === token) estado.pendentes.delete(id);
        statusVisto.set(id, anterior);
        desenhar();
        tremer(cardsEl.get(id));
        toast.error(`Não foi possível mover ${num}`, { message: mensagemErro(erro) });
        anunciar(`Não foi possível mover o chamado ${num}. Ele continua em ${STATUS[anterior].label}.`);
    }
}

/* ---------- Arrastar e soltar (Pointer Events) ---------- */

function colunaSob(x, y) {
    const area = quadro.getBoundingClientRect();
    if (y < area.top - 80 || y > area.bottom + 80) return null;
    return STATUS_ORDEM.find((st) => {
        const r = colunas[st].el.getBoundingClientRect();
        return x >= r.left && x <= r.right;
    });
}

function atualizarAlvo() {
    const a = arraste;
    if (!a?.ativo) return;
    const origem = a.chamado.status;
    const st = colunaSob(a.x, a.y);
    const alvo = st && st !== origem && TRANSICOES[origem]?.includes(st) ? st : null;

    if (alvo === a.alvo && (!alvo || a.placeholder.isConnected)) return;
    if (a.alvo) colunas[a.alvo].el.dataset.drop = "permitido";
    a.alvo = alvo;
    if (!alvo) {
        a.placeholder.remove();
        return;
    }
    colunas[alvo].el.dataset.drop = "alvo";

    // O placeholder fica onde o cartão vai cair pela ordenação da coluna
    const hipotetico = { ...a.chamado, ...camposOtimistas(a.chamado, alvo) };
    const ordenar = ordenacao(alvo);
    const lista = listasVisiveis()[alvo];
    const proximo = lista.find((c) => ordenar(hipotetico, c) < 0);
    colunas[alvo].lista.insertBefore(a.placeholder, (proximo && cardsEl.get(proximo.id)) || null);
}

function posicionarFantasma() {
    const a = arraste;
    a.fantasma.style.transform = `translate3d(${a.x - a.dx}px, ${a.y - a.dy}px, 0)`;
}

function iniciarArraste() {
    const a = arraste;
    a.ativo = true;
    clearTimeout(a.timer);

    const r = a.card.getBoundingClientRect();
    a.dx = a.x0 - r.left;
    a.dy = a.y0 - r.top;

    const fantasma = a.card.cloneNode(true);
    fantasma.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    const numero = fantasma.querySelector(".kcard__numero");
    if (numero) numero.style.viewTransitionName = "none";
    fantasma.classList.add("kcard--fantasma");
    fantasma.setAttribute("aria-hidden", "true");
    fantasma.inert = true;
    fantasma.style.width = `${r.width}px`;
    fantasma.style.height = `${r.height}px`;
    document.body.append(fantasma);
    a.fantasma = fantasma;

    a.placeholder = h("li", { class: "kanban__placeholder", "aria-hidden": "true", style: { height: `${r.height}px` } });
    a.card.classList.add("kcard--origem");
    document.documentElement.classList.add("is-arrastando");

    const origem = a.chamado.status;
    for (const st of STATUS_ORDEM) {
        colunas[st].el.dataset.drop = st === origem ? "origem" : TRANSICOES[origem]?.includes(st) ? "permitido" : "bloqueado";
    }

    if (a.toque) navigator.vibrate?.(8);
    posicionarFantasma();
    atualizarAlvo();
    a.raf = requestAnimationFrame(autoScroll);
}

function velocidade(distancia) {
    return Math.min(20, Math.max(2, distancia / 3));
}

// Rola o quadro (mobile) e a página quando o ponteiro encosta nas bordas
function autoScroll() {
    const a = arraste;
    if (!a?.ativo) return;
    let rolou = false;

    if (quadro.scrollWidth > quadro.clientWidth + 1) {
        const r = quadro.getBoundingClientRect();
        let vx = 0;
        if (a.x < r.left + BORDA_AUTOSCROLL) vx = -velocidade(r.left + BORDA_AUTOSCROLL - a.x);
        else if (a.x > r.right - BORDA_AUTOSCROLL) vx = velocidade(a.x - (r.right - BORDA_AUTOSCROLL));
        if (vx) {
            const antes = quadro.scrollLeft;
            quadro.scrollLeft += vx;
            rolou ||= quadro.scrollLeft !== antes;
        }
    }

    const topo = 64 + BORDA_AUTOSCROLL;
    const fundo = window.innerHeight - (mqBottomNav.matches ? 64 : 0) - BORDA_AUTOSCROLL;
    let vy = 0;
    if (a.y < topo) vy = -velocidade(topo - a.y);
    else if (a.y > fundo) vy = velocidade(a.y - fundo);
    if (vy) {
        const antes = window.scrollY;
        window.scrollBy(0, vy);
        rolou ||= window.scrollY !== antes;
    }

    if (rolou) atualizarAlvo();
    a.raf = requestAnimationFrame(autoScroll);
}

function limparVisualArraste() {
    const a = arraste;
    if (!a) return;
    a.fantasma?.remove();
    a.placeholder?.remove();
    a.card.classList.remove("kcard--origem");
    document.documentElement.classList.remove("is-arrastando");
    for (const st of STATUS_ORDEM) delete colunas[st]?.el.dataset.drop;
}

function encerrarArraste() {
    if (!arraste) return;
    clearTimeout(arraste.timer);
    cancelAnimationFrame(arraste.raf);
    window.removeEventListener("pointermove", aoMover);
    window.removeEventListener("pointerup", aoSoltar);
    window.removeEventListener("pointercancel", aoCancelar);
    window.removeEventListener("keydown", aoTeclarArrastando, true);
    arraste = null;
}

/** Evita que o "click" que segue o pointerup abra o chamado após um arraste. */
function suprimirClique() {
    const bloquear = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    window.addEventListener("click", bloquear, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", bloquear, { capture: true }), 100);
}

function soltar({ cancelar = false } = {}) {
    const a = arraste;
    const alvo = cancelar ? null : a.alvo;
    const rect = { left: a.x - a.dx, top: a.y - a.dy };
    const id = a.chamado.id;
    limparVisualArraste();
    encerrarArraste();

    if (alvo && estado.chamados.has(id)) {
        mover(id, alvo, { fantasma: { id, rect } });
    } else {
        desenhar({ fantasma: { id, rect } }); // volta voando para o lugar
    }
}

function aoPressionar(e) {
    if (arraste || !e.isPrimary || e.button !== 0 || !estado.carregado) return;
    if (e.target.closest("button, input, select, textarea")) return;
    const card = e.target.closest(".kcard");
    if (!card || !card._chamado || card.classList.contains("kcard--saindo")) return;
    const chamado = efetivo(card._chamado);
    if (!TRANSICOES[chamado.status]?.length) return;

    arraste = {
        card,
        chamado,
        pointerId: e.pointerId,
        toque: e.pointerType === "touch",
        x0: e.clientX,
        y0: e.clientY,
        x: e.clientX,
        y: e.clientY,
        ativo: false,
        alvo: null,
        timer: 0,
        raf: 0,
    };
    if (arraste.toque) {
        arraste.timer = setTimeout(() => {
            if (arraste && !arraste.ativo) iniciarArraste();
        }, ESPERA_TOQUE);
    }
    window.addEventListener("pointermove", aoMover, { passive: false });
    window.addEventListener("pointerup", aoSoltar);
    window.addEventListener("pointercancel", aoCancelar);
    window.addEventListener("keydown", aoTeclarArrastando, true);
}

function aoMover(e) {
    const a = arraste;
    if (!a || e.pointerId !== a.pointerId) return;
    a.x = e.clientX;
    a.y = e.clientY;

    if (!a.ativo) {
        const distancia = Math.hypot(a.x - a.x0, a.y - a.y0);
        if (distancia < (a.toque ? LIMIAR_TOQUE : LIMIAR_MOUSE)) return;
        if (a.toque) {
            encerrarArraste(); // mexeu antes do toque longo: é rolagem
            return;
        }
        iniciarArraste();
    }
    e.preventDefault();
    posicionarFantasma();
    atualizarAlvo();
}

function aoSoltar(e) {
    if (!arraste || e.pointerId !== arraste.pointerId) return;
    if (!arraste.ativo) {
        encerrarArraste();
        return;
    }
    suprimirClique();
    soltar();
}

function aoCancelar(e) {
    if (!arraste || e.pointerId !== arraste.pointerId) return;
    if (arraste.ativo) soltar({ cancelar: true });
    else encerrarArraste();
}

function aoTeclarArrastando(e) {
    if (e.key !== "Escape" || !arraste) return;
    e.preventDefault();
    e.stopPropagation();
    if (arraste.ativo) soltar({ cancelar: true });
    else encerrarArraste();
}

quadro.addEventListener("pointerdown", aoPressionar);
quadro.addEventListener("dragstart", (e) => e.preventDefault());
quadro.addEventListener("contextmenu", (e) => {
    if (arraste?.toque) e.preventDefault(); // toque longo não abre o menu do navegador
});
// Enquanto arrasta com o dedo, a página não rola (o autoScroll cuida disso)
document.addEventListener(
    "touchmove",
    (e) => {
        if (arraste?.ativo) e.preventDefault();
    },
    { passive: false }
);

/* ---------- Menu "Mover para…" (alternativa por teclado) ---------- */

const menu = h("div", { class: "kmenu", id: "fila-menu-mover", popover: "auto", role: "menu", "aria-labelledby": "fila-menu-titulo" });
$("#conteudo").append(menu);
let menuContexto = null; // { id, gatilho }

function gatilhoAtual() {
    if (!menuContexto) return null;
    if (menuContexto.gatilho.isConnected) return menuContexto.gatilho;
    return cardsEl.get(menuContexto.id)?.querySelector(".kcard__mover") || null;
}

function itensMenu() {
    return $$(".kmenu__item", menu);
}

function posicionarMenu(gatilho) {
    const r = gatilho.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 6);
    const left = Math.min(Math.max(8, r.right - m.width), window.innerWidth - m.width - 8);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}

function abrirMenu(gatilho) {
    const card = gatilho.closest(".kcard");
    const c = card?._chamado && efetivo(card._chamado);
    if (!c) return;

    const jaAberto = menu.matches(":popover-open");
    const mesmo = jaAberto && menuContexto?.id === c.id;
    if (jaAberto) menu.hidePopover();
    if (mesmo) return;

    menuContexto = { id: c.id, gatilho };
    const destinos = TRANSICOES[c.status] || [];
    render(
        menu,
        h("p", { class: "kmenu__titulo", id: "fila-menu-titulo" }, `Mover ${formatarNumeroChamado(c.numero)} para`),
        destinos.map((st) =>
            h(
                "button",
                { class: "kmenu__item", type: "button", role: "menuitem", tabindex: "-1", dataset: { status: st, tone: STATUS[st].tone } },
                icon(STATUS[st].icon),
                STATUS[st].label
            )
        )
    );
    menu.showPopover();
    posicionarMenu(gatilho);
    gatilho.setAttribute("aria-expanded", "true");
    itensMenu()[0]?.focus();
}

menu.addEventListener("toggle", (e) => {
    if (e.newState !== "closed") return;
    const gatilho = gatilhoAtual();
    menuContexto?.gatilho.setAttribute("aria-expanded", "false");
    gatilho?.setAttribute("aria-expanded", "false");
    const ativo = document.activeElement;
    if (gatilho && (!ativo || ativo === document.body || menu.contains(ativo))) gatilho.focus();
});

menu.addEventListener("click", (e) => {
    const item = e.target.closest(".kmenu__item");
    if (!item || !menuContexto) return;
    const { id } = menuContexto;
    const gatilho = gatilhoAtual();
    menu.hidePopover();
    gatilho?.focus();
    mover(id, item.dataset.status);
});

menu.addEventListener("keydown", (e) => {
    const itens = itensMenu();
    const atual = itens.indexOf(document.activeElement);
    let proximo = null;
    if (e.key === "ArrowDown") proximo = itens[(atual + 1) % itens.length];
    else if (e.key === "ArrowUp") proximo = itens[(atual - 1 + itens.length) % itens.length];
    else if (e.key === "Home") proximo = itens[0];
    else if (e.key === "End") proximo = itens[itens.length - 1];
    else if (e.key === "Tab") {
        e.preventDefault();
        menu.hidePopover();
        return;
    }
    if (proximo) {
        e.preventDefault();
        proximo.focus();
    }
});

quadro.addEventListener("click", (e) => {
    const botao = e.target.closest(".kcard__mover");
    if (!botao) return;
    e.preventDefault();
    abrirMenu(botao);
});

// Menu posicionado em coordenadas fixas: rolar fecha
window.addEventListener(
    "scroll",
    (e) => {
        if (menu.matches(":popover-open") && !menu.contains(e.target)) menu.hidePopover();
    },
    { capture: true, passive: true }
);

/* ---------- Filtros (estado na URL) ---------- */

function lerFiltrosDaUrl() {
    const p = new URLSearchParams(location.search);
    const prioridade = p.get("prioridade") || "";
    estado.filtros = {
        q: p.get("q") || "",
        prioridade: PRIORIDADES.some((x) => x.valor === prioridade) ? prioridade : "",
        meus: p.get("meus") === "1",
    };
}

function salvarFiltrosNaUrl() {
    const p = new URLSearchParams(location.search);
    const { q, prioridade, meus } = estado.filtros;
    q.trim() ? p.set("q", q.trim()) : p.delete("q");
    prioridade ? p.set("prioridade", prioridade) : p.delete("prioridade");
    meus ? p.set("meus", "1") : p.delete("meus");
    const qs = p.toString();
    history.replaceState(history.state, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
}

const botaoLimpar = h(
    "button",
    { class: "btn btn--ghost btn--sm fila-filtros__limpar", type: "button", hidden: true },
    icon(X),
    "Limpar filtros"
);

function aplicarFiltros() {
    salvarFiltrosNaUrl();
    botaoLimpar.hidden = !filtrosAtivos();
    desenhar();
}

function montarFiltros() {
    $("#fila-busca-wrap").prepend(icon(Search));
    campoPrioridade.append(...PRIORIDADES.map((p) => h("option", { value: p.valor }, p.valor)));
    formFiltros.append(botaoLimpar);

    campoBusca.value = estado.filtros.q;
    campoPrioridade.value = estado.filtros.prioridade;
    campoMeus.checked = estado.filtros.meus;
    botaoLimpar.hidden = !filtrosAtivos();

    let espera = 0;
    campoBusca.addEventListener("input", () => {
        clearTimeout(espera);
        espera = setTimeout(() => {
            estado.filtros.q = campoBusca.value;
            aplicarFiltros();
        }, 150);
    });
    campoPrioridade.addEventListener("change", () => {
        estado.filtros.prioridade = campoPrioridade.value;
        aplicarFiltros();
    });
    campoMeus.addEventListener("change", () => {
        estado.filtros.meus = campoMeus.checked;
        aplicarFiltros();
    });
    formFiltros.addEventListener("submit", (e) => e.preventDefault());
    botaoLimpar.addEventListener("click", () => {
        estado.filtros = { q: "", prioridade: "", meus: false };
        campoBusca.value = "";
        campoPrioridade.value = "";
        campoMeus.checked = false;
        aplicarFiltros();
        campoBusca.focus();
    });
}

/* ---------- Abas das colunas (mobile) ---------- */

function montarAbas() {
    abas = criarAbas($("#fila-abas"), {
        aoMudar: (st) => {
            colunas[st]?.el.scrollIntoView({ behavior: movimentoReduzido() ? "auto" : "smooth", inline: "start", block: "nearest" });
        },
    });

    // A aba acompanha a coluna visível ao deslizar
    const observador = new IntersectionObserver(
        (entradas) => {
            if (!mqMobile.matches) return;
            for (const entrada of entradas) {
                if (entrada.isIntersecting) abas.selecionar(entrada.target.dataset.status, { notificar: false });
            }
        },
        { root: quadro, threshold: 0.6 }
    );
    observadorColunas = observador;
}

function observarColunasVisiveis() {
    if (!observadorColunas) return;
    observadorColunas.disconnect();
    for (const st of STATUS_ORDEM) observadorColunas.observe(colunas[st].el);
}

/* ---------- Dados em tempo real ---------- */

function mostrarErro(erro) {
    console.error(erro);
    pararObservacao?.();
    pararObservacao = null;
    estado.carregado = false;
    quadro.removeAttribute("aria-busy");
    toast.error("Não foi possível carregar a fila", { message: mensagemErro(erro) });
    render(
        quadro,
        estadoVazio({
            icone: CircleAlert,
            tom: "danger",
            titulo: "Não foi possível carregar a fila",
            texto: "Verifique sua conexão e tente novamente.",
            acao: { label: "Tentar novamente", icone: RotateCw, onClick: iniciarObservacao },
        })
    );
}

function iniciarObservacao() {
    pararObservacao?.();
    estado.carregado = false;
    primeiroDesenho = true;
    cardsEl.clear();
    if (!colunas.aberto?.el.isConnected) {
        montarColunas();
        mostrarSkeleton();
    }
    observarColunasVisiveis();
    quadro.setAttribute("aria-busy", "true");

    pararObservacao = observarChamados(
        estado.perfil,
        (lista) => {
            estado.chamados = new Map(lista.map((c) => [c.id, c]));
            estado.carregado = true;
            quadro.removeAttribute("aria-busy");
            desenhar();
        },
        mostrarErro
    );
}

/* ---------- Início ---------- */

lerFiltrosDaUrl();
montarColunas();
mostrarSkeleton();
montarFiltros();
montarAbas();

estado.perfil = await iniciarPagina({ pagina: "fila", papeis: ["tecnico", "admin"] });
iniciarObservacao();

setInterval(atualizarIdades, 60_000);

window.addEventListener("pagehide", () => {
    pararObservacao?.();
    pararObservacao = null;
});
// Voltou pelo histórico (bfcache): retoma o tempo real
window.addEventListener("pageshow", (e) => {
    if (e.persisted && !pararObservacao) iniciarObservacao();
});
