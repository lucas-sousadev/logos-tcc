import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { criarFilaCaptura, erroCaptura } from "./filaCaptura.mjs";
import { validarUrlCaptura } from "./proxyCaptura.mjs";

function json(res, status, dados) {
  const corpo = JSON.stringify(dados);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(corpo),
    "Cache-Control": "no-store",
  });

  res.end(corpo);
}

export function criarServidorCaptura({
  segredo,
  executar,
  configuracaoFila = {},
}) {
  if (typeof segredo !== "string" || segredo.length < 32) {
    throw new Error("Configure CAPTURA_SEGREDO com pelo menos 32 caracteres.");
  }

  const segredoEsperado = Buffer.from(segredo);
  const fila = criarFilaCaptura({ ...configuracaoFila, executar });

  const servidor = createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    const recebido = Buffer.from(String(req.headers["x-captura-segredo"] ?? ""));

    if (
      req.method !== "POST" ||
      recebido.length !== segredoEsperado.length ||
      !timingSafeEqual(recebido, segredoEsperado)
    ) {
      res.writeHead(404, { Connection: "close" }).end();
      return;
    }

    try {
      let corpo = "";

      for await (const parte of req) {
        corpo += parte;

        if (Buffer.byteLength(corpo) > 4096) {
          throw erroCaptura("A requisição é grande demais.", 413);
        }
      }

      let dados;

      try {
        dados = JSON.parse(corpo);
      } catch {
        throw erroCaptura("JSON inválido.", 400);
      }

      if (!dados || Array.isArray(dados) || typeof dados !== "object") {
        throw erroCaptura("Requisição inválida.");
      }

      const dono = dados.solicitante;

      if (
        !dono ||
        !Number.isSafeInteger(dono.assessoria_id) ||
        dono.assessoria_id < 1 ||
        !Number.isSafeInteger(dono.usuario_id) ||
        dono.usuario_id < 1 ||
        !["clipping", "relatorio"].includes(dono.origem)
      ) {
        throw erroCaptura("Solicitante da captura inválido.");
      }

      if (req.url === "/capturas") {
        if (typeof dados.link !== "string") {
          throw erroCaptura("Informe o link da página.");
        }

        const link = dados.link.trim();
        validarUrlCaptura(link);

        const trecho = dados.trecho ?? 0;

        if (!Number.isSafeInteger(trecho) || trecho < 0 || trecho > 36) {
          throw erroCaptura("Trecho da página inválido.");
        }

        json(res, 202, { captura: fila.adicionar({ link, trecho }, dono) });

        return;
      }

      const rota = /^\/capturas\/([a-f0-9-]{36})$/.exec(req.url ?? "");

      if (!rota) throw erroCaptura("Rota não encontrada.", 404);

      if (dados.acao === "cancelar") {
        json(res, 200, { captura: fila.cancelar(rota[1], dono) });
        return;
      }

      if (dados.acao !== "consultar") {
        throw erroCaptura("Ação de captura inválida.");
      }

      const resultado = fila.consultar(rota[1], dono);

      if (!resultado.imagem) {
        json(res, 202, { captura: resultado });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": resultado.imagem.length,
        "Cache-Control": "no-store",
        "X-Captura-Largura": resultado.largura,
        "X-Captura-Altura": resultado.altura,
        "X-Captura-Incompleta": resultado.incompleta ? "1" : "0",
        "X-Captura-Tem-Proxima": resultado.temProxima ? "1" : "0",
        "X-Captura-Aviso": resultado.aviso ?? "",
      });

      res.end(resultado.imagem);
    } catch (erro) {
      if (res.destroyed || res.headersSent) return;

      const status = [400, 404, 409, 413, 422, 429, 503].includes(erro?.status)
        ? erro.status
        : 502;

      json(res, status, {
        message:
          status === 502
            ? "Não foi possível capturar esta página."
            : erro.message,
      });
    }
  });

  servidor.requestTimeout = 8000;
  servidor.headersTimeout = 5000;
  servidor.keepAliveTimeout = 1000;
  servidor.maxConnections = 128;

  return {
    servidor,
    fila,
  };
}
