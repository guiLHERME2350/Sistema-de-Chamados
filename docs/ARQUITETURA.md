# Arquitetura do front-end — HelpDesk

Guia de convenções do projeto. Leia antes de criar ou alterar uma página.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173 com hot reload
npm run build    # gera dist/ (funciona dentro do XAMPP: localhost/helpdesk/dist/)
```

## Estrutura

```
*.html                       uma por página (Vite multi-page; lista em vite.config.js)
public/favicon.svg
src/styles/main.css          importa tudo em camadas (@layer)
src/styles/tokens.css        cores, tipografia, espaço, raio, sombras, movimento
src/styles/components/*.css  componentes reutilizáveis
src/styles/motion.css        keyframes, view transitions, utilitários .anim-in / .stagger
src/styles/pages/<pagina>.css  estilos exclusivos da página, SEMPRE dentro de @layer pages { }
src/js/core/                 firebase.js, session.js, theme.js
src/js/services/             chamados.js, mensagens.js — ÚNICO lugar que importa firebase/firestore
src/js/components/           app-shell, toast, confirm, badges, skeleton, empty-state, avatar, tabs, command-palette
src/js/utils/                dom.js (h/render), icons.js, format.js, constants.js, motion.js
src/js/pages/<pagina>.js     entry de cada página
```

## Esqueleto de uma página autenticada

```html
<!doctype html>
<html lang="pt-BR" data-theme="system">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Nome da página · HelpDesk</title>
    <meta name="description" content="...">
    <meta name="theme-color" content="#0f0d13">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
    <script>
        /* Aplica as preferências antes do primeiro paint (espelha src/js/core/theme.js) */
        (function () {
            try {
                var p = JSON.parse(localStorage.getItem("hd:prefs") || "{}");
                var r = document.documentElement;
                r.dataset.theme = p.theme || "system";
                r.dataset.systemTheme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
                r.dataset.motion = p.motion || "system";
                r.dataset.density = p.density || "comfortable";
                r.dataset.sidebar = p.sidebar || "expanded";
            } catch (e) {}
        })();
    </script>
    <link rel="stylesheet" href="/src/styles/main.css">
    <link rel="stylesheet" href="/src/styles/pages/NOME.css">
</head>
<body>
    <div class="app" id="app">
        <main id="conteudo" class="page" tabindex="-1">
            <!-- conteúdo estático da página (cabeçalho, containers vazios com skeleton) -->
        </main>
    </div>
    <script type="module" src="/src/js/pages/NOME.js"></script>
</body>
</html>
```

O `app-shell.js` insere sidebar, topbar, bottom-nav (mobile), FAB "novo chamado" e o link "Pular para o conteúdo". **Não** escreva menu/sidebar no HTML.

```js
import { iniciarPagina } from "../components/app-shell.js";

