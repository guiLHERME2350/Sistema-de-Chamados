# Plano de Redesign — HelpDesk

> Redesign completo do front-end do sistema de chamados: identidade visual, arquitetura de código, responsividade e movimento.
> **Fora de escopo por enquanto:** segurança e backend (Firebase continua como está: Auth + Firestore, mesmas coleções e campos).

> **Status (19/09/2026):** fases 0 a 6 implementadas. Pendentes do roteiro: testes E2E com Playwright (exigem um usuário de teste no Firebase) e os itens do backlog (seção 11) e de backend (seção 12). Convenções atuais em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

---

## 1. Diagnóstico do projeto atual

### 1.1 O que existe

| Página | Arquivos | Função |
|---|---|---|
| Login | `index.html`, `script.js`, `CSS/style.css` | Login com e-mail/senha (Firebase Auth) |
| Dashboard | `dashboard.html/.js`, `CSS/dashboard.css` | Saudação, 3 cards de resumo (tempo real), lista de chamados |
| Abrir chamado | `abrirchamado.html/.js`, `CSS/abrirchamado.css` | Formulário com numeração sequencial via transação |
| Meus chamados | `meuschamados.html/.js`, `CSS/meuschamados.css` | Tabela com abas "Fila" / "Histórico" |
| Chamado | `chamado.html/.js`, `CSS/chamado.css` | Detalhes, assumir/resolver (técnico), chat com edição de mensagem |
| — | `verificar-permissao.js`, `firebase-config.js` | Guard de login + papel (`usuario`, `tecnico`, `admin`) |

**Stack:** HTML + CSS + JS puro com ES Modules, Firebase 12.5 via CDN, sem etapa de build. Servido pelo XAMPP.

### 1.2 Pontos fortes (manter)
- Separação por página já clara e fácil de entender.
- Uso de `onSnapshot` (tempo real) no resumo e no chat — ótima base para animações "ao vivo".
- Modelo de papéis simples e bem definido.
- Numeração sequencial de chamados (`#123`) — bom para a UX.

### 1.3 Problemas de front-end encontrados

**Identidade e consistência**
- Login usa tema claro com gradiente roxo/preto; o resto do app é escuro (`#1c191f`). Parecem dois produtos diferentes.
- Cores soltas em cada CSS (`#26222d`, `#3a3542`, `#a855f7`, `#4caf50`, `#ff6b6b`…), sem tokens.
- Fonte `Arial` em quase tudo e `Franklin Gothic` no login.
- `abrirchamado.html` tem um `<header>` extra que as outras páginas não têm.

**Duplicação**
- A sidebar está copiada em 4 HTML **e** em 4 CSS.
- A lógica "mostrar/esconder menu por papel" está copiada em 4 JS (em `meuschamados.js` o `verificarPermissao` é chamado 2×, ou seja, 2 consultas ao Firestore).
- Botão "Sair" reimplementado em cada página; `formatarData` duplicada.
- `style.css` (raiz) e `CSS/style.css` são quase iguais.

**Bugs de marcação/estilo**
- `meuschamados.html:73` → `style="display : nome;"` (deveria ser `none`).
- `style.css:18` e `CSS/style.css:18` → `background: wh;`.
- `abrirchamado.html:47,50,62` → `label for` não bate com o `id` do campo (clicar no rótulo não foca o campo).
- `chamado.html:108` → `<div class="campo">` aberta e nunca fechada.
- `index.html` e `meuschamados.html` com `lang="en"` num site em português.
- `onAuthStateChanged` duplicado em `abrirchamado.js` (já existe no guard).

**UX**
- `alert()` para tudo (sucesso, erro, validação) — bloqueia a tela e interrompe o fluxo.
- Sem estados de carregamento: os números aparecem como `0` e depois "pulam"; a tabela fica vazia até carregar.
- Status aparece cru (`analise`) em vez de rótulo ("Em análise") com cor.
- Categoria é texto livre (vai gerar "Rede", "rede", "REDE"…). Prioridade não tem "Média".
- "Chamados recentes" do dashboard não é ordenado, não tem limite e os cards não são clicáveis.
- Tabela não se adapta ao celular (só rolagem horizontal).
- "Relatórios" e "Configurações" apontam para `#`.
- Sem busca, filtro, ordenação ou paginação.

