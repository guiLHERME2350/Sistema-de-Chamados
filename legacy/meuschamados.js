import { auth, db } from "./firebase-config.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import {
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { verificarPermissao } from "./verificar-permissao.js";


// =====================================================
// CARREGAR CHAMADOS
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    const tabela = document.getElementById("tabelaChamados");

    const btnFila = document.getElementById("btnFila");
    const btnHistorico = document.getElementById("btnHistorico");

    let filtroAtual = "fila";
    let chamadosCarregados = [];


    console.log("Tabela:", tabela);


    // =====================================================
    // FUNÇÃO PARA FORMATAR DATA
    // =====================================================

    function formatarData(timestamp) {

        if (!timestamp) {
            return "-";
        }

        const data = timestamp.toDate();

        return data.toLocaleString(
            "pt-BR",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    // =====================================================
    // MOSTRAR CHAMADOS NA TABELA
    // =====================================================

    function mostrarChamados() {

        tabela.innerHTML = "";

        const cabecalhoDataResolucao =
        document.getElementById("cabecalhoDataResolucao");

        if (filtroAtual === "historico") {

        cabecalhoDataResolucao.style.display = "table-cell";

        } else {

        cabecalhoDataResolucao.style.display = "none";

        }



        // =================================================
        // FILTRAR CHAMADOS
        // =================================================

        const chamadosFiltrados = chamadosCarregados.filter(
            (item) => {

                const chamado = item.chamado;


                // FILA DE ATENDIMENTO
                if (filtroAtual === "fila") {

                    return (
                        chamado.status === "aberto" ||
                        chamado.status === "analise"
                    );

                }


                // HISTÓRICO
                if (filtroAtual === "historico") {

                    return chamado.status === "resolvido";

                }


                return false;
            }
        );


        // =================================================
        // NENHUM CHAMADO
        // =================================================

        if (chamadosFiltrados.length === 0) {

            tabela.innerHTML = `
                <tr>
                    <td colspan="6">
                        ${
                            filtroAtual === "fila"
                                ? "Nenhum chamado na fila de atendimento."
                                : "Nenhum chamado no histórico."
                        }
                    </td>
                </tr>
            `;

            return;
        }


        // =================================================
        // MOSTRAR CHAMADOS
        // =================================================

        chamadosFiltrados.forEach((item) => {

            const documento = item.documento;
            const chamado = item.chamado;


            console.log("Chamado:", chamado);

            console.log(
                "Número:",
                chamado.numeroChamado
            );


            const linha = document.createElement("tr");


            linha.innerHTML = `

                <td>
                    <a href="chamado.html?id=${documento.id}">
                        #${chamado.numeroChamado}
                    </a>
                </td>

                <td>
                    ${chamado.titulo}
                </td>

                <td>
                    ${chamado.categoria}
                </td>

                <td>
                    ${chamado.prioridade}
                </td>

                <td>
                    ${formatarData(chamado.dataCriacao)}
                </td>

                <td class="data-resolucao" style="display: ${
                    filtroAtual === "historico"
                        ? "table-cell"
                        : "none"
                };">
                    ${formatarData(chamado.dataResolucao)}
                </td>

            `;


            tabela.appendChild(linha);

        });

    }


    // =====================================================
    // BUSCAR CHAMADOS NO FIRESTORE
    // =====================================================

    verificarPermissao(

        ["usuario", "tecnico", "admin"],

        async (usuario, dadosUsuario, role) => {

            console.log("================================");
            console.log("USUÁRIO LOGADO:");
            console.log("Nome:", dadosUsuario.Nome);
            console.log("E-mail:", dadosUsuario.Email);
            console.log("Permissão:", role);
            console.log("================================");


            try {

                let consulta;


                // ==========================================
                // USUÁRIO
                // ==========================================

                if (role === "usuario") {

                    console.log(
                        "Carregando apenas os chamados do usuário."
                    );


                    consulta = query(
                        collection(db, "chamados"),
                        where(
                            "usuarioId",
                            "==",
                            usuario.uid
                        )
                    );

                }


                // ==========================================
                // TÉCNICO
                // ==========================================

                else if (role === "tecnico") {

                    console.log(
                        "Carregando todos os chamados para o técnico."
                    );


                    consulta = query(
                        collection(db, "chamados")
                    );

                }


                // ==========================================
                // ADMIN
                // ==========================================

                else if (role === "admin") {

                    console.log(
                        "Carregando todos os chamados para o administrador."
                    );


                    consulta = query(
                        collection(db, "chamados")
                    );

                }


                // ==========================================
                // PERMISSÃO INVÁLIDA
                // ==========================================

                else {

                    console.error(
                        "Permissão inválida:",
                        role
                    );

                    window.location.href =
                        "dashboard.html";

                    return;
                }


                // ==========================================
                // BUSCAR CHAMADOS
                // ==========================================

                const resultado =
                    await getDocs(consulta);


                chamadosCarregados = [];


                resultado.forEach((documento) => {

                    chamadosCarregados.push({

                        documento: documento,

                        chamado: documento.data()

                    });

                });


                console.log(
                    "Total de chamados:",
                    chamadosCarregados.length
                );


                // Mostrar inicialmente a fila
                mostrarChamados();


            } catch (error) {

                console.error(
                    "Erro ao carregar chamados:",
                    error
                );

            }

        }

    );


    // =====================================================
    // BOTÃO FILA DE ATENDIMENTO
    // =====================================================

    btnFila.addEventListener(
        "click",
        () => {

            filtroAtual = "fila";


            btnFila.classList.add(
                "filtro-ativo"
            );

            btnHistorico.classList.remove(
                "filtro-ativo"
            );


            mostrarChamados();

        }
    );


    // =====================================================
    // BOTÃO HISTÓRICO
    // =====================================================

    btnHistorico.addEventListener(
        "click",
        () => {

            filtroAtual = "historico";


            btnHistorico.classList.add(
                "filtro-ativo"
            );

            btnFila.classList.remove(
                "filtro-ativo"
            );


            mostrarChamados();

        }
    );

});


