import { resolve } from "node:path";
import { defineConfig } from "vite";

const paginas = [
    "index",
    "dashboard",
    "abrir-chamado",
    "chamados",
    "chamado",
    "fila",
    "relatorios",
    "configuracoes",
    "styleguide",
];

export default defineConfig({
    // Caminhos relativos: o build em dist/ funciona dentro do XAMPP (localhost/helpdesk/dist/)
    base: "./",
    build: {
        // Sem sourcemap em produção: o source não vai junto no deploy.
        sourcemap: false,
        // O maior chunk é o SDK do Firebase (Auth + Firestore, ~160 kB gzip), compartilhado e cacheado entre páginas
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            input: Object.fromEntries(
                paginas.map((nome) => [nome, resolve(import.meta.dirname, `${nome}.html`)])
            ),
        },
    },
});
