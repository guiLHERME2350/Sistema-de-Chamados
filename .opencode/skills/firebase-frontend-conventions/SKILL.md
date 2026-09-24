---
name: Firebase Frontend Conventions
description: Use ao mexer em Firestore/Auth/páginas deste helpdesk Vite+Firebase
---

# Firebase Frontend Conventions (helpdesk)

- Validação no service (`src/js/services/`): validar campos/permissão antes de chamar Firestore. Pages (`src/js/pages/`) só orquestram UI.
- Checagem de dono: leitura/escrita de chamado exige `auth.currentUser`; dono (`uid`) ou role `tecnico|admin` para intervir em chamado alheio.
- Nunca varrer a coleção `users`: ler por doc ID (`doc(db, "users", uid)`) ou query filtrada mínima. Sem `getDocs(users)` sem `where`/`limit`.
- Roles: `usuario|tecnico|admin` (ver `src/js/utils/constants.js` / `src/js/core/session.js`). Gatear UI e service pela role da sessão.
- Firebase v12 modular: `import { doc, getDoc, ... } from "firebase/firestore"`; `auth`/`db` vêm de `src/js/core/firebase.js`.
- Logs via `src/js/utils/logger.js`; nunca `console.*` direto em prod.
