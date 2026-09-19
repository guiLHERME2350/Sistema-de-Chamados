// Preferências visuais do usuário, aplicadas como data-* no <html>.
// O script inline no <head> de cada página aplica as mesmas chaves antes do
// primeiro paint (evita "piscar" o tema errado) — mantenha os dois em sincronia.

const CHAVE = "hd:prefs";

const PADRAO = {
    theme: "system", // "system" | "light" | "dark"
    motion: "system", // "system" | "reduce" | "full"
    density: "comfortable", // "comfortable" | "compact"
    sidebar: "expanded", // "expanded" | "collapsed"
};

const midiaTema = window.matchMedia("(prefers-color-scheme: light)");

export function getPrefs() {
    try {
        return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || "{}") };
    } catch {
        return { ...PADRAO };
    }
}

export function setPref(chave, valor) {
    const prefs = { ...getPrefs(), [chave]: valor };
    try {
        localStorage.setItem(CHAVE, JSON.stringify(prefs));
    } catch {
        // armazenamento indisponível: a preferência vale só para esta página
    }
    aplicarPrefs(prefs);
    window.dispatchEvent(new CustomEvent("hd:prefs", { detail: prefs }));
    return prefs;
}

export function aplicarPrefs(prefs = getPrefs()) {
    const raiz = document.documentElement;
    raiz.dataset.theme = prefs.theme;
    raiz.dataset.systemTheme = midiaTema.matches ? "light" : "dark";
    raiz.dataset.motion = prefs.motion;
    raiz.dataset.density = prefs.density;
    raiz.dataset.sidebar = prefs.sidebar;
}

/** Tema efetivamente em uso ("light" | "dark"), resolvendo "system". */
export function temaAtual() {
    const { theme } = getPrefs();
    if (theme !== "system") return theme;
    return midiaTema.matches ? "light" : "dark";
}

/** Alterna entre claro e escuro (sai do modo "system"). */
export function alternarTema() {
    return setPref("theme", temaAtual() === "dark" ? "light" : "dark");
}

/** true quando o usuário pediu menos movimento (sistema ou preferência do app). */
export function movimentoReduzido() {
    const { motion } = getPrefs();
    if (motion === "reduce") return true;
    if (motion === "full") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Tema do sistema mudou: quem depende de temaAtual() (ícone da topbar, gráficos) precisa saber
midiaTema.addEventListener("change", () => {
    aplicarPrefs();
    window.dispatchEvent(new CustomEvent("hd:prefs", { detail: getPrefs() }));
});
aplicarPrefs();
