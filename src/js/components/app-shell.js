// Monta sidebar, topbar, bottom-nav e FAB em volta do <main> da página,
// e garante a sessão. Toda página autenticada começa com:
//
//   const perfil = await iniciarPagina({ pagina: "dashboard" });
//   const perfil = await iniciarPagina({ pagina: "fila", papeis: ["tecnico", "admin"] });
//
// O HTML da página precisa ter:
//   <div class="app" id="app"> <main id="conteudo" class="page" tabindex="-1"> ... </main> </div>

import { ChevronsLeft, LifeBuoy, LogOut, Moon, Plus, Search, Settings, Sun } from "lucide";
import { exigirSessao, perfilEmCache, sair, TODOS_OS_PAPEIS } from "../core/session.js";
import { alternarTema, getPrefs, setPref, temaAtual } from "../core/theme.js";
import { MENU, PAPEIS } from "../utils/constants.js";
import { h, render } from "../utils/dom.js";
import { icon } from "../utils/icons.js";
import { avatar } from "./avatar.js";
import { exibirFlashPendente } from "./toast.js";

const MAX_ITENS_MOBILE = 4;

// Listeners globais do shell; renovado a cada desenho para não acumular (o shell é redesenhado após a sessão)
let controleShell = new AbortController();

function rotulo(item, role) {
    return typeof item.label === "function" ? item.label(role) : item.label;
}

function itensDoPapel(role) {
    return MENU.filter((item) => item.roles.includes(role));
}

function marca({ comNome = true } = {}) {
    return h(
        "a",
        { class: "brand", href: "dashboard.html", "aria-label": "HelpDesk — início" },
        h("span", { class: "brand__mark" }, icon(LifeBuoy)),
        comNome && h("span", { class: "brand__name" }, "HelpDesk")
    );
}

function sidebar(perfil, pagina) {
    const role = perfil?.role;
    const itens = role ? itensDoPapel(role) : [];

    const nav = h(
        "nav",
        { class: "sidebar__nav", "aria-label": "Principal" },
        h("span", { class: "sidebar__section-label" }, "Menu"),
        itens.map((item) => {
            const texto = rotulo(item, role);
            return h(
                "a",
                {
                    class: "nav-item",
                    href: item.href,
                    "aria-current": item.id === pagina ? "page" : null,
                    "aria-label": texto,
                    title: texto,
                },
                icon(item.icon),
                h("span", { class: "nav-item__label" }, texto)
            );
        })
    );

    const recolher = h(
        "button",
        {
            class: "nav-item",
            type: "button",
            dataset: { collapseToggle: "" },
            "aria-label": "Recolher menu",
            title: "Recolher menu",
            onClick: () => setPref("sidebar", getPrefs().sidebar === "collapsed" ? "expanded" : "collapsed"),
        },
        icon(ChevronsLeft),
        h("span", { class: "nav-item__label" }, "Recolher")
    );

    // A preferência também muda pela página de Configurações
    const sincronizarRecolher = () => {
        const texto = getPrefs().sidebar === "collapsed" ? "Expandir menu" : "Recolher menu";
        recolher.setAttribute("aria-label", texto);
        recolher.title = texto;
    };
    window.addEventListener("hd:prefs", sincronizarRecolher, { signal: controleShell.signal });
    sincronizarRecolher();

    const rodape = h(
        "div",
        { class: "sidebar__footer" },
        recolher,
        perfil &&
            h(
                "div",
                { class: "user-chip", title: perfil.nome },
                avatar(perfil.nome),
                h(
                    "span",
                    { class: "user-chip__text" },
                    h("span", { class: "user-chip__name truncate" }, perfil.nome),
                    h("span", { class: "user-chip__role" }, PAPEIS[perfil.role]?.label || "")
                )
            ),
        h(
            "button",
            { class: "nav-item nav-item--danger", type: "button", "aria-label": "Sair", title: "Sair", onClick: () => sair() },
            icon(LogOut),
            h("span", { class: "nav-item__label" }, "Sair")
        )
    );

    return h("aside", { class: "sidebar" }, marca(), nav, rodape);
}

function botaoTema() {
    const btn = h("button", { class: "btn btn--ghost btn--icon", type: "button" });
    const atualizar = () => {
        const escuro = temaAtual() === "dark";
        render(btn, icon(escuro ? Sun : Moon));
        btn.setAttribute("aria-label", escuro ? "Usar tema claro" : "Usar tema escuro");
        btn.title = btn.getAttribute("aria-label");
    };
    btn.addEventListener("click", alternarTema);
    window.addEventListener("hd:prefs", atualizar, { signal: controleShell.signal });
    atualizar();
    return btn;
}

