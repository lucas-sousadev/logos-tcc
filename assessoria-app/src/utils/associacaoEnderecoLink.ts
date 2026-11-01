export function normalizarSecaoAssociacao(caminho: string): string {
  return caminho.trim().replace(/\/+$/, "");
}

export function validarSecaoAssociacao(
  caminho: string,
  link: string
): string | null {
  const prefixo = normalizarSecaoAssociacao(caminho);

  if (!prefixo) {
    return "Informe a seção do site, como /agro.";
  }

  let decodificado: string;

  try {
    decodificado = decodeURIComponent(prefixo);
  } catch {
    return "A seção contém uma codificação inválida.";
  }

  if (
    Array.from(prefixo).length > 300 ||
    !prefixo.startsWith("/") ||
    decodificado.includes("//") ||
    /[\s\\?#\x00-\x1f\x7f]/u.test(decodificado) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(decodificado)
  ) {
    return "Use uma seção como /agro, sem domínio ou parâmetros, com até 300 caracteres.";
  }

  // mantém o caminho como veio no link pra conferir também na API
  const caminhoLink =
    /^https?:\/\/[^/?#]+([^?#]*)/i.exec(link)?.[1] || "/";

  if (
    caminhoLink !== prefixo &&
    !caminhoLink.startsWith(prefixo + "/")
  ) {
    return "A seção precisa fazer parte do link consultado.";
  }

  return null;
}