**Arquivos mortos:** `fila.html`, `fila.js`, `login.html`, `CSS/fila.css` (vazios), `javascript.js` (anotações de estudo), `Imagem/Sem título.jpg` (rascunho).

---

## 2. Objetivos do redesign

1. **Uma só identidade visual**, baseada em design tokens, com tema escuro e claro.
2. **Mobile-first de verdade**: cada tela pensada para 360 px e expandida até telas largas.
3. **Movimento com propósito**: transições entre páginas, feedback em toda ação, dados "vivos" — sempre respeitando `prefers-reduced-motion`.
4. **Código sem repetição**: layout (shell), componentes e acesso a dados escritos uma vez só.
5. **Acessível**: navegação por teclado, foco visível, contraste AA, semântica correta.
6. **Base pronta para crescer**: Kanban do técnico, relatórios, configurações.

---

## 3. Decisões técnicas

### 3.1 Ferramentas — recomendação

**Vite + JavaScript puro (ES Modules) + CSS moderno.** Sem framework.

Por quê:
- Mantém o que você já sabe (HTML/CSS/JS), mas ganha servidor com hot reload, `import` de pacotes npm (Firebase, ícones) e build otimizado.
- Vite suporta multi-página nativamente — cada `.html` continua sendo uma página.
- Migrar para React/Vue agora triplicaria o escopo. Se no futuro quiser, a camada de `services/` (abaixo) é reaproveitada inteira.

| Pacote | Uso |
|---|---|
| `vite` | dev server + build |
| `firebase` | trocar o CDN pelo pacote npm (mesma API) |
| `lucide` | ícones SVG consistentes (substitui texto puro no menu) |
| `motion` (opcional, ~4 kB) | animações por JS quando CSS não bastar (contadores, listas) |
| `chart.js` (fase 6) | gráficos da página de relatórios |

> Alternativa sem build: dá para seguir tudo deste plano servindo pelo XAMPP e importando libs via `esm.sh`/jsDelivr. Perde-se hot reload e minificação, mas nada do design muda.

### 3.2 Recursos de plataforma que vamos usar
- **View Transitions API entre documentos** (`@view-transition { navigation: auto; }`) — transição animada entre páginas de um MPA **sem SPA**. Chrome/Edge/Safari suportam; Firefox apenas troca de página normalmente (degradação elegante).
- **CSS custom properties** para tokens + `color-scheme` para tema claro/escuro.
- **`@layer`** para organizar a cascata (reset → tokens → base → componentes → páginas → utilitários).
- **Container queries** nos cards (o card se adapta ao espaço dele, não à tela).
- **`<dialog>`** nativo para confirmações e modais.
- **Popover API** para menus suspensos (menu do usuário, filtros).
- **`Intl.RelativeTimeFormat`** para datas "há 5 min".

### 3.3 Nova estrutura de pastas

```
helpdesk/
├── index.html                 # login
├── dashboard.html
├── abrir-chamado.html
├── chamados.html              # antigo meuschamados
├── chamado.html               # detalhe (?id=)
├── fila.html                  # NOVO: Kanban do técnico
├── relatorios.html            # NOVO: admin
├── configuracoes.html         # NOVO: perfil + preferências
├── public/
│   └── favicon.svg, logo.svg
├── src/
│   ├── styles/
│   │   ├── main.css           # só @imports em @layer
│   │   ├── reset.css
│   │   ├── tokens.css         # cores, espaço, tipografia, raios, sombras, motion
│   │   ├── base.css           # body, tipografia, foco, seleção
│   │   ├── motion.css         # keyframes + reduced-motion + view transitions
│   │   ├── components/        # button, input, card, badge, table, toast, dialog,
│   │   │                      # sidebar, avatar, skeleton, tabs, empty-state, chat
│   │   └── pages/             # ajustes específicos de cada página
│   ├── js/
│   │   ├── core/
│   │   │   ├── firebase.js    # antigo firebase-config.js
│   │   │   ├── session.js     # antigo verificar-permissao.js (1 consulta, cache)
│   │   │   └── theme.js       # claro/escuro/sistema
│   │   ├── services/          # ÚNICO lugar que fala com o Firestore
│   │   │   ├── chamados.js    # listar, observar, criar, assumir, resolver
│   │   │   └── mensagens.js   # observar, enviar, editar
│   │   ├── components/
│   │   │   ├── app-shell.js   # injeta sidebar/topbar/bottom-nav conforme papel
│   │   │   ├── toast.js       # substitui alert()
│   │   │   ├── confirm.js     # <dialog> de confirmação
│   │   │   ├── status-badge.js
│   │   │   └── skeleton.js
│   │   ├── utils/
│   │   │   ├── format.js      # datas, tempo relativo, números
│   │   │   ├── constants.js   # STATUS, PRIORIDADES, CATEGORIAS, MENU por papel
│   │   │   └── dom.js         # helpers de criação de elementos
│   │   └── pages/             # um entry por página: dashboard.js, chamado.js...
├── vite.config.js
└── package.json
```

