import { auth, db } from "./firebase-config.js";

import { verificarPermissao } from "./verificar-permissao.js";

import {
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    collection,
    onSnapshot,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


// ==========================
// CARREGAR CHAMADOS
// ==========================

async function carregarChamados(usuario, role) {

    if (!usuario) {
        return;
    }

    const lista =
        document.getElementById("listaChamados");


    // ==========================
    // CONSULTA DOS CHAMADOS
    // ==========================

    let consulta;

    if (role === "usuario") {

        // Usuário vê somente os próprios chamados

        consulta = query(
            collection(db, "chamados"),
            where("usuarioId", "==", usuario.uid)
        );

    } else {

        // Técnico e administrador
        // podem visualizar todos

        consulta = query(
            collection(db, "chamados")
        );

    }


    const resultado =
        await getDocs(consulta);


    lista.innerHTML = "";


    if (resultado.empty) {

        lista.innerHTML =
            "<p>Nenhum chamado encontrado.</p>";

        return;
    }


    resultado.forEach((documento) => {

        const chamado =
            documento.data();


        const card =
            document.createElement("div");


        card.classList.add(
            "chamado-card"
        );


        card.innerHTML = `
            <h4>
                Chamado #${chamado.numeroChamado || documento.id}
            </h4>

            <p>
                <strong>Descrição:</strong>
                ${chamado.descricao}
            </p>

            <p>
                <strong>Status:</strong>
                ${chamado.status}
            </p>
        `;


        lista.appendChild(card);

    });

}


// ==========================
// RESUMO DOS CHAMADOS
// ==========================

function carregarResumo(usuario, role) {

    if (!usuario) {
        return;
    }


    let consulta;


    if (role === "usuario") {

        // ==========================
        // USUÁRIO
        // SOMENTE OS CHAMADOS DELE
        // ==========================

        consulta = query(
            collection(db, "chamados"),
            where("usuarioId", "==", usuario.uid)
        );

    } else {

        // ==========================
        // TÉCNICO / ADMIN
        // TODOS OS CHAMADOS
        // ==========================

        consulta = query(
            collection(db, "chamados")
        );

    }


    onSnapshot(consulta, (snapshot) => {

        let abertos = 0;
        let analise = 0;
        let resolvidos = 0;


        snapshot.forEach((documento) => {

            const chamado =
                documento.data();


            if (chamado.status === "aberto") {
                abertos++;
            }


            if (chamado.status === "analise") {
                analise++;
            }


            if (chamado.status === "resolvido") {
                resolvidos++;
            }

        });


        document.getElementById(
            "chamadosAbertos"
        ).textContent = abertos;


        document.getElementById(
            "chamadosAnalise"
        ).textContent = analise;


        document.getElementById(
            "chamadosResolvidos"
        ).textContent = resolvidos;

    });

}


// ==========================
// VERIFICAR LOGIN E PERMISSÃO
// ==========================

verificarPermissao(
    ["usuario", "tecnico", "admin"],

    (usuario, dadosUsuario, role) => {

        console.log("================================");
        console.log("USUÁRIO LOGADO NO DASHBOARD:");
        console.log("Nome:", dadosUsuario.Nome);
        console.log("E-mail:", dadosUsuario.Email);
        console.log("Permissão:", role);
        console.log("================================");


        // ==========================
        // SAUDAÇÃO
        // ==========================

        const saudacao =
            document.getElementById("saudacao");


        saudacao.textContent =
            `Olá, ${dadosUsuario.Nome}! 👋`;


        // ==========================
        // CHAMADOS RECENTES
        // ==========================

        carregarChamados(
            usuario,
            role
        );


        // ==========================
        // RESUMO
        // ==========================

        carregarResumo(
            usuario,
            role
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