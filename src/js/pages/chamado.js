// Detalhe do chamado: cabeçalho, painel de detalhes (com linha do tempo e ações do técnico)
// e conversa em tempo real com envio e edição de mensagens.

import {
    ArrowDown,
    ArrowLeft,
    Check,
    ChevronDown,
    CircleCheck,
    CircleDot,
    Clock,
    Hand,
    Info,
    Link2,
    MessageSquareText,
    Pencil,
    RotateCcw,
    SendHorizontal,
    UserCheck,
    X,
} from "lucide";
import { iniciarPagina } from "../components/app-shell.js";
import { avatar } from "../components/avatar.js";
import { atualizarBadgeStatus, badgeCategoria, badgePrioridade, badgeStatus } from "../components/badges.js";
import { confirmar } from "../components/confirm.js";
import { estadoVazio } from "../components/empty-state.js";
import { toast } from "../components/toast.js";
import { movimentoReduzido } from "../core/theme.js";
import {
    assumirChamado,
    observarChamado,
    podeVerChamado,
    reabrirChamado,
    resolverChamado,
} from "../services/chamados.js";
import { editarMensagem, enviarMensagem, observarMensagens } from "../services/mensagens.js";
import { STATUS, STATUS_ORDEM } from "../utils/constants.js";
import { $, h, render } from "../utils/dom.js";
import {
    formatarDataHora,
    formatarHora,
    formatarNumeroChamado,
    primeiroNome,
} from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { destacar, tocar } from "../utils/motion.js";

const AGRUPAR_MS = 5 * 60 * 1000;
const PERTO_DO_FIM_PX = 140;

const el = {
    pagina: $("#conteudo"),
    cabecalho: $("#cabecalho"),
    voltar: $("#voltar"),
    numero: $("#numero-chamado"),
    titulo: $("#titulo-chamado"),
    badges: $("#badges-chamado"),
    copiar: $("#btn-copiar"),
    detalhes: $("#detalhes"),
    resumo: $("#detalhes-resumo"),
    chevron: $("#detalhes-chevron"),
    corpo: $("#detalhes-corpo"),
    acoes: $("#acoes"),
    lista: $("#lista-mensagens"),
    pilula: $("#pilula-novas"),
    anuncio: $("#anuncio-mensagens"),
    composer: $("#composer"),
    aviso: $("#composer-aviso"),
    campo: $("#campo-mensagem"),
    enviar: $("#btn-enviar"),
};

const desktop = window.matchMedia("(min-width: 1024px)");
const id = new URLSearchParams(location.search).get("id");

/** @type {import("../services/chamados.js").Chamado|null} */
let chamado = null;
/** @type {import("../services/mensagens.js").Mensagem[]} */
let mensagens = [];
let mensagensCarregadas = false;
let pararChamado = null;
let pararMensagens = null;
let acaoEmAndamento = false;
let badgeStatusEl = null;
let assinaturaConversa = "";
let primeiraConversa = true;

// Nós da conversa reaproveitados entre renders (preserva edição em andamento e animações)
const nos = new Map();
const conhecidos = new Set();

// ---------- Utilidades ----------

function pararTudo() {
    pararChamado?.();
    pararMensagens?.();
    pararChamado = null;
    pararMensagens = null;
}

function sairCom(titulo, message) {
    pararTudo();
    toast.flash("error", titulo, { message });
    location.replace("chamados.html");
}

function sou(uid) {
    return uid && uid === perfil.uid;
}

function numeroFormatado() {
    return formatarNumeroChamado(chamado?.numero ?? new URLSearchParams(location.search).get("n"));
}

const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const fmtDiaAno = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