### 3.4 Padrões de código
- **Configuração em dados, não em `if/else`:** o menu vira uma lista `{ href, label, icon, roles: [...] }` e o shell filtra pelo papel. Some todo o bloco repetido de `style.display`.
- **Mapas de domínio** em `constants.js`:
  ```js
  export const STATUS = {
    aberto:    { label: "Aberto",     tone: "info"    },
    analise:   { label: "Em análise", tone: "warning" },
    resolvido: { label: "Resolvido",  tone: "success" },
  };
  ```
- **Páginas não importam Firebase** — só `services/`. Isso isola o backend (que vai mudar depois).
- **Estados explícitos em toda tela que carrega dados:** `loading → vazio | erro | conteúdo`.
- Remover os `console.log` de depuração; comentários só onde o *porquê* não é óbvio (os banners `// =====` podem sair).

---

## 4. Design System

### 4.1 Direção visual
**"Calmo e operacional."** Um helpdesk é usado por horas: superfícies neutras, pouco ruído, cor reservada para *significado* (status, prioridade, ação principal). Mantemos o **roxo** como cor da marca — já é a identidade do projeto — mas usado com parcimônia.

### 4.2 Tokens de cor (tema escuro como padrão)

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0f0d13` | `#f7f6f9` | fundo da página |
| `--surface-1` | `#17141d` | `#ffffff` | cards, sidebar |
| `--surface-2` | `#211d29` | `#f1eff5` | inputs, hover |
| `--border` | `#2e2938` | `#e3e0ea` | divisórias |
| `--text` | `#f3f1f7` | `#17141d` | texto principal |
| `--text-muted` | `#a39db0` | `#5f5970` | rótulos, metadados |
| `--brand` | `#a855f7` | `#7c3aed` | ação primária, foco, item ativo |
| `--info` | `#60a5fa` | `#2563eb` | status Aberto |
| `--warning` | `#fbbf24` | `#b45309` | status Em análise / prioridade Alta |
| `--success` | `#34d399` | `#047857` | status Resolvido |
| `--danger` | `#f87171` | `#dc2626` | Muito Alta, erros, sair |

Badges usam a cor com ~15% de opacidade no fundo e a cor cheia no texto (`color-mix(in oklch, var(--info) 15%, transparent)`). Validar contraste AA de todos os pares.

### 4.3 Tipografia
- **Interface:** `Plus Jakarta Sans` (ou `Manrope`) — geométrica, amigável, boa em tamanhos pequenos.
- **Números e IDs** (`#123`, contadores, datas): `JetBrains Mono` ou `font-variant-numeric: tabular-nums` para não "dançarem" ao animar.
- Escala fluida com `clamp()`: `--fs-xs 12` · `--fs-sm 14` · `--fs-md 16` · `--fs-lg 20` · `--fs-xl clamp(24px, 3vw, 32px)` · `--fs-2xl clamp(32px, 5vw, 48px)`.

