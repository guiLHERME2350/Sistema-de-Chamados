# HelpDesk

Sistema de chamados (projeto de estudo): usuários abrem chamados, técnicos atendem e conversam em tempo real.
Front-end em HTML, CSS e JavaScript puro com [Vite](https://vite.dev); dados e login no Firebase (Auth + Firestore).

## Rodando

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ — abre no XAMPP em http://localhost/helpdesk/dist/
```

## Páginas

| Página | Quem acessa | O que faz |
|---|---|---|
| `index.html` | público | Login |
| `dashboard.html` | todos | Resumo em tempo real, recentes, fila aguardando |
| `abrir-chamado.html` | todos | Formulário com rascunho automático e prévia ao vivo |
| `chamados.html` | todos | Lista com busca, filtros e ordenação (estado na URL) |
| `chamado.html?id=` | dono / técnico / admin | Detalhe, linha do tempo, conversa e ações |
| `fila.html` | técnico, admin | Kanban com arrastar e soltar |
| `relatorios.html` | admin | KPIs, gráficos e exportação CSV |
| `configuracoes.html` | todos | Tema, movimento, densidade, atalhos |
| `styleguide.html` | dev | Vitrine do design system |

Atalhos: **Ctrl/⌘ + K** ou **/** abre a busca rápida · **Ctrl/⌘ + Enter** envia o chamado · **Enter** envia mensagem no chat.

## Documentação

- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — estrutura, convenções e API dos componentes e serviços.
- [`PLANO-REDESIGN.md`](PLANO-REDESIGN.md) — diagnóstico original e plano do redesign.
- `estudos/` — anotações de estudo de JavaScript.
