import { ArrowRight, CircleAlert, CloudCheck, Lightbulb, Plus } from "lucide";
import { iniciarPagina } from "../components/app-shell.js";
import { avatar } from "../components/avatar.js";
import { badgeCategoria, badgePrioridade, badgeStatus } from "../components/badges.js";
import { toast } from "../components/toast.js";
import { criarChamado } from "../services/chamados.js";
import { CATEGORIAS, PRIORIDADES, prioridadeInfo } from "../utils/constants.js";
import { $, $$, h, render } from "../utils/dom.js";
import { formatarHora, formatarNumeroChamado } from "../utils/format.js";
import { icon } from "../utils/icons.js";
import { logError } from "../utils/logger.js";
import { comTransicao, tocar, tremer } from "../utils/motion.js";

const CHAVE_RASCUNHO = "hd:rascunho-chamado";
const MAX_TITULO = 80;
const MIN_DESCRICAO = 10;
const PRIORIDADE_PADRAO = "Média";

const DICAS = [
    "Use um título específico: “Outlook não sincroniza”, e não “Problema no PC”.",
    "Diga o que você estava fazendo e o que esperava que acontecesse.",
    "Copie a mensagem de erro exatamente como aparece.",
    "Conte o que já tentou (reiniciar, trocar de cabo, outro navegador…).",
    "Informe onde está: sala, andar ou nome do equipamento.",
];

// ---------- Referências ----------
const layout = $("#novo");
const form = $("#form-chamado");
const campoTitulo = $("#titulo");
const campoDescricao = $("#descricao");
const contador = $("#titulo-contador");
const gruposCategoria = $("#categorias");
const gruposPrioridade = $("#prioridades");
const dicaPrioridade = $("#prioridade-dica");
const resumoErros = $("#resumo-erros");
const statusRascunho = $("#rascunho-status");
const btnEnviar = $("#btn-enviar");
const previa = $("#previa");

let perfil = null;
let enviando = false;
let timerRascunho = null;
let rascunhoFalhou = false;

// ---------- Montagem dos controles (dependem só de constants.js) ----------
render(
    gruposCategoria,
    CATEGORIAS.map((c) =>
        h(
            "label",
            { class: "chip" },
            h("input", { type: "radio", name: "categoria", value: c.valor }),
            icon(c.icon),
            c.valor
        )
    )
);

render(
    gruposPrioridade,
    PRIORIDADES.map((p) =>
        h(
            "label",
            { class: "segmented__option", dataset: { tone: p.tone } },
            h("input", { type: "radio", name: "prioridade", value: p.valor, checked: p.valor === PRIORIDADE_PADRAO }),
            p.valor
        )
    )
);

for (const lista of $$("[data-dicas]")) {
    render(lista, DICAS.map((d) => h("li", {}, icon(Lightbulb), h("span", {}, d))));
}

// Atalho: ⌘ no Mac, Ctrl nos demais
const ehMac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
const tecla = $("[data-mod]");
if (ehMac && tecla) tecla.textContent = "⌘";
btnEnviar.setAttribute("aria-keyshortcuts", ehMac ? "Meta+Enter" : "Control+Enter");

// ---------- Leitura do formulário ----------
function valores() {
    return {
        titulo: campoTitulo.value.trim(),
        descricao: campoDescricao.value.trim(),
        categoria: form.elements.categoria.value || "",
        prioridade: form.elements.prioridade.value || PRIORIDADE_PADRAO,
    };
}

function temConteudo(v = valores()) {
    return Boolean(v.titulo || v.descricao || v.categoria);
}

// ---------- Contador, dica de prioridade, textarea ----------
function atualizarContador() {
    const n = campoTitulo.value.length;
    contador.textContent = `${n}/${MAX_TITULO}`;
    contador.classList.toggle("is-near", n >= MAX_TITULO - 10);
}

function atualizarDicaPrioridade({ animar = true } = {}) {
    const info = prioridadeInfo(form.elements.prioridade.value || PRIORIDADE_PADRAO);
    dicaPrioridade.dataset.tone = info.tone;
    render(dicaPrioridade, h("strong", {}, `${info.valor}: `), info.dica);
    if (animar) tocar(dicaPrioridade, "is-entering");
}

// Fallback para navegadores sem field-sizing: content
const semFieldSizing = !CSS.supports?.("field-sizing", "content");
function ajustarAltura() {
    if (!semFieldSizing) return;
    campoDescricao.style.height = "auto";
    campoDescricao.style.height = `${campoDescricao.scrollHeight + 2}px`;
}