### 4.4 Espaço, raio, sombra
- Espaçamento em base 4: `--space-1: 4px` … `--space-8: 48px`.
- Raios: `--radius-sm 6px` (inputs), `--radius-md 10px` (botões), `--radius-lg 16px` (cards), `--radius-full` (badges, avatar).
- No escuro, profundidade vem de **borda + superfície mais clara**, não de sombra; no claro, sombras suaves.

### 4.5 Componentes (inventário)

| Componente | Variações / estados |
|---|---|
| Button | primary · secondary · ghost · danger · só-ícone; hover, active, focus, disabled, **loading** (spinner) |
| Input / Textarea / Select | label flutuante ou fixa, texto de ajuda, erro, contador de caracteres |
| Segmented control | seleção de prioridade |
| Chips | seleção de categoria |
| Card | padrão, clicável (hover eleva), stat card |
| Badge | status (3) e prioridade (4), com ponto colorido |
| Tabela → Lista | tabela no desktop, cards empilhados no mobile |
| Tabs | com indicador deslizante |
| Toast | sucesso · erro · info; empilháveis, fecham sozinhos, com ação "Desfazer" opcional |
| Dialog | confirmação ("Resolver chamado #42?") |
| Skeleton | linhas, cards, avatar |
| Empty state | ilustração/ícone + texto + ação ("Abrir primeiro chamado") |
| Avatar | iniciais do nome com cor derivada do nome |
| Chat bubble | minha · outra pessoa · sistema ("Técnico Ana assumiu o chamado") |

> Sugestão: criar uma página `styleguide.html` (só em dev) mostrando todos os componentes e estados. É o jeito profissional de validar o design system antes de montar as telas.

---

## 5. Layout responsivo

### 5.1 Breakpoints (mobile-first)
| Nome | Largura | Navegação |
|---|---|---|
| base | < 640 px | **bottom navigation** (4 itens) + botão flutuante "Novo chamado" |
| `md` | ≥ 640 px | sidebar recolhida (só ícones, 72 px) com tooltip |
| `lg` | ≥ 1024 px | sidebar expandida (240 px), recolhível pelo usuário (preferência salva) |
| `xl` | ≥ 1440 px | conteúdo com largura máxima e colunas extras (ex.: painel lateral no chamado) |

### 5.2 App shell
```
Desktop (lg)                                 Mobile (base)
┌──────────┬──────────────────────────────┐  ┌────────────────────────┐
│  ◆ Help  │  Topbar: busca (Ctrl+K)   🔔 👤│  │ ◆ HelpDesk        🔔 👤│
│  Desk    ├──────────────────────────────┤  ├────────────────────────┤
│          │                              │  │                        │
│ ⌂ Início │                              │  │       conteúdo         │
│ ＋ Abrir │          conteúdo            │  │                        │
│ ☰ Chamad.│                              │  │                   (＋) │
│ ▦ Fila   │                              │  ├────────────────────────┤
│ ▲ Relat. │                              │  │  ⌂    ☰    ▦    ⚙      │
│ ⚙ Config │                              │  └────────────────────────┘
│──────────│                              │
│ 👤 Ana   │                              │
│ Técnica ⏻│                              │
└──────────┴──────────────────────────────┘
```
O shell é **renderizado por JS uma única vez** (`app-shell.js`) — cada HTML só tem `<div id="app">` e o `<main>` da página. Item ativo destacado automaticamente pela URL.

---

## 6. Telas

### 6.1 Login (`index.html`)
- Layout dividido no desktop: à esquerda painel da marca com gradiente animado lento (mesh/blur do roxo) e uma frase; à direita o formulário. No mobile, só o formulário com a marca no topo.
- Campos com ícone, botão "mostrar senha", validação inline (sem `alert`).
- Botão com estado de carregamento; erro com animação de *shake* sutil no card.
- Após login: transição suave para o dashboard (View Transition).

