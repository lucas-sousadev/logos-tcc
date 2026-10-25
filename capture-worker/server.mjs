import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { chromium } from "playwright";

const porta = Number(process.env.CAPTURA_PORTA || 3777);
const segredo = process.env.CAPTURA_SEGREDO;

const ALTURA_CAPTURA = 1200;
const PASSO_CAPTURA = 250;
const MAX_TRECHO = 36;

const MENSAGEM_BLOQUEIO_403 =
  "O site bloqueou a captura automática (HTTP 403). " +
  "Se precisar da imagem, selecione um arquivo manualmente.";

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

async function dispensarAvisoCookies(pagina) {
  const botoesConhecidos = [
    "#onetrust-reject-all-handler",
    "#CybotCookiebotDialogBodyButtonDecline",
    "#didomi-notice-disagree-button",
    '[data-testid="uc-deny-all-button"]',
  ];

  const seletorAvisos = [
    "#onetrust-banner-sdk",
    "#CybotCookiebotDialog",
    '[id*="cookie-banner" i]',
    '[class*="cookie-banner" i]',
    '[id*="cookie-consent" i]',
    '[class*="cookie-consent" i]',
    '[role="dialog"][aria-label*="cookie" i]',
    '[role="dialog"][aria-label*="consent" i]',
  ].join(", ");

  const acoes = [
    /rejeitar|recusar|não aceitar|somente.*necessári|apenas.*necessári|reject|decline|only necessary|necessary only|rechazar/i,
    /^(fechar|close|cerrar|×|✕)$/i,
  ];

  const quadros = [
    pagina,
    ...pagina.frames()
      .filter((quadro) => quadro !== pagina.mainFrame())
      .slice(0, 4),
  ];

  for (const quadro of quadros) {
    for (const seletor of botoesConhecidos) {
      const botao = quadro.locator(seletor).first();

      if (await botao.isVisible().catch(() => false)) {
        try {
          await botao.click({ timeout: 700 });
          return;
        } catch {
          // Tenta outro botão.
        }
      }
    }

    const avisos = quadro.locator(seletorAvisos);
    const quantidade = Math.min(await avisos.count().catch(() => 0), 6);

    for (let indice = 0; indice < quantidade; indice += 1) {
      const aviso = avisos.nth(indice);

      if (!(await aviso.isVisible().catch(() => false))) continue;

      for (const acao of acoes) {
        const botao = aviso.getByRole("button", { name: acao }).first();

        if (!(await botao.isVisible().catch(() => false))) continue;

        try {
          await botao.click({ timeout: 700 });
          return;
        } catch {
          // mantém a captura disponível mesmo se o aviso não responde
        }
      }
    }
  }
}

