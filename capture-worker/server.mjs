import { capturar } from "./capturarPagina.mjs";
import { criarServidorCaptura } from "./servidorCaptura.mjs";

function configurarInteiro(nome, padrao, minimo, maximo) {
  const valor =
    process.env[nome] === undefined
      ? padrao
      : Number(process.env[nome]);

  if (!Number.isSafeInteger(valor) || valor < minimo || valor > maximo) {
    throw new Error(`${nome} precisa ser um inteiro entre ${minimo} e ${maximo}.`);
  }

  return valor;
}

const porta = configurarInteiro("CAPTURA_PORTA", 3777, 1, 65535);

const { servidor, fila } = criarServidorCaptura({
  segredo: process.env.CAPTURA_SEGREDO,
  executar: ({ link, trecho }, sinal) => capturar(link, trecho, sinal),
  configuracaoFila: {
    concorrencia: configurarInteiro("CAPTURA_CONCORRENCIA", 1, 1, 4),
    maxFila: configurarInteiro("CAPTURA_FILA_MAXIMA", 12, 1, 100),
    esperaMs: configurarInteiro("CAPTURA_ESPERA_MS", 90_000, 10_000, 180_000),
  },
});

servidor.listen(porta, "127.0.0.1", () => {
  console.log(`Captura disponível em 127.0.0.1:${porta}`);
});

let encerrando = false;

async function encerrar() {
  if (encerrando) return;

  encerrando = true;
  servidor.close();

  await fila.fechar();
}

process.once("SIGINT", () => {
  void encerrar();
});

process.once("SIGTERM", () => {
  void encerrar();
});
