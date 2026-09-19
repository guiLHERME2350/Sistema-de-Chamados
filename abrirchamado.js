import { auth, db } from "./firebase-config.js";

import { verificarPermissao } from "./verificar-permissao.js";

import {
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    addDoc,
    collection,
    serverTimestamp,
    doc,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


// ==========================
// NOME DO USUÁRIO
// ==========================

let nomeUsuario = "";


// ==========================
// VERIFICAR LOGIN
// ==========================

onAuthStateChanged(auth, (usuario) => {

    if (usuario) {

        console.log(
            "Usuário autenticado:",
            usuario.email
        );

    } else {

        console.log(
            "Usuário não está autenticado."
        );

        window.location.href = "index.html";

    }

});


// ==========================
// FORMULÁRIO
// ==========================

const formulario =
    document.getElementById("formularioChamado");


formulario.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const titulo =
            document
                .getElementById("titulo")
                .value
                .trim();


        const categoria =
            document
                .getElementById("categoria")
                .value
                .trim();


        const descricao =
            document
                .getElementById("descricao")
                .value
                .trim();


        const prioridade =
            document
                .getElementById("prioridade")
                .value
                .trim();


        // ==========================
        // VALIDAR CAMPOS
        // ==========================

        if (
            !titulo ||
            !categoria ||
            !descricao ||
            !prioridade
        ) {

            alert(
                "Preencha todos os campos!"
            );

            return;
        }


        try {

            const usuario =
                auth.currentUser;


            if (!usuario) {

                alert(
                    "Usuário não está logado."
                );

                return;
            }


            if (!nomeUsuario) {

                alert(
                    "Não foi possível identificar o nome do usuário."
                );

                return;
            }


            console.log(
                "Usuário logado:",
                usuario.email
            );

            console.log(
                "Nome:",
                nomeUsuario
            );


            // ==========================
            // CONTADOR DE CHAMADOS
            // ==========================

            const contadorRef =
                doc(
                    db,
                    "Configurações",
                    "Contadorchamados"
                );


            const numeroChamado =
                await runTransaction(
                    db,
                    async (transaction) => {

                        const contador =
                            await transaction.get(
                                contadorRef
                            );


                        const ultimoNumero =
                            contador.data()
                                .ultimoNumero;


                        const novoNumero =
                            ultimoNumero + 1;


                        transaction.update(
                            contadorRef,
                            {
                                ultimoNumero:
                                    novoNumero
                            }
                        );


                        return novoNumero;

                    }
                );


            console.log(
                "Número do chamado:",
                numeroChamado
            );


            // ==========================
            // CRIAR CHAMADO
            // ==========================

            const chamado =
                await addDoc(
                    collection(
                        db,
                        "chamados"
                    ),
                    {

                        numeroChamado:
                            numeroChamado,

                        titulo:
                            titulo,

                        categoria:
                            categoria,

                        descricao:
                            descricao,

                        prioridade:
                            prioridade,

                        status:
                            "aberto",

                        usuarioId:
                            usuario.uid,

                        usuarioNome:
                            nomeUsuario,

                        usuarioEmail:
                            usuario.email,

                        dataCriacao:
                            serverTimestamp()

                    }
                );


            console.log(
                "Chamado criado com sucesso!"
            );

            console.log(
                "ID do chamado:",
                chamado.id
            );

            console.log(
                "Nome salvo para o chamado:",
                nomeUsuario
            );


            alert(
                `Chamado criado com sucesso!\n\nNúmero do registro: ${numeroChamado}`
            );


            formulario.reset();

        } catch (error) {

            console.error(
                "Erro ao criar chamado:",
                error
            );

            alert(
                "Não foi possível criar o chamado."
            );

        }

    }
);


// ==========================
// BOTÃO SAIR
// ==========================

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


// ==========================
// VERIFICAR PERMISSÃO
// ==========================

verificarPermissao(
    [
        "usuario",
        "tecnico",
        "admin"
    ],

    (usuario, dadosUsuario, role) => {

        console.log(
            "================================"
        );

        console.log(
            "USUÁRIO LOGADO:"
        );

        console.log(
            "Nome:",
            dadosUsuario.Nome
        );

        console.log(
            "E-mail:",
            dadosUsuario.Email
        );

        console.log(
            "Permissão:",
            role
        );

        console.log(
            "================================"
        );


        // ==========================
        // GUARDAR NOME
        // ==========================

        nomeUsuario =
            dadosUsuario.Nome;


        console.log(
            "Nome disponível para o chamado:",
            nomeUsuario
        );


        // ==========================
        // MENU
        // ==========================

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


        // ==========================
        // USUÁRIO
        // ==========================

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


        // ==========================
        // TÉCNICO
        // ==========================

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


        // ==========================
        // ADMIN
        // ==========================

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

    }
);