const perfil = await iniciarPagina({ pagina: "chamados" });            // qualquer papel logado
const perfil = await iniciarPagina({ pagina: "fila", papeis: ["tecnico", "admin"] });
// perfil = { uid, nome, email, role: "usuario" | "tecnico" | "admin" }
```

`pagina` é o `id` do item em `MENU` (utils/constants.js) que fica destacado. IDs: `dashboard`, `abrir-chamado`, `chamados`, `fila`, `relatorios`, `configuracoes`. A página de detalhe (`chamado.html`) usa `pagina: "chamados"`.

## Regras

1. **Nada de `innerHTML` com dados.** Use `h()` / `render()` de `utils/dom.js` (textos viram nós de texto → sem XSS).
   ```js
   h("a", { class: "card card--interactive", href: `chamado.html?id=${c.id}` }, h("h3", {}, c.titulo))
   ```
2. **Nada de `alert()` / `confirm()`.** Use `toast.success|error|info|warning(titulo, { message, action, duration })`, `toast.flash(tom, titulo, {message})` (aparece na próxima página) e `await confirmar({ titulo, mensagem, confirmar, tom })`.
3. **Páginas não importam `firebase/*`.** Use `services/chamados.js` e `services/mensagens.js`. Os objetos já vêm normalizados (datas são `Date`, número do chamado é `numero`).
4. **Rótulos e cores de domínio vêm de `constants.js`** (`STATUS`, `PRIORIDADES`, `CATEGORIAS`, `PAPEIS`). Badges prontos em `components/badges.js`.
5. **Todo carregamento tem 3 estados:** skeleton (`components/skeleton.js`) → conteúdo, vazio (`estadoVazio`) ou erro (toast + estado vazio com "Tentar novamente").
6. **Ícones:** `import { Plus } from "lucide"` + `icon(Plus)` de `utils/icons.js`.
7. **CSS de página** fica em `src/styles/pages/<pagina>.css`, envolto em `@layer pages { ... }`, usando apenas tokens (`var(--...)`) — nada de cores hex soltas.
8. **Movimento:** use `.anim-in`, `stagger(container)`, `animarNumero`, `pulsar`, `tremer`, `destacar`, `comTransicao` (utils/motion.js). Anime só `transform`/`opacity`. Durações vêm dos tokens, então o modo "reduzir movimento" já zera tudo.
9. **Acessibilidade:** `label for` correto, `aria-invalid` + `aria-describedby` em erros, um `<h1>` por página, alvos de toque ≥ 44px, foco visível (já global).
10. **Responsivo mobile-first:** breakpoints 640 / 1024 / 1440 px. Tabelas usam `.table.table--responsive` com `data-label` em cada `<td>`.

## Componentes CSS disponíveis

| Classe | Uso |
|---|---|
| `.btn` + `--primary / --secondary / --ghost / --danger / --success`, `--sm / --lg / --icon / --block`, `aria-busy="true"` | botões (loading com spinner) |
| `.field`, `.field__label`, `.field__row`, `.field__hint`, `.field__counter`, `.field__error`, `.is-invalid`, `.input-wrap`, `.input`, `.textarea`, `.select` | formulários |
| `.chip-group` + `label.chip > input[type=radio]` | seleção em chips |
| `.segmented` + `label.segmented__option[data-tone] > input[type=radio]` | controle segmentado |
| `.switch > input[type=checkbox][role=switch]` | interruptor |
| `.card`, `.card--interactive`, `.card--flush`, `.card__header`, `.card__title` | cartões |
| `.stat[data-tone]` com `.stat__label / __value / __icon / __meta` | cards de métrica |
| `.badge[data-tone]`, `.badge--outline`, `.count` | selos e contadores |
| `.table.table--responsive`, `.table-wrap`, `.row-link` | tabelas (viram cards no mobile) |
| `.tabs` + `criarAbas()` | abas com indicador deslizante |
| `.page-header`, `__eyebrow`, `__text`, `__subtitle`, `__actions`, `.back-link` | cabeçalho de página |
| `.stack`, `.cluster`, `.spread`, `.truncate`, `.sr-only`, `.muted`, `.num`, `.mono` | utilitários |
| `data-tone`: `info · warning · success · danger · orange · brand · neutral` | define `--tone` |

## Serviços

```js
// services/chamados.js
listarChamados(perfil)                         → Promise<Chamado[]> (mais recentes primeiro)
observarChamados(perfil, (chamados, mudancas) => {}) → unsubscribe   // tempo real
obterChamado(id) / observarChamado(id, cb)
podeVerChamado(chamado, perfil)
criarChamado({ titulo, categoria, descricao, prioridade }, perfil) → { id, numero }
assumirChamado(id, perfil) · resolverChamado(id) · reabrirChamado(id)
moverChamado(chamado, novoStatus, perfil)      // regras de transição (Kanban)

// services/mensagens.js
observarMensagens(chamadoId, (mensagens, idsNovos) => {}) → unsubscribe
enviarMensagem(chamadoId, texto, perfil) · editarMensagem(chamadoId, mensagemId, texto)
```

Chamado: `{ id, numero, titulo, categoria, descricao, prioridade, status, usuarioId, usuarioNome, usuarioEmail, tecnicoId, tecnicoNome, dataCriacao, dataAssumido, dataResolucao }`.
Mensagem: `{ id, texto, usuarioId, usuarioNome, data, editada, pendente }`.
