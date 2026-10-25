import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { chromium } from "playwright";

const porta = Number(process.env.CAPTURA_PORTA || 3777);
const segredo = process.env.CAPTURA_SEGREDO;

if (!segredo || segredo.length < 32) {
  throw new Error("Configure CAPTURA_SEGREDO com pelo menos 32 caracteres.");
}

let ocupada = false;

function erroEntrada(mensagem) {
  const erro = new Error(mensagem);
  erro.status = 422;
  return erro;
}

function ipPublico(ip) {
  const partes = ip.split(".").map(Number);

  if (partes.length !== 4 || partes.some((parte) => parte < 0 || parte > 255)) {
    return false;
  }

  const [a, b, c] = partes;

  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) {
    return false;
  }
  if (a === 203 && b === 0 && c === 113) return false;

  return true;
}

async function validarUrl(valor) {
  let url;

  try {
    url = new URL(valor);
  } catch {
    throw erroEntrada("Informe um link válido.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.port ||
    valor.length > 2048
  ) {
    throw erroEntrada("Este endereço não pode ser capturado.");
  }

  const host = url.hostname.toLowerCase();

  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes(":")
  ) {
    throw erroEntrada("Este endereço não pode ser capturado.");
  }

  const enderecos = await lookup(host, {
    all: true,
    family: 4,
  });

  if (
    enderecos.length === 0 ||
    enderecos.some(({ address }) => !ipPublico(address))
  ) {
    throw erroEntrada("Este endereço não pode ser capturado.");
  }

  return url;
}

async function capturar(link) {
  await validarUrl(link);

  const navegador = await chromium.launch({ headless: true });
  const limite = setTimeout(() => {
    void navegador.close();
  }, 20_000);

  try {
    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
      acceptDownloads: false,
    });

    let requisicoes = 0;

    await contexto.route("**/*", async (rota) => {
      try {
        requisicoes += 1;

        if (
          requisicoes > 250 ||
          rota.request().resourceType() === "media"
        ) {
          await rota.abort();
          return;
        }

        await validarUrl(rota.request().url());
        await rota.continue();
      } catch {
        await rota.abort();
      }
    });

    await contexto.routeWebSocket("**/*", async (conexao) => {
      await conexao.close();
    });

    const pagina = await contexto.newPage();

    pagina.on("dialog", (dialogo) => {
      void dialogo.dismiss();
    });

    pagina.on("popup", (popup) => {
      void popup.close();
    });

    const resposta = await pagina.goto(link, {
      waitUntil: "domcontentloaded",
      timeout: 12_000,
    });

    if (!resposta || resposta.status() >= 400) {
      throw erroEntrada("A página não pôde ser aberta para captura.");
    }

    await pagina.waitForTimeout(1200);

    const alturaPagina = await pagina.evaluate(() =>
      Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      )
    );

    const altura = Math.max(1, Math.min(alturaPagina, 5000));

    const imagem = await pagina.screenshot({
      type: "jpeg",
      quality: 82,
      animations: "disabled",
      scale: "css",
      clip: {
        x: 0,
        y: 0,
        width: 1280,
        height: altura,
      },
      timeout: 6000,
    });

    if (imagem.length > 4 * 1024 * 1024) {
      throw erroEntrada("A captura ficou grande demais.");
    }

    return {
      imagem,
      largura: 1280,
      altura,
    };
  } finally {
    clearTimeout(limite);
    await navegador.close().catch(() => {});
  }
}

createServer(async (req, res) => {
  if (
    req.method !== "POST" ||
    req.url !== "/capturar" ||
    req.headers["x-captura-segredo"] !== segredo
  ) {
    res.writeHead(404).end();
    return;
  }

  if (ocupada) {
    res.writeHead(429).end("Já existe uma captura em andamento.");
    return;
  }

  ocupada = true;

  try {
    let corpo = "";

    for await (const trecho of req) {
      corpo += trecho;

      if (Buffer.byteLength(corpo) > 4096) {
        throw erroEntrada("A requisição é grande demais.");
      }
    }

    const dados = JSON.parse(corpo);

    if (typeof dados.link !== "string") {
      throw erroEntrada("Informe o link da página.");
    }

    const captura = await capturar(dados.link.trim());

    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": captura.imagem.length,
      "X-Captura-Largura": captura.largura,
      "X-Captura-Altura": captura.altura,
      "Cache-Control": "no-store",
    });

    res.end(captura.imagem);
  } catch (erro) {
    res.writeHead(erro.status || 502, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });

    res.end(
      JSON.stringify({
        message:
          erro.status === 422
            ? erro.message
            : "Não foi possível capturar esta página.",
      })
    );
  } finally {
    ocupada = false;
  }
}).listen(porta, "127.0.0.1", () => {
  console.log(`Captura disponível em 127.0.0.1:${porta}`);
});