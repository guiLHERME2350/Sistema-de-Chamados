# AGENTS.md — helpdesk (Vite + Firebase)

## Rodar
- `npm run dev` — dev server (Vite)
- `npm run build` — build p/ `dist/`
- `npm run preview` — pré-visualizar build

## Estrutura
- HTML raiz (multipage): `index.html`, `dashboard.html`, `abrir-chamado.html`, `chamados.html`, `chamado.html`, `fila.html`, `relatorios.html`, `configuracoes.html`, `styleguide.html`
- `src/js/core/` — `firebase.js`, `session.js`, `theme.js`
- `src/js/services/` — acesso Firestore/Auth (ex.: `chamados.js`, `mensagens.js`)
- `src/js/pages/` — um módulo por página HTML (ex.: `dashboard.js`)
- `src/js/components/` — UI reutilizável (toast, badges, skeleton, etc.)
- `src/js/utils/` — `dom.js`, `format.js`, `constants.js`, `icons.js`, `motion.js`, `logger.js`
- `src/styles/` — `tokens.css`, `base.css`, `reset.css`, `utilities.css`, `motion.css`, `main.css`

## Firebase (v12, API modular)
- Imports sempre modulares: `firebase/app`, `firebase/auth`, `firebase/firestore`. Nada de namespaced (`firebase.firestore()`).
- Config centralizada em `src/js/core/firebase.js` (`auth`, `db`). Não duplicar `initializeApp`.
- Regras versionadas em `firestore.rules` (deploy via Firebase Console/CLI); espelhar checagens no client apenas como UX, nunca como segurança.

## Logger
- Usar `src/js/utils/logger.js` (`logError(erro, contexto)`, `logWarn`, `silentError`). Nunca `console.*` direto em código de produção.

## Não quebrar
- `vite.config.js` — manter `base: "./"` (build roda sob subpasta, ex. XAMPP) e o mapa `rollupOptions.input` das páginas.
- `netlify.toml` / `nginx.conf` — não alterar publish/root SPA sem pedir; projeto é multipage com HTML raiz.