function menuUsuario(perfil) {
    if (!perfil) return null;
    const id = "menu-usuario";
    const popover = h(
        "div",
        { class: "menu-popover", id, popover: "auto" },
        h(
            "div",
            { class: "menu-popover__header" },
            avatar(perfil.nome),
            h(
                "div",
                { class: "user-chip__text" },
                h("strong", { class: "user-chip__name truncate" }, perfil.nome),
                h("span", { class: "user-chip__role truncate" }, perfil.email)
            )
        ),
        h("a", { class: "nav-item", href: "configuracoes.html" }, icon(Settings), "Configurações"),
        h("button", { class: "nav-item nav-item--danger", type: "button", onClick: () => sair() }, icon(LogOut), "Sair")
    );

    const gatilho = h(
        "button",
        {
            class: "btn btn--ghost btn--icon",
            type: "button",
            popovertarget: id,
            "aria-label": `Menu de ${perfil.nome}`,
            style: { anchorName: "--menu-usuario" },
        },
        avatar(perfil.nome, { tamanho: "sm" })
    );
    popover.style.positionAnchor = "--menu-usuario";

    return [gatilho, popover];
}

function topbar(perfil) {
    const atalho = navigator.platform?.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K";
    return h(
        "header",
        { class: "topbar" },
        marca(),
        h(
            "button",
            { class: "topbar__search", type: "button", dataset: { abrirPaleta: "" }, "aria-label": "Buscar (atalho " + atalho + ")" },
            icon(Search),
            h("span", {}, "Buscar chamados, páginas…"),
            h("kbd", {}, atalho)
        ),
        h("span", { class: "topbar__spacer" }),
        h(
            "button",
            { class: "btn btn--ghost btn--icon topbar__search-mobile", type: "button", dataset: { abrirPaleta: "" }, "aria-label": "Buscar" },
            icon(Search)
        ),
        botaoTema(),
        menuUsuario(perfil)
    );
}

function bottomNav(perfil, pagina) {
    if (!perfil) return h("nav", { class: "bottom-nav", "aria-label": "Navegação" });
    const itens = itensDoPapel(perfil.role).filter((i) => i.mobile).slice(0, MAX_ITENS_MOBILE);
    return h(
        "nav",
        { class: "bottom-nav", "aria-label": "Navegação" },
        itens.map((item) =>
            h(
                "a",
                { class: "bottom-nav__item", href: item.href, "aria-current": item.id === pagina ? "page" : null },
                icon(item.icon),
                h("span", {}, rotulo(item, perfil.role).replace("Meus chamados", "Chamados"))
            )
        )
    );
}

function fab(pagina) {
    if (pagina === "abrir-chamado") return null;
    return h("a", { class: "fab", href: "abrir-chamado.html", "aria-label": "Abrir novo chamado" }, icon(Plus));
}

function desenhar(app, perfil, pagina) {
    controleShell.abort();
    controleShell = new AbortController();
    app.querySelectorAll(":scope > .sidebar, :scope > .topbar, :scope > .bottom-nav, :scope > .fab").forEach((el) => el.remove());
    const main = app.querySelector("main");
    main.before(sidebar(perfil, pagina), topbar(perfil));
    main.after(bottomNav(perfil, pagina), fab(pagina) || "");
}

let paletaCarregada = null;

function registrarPaleta(perfil) {
    const abrir = async () => {
        paletaCarregada ??= import("./command-palette.js");
        const { abrirPaleta } = await paletaCarregada;
        abrirPaleta(perfil);
    };

    document.addEventListener("click", (e) => {
        if (e.target.closest("[data-abrir-paleta]")) abrir();
    });

    document.addEventListener("keydown", (e) => {
        const alvo = e.target;
        const digitando = alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || Boolean(alvo.closest?.("dialog[open]"));
        if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "k") {
            e.preventDefault();
            abrir();
        } else if (e.key === "/" && !digitando) {
            e.preventDefault();
            abrir();
        }
    });
}

/**
 * Prepara a página autenticada: desenha o shell, verifica sessão/papel e devolve o perfil.
 * @param {{ pagina: string, papeis?: string[] }} opcoes
 * @returns {Promise<import("../core/session.js").Perfil>}
 */
export async function iniciarPagina({ pagina, papeis = TODOS_OS_PAPEIS }) {
    const app = document.getElementById("app");

    if (!document.querySelector(".skip-link")) {
        document.body.prepend(h("a", { class: "skip-link", href: "#conteudo" }, "Pular para o conteúdo"));
    }

    // 1º desenho imediato com o perfil em cache (navegação sem "piscar")
    const cache = perfilEmCache();
    desenhar(app, cache, pagina);

    const perfil = await exigirSessao(papeis);
    if (!cache || cache.uid !== perfil.uid || cache.role !== perfil.role || cache.nome !== perfil.nome) {
        desenhar(app, perfil, pagina);
    }

    registrarPaleta(perfil);
    exibirFlashPendente();
    return perfil;
}
