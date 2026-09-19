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
        rollupOptions: {
            input: Object.fromEntries(
                paginas.map((nome) => [nome, resolve(import.meta.dirname, `${nome}.html`)])
            ),
        },
    },
});
