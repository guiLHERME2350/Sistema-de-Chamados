import { auth, db } from "./firebase-config.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";


export function verificarPermissao(
    permissoesPermitidas,
    callback
) {

    // ==========================
    // COMPATIBILIDADE
    // ==========================

    // Se a função foi chamada no formato antigo:
    //
    // verificarPermissao(callback)
    //
    // libera todas as permissões.

    if (typeof permissoesPermitidas === "function") {

        callback = permissoesPermitidas;

        permissoesPermitidas = [
            "usuario",
            "tecnico",
            "admin"
        ];
    }


    onAuthStateChanged(auth, async (usuario) => {

        // ==========================
        // VERIFICAR LOGIN
        // ==========================

        if (!usuario) {

            window.location.href = "index.html";

            return;
        }


        try {

            // ==========================
            // BUSCAR USUÁRIOS
            // ==========================

            const usuariosSnapshot =
                await getDocs(
                    collection(db, "users")
                );


            const emailAtual =
                usuario.email
                    ?.trim()
                    .toLowerCase();


            // ==========================
            // ENCONTRAR USUÁRIO LOGADO
            // ==========================

            const usuarioEncontrado =
                usuariosSnapshot.docs.find(
                    (documento) => {

                        const dados =
                            documento.data();


                        const emailBanco =
                            String(
                                dados.Email || ""
                            )
                            .trim()
                            .toLowerCase();


                        return emailBanco === emailAtual;

                    }
                );


            // ==========================
            // USUÁRIO NÃO ENCONTRADO
            // ==========================

            if (!usuarioEncontrado) {

                console.error(
                    "Usuário não encontrado na coleção users."
                );

                window.location.href =
                    "index.html";

                return;
            }


            // ==========================
            // DADOS DO USUÁRIO
            // ==========================

            const dadosUsuario =
                usuarioEncontrado.data();


            const role =
                dadosUsuario.role;


            console.log(
                "Usuário:",
                dadosUsuario.Nome
            );


            console.log(
                "Permissão:",
                role
            );


            // ==========================
            // VERIFICAR PERMISSÃO
            // ==========================

            if (
                !permissoesPermitidas.includes(role)
            ) {

                console.error(
                    "Acesso negado para:",
                    role
                );

                window.location.href =
                    "dashboard.html";

                return;
            }


            // ==========================
            // ACESSO LIBERADO
            // ==========================

            callback(
                usuario,
                dadosUsuario,
                role
            );


        } catch (error) {

            console.error(
                "Erro ao verificar permissão:",
                error
            );

        }

    });

}