import { Trash2 } from "lucide";
import { version as versaoApp } from "../../../package.json";
import { iniciarPagina } from "../components/app-shell.js";
import { avatar } from "../components/avatar.js";
import { confirmar } from "../components/confirm.js";
import { skeleton } from "../components/skeleton.js";
import { toast } from "../components/toast.js";
import { aplicarPrefs, getPrefs, movimentoReduzido, setPref } from "../core/theme.js";
import { PAPEIS } from "../utils/constants.js";
import { $, $$, h, render } from "../utils/dom.js";
import { plural } from "../utils/format.js";
import { icon } from "../utils/icons.js";

const PREFIXO = "hd:";
const ehMac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
const TECLA_CTRL = ehMac ? "⌘" : "Ctrl";

const midiaTema = window.matchMedia("(prefers-color-scheme: light)");
const midiaMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

const el = {
    perfil: $("#cfg-perfil"),
    sidebar: $("#cfg-sidebar"),
    temaDica: $("#cfg-tema-sistema-dica"),
    demo: $("#cfg-demo"),
    demoTexto: $("#cfg-demo-texto"),
    atalhos: $("#cfg-atalhos"),
    dadosResumo: $("#cfg-dados-resumo"),
    limpar: $("#cfg-limpar"),
    sobre: $("#cfg-sobre"),
};

/* ---------- Perfil ---------- */

function perfilSkeleton() {
    render(
        el.perfil,
        skeleton({ w: "72px", h: "72px", circle: true }),
        h("div", { class: "stack", style: { "--stack-gap": "var(--space-2)", flex: "1" } }, skeleton({ w: "40%", h: "18px" }), skeleton({ w: "55%" }), skeleton({ w: "90px", h: "22px", r: "999px" }))
    );
}

function desenharPerfil(perfil) {
    el.perfil.removeAttribute("aria-busy");
    render(
        el.perfil,
        avatar(perfil.nome, { tamanho: "xl" }),
        h(
            "dl",
            { class: "cfg-perfil__dados" },
            h("div", {}, h("dt", {}, "Nome"), h("dd", { class: "cfg-perfil__nome" }, perfil.nome || "—")),
            h("div", {}, h("dt", {}, "E-mail"), h("dd", { class: "truncate" }, perfil.email || "—")),
            h(
                "div",
                {},
                h("dt", {}, "Papel"),
                h("dd", {}, h("span", { class: "badge", dataset: { tone: perfil.role === "admin" ? "brand" : perfil.role === "tecnico" ? "info" : "neutral" } }, PAPEIS[perfil.role]?.label || perfil.role))
            )
        )
    );
}

/* ---------- Preferências ---------- */

let toastAtual = null;

function salvar(chave, valor) {
    if (getPrefs()[chave] === valor) return;
    setPref(chave, valor);
    toastAtual?.fechar();
    toastAtual = toast.success("Preferência salva", { duration: 2000 });
}

/** Reflete as preferências atuais nos controles (também quando mudam por fora, ex.: botão da topbar). */
function sincronizar() {
    const prefs = getPrefs();
    for (const nome of ["theme", "density", "motion"]) {
        const radio = document.querySelector(`input[name="${nome}"][value="${prefs[nome]}"]`);
        if (radio) radio.checked = true;
    }
    el.sidebar.checked = prefs.sidebar === "collapsed";
    el.temaDica.textContent = `Agora: ${midiaTema.matches ? "claro" : "escuro"}`;
    atualizarDemo();
    atualizarResumoDados();
}

function atualizarDemo() {
    const { motion } = getPrefs();
    const reduzido = movimentoReduzido();
    el.demo.dataset.ativo = String(!reduzido);
    let texto;
    if (motion === "system") {
        texto = midiaMovimento.matches
            ? "Seu sistema pede menos movimento: as animações estão desligadas."
            : "Seu sistema não pede redução: as animações estão ligadas.";
    } else if (motion === "reduce") {
        texto = "Animações desligadas: as mudanças acontecem na hora, sem transições.";
    } else {
        texto = "Animações completas, mesmo que o sistema peça menos movimento.";
    }
    el.demoTexto.textContent = texto;
}

function ligarControles() {
    for (const nome of ["theme", "density", "motion"]) {
        $$(`input[name="${nome}"]`).forEach((radio) =>
            radio.addEventListener("change", () => {
                if (radio.checked) salvar(nome, radio.value);
            })
        );
    }
    el.sidebar.addEventListener("change", () => salvar("sidebar", el.sidebar.checked ? "collapsed" : "expanded"));

    window.addEventListener("hd:prefs", sincronizar);
    midiaTema.addEventListener("change", sincronizar);
    midiaMovimento.addEventListener("change", atualizarDemo);

    // Outra aba mudou as preferências
    window.addEventListener("storage", (e) => {
        if (e.key === `${PREFIXO}prefs` || e.key === null) {
            aplicarPrefs();
            sincronizar();
        }
    });
}

/* ---------- Atalhos ---------- */

