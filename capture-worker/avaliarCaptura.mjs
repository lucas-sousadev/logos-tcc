export function analisarPaginaCaptura({ inicio, altura, largura }) {
  const prazo = performance.now() + 150;
  const areaCaptura = largura * altura;
  let limitada = false;
  const estilos = new WeakMap();

  function areaNoTrecho(retangulo) {
    const topo = Math.max(
      inicio,
      retangulo.top + window.scrollY
    );
    const fim = Math.min(
      inicio + altura,
      retangulo.bottom + window.scrollY
    );
    const esquerda = Math.max(0, retangulo.left);
    const direita = Math.min(largura, retangulo.right);

    return (
      Math.max(0, fim - topo) *
      Math.max(0, direita - esquerda)
    );
  }

  function visivel(elemento) {
    let atual = elemento;
    let primeiro = true;

    while (atual) {
      if (!noPrazo()) return false;

      let estilo = estilos.get(atual);

      if (!estilo) {
        estilo = getComputedStyle(atual);
        estilos.set(atual, estilo);
      }

      if (
        estilo.display === "none" ||
        Number(estilo.opacity) <= 0
      ) {
        return false;
      }

      // o filho pode restaurar visibility mas não a opacidade de um ancestral
      if (
        primeiro &&
        ["hidden", "collapse"].includes(estilo.visibility)
      ) {
        return false;
      }

      primeiro = false;
      atual = atual.parentElement;
    }

    return true;
  }

  function noPrazo() {
    if (performance.now() <= prazo) return true;

    limitada = true;
    return false;
  }

  if (!document.body) return "pouco_conteudo";

  const normalizar = (texto) =>
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const titulo = normalizar(document.title.slice(0, 300));
  const titulos = document.querySelectorAll("h1");
  let h1 = "";

  if (titulos.length > 20) limitada = true;

  for (
    let indice = 0;
    indice < Math.min(titulos.length, 20);
    indice += 1
  ) {
    if (!noPrazo()) break;

    const elemento = titulos[indice];

    if (
      visivel(elemento) &&
      areaNoTrecho(elemento.getBoundingClientRect()) > 0
    ) {
      h1 = normalizar(
        (elemento.textContent ?? "").slice(0, 300)
      );
      break;
    }
  }

  const mensagensBloqueio = [
    /^just a moment\b/,
    /^attention required\b/,
    /^checking (?:your|the) browser\b/,
    /^verificando (?:seu|o) navegador\b/,
    /^verify (?:you are|that you are) human\b/,
    /^verifique (?:se|que) voce e humano\b/,
    /^confirme que voce e humano\b/,
    /^(?:access denied|acesso negado)[.!]?$/,
  ];

  const tituloBloqueio = mensagensBloqueio.some(
    (mensagem) =>
      mensagem.test(titulo) || mensagem.test(h1)
  );

  const marcadores = document.querySelectorAll(
    "#challenge-running, #challenge-stage, " +
    "#cf-challenge-running, #challenge-form, #px-captcha"
  );

  let bloqueioVisivel = false;
  let bloqueioDominante = false;

  for (
    let indice = 0;
    indice < Math.min(marcadores.length, 12);
    indice += 1
  ) {
    if (!noPrazo()) break;

    const elemento = marcadores[indice];
    const area = areaNoTrecho(
      elemento.getBoundingClientRect()
    );

    if (area > 0 && visivel(elemento)) {
      bloqueioVisivel = true;
      bloqueioDominante ||= area / areaCaptura >= 0.45;
    }
  }

  let sobreposicao = false;

  const avisos = document.querySelectorAll(
    '[role="dialog"], dialog[open], [aria-modal="true"], ' +
    '[id*="cookie" i], [class*="cookie-banner" i], ' +
    '[id*="paywall" i], [class*="paywall" i], ' +
    '[class*="modal" i]'
  );

  for (
    let indice = 0;
    indice < Math.min(avisos.length, 32);
    indice += 1
  ) {
    if (!noPrazo()) break;

    const elemento = avisos[indice];
    const estilo = getComputedStyle(elemento);

    const dialogo = elemento.matches(
      '[role="dialog"], dialog[open], [aria-modal="true"]'
    );

    const area = areaNoTrecho(
      elemento.getBoundingClientRect()
    );

    if (
      area / areaCaptura >= 0.3 &&
      visivel(elemento) &&
      (
        dialogo ||
        ["fixed", "absolute", "sticky"].includes(
          estilo.position
        )
      )
    ) {
      sobreposicao = true;
      break;
    }
  }

  let areaVisual = 0;

  const imagens = document.querySelectorAll(
    "img, video, canvas, svg"
  );

  for (
    let indice = 0;
    indice < Math.min(imagens.length, 300);
    indice += 1
  ) {
    if (!noPrazo()) break;

    const elemento = imagens[indice];

    if (
      elemento.tagName === "IMG" &&
      (!elemento.complete || !elemento.naturalWidth)
    ) {
      continue;
    }

    if (
      elemento.tagName === "VIDEO" &&
      elemento.readyState < 2 &&
      !elemento.poster
    ) {
      continue;
    }

    if (
      elemento.tagName.toLowerCase() === "svg" &&
      !elemento.childElementCount
    ) {
      continue;
    }

    const area = areaNoTrecho(
      elemento.getBoundingClientRect()
    );

    if (area > 0 && visivel(elemento)) {
      areaVisual += area;
    }
  }

  const fundos = document.querySelectorAll(
    "body, main, article, section, [style], [class]"
  );

  for (
    let indice = 0;
    indice < Math.min(fundos.length, 100);
    indice += 1
  ) {
    if (!noPrazo()) break;

    const elemento = fundos[indice];
    const area = areaNoTrecho(
      elemento.getBoundingClientRect()
    );

    if (
      area > 0 &&
      visivel(elemento) &&
      getComputedStyle(elemento)
        .backgroundImage.includes("url(")
    ) {
      areaVisual += area;
    }
  }

  if (
    marcadores.length > 12 ||
    avisos.length > 32 ||
    imagens.length > 300 ||
    fundos.length > 100
  ) {
    limitada = true;
  }
  // limita a leitura porque a página pode ter milhares de elementos
  let caracteres = 0;
  let caracteresArtigo = 0;
  let areaTexto = 0;
  let visitados = 0;

  const textos = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  let texto;

  while ((texto = textos.nextNode())) {
    if (++visitados > 1500 || !noPrazo()) {
      limitada = true;
      break;
    }

    const elemento = texto.parentElement;
    const valor = texto.textContent.trim();

    if (
      !valor ||
      !elemento ||
      elemento.closest("script, style, noscript, template")
    ) {
      continue;
    }

    if (!visivel(elemento)) continue;

    const intervalo = document.createRange();
    intervalo.selectNodeContents(texto);

    const retangulos = intervalo.getClientRects();
    let area = 0;
    if (retangulos.length > 16) limitada = true;

    for (
      let indice = 0;
      indice < Math.min(retangulos.length, 16);
      indice += 1
    ) {
      area += areaNoTrecho(retangulos[indice]);
    }

    if (area > 0) {
      caracteres += Math.min(valor.length, 240);
      areaTexto += area;

      if (elemento.closest("article")) {
        caracteresArtigo += Math.min(valor.length, 240);
      }

      if (
        caracteres >= 1000 &&
        caracteresArtigo >= 240
      ) {
        break;
      }
    }
  }

  const possivelBloqueio =
    caracteresArtigo < 240 &&
    (
      bloqueioVisivel ||
      (caracteres < 1000 && tituloBloqueio)
    );

  if (
    bloqueioDominante ||
    (!limitada && possivelBloqueio)
  ) {
    return "bloqueio";
  }
  if (sobreposicao) return "sobreposicao";

  if (limitada && possivelBloqueio) {
    return "incerto";
  }

  // uma imagem ou gráfico grande também pode ser conteúdo útil sem muito texto
  if (areaVisual / areaCaptura >= 0.02) return null;

  if (limitada) {
    return caracteres >= 80 ? null : "incerto";
  }

  if (
    caracteres < 40 ||
    areaTexto / areaCaptura < 0.003
  ) {
    return "pouco_conteudo";
  }

  return null;
}

export async function avaliarCaptura(pagina, regiao) {
  try {
    return await pagina.evaluate(
      analisarPaginaCaptura,
      regiao
    );
  } catch {
    // a imagem ainda pode ser usada se não der pra conferir o conteúdo
    return "incerto";
  }
}