async function capturar(link, trecho = 0) {
  if (
    !Number.isSafeInteger(trecho) ||
    trecho < 0 ||
    trecho > MAX_TRECHO
  ) {
    throw erroEntrada("Trecho da página inválido.");
  }

  const endereco = await validarUrl(link);
  const host = endereco.hostname.toLowerCase();
  const ehYoutube =
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com");

  const navegador = await chromium.launch({ headless: true });
  const limite = setTimeout(() => {
    void navegador.close();
  }, 32_000);

  try {
    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: ALTURA_CAPTURA },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
      acceptDownloads: false,
    });

    let requisicoes = 0;

    await contexto.route("**/*", async (rota) => {
      try {
        // Vídeos não são necessários para fotografar a página.
        if (rota.request().resourceType() === "media") {
          await rota.abort();
          return;
        }

        requisicoes += 1;

        if (requisicoes > 250) {
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
    let statusDocumento = null;

    pagina.on("response", (evento) => {
      try {
        if (
          evento.request().isNavigationRequest() &&
          evento.frame() === pagina.mainFrame()
        ) {
          statusDocumento = evento.status();
        }
      } catch {
        // Algumas respostas podem não estar associadas a um frame.
      }
    });

    function verificarBloqueio403() {
      if (statusDocumento === 403) {
        throw erroEntrada(MENSAGEM_BLOQUEIO_403);
      }
    }
    
    pagina.on("dialog", (dialogo) => {
      void dialogo.dismiss();
    });

    pagina.on("popup", (popup) => {
      void popup.close();
    });

        let resposta;

    try {
      resposta = await pagina.goto(link, {
        waitUntil: "commit",
        timeout: 14_000,
      });
    } catch (falha) {
      if (
        falha instanceof Error &&
        falha.name === "TimeoutError"
      ) {
        throw erroEntrada(
          "O site demorou para responder. Tente novamente."
        );
      }

      throw falha;
    }

    if (!resposta) {
      throw erroEntrada("A página não pôde ser aberta para captura.");
    }

    if (resposta.status() === 403) {
      throw erroEntrada(MENSAGEM_BLOQUEIO_403);
    }

    if (resposta.status() >= 400) {
      throw erroEntrada(
        `O site respondeu com HTTP ${resposta.status()}.`
      );
    }

    await pagina.waitForTimeout(350);
    await dispensarAvisoCookies(pagina);

    let incompleta = false;

    try {
      await pagina.waitForFunction(
        (youtube) => {
          if (youtube) {
            const titulo = document.querySelector(
              "ytd-watch-metadata h1, #above-the-fold h1"
            );

            return (
              (titulo?.textContent ?? "").trim().length >= 4
            );
          }

          const principal =
            document.querySelector(
              "article, main, [role='main']"
            ) ?? document.body;

          const texto = (
            principal?.innerText ?? ""
          ).trim();

          const titulo =
            principal?.querySelector("h1") ??
            document.querySelector("h1");

          return (
            (titulo?.textContent ?? "").trim().length >= 5 &&
            texto.length >= 100
          );
        },
        ehYoutube,
        {
          timeout: 6000,
          polling: 200,
        }
      );
    } catch {
      // Ainda permitimos conferir e recortar a imagem,
      // mas avisamos que o carregamento pode estar incompleto.
      incompleta = true;
    }

    verificarBloqueio403();
        // Dispensa avisos tardios antes de posicionar a página.
    await dispensarAvisoCookies(pagina);

    const inicio = trecho * PASSO_CAPTURA;

    // Tenta acionar o carregamento das imagens próximas ao trecho.
    await pagina.evaluate(
      async ({ posicao, altura }) => {
        const raiz =
          document.scrollingElement ?? document.documentElement;

        raiz.style.setProperty(
          "scroll-behavior",
          "auto",
          "important"
        );
        document.body?.style.setProperty(
          "scroll-behavior",
          "auto",
          "important"
        );

        window.scrollTo({
          top: posicao + altura / 2,
          behavior: "instant",
        });

        await new Promise((resolver) =>
          requestAnimationFrame(resolver)
        );

        window.scrollTo({
          top: posicao,
          behavior: "instant",
        });
      },
      { posicao: inicio, altura: ALTURA_CAPTURA }
    );

    try {
      await pagina.waitForFunction(
        (posicao) => {
          const imagens = Array.from(
            document.querySelectorAll("main img, article img")
          )
            .filter((imagem) => {
              const area = imagem.getBoundingClientRect();
              const topo = area.top + window.scrollY;

              return (
                topo < posicao + 1200 &&
                topo + area.height > posicao &&
                area.width >= 100 &&
                area.height >= 60
              );
            })
            .slice(0, 6);

          return imagens.every(
            (imagem) =>
              imagem.complete && imagem.naturalWidth > 0
          );
        },
        inicio,
        { timeout: 1500, polling: 200 }
      );
    } catch {
      incompleta = true;
    }

    const {
      alturaPagina,
      alturaJanela,
      posicaoReal,
    } = await pagina.evaluate(() => ({
      alturaPagina: Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        window.innerHeight
      ),
      alturaJanela: window.innerHeight,
      posicaoReal: window.scrollY,
    }));

    if (inicio > 0 && inicio >= alturaPagina - 80) {
      throw erroEntrada("Você chegou ao fim desta página.");
    }

    const altura = Math.min(
      ALTURA_CAPTURA,
      alturaPagina - inicio
    );

    const posicaoEsperada = Math.min(
      inicio,
      Math.max(0, alturaPagina - alturaJanela)
    );

    if (
      inicio > 0 &&
      Math.abs(posicaoReal - posicaoEsperada) > 80
    ) {
      // O recorte ainda pode funcionar, mas imagens carregadas
      // somente durante a rolagem podem estar ausentes.
      incompleta = true;
    }

    verificarBloqueio403();
    // Captura a faixa pelas coordenadas da página, mesmo quando
    // o site impede ou desfaz a rolagem da janela.
    const imagem = await pagina.screenshot({
      type: "jpeg",
      quality: 82,
      animations: "disabled",
      scale: "css",
      fullPage: true,
      clip: {
        x: 0,
        y: inicio,
        width: 1280,
        height: altura,
      },
      timeout: 6000,
    });

    verificarBloqueio403();
    
    if (imagem.length > 4 * 1024 * 1024) {
      throw erroEntrada("A captura ficou grande demais.");
    }

    const alturaFinalPagina = await pagina.evaluate(() =>
      Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      )
    );

    return {
      imagem,
      largura: 1280,
      altura,
      incompleta,
      temProxima:
        trecho < MAX_TRECHO &&
        alturaFinalPagina > inicio + altura + 50,
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

    const captura = await capturar(
      dados.link.trim(),
      dados.trecho ?? 0
    );

    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": captura.imagem.length,
      "X-Captura-Largura": captura.largura,
      "X-Captura-Altura": captura.altura,
      "Cache-Control": "no-store",
      "X-Captura-Incompleta": captura.incompleta ? "1" : "0",
      "X-Captura-Tem-Proxima": captura.temProxima ? "1" : "0",
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