// =====================================================
// BOTÃO SAIR
// =====================================================

const btnSair =
    document.getElementById("btnSair");


btnSair.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "index.html";


        } catch (error) {

            console.error(
                "Erro ao sair:",
                error
            );

        }

    }
);


// =====================================================
// CONFIGURAR MENU
// =====================================================

verificarPermissao(

    ["usuario", "tecnico", "admin"],

    (usuario, dadosUsuario, role) => {

        console.log("================================");
        console.log("CONFIGURANDO MENU");
        console.log("Nome:", dadosUsuario.Nome);
        console.log("Permissão:", role);
        console.log("================================");


        const menuAbrirChamado =
            document.getElementById(
                "menuAbrirChamado"
            );


        const menuMeusChamados =
            document.getElementById(
                "menuMeusChamados"
            );


        const menuRelatorios =
            document.getElementById(
                "menuRelatorios"
            );


        const menuConfiguracoes =
            document.getElementById(
                "menuConfiguracoes"
            );


        // ==========================================
        // USUÁRIO
        // ==========================================

        if (role === "usuario") {

            menuAbrirChamado.style.display =
                "flex";

            menuMeusChamados.style.display =
                "flex";

            menuRelatorios.style.display =
                "none";

            menuConfiguracoes.style.display =
                "none";


            menuMeusChamados
                .querySelector("p")
                .textContent =
                "Meus chamados";


            console.log(
                "Menu configurado para USUÁRIO"
            );

        }


        // ==========================================
        // TÉCNICO
        // ==========================================

        else if (role === "tecnico") {

            menuAbrirChamado.style.display =
                "flex";

            menuMeusChamados.style.display =
                "flex";

            menuRelatorios.style.display =
                "none";

            menuConfiguracoes.style.display =
                "flex";


            menuMeusChamados
                .querySelector("p")
                .textContent =
                "Chamados";


            console.log(
                "Menu configurado para TÉCNICO"
            );

        }


        // ==========================================
        // ADMIN
        // ==========================================

        else if (role === "admin") {

            menuAbrirChamado.style.display =
                "flex";

            menuMeusChamados.style.display =
                "flex";

            menuRelatorios.style.display =
                "flex";

            menuConfiguracoes.style.display =
                "flex";


            menuMeusChamados
                .querySelector("p")
                .textContent =
                "Chamados";


            console.log(
                "Menu configurado para ADMINISTRADOR"
            );

        }


        // ==========================================
        // PERMISSÃO INVÁLIDA
        // ==========================================

        else {

            menuAbrirChamado.style.display =
                "none";

            menuMeusChamados.style.display =
                "none";

            menuRelatorios.style.display =
                "none";

            menuConfiguracoes.style.display =
                "none";


            console.log(
                "Acesso NEGADO"
            );

        }

    }

);