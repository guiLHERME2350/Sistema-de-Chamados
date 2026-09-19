// Comandos e Sixtaxes basicas do JavaScript
// var: Antigo, tem escopo global ou de função inteira, e vaza de dentro de blocos, causando erros difíceis de achar.
//const: Moderno, tem escopo de bloco, mas o valor é fixo e não pode ser mudado após ser definido.


//Tipo de dados:

let nome = "Guilherme"; //String(texto)
console.log("Olá, " + nome + "!"); // print

let idade = 21; //Number(numeros)
console.log("Você tem " + idade + " anos"); // print

let eMaiorDeIdade = idade >=18; //Boolean(verdadeiro ou falso)
console.log("É maior de idade? "  + eMaiorDeIdade); //print

//null e undefined:

let telefone = null // a variavel está definida que o valor será nulo ou seja nada(null)
console.log("multiplicacao", telefone * 2); // print

console.log("Telefone", telefone); // print

let telefones; // a variavel ainda não foi definida (undefined)
console.log("Telefones", telefones); //print

console.log("multiplicacao", telefones * 2); // print

//Condição implicita ou explicita:

if(telefone){  //se telefone tiver algum valor ele vai printar o resultado a da multiplicação
    console.log("multiplicacao", telefone * 2); //print
}
else{ // se não vai printar que o telefone não existe pois o telefone não tem nenhum valor definido
    console.log("telefone não existe")
}


//typeof:
// O typeof é um operador do JavaScript que serve para descobrir o tipo de dado de uma variável ou de um valor. 
// Ele avalia o dado e retorna o resultado em formato de texto (uma string), ajudando a evitar erros no código ao garantir que você está lidando com o tipo certo de informação.


let numero = 1;
let numeroString = String(numero); // aqui a variavel tenta forçar o javascript modificar uma string(texto) para number(numero)


let stringNumero = "123"; // variavel declara que o valor da variavel é numero
let stringNumeroNumero = Number(stringNumero); // aqui a variavel tenta forçar o javascript modificar um number(numero) para uma string(texto)


let segundoNumero = (10).toString(); // aqui ele já utiliza uma maneira mais facil de modificar aquele valor declarado

console.log(typeof numero, numero);
console.log(typeof numeroString, numeroString); // aqui mostra qual tipo de dado o javascript está interpretando
console.log(typeof stringNumero, stringNumero);
console.log(typeof stringNumeroNumero, stringNumeroNumero);

// Variaveis:

//let , const, var

//let é usado para declarar variaveis que podem mudar de valor
//let tem escopo de bloco

let videogame = 3500;

videogame = videogame / 5;
console.log("O valor parcelado do videogame por mês fica :", videogame);

//const é usado para declarar variaveis que não podem ser mudadas
//const não pode ser declarada sem valor inicial

const Filmemiranha = "Bom demaize"; // apenas essa variavel retorna corretamente
//Filmemiranha = 123; // esse função vai retornar erro, pois o const não aceita mudança na variavel.
console.log("Avaliação do Filme é : ", Filmemiranha);

//var é usado para declarar variaveis que podem mudar de valor
//var tem escopo global ou de função

console.log("Nome var:", nomeVar);

for(var i = 0; i > 5; i++) { // for é utilizado para loop de varios valores 
    var nomeVar = "Guilherme";
    console.log("i dentro do for: ", i)
}

for(var i = 0; i > 5; i++) { // for é utilizado para loop de varios valores 
    var nomeVar = "Teste";
    console.log("i dentro do for: ", i)
}

console.log("Nome var: ", nomeVar);

let count = 0;
count++;
count++;
count--;
console.log("count" , count);  

console.log("é igual?" , 2
     == "1" ? "igual" : "diferente")

if(1 == "1"){
    console.log("É igual")
}
else{
    console.log("É diferente")
}

// == => compara valor (com coerção de tipos)
// === => compara valor e tipo (sem coerção de tipos)



//Operadores Logicos




const botaoenviar = document.getElementById("botaoenviar");

botaoenviar.addEventListener("click", () => {
    alert("Enviado com sucesso");
})