// ---------- Prévia ao vivo ----------
const previaTitulo = h("p", { class: "previa__titulo" });
const previaDescricao = h("p", { class: "previa__descricao" });
const previaBadges = h("div", { class: "previa__badges" });
const previaAutor = h("div", { class: "previa__autor" });

render(
    previa,
    h(
        "div",
        { class: "card previa" },
        h(
            "div",
            { class: "previa__topo" },
            h("span", { class: "previa__numero mono" }, "#novo"),
            badgeStatus("aberto")
        ),
        previaTitulo,
        previaDescricao,
        previaBadges,
        previaAutor
    )
);

function atualizarPrevia() {
    const v = valores();
    previaTitulo.textContent = v.titulo || "Título do chamado";
    previaTitulo.classList.toggle("is-vazio", !v.titulo);
    previaDescricao.textContent = v.descricao || "A descrição aparece aqui enquanto você digita.";
    previaDescricao.classList.toggle("is-vazio", !v.descricao);
    render(
        previaBadges,
        v.categoria
            ? badgeCategoria(v.categoria)
            : h("span", { class: "badge badge--outline", dataset: { tone: "neutral" } }, "Sem categoria"),
        badgePrioridade(v.prioridade)
    );
}

function desenharAutor() {
    const nome = perfil?.nome || "Você";
    render(previaAutor, avatar(nome, { tamanho: "sm" }), h("span", { class: "truncate" }, nome), h("span", { class: "muted" }, "· agora"));
}

// ---------- Validação ----------
const CAMPOS = {
    titulo: {
        field: () => campoTitulo.closest(".field"),
        controles: () => [campoTitulo],
        base: "titulo-dica titulo-contador",
        rotulo: "Título",
        validar: (v) => (v.titulo ? "" : "Dê um título ao chamado."),
    },
    descricao: {
        field: () => campoDescricao.closest(".field"),
        controles: () => [campoDescricao],
        base: "descricao-dica",
        rotulo: "Descrição",
        validar: (v) => {
            if (!v.descricao) return "Descreva o que aconteceu.";
            const faltam = MIN_DESCRICAO - v.descricao.length;
            if (faltam > 0) return `Escreva pelo menos ${MIN_DESCRICAO} caracteres (faltam ${faltam}).`;
            return "";
        },
    },
    categoria: {
        field: () => gruposCategoria.closest(".field"),
        controles: () => $$("input", gruposCategoria),
        base: "",
        rotulo: "Categoria",
        validar: (v) => (v.categoria ? "" : "Escolha uma categoria."),
    },
};

function aplicarErro(nome, mensagem) {
    const cfg = CAMPOS[nome];
    const field = cfg.field();
    const erro = $(`#${nome}-erro`);
    const invalido = Boolean(mensagem);

    field.classList.toggle("is-invalid", invalido);
    render(erro, invalido && icon(CircleAlert, { size: 14 }), invalido && h("span", {}, mensagem));

    for (const el of cfg.controles()) {
        const descritores = [invalido && erro.id, cfg.base].filter(Boolean).join(" ");
        if (invalido) el.setAttribute("aria-invalid", "true");
        else el.removeAttribute("aria-invalid");
        if (descritores) el.setAttribute("aria-describedby", descritores);
        else el.removeAttribute("aria-describedby");
    }
    return invalido;
}

/** Valida um campo; devolve a mensagem de erro (ou ""). */
function validarCampo(nome) {
    const mensagem = CAMPOS[nome].validar(valores());
    aplicarErro(nome, mensagem);
    return mensagem;
}

function validarTudo() {
    const erros = Object.keys(CAMPOS)
        .map((nome) => ({ nome, mensagem: validarCampo(nome) }))
        .filter((e) => e.mensagem);

    if (!erros.length) {
        resumoErros.textContent = "";
        return true;
    }

    const qtd = erros.length === 1 ? "1 campo precisa" : `${erros.length} campos precisam`;
    resumoErros.textContent = `${qtd} de atenção: ${erros.map((e) => `${CAMPOS[e.nome].rotulo} — ${e.mensagem}`).join(" ")}`;

    const primeiro = erros[0].nome;
    const controles = CAMPOS[primeiro].controles();
    const alvo = controles.find((c) => c.checked) || controles[0];
    alvo.focus();
    tremer(primeiro === "categoria" ? gruposCategoria : alvo);
    return false;
}

// Erro aparece no blur; depois que apareceu, some assim que o campo fica válido
campoTitulo.addEventListener("blur", () => validarCampo("titulo"));
campoDescricao.addEventListener("blur", () => validarCampo("descricao"));
gruposCategoria.closest("fieldset").addEventListener("focusout", (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) validarCampo("categoria");
});

