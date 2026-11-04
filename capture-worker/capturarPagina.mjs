import {
  criarProxyCaptura,
  validarUrlCaptura as validarUrl,
} from "./proxyCaptura.mjs";
import { avaliarCaptura } from "./avaliarCaptura.mjs";
import {
  ALTURA_CAPTURA,
  PASSO_CAPTURA,
  MAX_TRECHO,
  alcanceCaptura,
} from "./limitesCaptura.mjs";
import { chromium } from "playwright";

const MENSAGEM_BLOQUEIO_403 =
  "O site bloqueou a captura automática (HTTP 403). " +
  "Se precisar da imagem, selecione um arquivo manualmente.";

function erroEntrada(mensagem) {
  const erro = new Error(mensagem);
  erro.status = 422;
  return erro;
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
          // tenta outro botão se esse não responder
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
          // segue com a captura mesmo se o aviso não responder
        }
      }
    }
  }
}

export async function capturar(link, trecho = 0, sinal) {
  if (
    !Number.isSafeInteger(trecho) ||
    trecho < 0 ||
    trecho > MAX_TRECHO
  ) {
    throw erroEntrada("Trecho da página inválido.");
  }

  sinal?.throwIfAborted();
  const endereco = await validarUrl(link);
  const host = endereco.hostname.toLowerCase();
  const ehYoutube =
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com");

  let navegador = null;
  let proxy = null;
  let erroExecucao = null;
  const limite = setTimeout(() => {
    erroExecucao = erroEntrada(
      "A captura excedeu o tempo de processamento. Tente novamente."
    );
    proxy?.interromper(erroExecucao);
    void navegador?.close().catch(() => { });
  }, 32_000);

  function cancelar() {
    erroExecucao = Object.assign(new Error("A captura foi cancelada."), {
      status: 409,
    });
    proxy?.interromper(erroExecucao);
    void navegador?.close().catch(() => { });
  }

  sinal?.addEventListener("abort", cancelar, { once: true });

  try {
    sinal?.throwIfAborted();
    proxy = await criarProxyCaptura({
      aoFalhar: () => {
        void navegador?.close().catch(() => { });
      },
    });
    await proxy.validarDestino(link);
    sinal?.throwIfAborted();
    navegador = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
      timeout: 8000,
      proxy: proxy.configuracao,
      args: [
        "--disable-quic",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
    });
    sinal?.throwIfAborted();

    if (proxy.falha || erroExecucao) throw proxy.falha ?? erroExecucao;

    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: ALTURA_CAPTURA },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
      acceptDownloads: false,
    });

    let requisicoes = 0;
    let recursosBloqueados = false;

    await contexto.route("**/*", async (rota) => {
      try {
        // não precisa baixar o vídeo pra tirar a captura
        if (rota.request().resourceType() === "media") {
          await rota.abort();
          return;
        }

        requisicoes += 1;

        if (requisicoes > 250) {
          recursosBloqueados = true;
          await rota.abort();
          return;
        }

        await validarUrl(rota.request().url());
        await rota.continue();
      } catch {
        recursosBloqueados = true;
        await rota.abort().catch(() => { });
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
        // ignora as respostas que não têm um frame associado
      }
    });

    function verificarBloqueio403() {
      if (proxy.falha || erroExecucao) throw proxy.falha ?? erroExecucao;
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
      // deixa recortar mesmo assim e avisa que pode faltar conteúdo
      incompleta = true;
    }

    verificarBloqueio403();
    // fecha os avisos que apareceram depois do carregamento
    await dispensarAvisoCookies(pagina);

    const inicio = trecho * PASSO_CAPTURA;

    // rola um pouco pra carregar as imagens próximas do trecho
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
      // avisa se a rolagem falhou porque algumas imagens podem não ter carregado
      incompleta = true;
    }

    verificarBloqueio403();
    const aviso = await avaliarCaptura(pagina, {
      inicio,
      altura,
      largura: 1280,
    });

    // usa as coordenadas da página mesmo se o site travar a rolagem
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
      incompleta:
        incompleta ||
        recursosBloqueados ||
        proxy.restricoes ||
        aviso !== null,
      aviso,
      ...alcanceCaptura(alturaFinalPagina, inicio, altura, trecho),
    };
  } catch (erro) {
    throw proxy?.falha ?? erroExecucao ?? erro;
  } finally {
    clearTimeout(limite);
    sinal?.removeEventListener("abort", cancelar);
    await Promise.allSettled([
      proxy?.fechar(),
      navegador?.close(),
    ]);
  }
}