### 6.2 Dashboard
```
Olá, Ana 👋                         [ + Novo chamado ]
Você tem 3 chamados em andamento.

┌─ Abertos ──┐ ┌─ Em análise ┐ ┌─ Resolvidos ┐ ┌─ Tempo médio ┐
│  12  ↑2    │ │   5         │ │  48         │ │  3h 20m      │
└────────────┘ └─────────────┘ └─────────────┘ └──────────────┘

Chamados recentes                              Ver todos →
┌────────────────────────────────────────────────────────┐
│ #52  Impressora não conecta   [Aberto] [Alta]   há 5min│
│ #51  Acesso ao e-mail         [Em análise]      há 2h  │
└────────────────────────────────────────────────────────┘
```
- Saudação por horário ("Bom dia/Boa tarde/Boa noite") + frase contextual por papel.
- Stat cards **clicáveis** (levam à lista já filtrada), com contagem animada e *pulse* quando o número muda em tempo real.
- Recentes: ordenados por `dataCriacao desc`, limite 5, clicáveis, com badges e tempo relativo.
- Técnico/admin: bloco extra "Aguardando atendimento" com botão rápido "Assumir".

### 6.3 Abrir chamado
- Formulário em uma coluna larga, agrupado: **O quê** (título + descrição) → **Classificação** (categoria + prioridade).
- **Categoria em chips** (Hardware, Software, Rede, Acesso, E-mail, Impressora, Outros) — fim do texto livre.
- **Prioridade em segmented control**: Baixa · Média · Alta · Muito Alta, cada uma com sua cor e uma dica ("Muito Alta: estou impedido de trabalhar").
- Contador de caracteres no título (50) e textarea que cresce com o conteúdo (`field-sizing: content`).
- **Rascunho automático** no `localStorage`.
- Ao enviar: botão vira spinner → tela de sucesso animada (check desenhado em SVG) com o número `#53` e botões "Ver chamado" / "Abrir outro".