function inicioDoDia(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function chaveDia(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function rotuloDia(d) {
    const dias = Math.round((inicioDoDia(new Date()) - inicioDoDia(d)) / 86400000);
    if (dias === 0) return "Hoje";
    if (dias === 1) return "Ontem";
    return d.getFullYear() === new Date().getFullYear() ? fmtDia.format(d) : fmtDiaAno.format(d);
}

// ---------- Rolagem da conversa ----------
// Desktop: a lista rola por dentro. Mobile: a página inteira rola.

function distanciaDoFim() {
    if (desktop.matches) return el.lista.scrollHeight - el.lista.scrollTop - el.lista.clientHeight;
    const doc = document.documentElement;
    return doc.scrollHeight - window.scrollY - window.innerHeight;
}

function rolarParaFim(suave = true) {
    const behavior = suave && !movimentoReduzido() ? "smooth" : "auto";
    if (desktop.matches) el.lista.scrollTo({ top: el.lista.scrollHeight, behavior });
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
    esconderPilula();
}

function mostrarPilula() {
    if (!el.pilula.hidden) return;
    el.pilula.hidden = false;
}

function esconderPilula() {
    el.pilula.hidden = true;
}

function aoRolar() {
    if (!el.pilula.hidden && distanciaDoFim() < PERTO_DO_FIM_PX) esconderPilula();
}

// ---------- Cabeçalho ----------

function prepararCabecalho() {
    el.voltar.prepend(icon(ArrowLeft));
    el.voltar.addEventListener("click", (e) => {
        // Volta no histórico quando viemos de outra página da própria app (mantém filtros/rolagem)
        try {
            const origem = document.referrer ? new URL(document.referrer) : null;
            if (origem && origem.origin === location.origin && !origem.pathname.endsWith("chamado.html") && history.length > 1) {
                e.preventDefault();
                history.back();
            }
        } catch {
            // referrer inválido: segue o link
        }
    });

    el.copiar.prepend(icon(Link2));
    el.copiar.addEventListener("click", async () => {
        const url = new URL("chamado.html", location.href);
        url.searchParams.set("id", id);
        if (chamado?.numero != null) url.searchParams.set("n", chamado.numero);
        try {
            await navigator.clipboard.writeText(url.href);
            toast.success("Link copiado", { message: `Qualquer pessoa com acesso ao chamado ${numeroFormatado()} pode abri-lo.` });
        } catch {
            toast.error("Não foi possível copiar o link", { message: "Copie o endereço pela barra do navegador." });
        }
    });

    // Altura do cabeçalho e do composer alimentam o cálculo de altura da conversa (CSS)
    if ("ResizeObserver" in window) {
        new ResizeObserver(() => {
            el.pagina.style.setProperty("--chamado-header-h", `${el.cabecalho.offsetHeight}px`);
        }).observe(el.cabecalho);
        new ResizeObserver(() => {
            el.pagina.style.setProperty("--composer-h", `${el.composer.offsetHeight}px`);
        }).observe(el.composer);
    }
}

function renderCabecalho() {
    const numero = numeroFormatado();
    el.numero.textContent = numero;
    el.numero.style.viewTransitionName = `chamado-${id.replace(/[^A-Za-z0-9_-]/g, "")}`;
    el.titulo.textContent = chamado.titulo;
    document.title = `${numero} · ${chamado.titulo} · HelpDesk`;

    if (!badgeStatusEl) {
        badgeStatusEl = badgeStatus(chamado.status);
        render(el.badges, badgeStatusEl, badgePrioridade(chamado.prioridade));
    } else {
        el.badges.lastChild.replaceWith(badgePrioridade(chamado.prioridade));
    }
    el.copiar.disabled = false;
}

// ---------- Painel de detalhes ----------

function pessoa(nome, detalhe, { voce = false } = {}) {
    return h(
        "span",
        { class: "pessoa" },
        avatar(nome, { tamanho: "sm" }),
        h(
            "span",
            { class: "pessoa__texto" },
            h("span", { class: "pessoa__nome truncate" }, nome || "—", voce && h("span", { class: "muted" }, " (você)")),
            detalhe
        )
    );
}

function item(rotulo, ...valor) {
    return h("div", { class: "detalhes__item" }, h("dt", {}, rotulo), h("dd", {}, ...valor));
}

function etapasLinhaDoTempo() {
    const c = chamado;
    const atual = STATUS_ORDEM.indexOf(c.status);
    const estado = (i) => (i < atual ? "done" : i === atual ? "current" : "future");

    return [
        {
            estado: estado(0),
            icone: CircleDot,
            tom: "info",
            titulo: "Aberto",
            meta: `por ${c.usuarioNome || "solicitante"} · ${formatarDataHora(c.dataCriacao)}`,
        },
        {
            estado: estado(1),
            icone: UserCheck,
            tom: "warning",
            titulo: c.tecnicoNome && atual >= 1 ? `Assumido por ${c.tecnicoNome}` : "Em análise",
            meta: atual >= 1 ? formatarDataHora(c.dataAssumido, "agora") : "Aguardando um técnico",
        },
        {
            estado: estado(2),
            icone: CircleCheck,
            tom: "success",
            titulo: "Resolvido",
            meta: atual >= 2 ? formatarDataHora(c.dataResolucao, "agora") : "Ainda não resolvido",
        },
    ];
}

function linhaDoTempo() {
    return h(
        "section",
        { class: "linha-tempo", "aria-labelledby": "linha-tempo-titulo" },
        h("h3", { class: "linha-tempo__titulo", id: "linha-tempo-titulo" }, "Linha do tempo"),
        h(
            "ol",
            { class: "linha-tempo__lista" },
            etapasLinhaDoTempo().map((etapa) =>
                h(
                    "li",
                    {
                        class: "linha-tempo__etapa",
                        dataset: { estado: etapa.estado, tone: etapa.tom },
                        "aria-current": etapa.estado === "current" ? "step" : null,
                    },
                    h("span", { class: "linha-tempo__marcador" }, icon(etapa.estado === "done" ? Check : etapa.icone)),
                    h(
                        "span",
                        { class: "linha-tempo__texto" },
                        h("strong", {}, etapa.titulo),
                        h("span", { class: "linha-tempo__meta" }, etapa.meta),
                        etapa.estado === "future" && h("span", { class: "sr-only" }, "(etapa futura)")
                    )
                )
            )
        )
    );
}

function renderPainel() {
    const c = chamado;
    el.corpo.removeAttribute("aria-busy");

    render(
        el.corpo,
        h("h2", { class: "detalhes__titulo" }, "Detalhes"),
        h(
            "dl",
            { class: "detalhes__lista" },
            item(
                "Solicitante",
                pessoa(
                    c.usuarioNome,
                    c.usuarioEmail && h("a", { class: "pessoa__email truncate", href: `mailto:${c.usuarioEmail}` }, c.usuarioEmail),
                    { voce: sou(c.usuarioId) }
                )
            ),
            item(
                "Técnico responsável",
                c.tecnicoNome
                    ? pessoa(c.tecnicoNome, null, { voce: sou(c.tecnicoId) })
                    : h("span", { class: "muted" }, "Ninguém ainda")
            ),
            item("Categoria", badgeCategoria(c.categoria)),
            item("Prioridade", badgePrioridade(c.prioridade)),
            item("Aberto em", h("span", { class: "num" }, formatarDataHora(c.dataCriacao))),
            item("Resolvido em", h("span", { class: c.dataResolucao ? "num" : "muted" }, formatarDataHora(c.dataResolucao)))
        ),
        linhaDoTempo()
    );

    const tecnico = c.tecnicoNome ? `Técnico: ${primeiroNome(c.tecnicoNome)}` : "Sem técnico";
    el.resumo.textContent = `${STATUS[c.status]?.label || c.status} · ${tecnico}`;

    renderAcoes();
}

const ACOES = {
    aberto: {
        rotulo: "Assumir chamado",
        icone: Hand,
        classe: "btn--primary",
        confirmacao: () => ({
            titulo: `Assumir o chamado ${numeroFormatado()}?`,
            mensagem: "Ele passa para “Em análise” e você fica como técnico responsável.",
            confirmar: "Assumir",
            tom: "brand",
        }),
        executar: () => assumirChamado(chamado.id, perfil),
        sucesso: "Chamado assumido",
        erro: "Não foi possível assumir o chamado",
    },
    analise: {
        rotulo: "Resolver chamado",
        icone: CircleCheck,
        classe: "btn--success",
        confirmacao: () => ({
            titulo: `Resolver o chamado ${numeroFormatado()}?`,
            mensagem: "O solicitante verá o chamado como resolvido. Você poderá reabri-lo depois, se precisar.",
            confirmar: "Resolver",
            tom: "success",
        }),
        executar: () => resolverChamado(chamado.id),
        sucesso: "Chamado resolvido",
        erro: "Não foi possível resolver o chamado",
    },
    resolvido: {
        rotulo: "Reabrir chamado",
        icone: RotateCcw,
        classe: "btn--secondary",
        confirmacao: () => ({
            titulo: `Reabrir o chamado ${numeroFormatado()}?`,
            mensagem: "Ele volta para “Em análise” com o mesmo técnico responsável.",
            confirmar: "Reabrir",
            tom: "warning",
        }),
        executar: () => reabrirChamado(chamado.id),
        sucesso: "Chamado reaberto",
        erro: "Não foi possível reabrir o chamado",
    },
};

function renderAcoes() {
    if (perfil.role === "usuario") {
        el.acoes.hidden = true;
        return;
    }
    const acao = ACOES[chamado.status];
    if (!acao) {
        render(el.acoes);
        return;
    }
    const botao = h(
        "button",
        { class: `btn ${acao.classe} btn--block`, type: "button", dataset: { acao: chamado.status } },
        icon(acao.icone),
        h("span", {}, acao.rotulo)
    );
    botao.addEventListener("click", () => executarAcao(botao, acao));
    render(el.acoes, botao);
}

async function executarAcao(botao, acao) {
    if (acaoEmAndamento) return;
    const ok = await confirmar(acao.confirmacao());
    if (!ok) return;

    acaoEmAndamento = true;
    botao.setAttribute("aria-busy", "true");
    try {
        await acao.executar();
        toast.success(acao.sucesso, { message: `${numeroFormatado()} · ${chamado.titulo}` });
    } catch (erro) {
        console.error(erro);
        toast.error(acao.erro, { message: "Verifique sua conexão e tente novamente." });
        botao.removeAttribute("aria-busy");
    } finally {
        acaoEmAndamento = false;
    }
    // O painel foi redesenhado pelo snapshot: devolve o foco à nova ação
    const novo = el.acoes.querySelector("button");
    if (novo && !novo.isSameNode(botao)) novo.focus({ preventScroll: true });
}

// ---------- Conversa ----------

/** Descrição + eventos de sistema + mensagens, em ordem cronológica. */
function itensDaConversa() {
    const c = chamado;
    const itens = [
        {
            tipo: "msg",
            chave: "desc",
            descricao: true,
            autorId: c.usuarioId,
            autorNome: c.usuarioNome || "Solicitante",
            texto: c.descricao || "(sem descrição)",
            data: c.dataCriacao || new Date(0),
        },
    ];

    if (c.tecnicoNome && c.dataAssumido && c.status !== "aberto") {
        itens.push({
            tipo: "evento",
            chave: `ev:assumido:${c.dataAssumido.getTime()}`,
            data: c.dataAssumido,
            icone: UserCheck,
            tom: "warning",
            texto: `${sou(c.tecnicoId) ? "Você" : c.tecnicoNome} assumiu o chamado`,
        });
    }
    if (c.status === "resolvido" && c.dataResolucao) {
        itens.push({
            tipo: "evento",
            chave: `ev:resolvido:${c.dataResolucao.getTime()}`,
            data: c.dataResolucao,
            icone: CircleCheck,
            tom: "success",
            texto: "Chamado marcado como resolvido",
        });
    }

    for (const m of mensagens) {
        itens.push({
            tipo: "msg",
            chave: `m:${m.id}`,
            mensagem: m,
            autorId: m.usuarioId,
            autorNome: m.usuarioNome,
            texto: m.texto,
            data: m.data || new Date(),
            editada: m.editada,
            pendente: m.pendente,
        });
    }

    // A descrição sempre abre a conversa; o resto segue a ordem do tempo
    return itens
        .map((it, i) => ({ it, i }))
        .sort((a, b) => (a.it.descricao ? -1 : b.it.descricao ? 1 : a.it.data - b.it.data || a.i - b.i))
        .map(({ it }) => it);
}

function marcarNovo(no) {
    no.classList.add("is-new");
    no.addEventListener("animationend", () => no.classList.remove("is-new"), { once: true });
}

function noEvento(it) {
    let no = nos.get(it.chave);
    if (!no) {
        no = h(
            "div",
            { class: "evento", dataset: { tone: it.tom }, role: "note" },
            h("span", { class: "evento__icone" }, icon(it.icone)),
            h("span", { class: "evento__texto" }, it.texto),
            h("time", { class: "evento__hora num", datetime: it.data.toISOString(), title: formatarDataHora(it.data) }, formatarHora(it.data))
        );
        nos.set(it.chave, no);
    } else {
        no.querySelector(".evento__texto").textContent = it.texto;
    }
    return no;
}

function noMensagem(it) {
    let linha = nos.get(it.chave);
    const minha = sou(it.autorId);
    const editavel = minha && !it.descricao;

    if (!linha) {
        const bolha = h(
            "div",
            { class: ["bolha", it.descricao && "bolha--descricao"] },
            it.descricao && h("span", { class: "bolha__rotulo" }, icon(MessageSquareText), "Descrição"),
            h("p", { class: "bolha__texto" }),
            h(
                "span",
                { class: "bolha__meta" },
                h("span", { class: "bolha__pendente", title: "Enviando…" }, icon(Clock), h("span", { class: "sr-only" }, "Enviando")),
                h("time", { class: "bolha__hora num" }),
                h("span", { class: "bolha__editada" }, "(editada)")
            )
        );
        linha = h("div", { class: "msg", dataset: { chave: it.chave } });
        if (editavel) {
            const editar = h(
                "button",
                { class: "btn btn--ghost btn--icon btn--sm msg__editar", type: "button", "aria-label": "Editar mensagem", title: "Editar mensagem" },
                icon(Pencil)
            );
            editar.addEventListener("click", () => abrirEdicao(linha, it.mensagem.id));
            linha.append(editar);
        }
        linha.append(bolha);
        nos.set(it.chave, linha);
    }

    linha.classList.toggle("msg--minha", minha);
    linha.classList.toggle("is-pending", Boolean(it.pendente));
    if (it.mensagem) linha.dataset.texto = it.texto;

    // Edição em andamento: não sobrescreve o editor
    if (linha.dataset.editando) return linha;

    linha.querySelector(".bolha__texto").textContent = it.texto;
    const hora = linha.querySelector(".bolha__hora");
    hora.textContent = formatarHora(it.data);
    hora.dateTime = it.data.toISOString();
    hora.title = formatarDataHora(it.data);
    linha.querySelector(".bolha__editada").hidden = !it.editada;
    linha.querySelector(".bolha__pendente").hidden = !it.pendente;
    return linha;
}

function cabecalhoGrupo(it) {
    const tecnico = chamado.tecnicoId && it.autorId === chamado.tecnicoId;
    const solicitante = it.autorId === chamado.usuarioId;
    return h(
        "div",
        { class: "grupo__cabecalho" },
        h("span", { class: "grupo__nome" }, it.autorNome),
        tecnico && h("span", { class: "badge", dataset: { tone: "brand" } }, "Técnico"),
        !tecnico && solicitante && perfil.role !== "usuario" && h("span", { class: "grupo__papel" }, "Solicitante")
    );
}

/** Monta a estrutura (dias, grupos, eventos) e uma assinatura para evitar redesenhos à toa. */
function estruturar(itens) {
    const blocos = [];
    const partesAssinatura = [];
    let diaAtual = null;
    let grupo = null;

    for (const it of itens) {
        const dia = chaveDia(it.data);
        if (dia !== diaAtual) {
            diaAtual = dia;
            grupo = null;
            const rotulo = it.descricao && it.data.getTime() === 0 ? "" : rotuloDia(it.data);
            blocos.push({ tipo: "dia", rotulo });
            partesAssinatura.push(`d:${rotulo}`);
        }
        if (it.tipo === "evento") {
            grupo = null;
            blocos.push({ tipo: "evento", it });
            partesAssinatura.push(it.chave);
            continue;
        }
        const continua = grupo && grupo.autorId === it.autorId && it.data - grupo.ultima < AGRUPAR_MS;
        if (!continua) {
            grupo = { tipo: "grupo", autorId: it.autorId, primeiro: it, itens: [], ultima: it.data };
            blocos.push(grupo);
            partesAssinatura.push(`g:${it.autorId}:${it.autorId === chamado.tecnicoId}`);
        }
        grupo.itens.push(it);
        grupo.ultima = it.data;
        partesAssinatura.push(it.chave);
    }
    if (mensagensCarregadas && !mensagens.length) partesAssinatura.push("vazia");
    return { blocos, assinatura: partesAssinatura.join("|") };
}

function renderConversa({ novas = [] } = {}) {
    if (!chamado || !mensagensCarregadas) return;

    const pertoDoFim = distanciaDoFim() < PERTO_DO_FIM_PX;
    const itens = itensDaConversa();
    const { blocos, assinatura } = estruturar(itens);

    // Atualiza o conteúdo dos nós existentes (texto, pendente, editada) sempre
    const nosDaVez = new Map(itens.map((it) => [it.chave, it.tipo === "evento" ? noEvento(it) : noMensagem(it)]));
    const recemChegados = primeiraConversa ? [] : itens.filter((it) => !conhecidos.has(it.chave));

    if (assinatura !== assinaturaConversa) {
        assinaturaConversa = assinatura;

        // Mover nós tira o foco; guardamos e devolvemos depois
        const ativo = el.lista.contains(document.activeElement) ? document.activeElement : null;
        const selecao = ativo && "selectionStart" in ativo ? [ativo.selectionStart, ativo.selectionEnd] : null;

        const filhos = blocos.map((b) => {
            if (b.tipo === "dia") {
                return b.rotulo
                    ? h("div", { class: "dia", role: "separator", "aria-label": b.rotulo }, h("span", {}, b.rotulo))
                    : null;
            }
            if (b.tipo === "evento") return nosDaVez.get(b.it.chave);

            const minha = sou(b.autorId);
            const cabeca = !minha && cabecalhoGrupo(b.primeiro);
            const grupoEl = h(
                "div",
                { class: ["grupo", minha ? "grupo--minha" : "grupo--outra"] },
                !minha && h("div", { class: "grupo__avatar" }, avatar(b.primeiro.autorNome, { tamanho: "sm" })),
                h("div", { class: "grupo__corpo" }, cabeca, b.itens.map((it) => nosDaVez.get(it.chave)))
            );
            if (cabeca && recemChegados.includes(b.primeiro)) {
                marcarNovo(cabeca);
                marcarNovo(grupoEl.querySelector(".grupo__avatar"));
            }
            return grupoEl;
        });

        if (!mensagens.length) {
            filhos.push(
                h(
                    "p",
                    { class: "conversa__dica" },
                    perfil.role === "usuario"
                        ? "Nenhuma mensagem ainda. Escreva abaixo para conversar com o técnico."
                        : "Nenhuma mensagem ainda. Escreva abaixo para falar com o solicitante."
                )
            );
        }

        render(el.lista, filhos);

        if (ativo?.isConnected) {
            ativo.focus({ preventScroll: true });
            if (selecao) ativo.setSelectionRange(...selecao);
        }
    }

    for (const it of recemChegados) marcarNovo(nosDaVez.get(it.chave));
    for (const it of itens) conhecidos.add(it.chave);
    // Nós de itens que sumiram (ex.: chamado reaberto) saem do cache
    for (const chave of nos.keys()) if (!nosDaVez.has(chave)) nos.delete(chave);

    if (primeiraConversa) {
        primeiraConversa = false;
        el.lista.removeAttribute("aria-busy");
        el.lista.classList.add("anim-in");
        if (desktop.matches) rolarParaFim(false);
        return;
    }

    if (!recemChegados.length) return;

    const idsNovos = new Set(novas);
    const minhaNova = recemChegados.some((it) => it.mensagem && idsNovos.has(it.mensagem.id) && sou(it.autorId));
    if (minhaNova || pertoDoFim) rolarParaFim(true);
    else mostrarPilula();

    anunciar(recemChegados.filter((it) => it.tipo === "msg" && !sou(it.autorId)));
}

function anunciar(itens) {
    if (!itens.length) return;
    const texto = itens
        .map((it) => {
            const resumo = it.texto.length > 140 ? `${it.texto.slice(0, 140)}…` : it.texto;
            return `Nova mensagem de ${it.autorNome}: ${resumo}`;
        })
        .join(". ");
    el.anuncio.textContent = "";
    // Pequeno atraso para o leitor de tela perceber a troca de texto
    setTimeout(() => (el.anuncio.textContent = texto), 50);
}

function iniciarMensagens() {
    pararMensagens?.();
    pararMensagens = observarMensagens(
        chamado.id,
        (lista, novas) => {
            mensagens = lista;
            mensagensCarregadas = true;
            renderConversa({ novas });
        },
        (erro) => {
            console.error(erro);
            pararMensagens = null;
            assinaturaConversa = "";
            el.lista.removeAttribute("aria-busy");
            render(
                el.lista,
                estadoVazio({
                    icone: MessageSquareText,
                    titulo: "Não foi possível carregar a conversa",
                    texto: "Verifique sua conexão e tente de novo.",
                    tom: "danger",
                    acao: { label: "Tentar novamente", icone: RotateCcw, variante: "btn--secondary", onClick: iniciarMensagens },
                })
            );
            toast.error("Erro ao carregar mensagens");
        }
    );
}

// ---------- Edição inline ----------

function abrirEdicao(linha, mensagemId) {
    if (linha.dataset.editando) return;
    const original = linha.dataset.texto || "";
    const bolha = linha.querySelector(".bolha");
    const textoEl = bolha.querySelector(".bolha__texto");
    const metaEl = bolha.querySelector(".bolha__meta");
    const idCampo = `editar-${mensagemId}`;

    const campo = h("textarea", { class: "textarea bolha__editor", id: idCampo, rows: 1 });
    campo.value = original;

    const salvar = h("button", { class: "btn btn--primary btn--sm", type: "submit" }, icon(Check), h("span", {}, "Salvar"));
    const cancelar = h("button", { class: "btn btn--ghost btn--sm", type: "button" }, icon(X), h("span", {}, "Cancelar"));

    const form = h(
        "form",
        { class: "bolha__form", novalidate: true },
        h("label", { class: "sr-only", for: idCampo }, "Editar mensagem"),
        campo,
        h(
            "div",
            { class: "bolha__form-acoes" },
            h("span", { class: "bolha__form-dica" }, "Enter salva · Esc cancela"),
            cancelar,
            salvar
        )
    );

    const fechar = ({ focarEditar = true } = {}) => {
        delete linha.dataset.editando;
        linha.classList.remove("is-editing");
        form.replaceWith(textoEl);
        metaEl.hidden = false;
        const it = mensagens.find((m) => m.id === mensagemId);
        if (it) noMensagem({ chave: `m:${it.id}`, mensagem: it, autorId: it.usuarioId, texto: it.texto, data: it.data || new Date(), editada: it.editada, pendente: it.pendente });
        if (focarEditar) linha.querySelector(".msg__editar")?.focus({ preventScroll: true });
    };

    const atualizarEstado = () => {
        salvar.disabled = !campo.value.trim();
        campo.setAttribute("aria-invalid", campo.value.trim() ? "false" : "true");
    };

    const enviarEdicao = async () => {
        const texto = campo.value.trim();
        if (!texto) {
            tocar(campo, "is-shaking");
            toast.warning("A mensagem não pode ficar vazia");
            return;
        }
        if (texto === original.trim()) {
            fechar();
            return;
        }
        salvar.setAttribute("aria-busy", "true");
        campo.readOnly = true;
        try {
            await editarMensagem(chamado.id, mensagemId, texto);
            linha.dataset.texto = texto;
            fechar();
            destacar(bolha);
        } catch (erro) {
            console.error(erro);
            toast.error("Não foi possível editar a mensagem", { message: "Seu texto foi mantido. Tente novamente." });
            salvar.removeAttribute("aria-busy");
            campo.readOnly = false;
            campo.focus();
        }
    };

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        enviarEdicao();
    });
    cancelar.addEventListener("click", () => fechar());
    campo.addEventListener("input", () => {
        atualizarEstado();
        autoAjustar(campo);
    });
    campo.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            fechar();
        } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            enviarEdicao();
        }
    });

    linha.dataset.editando = "1";
    linha.classList.add("is-editing");
    textoEl.replaceWith(form);
    metaEl.hidden = true;
    atualizarEstado();
    autoAjustar(campo);
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
}

