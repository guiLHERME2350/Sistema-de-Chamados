import { auth, db } from "./firebase-config.js";

import { verificarPermissao } from "./verificar-permissao.js";

import {
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    collection,
    serverTimestamp,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


// ======================================================
// FORMATAR DATA
// ======================================================

function formatarData(timestamp) {

    if (!timestamp) {
        return "";
    }

    const data = timestamp.toDate();

    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

}


// ======================================================
// VERIFICAR LOGIN E PERMISSÃO
// ======================================================

verificarPermissao(
    ["usuario", "tecnico", "admin"],

    async (usuario, dadosUsuario, role) => {

        console.log("================================");
        console.log("USUÁRIO LOGADO NO CHAMADO:");
        console.log("Nome:", dadosUsuario.Nome);
        console.log("E-mail:", dadosUsuario.Email);
        console.log("Permissão:", role);
        console.log("================================");


        // ==================================================
        // PEGAR ID DO CHAMADO NA URL
        // ==================================================

        const parametros =
            new URLSearchParams(
                window.location.search
            );


        const idChamado =
            parametros.get("id");


        console.log(
            "ID do chamado:",
            idChamado
        );


        if (!idChamado) {

            alert(
                "Chamado não encontrado."
            );

            window.location.href =
                "meuschamados.html";

            return;
        }


        // ==================================================
        // MENU
        // ==================================================

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


        // ==================================================
        // CONFIGURAR MENU DE ACORDO COM A PERMISSÃO
        // ==================================================

        if (role === "usuario") {

            menuAbrirChamado.style.display =
                "flex";

            menuMeusChamados.style.display =
                "flex";

            menuRelatorios.style.display =
                "none";

            menuConfiguracoes.style.display =
                "none";


            console.log(
                "Acesso de USUÁRIO"
            );

        }


        else if (role === "tecnico") {

            menuAbrirChamado.style.display =
                "flex";

            menuMeusChamados.style.display =
                "flex";

            menuRelatorios.style.display =
                "none";

            menuConfiguracoes.style.display =
                "flex";


            console.log(
                "Acesso de TÉCNICO"
            );

        }


        else if (role === "admin") {

            menuAbrirChamado.style.display =
                "flex";

            menuMeusChamados.style.display =
                "flex";

            menuRelatorios.style.display =
                "flex";

            menuConfiguracoes.style.display =
                "flex";


            console.log(
                "Acesso de ADMINISTRADOR"
            );

        }


        // ==================================================
        // BUSCAR CHAMADO
        // ==================================================

        try {

            const referencia =
                doc(
                    db,
                    "chamados",
                    idChamado
                );


            const resultado =
                await getDoc(
                    referencia
                );


            // ==================================================
            // VERIFICAR SE O CHAMADO EXISTE
            // ==================================================

            if (!resultado.exists()) {

                alert(
                    "Esse chamado não existe."
                );

                window.location.href =
                    "meuschamados.html";

                return;
            }


            const chamado =
                resultado.data();


            console.log(
                "Chamado encontrado:",
                chamado
            );


            // ==================================================
            // VERIFICAR ACESSO AO CHAMADO
            // ==================================================

            if (
                role === "usuario" &&
                chamado.usuarioId !== usuario.uid
            ) {

                alert(
                    "Você não tem permissão para acessar este chamado."
                );

                window.location.href =
                    "meuschamados.html";

                return;
            }


            // ==================================================
            // PREENCHER DADOS DO CHAMADO
            // ==================================================

            document.getElementById(
                "chamadoexecucao"
            ).textContent =
                chamado.numeroChamado || "-";


            document.getElementById(
                "tituloChamado"
            ).textContent =
                chamado.titulo || "-";


            document.getElementById(
                "categoriaChamado"
            ).textContent =
                chamado.categoria || "-";


            document.getElementById(
                "prioridadeChamado"
            ).textContent =
                chamado.prioridade || "-";


            document.getElementById(
                "statusChamado"
            ).textContent =
                chamado.status || "-";


            document.getElementById(
                "descricaoChamado"
            ).textContent =
                chamado.descricao || "-";


            // ==================================================
            // AÇÕES DO TÉCNICO
            // ==================================================

            const acoesTecnico =
                document.getElementById(
                    "acoesTecnico"
                );


            const btnAssumirChamado =
                document.getElementById(
                    "btnAssumirChamado"
                );


            const btnResolverChamado =
                document.getElementById(
                    "btnResolverChamado"
                );


            // Esconder para usuário comum

            if (role === "usuario") {

                acoesTecnico.style.display =
                    "none";

            }


            // Mostrar para técnico/admin

            else {

                acoesTecnico.style.display =
                    "block";


                // ==========================================
                // CONFIGURAR BOTÕES CONFORME O STATUS
                // ==========================================

                if (chamado.status === "aberto") {

                    btnAssumirChamado.style.display =
                        "inline-block";

                    btnResolverChamado.style.display =
                        "none";

                }


                else if (chamado.status === "analise") {

                    btnAssumirChamado.style.display =
                        "none";

                    btnResolverChamado.style.display =
                        "inline-block";

                }


                else if (chamado.status === "resolvido") {

                    btnAssumirChamado.style.display =
                        "none";

                    btnResolverChamado.style.display =
                        "none";

                }


                // ==========================================
                // ASSUMIR CHAMADO
                // ==========================================

                btnAssumirChamado.addEventListener(
                    "click",
                    async () => {

                        try {

                            await updateDoc(
                                referencia,
                                {
                                    status: "analise",

                                    tecnicoId:
                                        usuario.uid,

                                    tecnicoNome:
                                        dadosUsuario.Nome,

                                    dataAssumido:
                                        serverTimestamp()
                                }
                            );


                            alert(
                                "Chamado assumido com sucesso!"
                            );


                            console.log(
                                "Chamado assumido pelo técnico:",
                                dadosUsuario.Nome
                            );


                            // Atualizar tela

                            document.getElementById(
                                "statusChamado"
                            ).textContent =
                                "analise";


                            btnAssumirChamado.style.display =
                                "none";


                            btnResolverChamado.style.display =
                                "inline-block";


                        } catch (error) {

                            console.error(
                                "Erro ao assumir chamado:",
                                error
                            );


                            alert(
                                "Não foi possível assumir o chamado."
                            );

                        }

                    }
                );


                // ==========================================
                // RESOLVER CHAMADO
                // ==========================================

                btnResolverChamado.addEventListener(
                    "click",
                    async () => {

                        try {

                            await updateDoc(
                                referencia,
                                {
                                    status: "resolvido",

                                    dataResolucao:
                                        serverTimestamp()
                                }
                            );


                            alert(
                                "Chamado resolvido com sucesso!"
                            );


                            console.log(
                                "Chamado resolvido."
                            );


                            // Atualizar tela

                            document.getElementById(
                                "statusChamado"
                            ).textContent =
                                "resolvido";


                            btnResolverChamado.style.display =
                                "none";


                        } catch (error) {

                            console.error(
                                "Erro ao resolver chamado:",
                                error
                            );


                            alert(
                                "Não foi possível resolver o chamado."
                            );

                        }

                    }
                );

            }


            // ==================================================
            // FORMULÁRIO DE MENSAGEM
            // ==================================================

            const formMensagem =
                document.getElementById(
                    "formMensagem"
                );


            formMensagem.addEventListener(
                "submit",
                async (event) => {

                    event.preventDefault();


                    const campoMensagem =
                        document.getElementById(
                            "mensagem"
                        );


                    const texto =
                        campoMensagem.value.trim();


                    if (!texto) {

                        alert(
                            "Digite uma mensagem."
                        );

                        return;
                    }


                    try {

                        await addDoc(

                            collection(
                                db,
                                "chamados",
                                idChamado,
                                "mensagens"
                            ),

                            {

                                texto:
                                    texto,

                                usuarioId:
                                    usuario.uid,

                                usuarioNome:
                                    dadosUsuario.Nome,

                                data:
                                    serverTimestamp()

                            }

                        );


                        console.log(
                            "Mensagem salva com sucesso!"
                        );


                        campoMensagem.value =
                            "";


                    } catch (error) {

                        console.error(
                            "Erro ao salvar mensagem:",
                            error
                        );


                        alert(
                            "Não foi possível enviar a mensagem."
                        );

                    }

                }
            );


            // ==================================================
            // REFERÊNCIA DAS MENSAGENS
            // ==================================================

            const mensagensRef =
                collection(
                    db,
                    "chamados",
                    idChamado,
                    "mensagens"
                );


            // ==================================================
            // ORDENAR MENSAGENS
            // ==================================================

            const consultaMensagens =
                query(
                    mensagensRef,
                    orderBy(
                        "data",
                        "asc"
                    )
                );


            // ==================================================
            // ESCUTAR MENSAGENS
            // ==================================================

            onSnapshot(
                consultaMensagens,
                (resultado) => {

                    const areaMensagens =
                        document.getElementById(
                            "mensagens"
                        );


                    areaMensagens.innerHTML =
                        "";


                    resultado.forEach(
                        (documento) => {

                            const mensagem =
                                documento.data();


                            const div =
                                document.createElement(
                                    "div"
                                );


                            // ==========================================
                            // VERIFICAR SE A MENSAGEM É DO USUÁRIO
                            // ==========================================

                            const souEu =
                                mensagem.usuarioId ===
                                usuario.uid;


                            if (souEu) {

                                div.classList.add(
                                    "mensagem-minha"
                                );

                            }

                            else {

                                div.classList.add(
                                    "mensagem-tecnico"
                                );

                            }


                            // ==========================================
                            // DATA
                            // ==========================================

                            const dataMensagem =
                                formatarData(
                                    mensagem.data
                                );


                            // ==========================================
                            // INDICADOR DE EDITADA
                            // ==========================================

                            const mensagemEditada =
                                mensagem.editada
                                    ? " · editada"
                                    : "";


                            // ==========================================
                            // HTML DA MENSAGEM
                            // ==========================================

                            div.innerHTML = `

                                <strong>
                                    ${mensagem.usuarioNome || "Usuário"}
                                </strong>

                                <span class="data-mensagem">
                                    ${dataMensagem}${mensagemEditada}
                                </span>

                                <p>
                                    ${mensagem.texto || ""}
                                </p>

                                ${
                                    souEu
                                    ? `

                                        <button
                                            type="button"
                                            class="btn-editar"
                                            data-id="${documento.id}">

                                            Editar

                                        </button>

                                    `
                                    : ""
                                }

                            `;


                            areaMensagens.appendChild(
                                div
                            );

                        }
                    );


                    // ==================================================
                    // BOTÕES DE EDITAR
                    // ==================================================

                    const botoesEditar =
                        document.querySelectorAll(
                            ".btn-editar"
                        );


                    botoesEditar.forEach(
                        (botao) => {

                            botao.addEventListener(
                                "click",
                                () => {

                                    // ==================================
                                    // ID DA MENSAGEM
                                    // ==================================

                                    const idMensagem =
                                        botao.dataset.id;


                                    // ==================================
                                    // DIV DA MENSAGEM
                                    // ==================================

                                    const mensagemDiv =
                                        botao.parentElement;


                                    // ==================================
                                    // TEXTO ORIGINAL
                                    // ==================================

                                    const paragrafo =
                                        mensagemDiv.querySelector(
                                            "p"
                                        );


                                    const textoAtual =
                                        paragrafo.textContent;


                                    // ==================================
                                    // TRANSFORMAR TEXTO EM INPUT
                                    // ==================================

                                    paragrafo.innerHTML = `

                                        <input
                                            type="text"
                                            class="campo-editar"
                                            value="${textoAtual.replace(/"/g, "&quot;")}">

                                    `;


                                    // ==================================
                                    // ESCONDER BOTÃO EDITAR
                                    // ==================================

                                    botao.style.display =
                                        "none";


                                    // ==================================
                                    // CRIAR BOTÕES
                                    // ==================================

                                    const botoes =
                                        document.createElement(
                                            "div"
                                        );


                                    botoes.classList.add(
                                        "botoes-edicao"
                                    );


                                    botoes.innerHTML = `

                                        <button
                                            type="button"
                                            class="btn-salvar">

                                            Salvar

                                        </button>

                                        <button
                                            type="button"
                                            class="btn-cancelar">

                                            Cancelar

                                        </button>

                                    `;


                                    mensagemDiv.appendChild(
                                        botoes
                                    );


                                    // ==================================
                                    // PEGAR ELEMENTOS
                                    // ==================================

                                    const btnSalvar =
                                        botoes.querySelector(
                                            ".btn-salvar"
                                        );


                                    const btnCancelar =
                                        botoes.querySelector(
                                            ".btn-cancelar"
                                        );


                                    const campo =
                                        mensagemDiv.querySelector(
                                            ".campo-editar"
                                        );


                                    // ==================================
                                    // SALVAR EDIÇÃO
                                    // ==================================

                                    btnSalvar.addEventListener(
                                        "click",
                                        async () => {

                                            const novoTexto =
                                                campo.value.trim();


                                            if (!novoTexto) {

                                                alert(
                                                    "A mensagem não pode ficar vazia."
                                                );

                                                return;
                                            }


                                            try {

                                                const mensagemRef =
                                                    doc(
                                                        db,
                                                        "chamados",
                                                        idChamado,
                                                        "mensagens",
                                                        idMensagem
                                                    );


                                                await updateDoc(
                                                    mensagemRef,
                                                    {

                                                        texto:
                                                            novoTexto,

                                                        editada:
                                                            true,

                                                        dataEdicao:
                                                            serverTimestamp()

                                                    }
                                                );


                                                console.log(
                                                    "Mensagem editada com sucesso!"
                                                );


                                            } catch (error) {

                                                console.error(
                                                    "Erro ao editar mensagem:",
                                                    error
                                                );


                                                alert(
                                                    "Não foi possível editar a mensagem."
                                                );

                                            }

                                        }
                                    );


                                    // ==================================
                                    // CANCELAR EDIÇÃO
                                    // ==================================

                                    btnCancelar.addEventListener(
                                        "click",
                                        () => {

                                            paragrafo.textContent =
                                                textoAtual;


                                            botoes.remove();


                                            botao.style.display =
                                                "inline-block";

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );


        } catch (error) {

            console.error(
                "Erro ao carregar chamado:",
                error
            );

        }

    }
);


// ======================================================
// BOTÃO SAIR
// ======================================================

const btnSair =
    document.getElementById(
        "btnSair"
    );


btnSair.addEventListener(
    "click",
    async () => {

        try {

            await auth.signOut();

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