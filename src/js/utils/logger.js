// Logger centralizado: evita vazar IDs/dados sensíveis no console em produção.
// Em DEV loga só `erro?.code` + contexto. Em produção fica silencioso
// (ou delega a `reportError`, se existir). Nunca logar o objeto completo.

export function logError(erro, contexto = "app") {
    try {
        if (import.meta.env?.DEV) {
            console.error(`[${contexto}]`, erro?.code ?? "unknown-error");
        } else if (typeof reportError === "function") {
            reportError(erro);
        }
    } catch {
        // logger nunca deve quebrar a página
    }
}

export function logWarn(mensagem, contexto = "app") {
    try {
        if (import.meta.env?.DEV) {
            console.warn(`[${contexto}]`, mensagem);
        }
    } catch {
        // silencioso
    }
}

export const silentError = () => {};