form.addEventListener("input", (e) => {
    const nome = e.target.name;
    if (CAMPOS[nome] && CAMPOS[nome].field().classList.contains("is-invalid")) validarCampo(nome);
    if (nome === "titulo") atualizarContador();
    if (nome === "descricao") ajustarAltura();
    atualizarPrevia();
    agendarRascunho();
});

form.addEventListener("change", (e) => {
    if (e.target.name === "prioridade") atualizarDicaPrioridade();
    if (e.target.name === "categoria") validarCampo("categoria");
    atualizarPrevia();
    agendarRascunho();
});

// ---------- Rascunho ----------
function lerRascunho() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || "null");
    } catch {
        return null;
    }
}

function salvarRascunho() {
    clearTimeout(timerRascunho);
    timerRascunho = null;
    const v = valores();
    try {
        if (temConteudo(v)) {
            localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ ...v, uid: perfil?.uid || null, salvoEm: Date.now() }));
            mostrarStatusRascunho(new Date());
        } else {
            localStorage.removeItem(CHAVE_RASCUNHO);
            statusRascunho.hidden = true;
        }
        rascunhoFalhou = false;
    } catch {
        // Armazenamento cheio ou bloqueado: o aviso de saída passa a valer
        rascunhoFalhou = true;
    }
}

function agendarRascunho() {
    if (enviando) return;
    clearTimeout(timerRascunho);
    timerRascunho = setTimeout(salvarRascunho, 400);
}

function limparRascunho() {
    clearTimeout(timerRascunho);
    timerRascunho = null;
    try {
        localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {
        // nada a limpar
    }
    statusRascunho.hidden = true;
}

function mostrarStatusRascunho(quando) {
    render(statusRascunho, icon(CloudCheck, { size: 16 }), `Rascunho salvo às ${formatarHora(quando)}`);
    const estavaOculto = statusRascunho.hidden;
    statusRascunho.hidden = false;
    if (estavaOculto) tocar(statusRascunho, "is-entering");
}

function preencher({ titulo = "", descricao = "", categoria = "", prioridade = PRIORIDADE_PADRAO } = {}) {
    campoTitulo.value = titulo;
    campoDescricao.value = descricao;
    for (const r of $$("input[name=categoria]", form)) r.checked = r.value === categoria;
    const prioridadeValida = PRIORIDADES.some((p) => p.valor === prioridade) ? prioridade : PRIORIDADE_PADRAO;
    for (const r of $$("input[name=prioridade]", form)) r.checked = r.value === prioridadeValida;
    for (const nome of Object.keys(CAMPOS)) aplicarErro(nome, "");
    resumoErros.textContent = "";
    atualizarContador();
    atualizarDicaPrioridade({ animar: false });
    ajustarAltura();
    atualizarPrevia();
}

function restaurarRascunho() {
    const r = lerRascunho();
    if (!r || !temConteudo(r)) return;
    if (r.uid && perfil?.uid && r.uid !== perfil.uid) return; // rascunho de outra conta neste navegador

    preencher(r);
    if (r.salvoEm) mostrarStatusRascunho(new Date(r.salvoEm));
    toast.info("Rascunho restaurado", {
        message: "Continuamos de onde você parou.",
        duration: 8000,
        action: {
            label: "Descartar",
            onClick: () => {
                limparRascunho();
                preencher();
                campoTitulo.focus();
            },
        },
    });
}

// Aviso de saída: só enquanto envia ou se o rascunho não pôde ser salvo
window.addEventListener("beforeunload", (e) => {
    if (timerRascunho) salvarRascunho();
    if (enviando || (rascunhoFalhou && temConteudo())) {
        e.preventDefault();
        e.returnValue = "";
    }
});

// ---------- Envio ----------
form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        form.requestSubmit(btnEnviar);
    }
});

