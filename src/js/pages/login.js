import { ArrowRight, CircleAlert, Eye, EyeOff, KanbanSquare, LifeBuoy, Lock, Mail, MessagesSquare, Moon, Sun, Zap } from "lucide";
import { toast } from "../components/toast.js";
import { entrar, redirecionarSeLogado } from "../core/session.js";
import { alternarTema, temaAtual } from "../core/theme.js";
import { $, $$, h, render } from "../utils/dom.js";
import { icon } from "../utils/icons.js";
import { tremer } from "../utils/motion.js";

redirecionarSeLogado();

// ---------- Ícones estáticos ----------
const ICONES = { marca: LifeBuoy, rapido: Zap, conversa: MessagesSquare, fila: KanbanSquare, seta: ArrowRight };

for (const el of $$("[data-icone]")) {
    const chave = el.dataset.icone;
    if (chave === "email") el.prepend(icon(Mail));
    else if (chave === "senha") el.prepend(icon(Lock));
    else if (ICONES[chave]) el.append(icon(ICONES[chave]));
}

// ---------- Tema ----------
const botaoTema = $("#alternar-tema");
const metaCor = $('meta[name="theme-color"]');

function atualizarBotaoTema() {
    const escuro = temaAtual() === "dark";
    render(botaoTema, icon(escuro ? Sun : Moon));
    botaoTema.setAttribute("aria-label", escuro ? "Ativar tema claro" : "Ativar tema escuro");
    botaoTema.title = botaoTema.getAttribute("aria-label");
    metaCor?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
}

botaoTema.addEventListener("click", alternarTema);
window.addEventListener("hd:prefs", atualizarBotaoTema);
matchMedia("(prefers-color-scheme: light)").addEventListener("change", atualizarBotaoTema);
atualizarBotaoTema();

// ---------- Mostrar / ocultar senha ----------
const campoSenha = $("#senha");
const botaoOlho = $("#mostrar-senha");

function atualizarOlho() {
    const visivel = campoSenha.type === "text";
    botaoOlho.setAttribute("aria-pressed", String(visivel));
    render(botaoOlho, icon(visivel ? EyeOff : Eye));
}

botaoOlho.addEventListener("click", () => {
    campoSenha.type = campoSenha.type === "password" ? "text" : "password";
    atualizarOlho();
    // Mantém o cursor no fim do texto ao voltar para o campo
    campoSenha.focus();
    const fim = campoSenha.value.length;
    campoSenha.setSelectionRange(fim, fim);
});
atualizarOlho();

// ---------- Validação inline ----------
const form = $("#form-login");
const campoEmail = $("#email");
const botaoEntrar = $("#botao-entrar");
const alerta = $("#login-alerta");
const card = $("#login-card");

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const REGRAS = [
    {
        input: campoEmail,
        validar: (valor) => {
            if (!valor) return "Informe seu e-mail.";
            if (!REGEX_EMAIL.test(valor)) return "Digite um e-mail válido, como nome@empresa.com.";
            return "";
        },
    },
    {
        input: campoSenha,
        validar: (valor) => (valor ? "" : "Informe sua senha."),
    },
];

function marcarErro(input, mensagem) {
    const field = input.closest(".field");
    const erro = $(".field__error", field);
    field.classList.toggle("is-invalid", Boolean(mensagem));
    if (mensagem) {
        input.setAttribute("aria-invalid", "true");
        render(erro, icon(CircleAlert, { size: 14 }), mensagem);
    } else {
        input.removeAttribute("aria-invalid");
        render(erro);
    }
}

function valorDe(input) {
    return input === campoSenha ? input.value : input.value.trim();
}

/** Valida tudo, mostra os erros e devolve o primeiro campo inválido (ou null). */
function validarFormulario() {
    let primeiroInvalido = null;
    for (const { input, validar } of REGRAS) {
        const mensagem = validar(valorDe(input));
        marcarErro(input, mensagem);
        if (mensagem && !primeiroInvalido) primeiroInvalido = input;
    }
    return primeiroInvalido;
}

// Depois do primeiro erro, o campo se revalida enquanto a pessoa digita (só para limpar o erro)
for (const { input, validar } of REGRAS) {
    input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") === "true" && !validar(valorDe(input))) marcarErro(input, "");
        limparAlerta();
    });
    input.addEventListener("blur", () => {
        if (input.getAttribute("aria-invalid") === "true") marcarErro(input, validar(valorDe(input)));
    });
}

// ---------- Erros do Firebase ----------
const MENSAGENS_ERRO = {
    "auth/invalid-credential": { titulo: "E-mail ou senha incorretos.", texto: "Confira os dados e tente novamente.", campo: "senha" },
    "auth/wrong-password": { titulo: "E-mail ou senha incorretos.", texto: "Confira os dados e tente novamente.", campo: "senha" },
    "auth/user-not-found": { titulo: "E-mail ou senha incorretos.", texto: "Confira os dados e tente novamente.", campo: "senha" },
    "auth/invalid-email": { titulo: "Esse e-mail não parece válido.", texto: "Verifique se foi digitado corretamente.", campo: "email" },
    "auth/too-many-requests": {
        titulo: "Muitas tentativas seguidas.",
        texto: "Por segurança, o acesso foi pausado. Aguarde alguns minutos e tente de novo.",
    },
    "auth/network-request-failed": {
        titulo: "Sem conexão com o servidor.",
        texto: "Verifique sua internet e tente novamente.",
    },
    "app/perfil-nao-encontrado": {
        titulo: "Sua conta não tem um perfil no HelpDesk.",
        texto: "O login funcionou, mas não encontramos seu cadastro. Procure o administrador do sistema.",
    },
};

const ERRO_GENERICO = { titulo: "Não foi possível entrar agora.", texto: "Tente novamente em instantes." };

function mostrarAlerta({ titulo, texto }) {
    render(
        alerta,
        h(
            "div",
            { class: "login-alert" },
            icon(CircleAlert, { size: 18 }),
            h("div", {}, h("strong", {}, titulo), texto && h("span", {}, texto))
        )
    );
}

function limparAlerta() {
    if (alerta.firstChild) render(alerta);
}

// ---------- Envio ----------
let enviando = false;

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    limparAlerta();
    const invalido = validarFormulario();
    if (invalido) {
        invalido.focus();
        tremer(card);
        return;
    }

    enviando = true;
    botaoEntrar.setAttribute("aria-busy", "true");

    try {
        await entrar(campoEmail.value.trim(), campoSenha.value);
        toast.flash("success", "Bem-vindo(a) de volta!");
        window.location.href = "dashboard.html";
    } catch (erro) {
        console.error(erro);
        const info = MENSAGENS_ERRO[erro?.code] || ERRO_GENERICO;
        mostrarAlerta(info);
        tremer(card);
        if (info.campo === "email") {
            campoEmail.focus();
        } else if (info.campo === "senha") {
            campoSenha.focus();
            campoSenha.select();
        }
        botaoEntrar.removeAttribute("aria-busy");
        enviando = false;
    }
});
