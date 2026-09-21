# HelpDesk — Sistema de Chamados

Projeto de estudo de um **sistema de chamados de suporte** (help desk).
Um usuário abre um chamado ("minha impressora não funciona"), um técnico assume, os dois conversam pelo chat do chamado e, no fim, o técnico marca como resolvido. Tudo atualiza **em tempo real** na tela de todo mundo.

- **Front-end:** HTML, CSS e JavaScript puro (sem React/Vue), organizado com [Vite](https://vite.dev).
- **Back-end:** [Firebase](https://firebase.google.com) — *Authentication* (login) e *Firestore* (banco de dados).
- **Visual:** tema claro e escuro, responsivo (celular → desktop), animações e transições entre páginas.

---

## Sumário

1. [O que o sistema faz](#1-o-que-o-sistema-faz)
2. [Antes de começar: o que instalar](#2-antes-de-começar-o-que-instalar)
3. [Rodando o projeto pela primeira vez](#3-rodando-o-projeto-pela-primeira-vez)
4. [Por que `localhost/helpdesk` não funciona?](#4-por-que-localhosthelpdesk-não-funciona)
5. [Publicando no XAMPP (build)](#5-publicando-no-xampp-build)
6. [Comandos disponíveis](#6-comandos-disponíveis)
7. [Dados no Firebase](#7-dados-no-firebase)
8. [Estrutura de pastas](#8-estrutura-de-pastas)
9. [Problemas comuns](#9-problemas-comuns)
10. [Para continuar estudando](#10-para-continuar-estudando)

---

## 1. O que o sistema faz

Existem três perfis de acesso (papéis):

| Papel | O que pode fazer |
|---|---|
| **usuario** | Abrir chamados, ver **os próprios** chamados e conversar com o técnico |
| **tecnico** | Tudo do usuário + ver **todos** os chamados, assumir, resolver e usar a Fila (Kanban) |
| **admin** | Tudo do técnico + página de Relatórios |

### Páginas

| Página | Quem acessa | Para que serve |
|---|---|---|
| `index.html` | qualquer um | Login |
| `dashboard.html` | todos | Resumo em tempo real, chamados recentes e fila aguardando |
| `abrir-chamado.html` | todos | Formulário de novo chamado (salva rascunho sozinho) |
| `chamados.html` | todos | Lista com busca, filtros e ordenação |
| `chamado.html?id=...` | dono do chamado, técnico, admin | Detalhes, linha do tempo, chat e ações |
| `fila.html` | técnico, admin | Quadro Kanban: arraste o card para mudar o status |
| `relatorios.html` | admin | Indicadores, gráficos e exportação para CSV |
| `configuracoes.html` | todos | Tema, animações, densidade e atalhos |
| `styleguide.html` | desenvolvimento | Vitrine de todos os componentes visuais |

**Atalhos de teclado:** `Ctrl + K` (ou `/`) abre a busca rápida · `Ctrl + Enter` envia o chamado · `Enter` envia mensagem no chat (`Shift + Enter` quebra linha).

---

## 2. Antes de começar: o que instalar

Você precisa de **uma** coisa obrigatória e duas opcionais:

| Programa | Obrigatório? | Para quê | Como conferir |
|---|---|---|---|
| **[Node.js](https://nodejs.org)** versão **20.19+ ou 22.12+** (baixe a versão *LTS*) | ✅ Sim | Roda o Vite e instala as bibliotecas. Já vem com o **npm**. | `node -v` e `npm -v` no terminal |
| **XAMPP** | Opcional | Só se quiser abrir a versão final por `localhost/helpdesk/dist/` | — |
| **Git** | Opcional | Histórico de versões do projeto | `git --version` |

> 💡 **O que é o npm?** É o "gerenciador de pacotes" do Node. Ele lê o arquivo `package.json`, baixa as bibliotecas que o projeto usa (Firebase, Vite, ícones, gráficos) para a pasta `node_modules/` e roda os comandos do projeto (`npm run dev`, `npm run build`).

---

## 3. Rodando o projeto pela primeira vez

### Passo 1 — Abra um terminal **dentro da pasta do projeto**

- **VS Code:** menu *Terminal → New Terminal* (já abre na pasta certa).
- **Windows Explorer:** entre na pasta `C:\xampp\htdocs\helpdesk`, clique na barra de endereço, digite `cmd` e aperte Enter.

Confira que está no lugar certo: o comando `dir` (Windows) ou `ls` deve listar o arquivo `package.json`.

### Passo 2 — Instale as dependências (só na primeira vez)

```bash
npm install
```

Isso cria a pasta `node_modules/`. Pode demorar um pouco. Avisos amarelos (`warn`) são normais; só se preocupe com erros vermelhos (`ERR!`).

> Só precisa repetir este passo se apagar a `node_modules/` ou se o `package.json` mudar.

### Passo 3 — Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Vai aparecer algo assim:

```
  VITE v8.x.x  ready in 362 ms

  ➜  Local:   http://localhost:5173/
```

### Passo 4 — Abra no navegador

Acesse **http://localhost:5173** e faça login com um usuário cadastrado no Firebase (veja a [seção 7](#7-dados-no-firebase)).

✨ Agora, toda vez que você salvar um arquivo `.html`, `.css` ou `.js`, a página atualiza sozinha (*hot reload*).

### Passo 5 — Para parar

No terminal, aperte `Ctrl + C`.

> ✅ **Resumo do dia a dia:** abrir o terminal na pasta → `npm run dev` → abrir `http://localhost:5173`.

---

## 4. Por que `localhost/helpdesk` não funciona?

Se você abrir `http://localhost/helpdesk` pelo XAMPP, a tela aparece **sem nenhum estilo** e o login não funciona. Isso é esperado. Os arquivos da raiz são **código-fonte**, e o Apache (servidor do XAMPP) não sabe prepará-los:

1. As páginas carregam o CSS de `/src/styles/main.css`. Para o Apache, a barra inicial significa "a partir da raiz do servidor", ou seja, `localhost/src/...`, fora da pasta do projeto → **erro 404**.
2. O JavaScript usa imports como `import { getAuth } from "firebase/auth"`. O navegador não sabe onde fica `"firebase/auth"`; quem traduz isso para um arquivo de verdade é o **Vite**.

Por isso existem dois jeitos corretos de abrir o projeto:

| Situação | Use | Endereço |
|---|---|---|
| Estou **programando/estudando** | `npm run dev` | http://localhost:5173 |
| Quero a **versão final** no XAMPP | `npm run build` | http://localhost/helpdesk/dist/ |

---

## 5. Publicando no XAMPP (build)

O *build* transforma o código-fonte em arquivos prontos para qualquer servidor: junta e minifica o CSS/JS, resolve os imports e grava tudo na pasta **`dist/`**.

```bash
npm run build
```

Depois, com o Apache ligado no painel do XAMPP, acesse:

**http://localhost/helpdesk/dist/**

> ⚠️ A pasta `dist/` é uma **cópia gerada**. Nunca edite arquivos dentro dela: altere os arquivos da raiz/`src/` e rode `npm run build` de novo.

Quer testar o build sem o XAMPP? Rode `npm run preview` e abra o endereço que aparecer (normalmente http://localhost:4173).

---

## 6. Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm install` | Baixa as dependências para `node_modules/` (primeira vez) |
| `npm run dev` | Servidor de desenvolvimento com atualização automática — **use no dia a dia** |
| `npm run build` | Gera a versão final em `dist/` |
| `npm run preview` | Serve a pasta `dist/` localmente para conferir o build |

---

## 7. Dados no Firebase

A configuração do projeto Firebase fica em `src/js/core/firebase.js`. O sistema usa estas coleções no **Firestore**:

### `users` — cadastro dos perfis

Cada pessoa precisa **existir em dois lugares**:

1. Em **Authentication** (e-mail e senha — é isso que o login confere);
2. Na coleção **`users`** do Firestore, com o **mesmo e-mail**:

| Campo | Exemplo | Observação |
|---|---|---|
| `Nome` | `"Ana Souza"` | Com **N maiúsculo** |
| `Email` | `"ana@empresa.com"` | Com **E maiúsculo**, igual ao do Authentication |
| `role` | `"usuario"`, `"tecnico"` ou `"admin"` | Sempre em **minúsculas e sem espaços**. O app normaliza (`trim().toLowerCase()`), mas grave já normalizado para evitar que a página de Relatórios (só `admin`) volte sozinha para o dashboard |

> Se o login der certo no Authentication mas o e-mail não estiver em `users`, o sistema mostra "perfil não encontrado". Se o `role` estiver com maiúscula/espaço (`"Admin"`, `"tecnico "`) ou com outro texto, o perfil também é tratado como não encontrado e o login é desfeito — confira a grafia no Firestore.
> Depois de **trocar o papel de alguém no Firestore** (ex.: `usuario` → `admin`), a pessoa precisa **sair e entrar de novo**: o papel fica em cache em `sessionStorage` (`hd:perfil`) para a navegação não reconsultar o banco a cada página. A página de Relatórios ainda confere uma vez no servidor antes de redirecionar, justamente para aceitar uma promoção recente.

### `chamados` — os chamados

Criados pelo formulário. Campos principais: `numeroChamado`, `titulo`, `descricao`, `categoria`, `prioridade`, `status` (`aberto` → `analise` → `resolvido`), dados de quem abriu (`usuarioId`, `usuarioNome`, `usuarioEmail`), do técnico (`tecnicoId`, `tecnicoNome`) e datas (`dataCriacao`, `dataAssumido`, `dataResolucao`).

Cada chamado tem a subcoleção **`mensagens`** (o chat): `texto`, `usuarioId`, `usuarioNome`, `data`, `editada`.

**Regra do chat:** com o chamado em `aberto`, o técnico/admin **precisa assumir antes de conversar** (funções `precisaAssumirParaConversar()` / `podeConversarNoChamado()` em `services/chamados.js`). Na página `chamado.html`, o campo fica desativado com o aviso "Assuma o chamado para participar da conversa" e o envio é bloqueado com um toast. O dono do chamado (perfil `usuario`) sempre pode conversar no próprio chamado. Para valer também no servidor, reforce a mesma regra nas **regras do Firestore** (o front-end sozinho não impede escrita direta pelo console).

### `Configurações/Contadorchamados`

Guarda `ultimoNumero`, usado para numerar os chamados em sequência (#0001, #0002…). É criado automaticamente no primeiro chamado, se não existir.

---

## 8. Estrutura de pastas

```
helpdesk/
├── index.html, dashboard.html, ...   ← uma página HTML por tela
├── package.json                      ← dependências e comandos (npm)
├── vite.config.js                    ← lista de páginas para o build
├── public/                           ← arquivos copiados sem alteração (favicon)
├── src/
│   ├── styles/
│   │   ├── main.css                  ← junta todo o CSS em camadas (@layer)
│   │   ├── tokens.css                ← cores, fontes, espaçamentos, tempos de animação
│   │   ├── components/               ← botões, cards, formulários, tabelas...
│   │   └── pages/                    ← estilos exclusivos de cada página
│   └── js/
│       ├── core/                     ← Firebase, sessão/login, tema
│       ├── services/                 ← ÚNICO lugar que conversa com o banco
│       ├── components/               ← menu, toasts, diálogos, badges, busca Ctrl+K
│       ├── utils/                    ← criar elementos, formatar datas, ícones
│       └── pages/                    ← o JavaScript de cada página
├── docs/ARQUITETURA.md               ← convenções para criar/alterar páginas
├── estudos/                          ← anotações de estudo de JavaScript
├── node_modules/                     ← gerada pelo npm install (não editar)
└── dist/                             ← gerada pelo npm run build (não editar)
```

**Caminho de uma página**, usando o dashboard como exemplo:

1. `dashboard.html` tem a estrutura inicial (com "esqueletos" de carregamento) e chama `src/js/pages/dashboard.js`;
2. `dashboard.js` chama `iniciarPagina()`, que confere o login e desenha o menu;
3. depois pede os dados a `services/chamados.js`, que busca no Firestore;
4. e monta a tela com os componentes de `components/`.

---

## 9. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Página **sem estilo** | Abriu por `localhost/helpdesk` | Use `npm run dev` → `localhost:5173` ([seção 4](#4-por-que-localhosthelpdesk-não-funciona)) |
| `'npm' não é reconhecido como um comando` | Node.js não instalado, ou terminal aberto antes da instalação | Instale o Node.js e **abra um terminal novo** |
| `Cannot find module` / `vite: not found` | Faltou instalar as dependências | Rode `npm install` |
| Erro de versão do Node ao rodar o Vite | Node antigo | Instale o Node.js LTS (20.19+ ou 22.12+) |
| `Port 5173 is in use` | Outro `npm run dev` já está aberto | Feche o outro terminal ou use o endereço que o Vite sugerir |
| Login diz "perfil não encontrado" | E-mail não está na coleção `users` | Cadastre o documento em `users` ([seção 7](#7-dados-no-firebase)) |
| Login desloga logo após entrar | `role` com maiúscula, espaço ou valor fora de `usuario/tecnico/admin` | Corrija o campo `role` no Firestore (minúsculas, sem espaço) e entre de novo |
| Página de admin (Relatórios) volta sozinha para o Início | Papel ainda antigo no cache (`hd:perfil`) ou `role` grafado errado | Saia e entre de novo; confira o `role` no Firestore. A página tenta reconfirmar o papel no servidor uma vez antes de redirecionar |
| Técnico consegue ler mas o chat fica bloqueado em chamado aberto | Comportamento esperado após a correção | Clique em "Assumir chamado" — o chat libera em tempo real quando o status vira `analise` |
| Página volta sozinha para o Início | Seu papel não tem acesso a ela (ex.: usuário abrindo `fila.html`) | Comportamento esperado |
| `localhost/helpdesk/dist/` mostra versão antiga | O build não foi refeito | Rode `npm run build` de novo |
| Alterei algo em `dist/` e sumiu | `dist/` é recriada a cada build | Edite sempre `src/` e as páginas da raiz |

---

## 10. Docker (rodar igual produção, local ou VPS)

O Docker só entrega a pasta `dist/` com Nginx — o Firebase continua sendo o back-end. Não é preciso mudar código.

```bash
docker compose up --build
# abre http://localhost:8080
```

- `Dockerfile`: etapa 1 (`node:22-alpine`) roda `npm ci` + `npm run build`; etapa 2 (`nginx:alpine`) serve a `dist/` com `nginx.conf` (`try_files $uri $uri.html`, cache longo em `/assets/*`).
- `compose.yml`: sobe o serviço `helpdesk` em `8080:80` com `restart: unless-stopped`.
- Para atualizar: edite `src/` ou os `.html` da raiz, refaça `docker compose up --build`. Nunca edite `dist/`.

## 11. Netlify (hospedagem com deploy automático)

O `netlify.toml` já deixa configurado: comando `npm run build`, pasta `dist/`, cache longo em `/assets/*` e sem cache em `/*.html`.

1. Suba o projeto para o GitHub.
2. No Netlify: *Add new site → Import an existing project* → conecte o repositório. Ele detecta o `netlify.toml` sozinho.
3. Cada `git push` gera um deploy novo com URL própria de preview; o Firebase (Auth/Firestore) continua igual — só Confira se o domínio `*.netlify.app` está liberado onde precisar (ex.: domínios autorizados no Authentication, se usar).

> Docker e Netlify são alternativos: use o Docker para rodar local/VPS com controle total, e o Netlify para hospedar com CI/CD automático. Um não "cuida" do outro.

---

## 12. Para continuar estudando

- **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**: regras do projeto, esqueleto de uma página nova e a lista de componentes e funções disponíveis. Leia antes de criar uma tela.
- **`styleguide.html`** (em `npm run dev`: http://localhost:5173/styleguide.html): todos os componentes visuais funcionando, com botões para testar tema, animações e toasts. É público e não precisa de login.
- **Configurações** do app: experimente "Reduzir movimento" para ver como a interface se adapta a quem prefere menos animação.
