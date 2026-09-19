// Mapas de domínio: rótulos, cores (tone) e ícones ficam aqui, nunca espalhados pelas páginas.
// Os valores gravados no Firestore são as chaves / "valor" abaixo (compatíveis com os dados existentes).

import {
    ChartColumn,
    CircleCheck,
    CircleDot,
    Cpu,
    House,
    KanbanSquare,
    KeyRound,
    LayoutList,
    Loader,
    Mail,
    Network,
    Package,
    Plus,
    Printer,
    Settings,
    AppWindow,
} from "lucide";

export const STATUS = {
    aberto: { label: "Aberto", tone: "info", icon: CircleDot },
    analise: { label: "Em análise", tone: "warning", icon: Loader },
    resolvido: { label: "Resolvido", tone: "success", icon: CircleCheck },
};

export const STATUS_ORDEM = ["aberto", "analise", "resolvido"];

// "Média" é nova; chamados antigos só têm Baixa / Alta / Muito Alta.
export const PRIORIDADES = [
    { valor: "Baixa", tone: "neutral", peso: 1, dica: "Pode esperar, não atrapalha o trabalho." },
    { valor: "Média", tone: "info", peso: 2, dica: "Incomoda, mas há como contornar." },
    { valor: "Alta", tone: "orange", peso: 3, dica: "Atrapalha bastante o trabalho." },
    { valor: "Muito Alta", tone: "danger", peso: 4, dica: "Estou impedido de trabalhar." },
];

export function prioridadeInfo(valor) {
    return PRIORIDADES.find((p) => p.valor === valor) || { valor: valor || "—", tone: "neutral", peso: 0, dica: "" };
}

export const CATEGORIAS = [
    { valor: "Hardware", icon: Cpu },
    { valor: "Software", icon: AppWindow },
    { valor: "Rede", icon: Network },
    { valor: "Acesso", icon: KeyRound },
    { valor: "E-mail", icon: Mail },
    { valor: "Impressora", icon: Printer },
    { valor: "Outros", icon: Package },
];

export function categoriaInfo(valor) {
    return CATEGORIAS.find((c) => c.valor.toLowerCase() === String(valor || "").toLowerCase()) || { valor: valor || "Outros", icon: Package };
}

export const PAPEIS = {
    usuario: { label: "Usuário" },
    tecnico: { label: "Técnico" },
    admin: { label: "Administrador" },
};

/**
 * Itens de navegação. O shell filtra por papel.
 * `mobile: true` → aparece na bottom-nav (máx. 4 por papel).
 * `label` pode ser uma função do papel.
 */
export const MENU = [
    { id: "dashboard", href: "dashboard.html", label: "Início", icon: House, roles: ["usuario", "tecnico", "admin"], mobile: true },
    { id: "abrir-chamado", href: "abrir-chamado.html", label: "Abrir chamado", icon: Plus, roles: ["usuario", "tecnico", "admin"] },
    { id: "chamados", href: "chamados.html", label: (role) => (role === "usuario" ? "Meus chamados" : "Chamados"), icon: LayoutList, roles: ["usuario", "tecnico", "admin"], mobile: true },
    { id: "fila", href: "fila.html", label: "Fila", icon: KanbanSquare, roles: ["tecnico", "admin"], mobile: true },
    { id: "relatorios", href: "relatorios.html", label: "Relatórios", icon: ChartColumn, roles: ["admin"], mobile: true },
    { id: "configuracoes", href: "configuracoes.html", label: "Configurações", icon: Settings, roles: ["usuario", "tecnico", "admin"], mobile: true },
];