// ---------- Composer ----------

const semFieldSizing = !(window.CSS?.supports?.("field-sizing", "content"));

/** Fallback para navegadores sem field-sizing: cresce até o max-height do CSS. */
function autoAjustar(campo) {
    if (!semFieldSizing) return;
    campo.style.height = "auto";
    campo.style.height = `${campo.scrollHeight + 2}px`;
}

function atualizarComposer() {
    el.aviso.hidden = chamado.status !== "resolvido";
}

function prepararComposer() {
    el.enviar.append(icon(SendHorizontal));
    el.aviso.prepend(icon(Info));

    const atualizarBotao = () => {
        el.enviar.disabled = !el.campo.value.trim();
    };

    el.campo.addEventListener("input", () => {
        atualizarBotao();
        autoAjustar(el.campo);
    });

    el.campo.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            el.composer.requestSubmit();
        }
    });

    el.composer.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = el.campo.value.trim();
        if (!texto || !chamado) return;

        // Otimista: o snapshot local já mostra a bolha como pendente
        el.campo.value = "";
        atualizarBotao();
        autoAjustar(el.campo);
        el.campo.focus();

        try {
            await enviarMensagem(chamado.id, texto, perfil);
        } catch (erro) {
            console.error(erro);
            if (!el.campo.value.trim()) el.campo.value = texto;
            atualizarBotao();
            autoAjustar(el.campo);
            toast.error("Não foi possível enviar a mensagem", { message: "Seu texto foi mantido no campo. Tente novamente." });
        }
    });

    el.pilula.prepend(icon(ArrowDown));
    el.pilula.addEventListener("click", () => rolarParaFim(true));
    el.lista.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("scroll", aoRolar, { passive: true });
}