### 6.4 Chamados (lista) — antigo "Meus chamados"
- Título muda por papel ("Meus chamados" / "Todos os chamados") — já existe essa ideia no código, agora centralizada.
- Tabs **Fila / Histórico** com indicador deslizante + contador em cada aba.
- Barra de ferramentas: **busca** (título, #número), filtros por status/prioridade/categoria (popover), ordenação.
- Filtros refletidos na URL (`?status=aberto&q=impressora`) — links compartilháveis e o botão Voltar funciona.
- Desktop: tabela com linha inteira clicável e cabeçalho fixo. Mobile: lista de cards.
- Skeleton ao carregar; empty state diferente para "sem chamados" e "nenhum resultado para o filtro".

### 6.5 Chamado (detalhe)
```
← Voltar   Chamado #52                     [Aberto] [Alta]
Impressora não conecta
┌───────────────────────────────────┬────────────────────────┐
│ Conversa                          │ Detalhes               │
│  (bolhas de chat, auto-scroll)    │ Solicitante: João      │
│                                   │ Técnico: —             │
│                                   │ Categoria: Impressora  │
│                                   │ Aberto: 12/09 14:03    │
│                                   │ ────────────────────── │
│                                   │ Linha do tempo         │
│                                   │ ● Aberto      14:03    │
│                                   │ ● Assumido    14:20    │
│ [ Escreva uma mensagem...   ➤ ]   │ [ Assumir chamado ]    │
└───────────────────────────────────┴────────────────────────┘
```
- Desktop: duas colunas (conversa + painel de detalhes fixo). Mobile: detalhes recolhíveis no topo e composer fixo no rodapé.
- Descrição original aparece como a primeira "mensagem" do chat.
- Bolhas diferenciadas (minha à direita, outra pessoa à esquerda, eventos do sistema centralizados).
- Enviar com `Enter`, nova linha com `Shift+Enter`; mensagem aparece com animação de entrada.
- Edição inline mantida, mas com `Esc` para cancelar e `Enter` para salvar.
- Ações do técnico com `<dialog>` de confirmação; ao mudar status, o badge faz transição de cor.
- Linha do tempo derivada dos campos já existentes (`dataCriacao`, `tecnicoNome`, `dataResolucao`).

### 6.6 Fila — Kanban (NOVO, técnico/admin) — reaproveita o `fila.html` vazio
- Três colunas: **Aberto · Em análise · Resolvido**, em tempo real (`onSnapshot`).
- Arrastar um card de "Aberto" para "Em análise" = assumir; para "Resolvido" = resolver (mesmas chamadas do serviço).
- Cards com prioridade (barra colorida lateral), idade do chamado e avatar do técnico.
- Mobile: colunas viram abas com swipe horizontal (`scroll-snap`).

### 6.7 Relatórios (NOVO, admin)
- Gráficos: chamados por status, por categoria, por prioridade; abertos × resolvidos por dia; tempo médio de resolução.
- Filtro de período (7 / 30 / 90 dias). Tudo calculado no front a partir da coleção `chamados` (suficiente para estudo).

### 6.8 Configurações (NOVO)
- Perfil (nome, e-mail, papel — leitura).
- Tema: claro / escuro / seguir sistema.
- Reduzir animações (sobrepõe a preferência do sistema).
- Densidade da tabela: confortável / compacta.

---

## 7. Movimento (motion design)

### 7.1 Princípios
- **Rápido e com propósito:** micro-interações 120–200 ms; entradas de conteúdo 250–400 ms. Nada passa de 500 ms.
- **Mesma linguagem em tudo:** tokens de motion.
  ```css
  --ease-out: cubic-bezier(.22, 1, .36, 1);
  --ease-in-out: cubic-bezier(.65, 0, .35, 1);
  --dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 400ms;
  ```
- **Anime apenas `transform` e `opacity`** (performance, 60 fps).
- **`prefers-reduced-motion: reduce`** → troca movimentos por *fade* curto ou nada.

### 7.2 Catálogo de animações

| Onde | Animação |
|---|---|
| Navegação entre páginas | View Transition: conteúdo faz *fade + slide* de 8 px; sidebar permanece fixa (`view-transition-name: sidebar`) |
| Lista → detalhe | o `#número` do card "voa" até o título do chamado (shared element via `view-transition-name`) |
| Carregamento | skeleton com *shimmer* → conteúdo com fade |
| Listas e cards | entrada escalonada (*stagger* de 40 ms por item) |
| Stat cards | contagem de 0 → valor; *pulse* no card quando o valor muda em tempo real |
| Botões | leve escala no `:active` (0.97); spinner no loading |
| Hover em cards | elevação (translateY −2 px + borda na cor da marca) |
| Tabs | indicador desliza até a aba ativa |
| Toast | entra deslizando de baixo/canto, sai com fade; barra de progresso do tempo |
| Dialog | fundo com blur + card com *scale* 0.96 → 1 (`@starting-style`) |
| Chat | nova mensagem sobe com fade; auto-scroll suave |
| Troca de status | badge faz *crossfade* de cor; evento aparece na linha do tempo |
| Chamado criado | check SVG desenhado com `stroke-dashoffset` + confete discreto (opcional) |
| Erro de login | *shake* horizontal curto |
| Kanban | card levanta ao arrastar (sombra + rotação 2°), colunas destacam a zona de soltura |
| Login | gradiente de fundo se movendo lentamente |

---

## 8. Acessibilidade (checklist)
- [ ] `lang="pt-BR"` em todas as páginas; um `<h1>` por página; landmarks (`header`, `nav`, `main`).
- [ ] Todo `label` ligado ao seu campo; erros com `aria-describedby` e `aria-invalid`.
- [ ] Foco visível (`:focus-visible` com anel na cor da marca) e ordem lógica de tabulação.
- [ ] Link "Pular para o conteúdo".
- [ ] Toasts em região `aria-live="polite"`; erros em `role="alert"`.
- [ ] Status nunca comunicado só por cor (badge tem texto + ponto).
- [ ] Contraste AA (4.5:1 texto, 3:1 componentes) nos dois temas.
- [ ] Alvos de toque ≥ 44 × 44 px no mobile.
- [ ] Kanban com alternativa por teclado/menu ("Mover para…"), não só arrastar.
- [ ] Nova mensagem no chat anunciada para leitores de tela.

## 9. Performance
- Fontes com `font-display: swap` e *preconnect*; apenas os pesos usados (400/500/600/700).
- Ícones importados individualmente (tree-shaking do `lucide`).
- `chart.js` carregado só na página de relatórios (`import()` dinâmico).
- Consultas com `orderBy` + `limit` onde fizer sentido (dashboard).
- `session.js` guarda os dados do usuário em `sessionStorage` para não refazer a consulta de `users` a cada página.
- Meta: Lighthouse ≥ 90 em Performance e Acessibilidade.

---

## 10. Roteiro de execução

Cada fase entrega algo funcionando — dá para parar em qualquer uma.

### Fase 0 — Limpeza e fundação
- [ ] Iniciar git (`git init`) para versionar o redesign.
- [ ] Remover arquivos mortos (`fila.*` vazios, `login.html`, `javascript.js`, `style.css` da raiz, `Imagem/`). Guardar `javascript.js` fora do projeto se as anotações forem úteis.
- [ ] Configurar Vite (multi-página) e trocar Firebase CDN pelo pacote npm.
- [ ] Criar a estrutura `src/` da seção 3.3.
- [ ] Corrigir os bugs listados em 1.3.

### Fase 1 — Design system
- [ ] `tokens.css` (cores claro/escuro, tipografia, espaço, raio, motion), `reset.css`, `base.css`.
- [ ] Componentes CSS da seção 4.5.
- [ ] `toast.js`, `confirm.js`, `skeleton.js`, `status-badge.js`.
- [ ] `styleguide.html` com todos os estados.

### Fase 2 — Shell e dados
- [ ] `app-shell.js` (sidebar / rail / bottom-nav) com menu configurado por papel.
- [ ] `session.js` (guard único, com cache) e `theme.js`.
- [ ] `services/chamados.js` e `services/mensagens.js` extraindo toda a lógica do Firestore das páginas.
- [ ] `utils/format.js` e `utils/constants.js`.

### Fase 3 — Telas existentes
- [ ] Login → Dashboard → Abrir chamado → Lista → Detalhe (nessa ordem, cada uma já com loading/vazio/erro e responsiva).
- [ ] Trocar todos os `alert()` por toasts/dialogs.

### Fase 4 — Movimento
- [ ] View Transitions entre páginas + shared element lista → detalhe.
- [ ] Micro-interações e entradas escalonadas (tabela 7.2).
- [ ] Auditoria de `prefers-reduced-motion`.

### Fase 5 — Novas funcionalidades
- [ ] Kanban (`fila.html`).
- [ ] Busca, filtros e ordenação com estado na URL.
- [ ] Paleta de comandos `Ctrl+K` (buscar chamado por número/título, navegar, trocar tema).
- [ ] Configurações (tema, reduzir animações, densidade).

### Fase 6 — Relatórios e acabamento
- [ ] Página de relatórios com gráficos.
- [ ] Revisão de acessibilidade (seção 8) e Lighthouse (seção 9).
- [ ] Testes de ponta a ponta com Playwright nos fluxos principais (login, abrir chamado, assumir, resolver, conversar) em desktop e mobile.

---

## 11. Ideias extras (backlog)
- **Notificações:** sino na topbar com contador (via `onSnapshot`) quando alguém responde seu chamado; opcionalmente Notification API do navegador.
- **Indicador de SLA:** barra de tempo por prioridade (ex.: Muito Alta = 4 h) mudando de verde para vermelho.
- **Avaliação do atendimento:** ao resolver, o solicitante dá 1–5 estrelas (alimenta os relatórios).
- **Respostas prontas** para técnicos no chat.
- **Anexos/prints** no chamado (depende do Firebase Storage — fase de backend).
- **PWA:** instalável no celular, com ícone e tela de splash.
- **Atalhos de teclado:** `N` novo chamado, `/` busca, `G` + `D` dashboard.
- **Onboarding:** tour rápido na primeira visita.

## 12. Para a fase de backend (anotado, não fazer agora)
- `session.js` hoje baixa **todos** os usuários para achar um por e-mail — trocar por `doc(db, "users", uid)`.
- Conteúdo do usuário é inserido com `innerHTML` (risco de XSS) — no redesign, já usar `textContent`/criação de elementos, o que resolve de graça.
- Regras de segurança do Firestore por papel.
- Normalizar nomes de campos (`Nome`/`Email` com maiúscula vs. `usuarioNome` em camelCase) e a coleção `Configurações` (acento no ID).