const ATALHOS = [
    { acao: "Abrir a busca", teclas: [[TECLA_CTRL, "K"], ["/"]] },
    { acao: "Enviar o chamado (no formulário)", teclas: [[TECLA_CTRL, "Enter"]] },
    { acao: "Enviar mensagem no chat", teclas: [["Enter"]] },
    { acao: "Quebrar linha no chat", teclas: [["Shift", "Enter"]] },
    { acao: "Fechar diálogos e menus", teclas: [["Esc"]] },
];

function desenharAtalhos() {
    render(
        el.atalhos,
        ATALHOS.map(({ acao, teclas }) =>
            h(
                "tr",
                {},
                h("td", {}, acao),
                h(
                    "td",
                    { class: "cfg-atalhos__teclas" },
                    teclas.map((combo, i) => [
                        i > 0 && h("span", { class: "cfg-atalhos__ou" }, "ou"),
                        h(
                            "span",
                            { class: "cfg-atalhos__combo" },
                            combo.map((tecla, j) => [j > 0 && h("span", { "aria-hidden": "true" }, "+"), h("kbd", {}, tecla)])
                        ),
                    ])
                )
            )
        )
    );
}

/* ---------- Dados locais ---------- */

function chavesLocais() {
    try {
        return Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO));
    } catch {
        return [];
    }
}

function atualizarResumoDados() {
    const chaves = chavesLocais();
    const rascunhos = chaves.filter((k) => k.includes("rascunho")).length;
    const temPrefs = chaves.includes(`${PREFIXO}prefs`);
    if (!chaves.length) {
        el.dadosResumo.textContent = "Nada salvo neste navegador.";
    } else {
        const partes = [];
        if (temPrefs) partes.push("preferências de aparência");
        if (rascunhos) partes.push(plural(rascunhos, "rascunho"));
        const outros = chaves.length - rascunhos - (temPrefs ? 1 : 0);
        if (outros > 0) partes.push(plural(outros, "outro item", "outros itens"));
        el.dadosResumo.textContent = partes.join(" · ");
    }
    el.limpar.disabled = !chaves.length;
}

async function limparDados() {
    const chaves = chavesLocais();
    if (!chaves.length) return;
    const ok = await confirmar({
        titulo: "Limpar dados locais?",
        mensagem: "Rascunhos de chamados não enviados e suas preferências de aparência serão apagados deste navegador. Essa ação não pode ser desfeita.",
        confirmar: "Limpar",
        tom: "danger",
    });
    if (!ok) return;

    for (const chave of chaves) {
        try {
            localStorage.removeItem(chave);
        } catch {
            // ignora chaves que não puderam ser removidas
        }
    }
    aplicarPrefs();
    window.dispatchEvent(new CustomEvent("hd:prefs", { detail: getPrefs() }));
    toast.success("Dados locais apagados", { message: `${plural(chaves.length, "item removido", "itens removidos")}.` });
}

/* ---------- Sobre ---------- */

function desenharSobre() {
    const itens = [
        ["Versão", h("span", { class: "num" }, versaoApp)],
        ["Interface", "JavaScript puro (ES modules), HTML e CSS com camadas"],
        ["Build", "Vite"],
        ["Backend", "Firebase — Authentication e Cloud Firestore"],
        ["Bibliotecas", "Chart.js (relatórios) e Lucide (ícones)"],
    ];
    render(
        el.sobre,
        itens.map(([rotulo, valor]) => h("div", { class: "cfg-sobre__item" }, h("dt", {}, rotulo), h("dd", {}, valor)))
    );
}

/* ---------- Navegação lateral (seção ativa) ---------- */

function observarSecoes() {
    const links = new Map($$(".cfg-nav__item").map((a) => [a.dataset.secao, a]));
    const visiveis = new Set();
    const marcar = (id) => {
        for (const [secao, link] of links) {
            if (secao === id) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
        }
    };
    const obs = new IntersectionObserver(
        (entradas) => {
            for (const e of entradas) {
                if (e.isIntersecting) visiveis.add(e.target.id);
                else visiveis.delete(e.target.id);
            }
            const primeira = [...links.keys()].find((id) => visiveis.has(id));
            if (primeira) marcar(primeira);
        },
        { rootMargin: "-80px 0px -55% 0px" }
    );
    $$(".cfg-secao").forEach((s) => obs.observe(s));

    for (const [id, link] of links) {
        link.addEventListener("click", () => {
            marcar(id);
            // Move o foco para a seção, para leitores de tela e teclado
            const alvo = document.getElementById(id);
            alvo.setAttribute("tabindex", "-1");
            requestAnimationFrame(() => alvo.focus({ preventScroll: true }));
        });
    }
    marcar(location.hash.slice(1) || "perfil");
}

/* ---------- Início ---------- */

el.limpar.prepend(icon(Trash2));
perfilSkeleton();
desenharAtalhos();
desenharSobre();
ligarControles();
sincronizar();
observarSecoes();
el.limpar.addEventListener("click", limparDados);

const perfil = await iniciarPagina({ pagina: "configuracoes" });
desenharPerfil(perfil);