function bloquear(ocupado) {
    enviando = ocupado;
    btnEnviar.setAttribute("aria-busy", String(ocupado));
    btnEnviar.setAttribute("aria-disabled", String(ocupado));
    for (const el of $$("input, textarea", form)) el.disabled = ocupado;
    form.classList.toggle("is-sending", ocupado);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!perfil) {
        toast.error("Sessão inválida", {
            message: "Seu perfil não foi encontrado. Saia e entre de novo.",
        });
        return;
    }
    if (!validarTudo()) return;

    const dados = valores();
    // Foco vai para o botão antes de desabilitar os campos (senão se perde no <body>)
    btnEnviar.focus();
    bloquear(true);

    try {
        const { id, numero } = await criarChamado(dados, perfil);
        limparRascunho();
        bloquear(false);
        await mostrarSucesso({ id, numero, ...dados });
    } catch (erro) {
        logError(erro, "abrir-chamado:criar");
        bloquear(false);
        salvarRascunho();
        const codigo = erro?.code ? ` (${erro.code})` : "";
        toast.error("Não foi possível abrir o chamado", {
            message: `Verifique sua conexão e tente de novo${codigo}. Seus dados foram mantidos.`,
        });
    }
});

// ---------- Tela de sucesso ----------
const SVG_NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, ...filhos) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    el.append(...filhos);
    return el;
}

function checkDesenhado() {
    return svg(
        "svg",
        { class: "sucesso__check", viewBox: "0 0 64 64", width: 72, height: 72, "aria-hidden": "true", focusable: "false" },
        svg("circle", { class: "sucesso__circulo", cx: 32, cy: 32, r: 29, pathLength: 1 }),
        svg("path", { class: "sucesso__traco", d: "M20 33.5 28.5 42 45 24", pathLength: 1 })
    );
}

const CORES_CONFETE = ["brand", "info", "success", "warning", "orange", "danger"];
function confete() {
    return h(
        "div",
        { class: "sucesso__confete", "aria-hidden": "true" },
        Array.from({ length: 14 }, (_, i) => {
            const angulo = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
            const distancia = 70 + (i % 3) * 22;
            return h("span", {
                style: {
                    "--x": `${Math.round(Math.cos(angulo) * distancia)}px`,
                    "--y": `${Math.round(Math.sin(angulo) * distancia - 20)}px`,
                    "--r": `${(i * 57) % 360}deg`,
                    "--cor": `var(--${CORES_CONFETE[i % CORES_CONFETE.length]})`,
                    "--atraso": `${(i % 4) * 30}ms`,
                },
            });
        })
    );
}

let telaSucesso = null;

function mostrarSucesso(chamado) {
    const numero = formatarNumeroChamado(chamado.numero);
    const tituloSucesso = h(
        "h2",
        { class: "sucesso__titulo", id: "sucesso-titulo", tabindex: "-1" },
        "Chamado ",
        h("span", { class: "sucesso__numero num", style: { viewTransitionName: `chamado-${chamado.id}` } }, numero),
        " criado"
    );

    telaSucesso = h(
        "section",
        { class: "card sucesso", "aria-labelledby": "sucesso-titulo" },
        h("div", { class: "sucesso__icone" }, confete(), checkDesenhado()),
        tituloSucesso,
        h("p", { class: "sucesso__texto muted" }, "A equipe técnica já foi avisada. Você acompanha as respostas pela página do chamado."),
        h(
            "dl",
            { class: "sucesso__resumo" },
            h("div", {}, h("dt", {}, "Título"), h("dd", {}, chamado.titulo)),
            h("div", {}, h("dt", {}, "Categoria"), h("dd", {}, badgeCategoria(chamado.categoria))),
            h("div", {}, h("dt", {}, "Prioridade"), h("dd", {}, badgePrioridade(chamado.prioridade))),
            h("div", {}, h("dt", {}, "Status"), h("dd", {}, badgeStatus("aberto")))
        ),
        h(
            "div",
            { class: "sucesso__acoes" },
            h(
                "a",
                { class: "btn btn--primary btn--lg", href: `chamado.html?id=${encodeURIComponent(chamado.id)}&n=${chamado.numero}` },
                "Ver chamado",
                icon(ArrowRight)
            ),
            h("button", { class: "btn btn--secondary btn--lg", type: "button", onClick: abrirOutro }, icon(Plus), "Abrir outro chamado")
        )
    );

    return comTransicao(() => {
        layout.hidden = true;
        layout.after(telaSucesso);
        document.title = `Chamado ${numero} criado · HelpDesk`;
    }).then(() => tituloSucesso.focus());
}

function abrirOutro() {
    comTransicao(() => {
        telaSucesso?.remove();
        telaSucesso = null;
        preencher();
        layout.hidden = false;
        document.title = "Abrir chamado · HelpDesk";
    }).then(() => campoTitulo.focus());
}

// ---------- Início ----------
atualizarContador();
atualizarDicaPrioridade({ animar: false });
atualizarPrevia();
desenharAutor();

perfil = await iniciarPagina({ pagina: "abrir-chamado" });
desenharAutor();
restaurarRascunho();