// ---------- Detalhes recolhíveis (mobile) ----------

function prepararDetalhes() {
    el.chevron.append(icon(ChevronDown));
    const aplicar = () => {
        // No desktop o painel fica sempre aberto (o summary some via CSS)
        el.detalhes.open = desktop.matches;
    };
    aplicar();
    desktop.addEventListener("change", aplicar);
}

// ---------- Chamado em tempo real ----------

function descreverMudanca(anterior, atual) {
    if (atual.status === "analise" && anterior.status === "aberto") {
        return `${atual.tecnicoNome || "Um técnico"} assumiu o chamado.`;
    }
    if (atual.status === "analise" && anterior.status === "resolvido") return "O chamado foi reaberto.";
    if (atual.status === "resolvido") return "O chamado foi marcado como resolvido.";
    if (atual.status === "aberto") return "O chamado voltou para a fila de atendimento.";
    return `Novo status: ${STATUS[atual.status]?.label || atual.status}.`;
}

function aoReceberChamado(c) {
    if (!c) {
        sairCom(chamado ? "Este chamado foi removido" : "Chamado não encontrado", "Confira o link ou procure o chamado na lista.");
        return;
    }
    if (!podeVerChamado(c, perfil)) {
        sairCom("Acesso negado", "Você só pode ver os chamados que abriu.");
        return;
    }

    const anterior = chamado;
    chamado = c;

    renderCabecalho();
    renderPainel();
    atualizarComposer();

    if (!anterior) {
        el.campo.disabled = false;
        iniciarMensagens();
        return;
    }

    if (anterior.status !== c.status) {
        atualizarBadgeStatus(badgeStatusEl, c.status);
        tocar(badgeStatusEl, "is-pulsing");
        if (!acaoEmAndamento) {
            toast.info(`Status: ${STATUS[c.status]?.label || c.status}`, { message: descreverMudanca(anterior, c) });
        }
    }
    renderConversa();
}

// ---------- Início ----------

const perfil = await iniciarPagina({ pagina: "chamados" });

if (!id) {
    sairCom("Chamado não encontrado", "O link está incompleto.");
} else {
    prepararCabecalho();
    prepararDetalhes();
    prepararComposer();

    pararChamado = observarChamado(id, aoReceberChamado, (erro) => {
        console.error(erro);
        const negado = erro?.code === "permission-denied";
        sairCom(
            negado ? "Acesso negado" : "Não foi possível abrir o chamado",
            negado ? "Você não tem permissão para ver este chamado." : "Verifique sua conexão e tente novamente."
        );
    });

    window.addEventListener("pagehide", pararTudo);
    // Voltando do bfcache os observadores já foram parados: recarrega para reconectar
    window.addEventListener("pageshow", (e) => {
        if (e.persisted) location.reload();
    });
}
