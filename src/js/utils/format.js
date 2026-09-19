const dataHora = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const soData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const soHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const relativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const numero = new Intl.NumberFormat("pt-BR");

/** Aceita Date, Timestamp do Firestore, número ou null. */
export function paraData(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    if (typeof valor.toDate === "function") return valor.toDate();
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** 12/09/2026 14:03 */
export function formatarDataHora(valor, vazio = "—") {
    const d = paraData(valor);
    return d ? dataHora.format(d) : vazio;
}

/** 12/09/2026 */
export function formatarData(valor, vazio = "—") {
    const d = paraData(valor);
    return d ? soData.format(d) : vazio;
}

/** 14:03 */
export function formatarHora(valor, vazio = "") {
    const d = paraData(valor);
    return d ? soHora.format(d) : vazio;
}

/** 12 de set. */
export function formatarDataCurta(valor, vazio = "—") {
    const d = paraData(valor);
    return d ? dataCurta.format(d) : vazio;
}

const UNIDADES = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
];

/** "há 5 minutos", "ontem", "agora" */
export function tempoRelativo(valor, agora = new Date()) {
    const d = paraData(valor);
    if (!d) return "—";
    const segundos = Math.round((d.getTime() - agora.getTime()) / 1000);
    if (Math.abs(segundos) < 45) return "agora";
    for (const [unidade, s] of UNIDADES) {
        if (Math.abs(segundos) >= s) return relativo.format(Math.round(segundos / s), unidade);
    }
    return relativo.format(Math.round(segundos / 60), "minute");
}

/** Duração legível: 3h 20min, 2d 4h, 45min */
export function formatarDuracao(ms) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
    const min = Math.round(ms / 60000);
    if (min < 1) return "< 1min";
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const restoMin = min % 60;
    if (h < 24) return restoMin ? `${h}h ${restoMin}min` : `${h}h`;
    const d = Math.floor(h / 24);
    const restoH = h % 24;
    return restoH ? `${d}d ${restoH}h` : `${d}d`;
}

export function formatarNumero(n) {
    return numero.format(n ?? 0);
}

/** "Bom dia" / "Boa tarde" / "Boa noite" */
export function saudacao(agora = new Date()) {
    const h = agora.getHours();
    if (h < 5) return "Boa noite";
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
}

export function primeiroNome(nome = "") {
    return String(nome).trim().split(/\s+/)[0] || "";
}

/** "Ana Souza" → "AS" */
export function iniciais(nome = "") {
    const partes = String(nome).trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    const primeira = partes[0][0];
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
    return (primeira + ultima).toUpperCase();
}

/** "#0042" — número do chamado com zeros à esquerda */
export function formatarNumeroChamado(n) {
    if (n === null || n === undefined || n === "") return "#—";
    return `#${String(n).padStart(4, "0")}`;
}

/** Plural simples: plural(3, "chamado") → "3 chamados" */
export function plural(n, singular, pluralForma = `${singular}s`) {
    return `${formatarNumero(n)} ${n === 1 ? singular : pluralForma}`;
}

/** Texto para comparação em buscas: minúsculas e sem acentos ("Impressão" → "impressao"). */
export function normalizarBusca(texto) {
    return String(texto ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
