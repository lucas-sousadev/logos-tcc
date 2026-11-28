import {
  LARGURA_LINHA_TEXTO_SLIDE,
  LARGURAS_TEXTO_SLIDE,
} from "@/utils/relatorioTextoMetricas";

const MAXIMO_LINHAS = 5;
const LARGURA_LINHA = 48;
export const LIMITE_DESCRICAO_SLIDE = 200;

export function normalizarEscalaImagemSlide(valor: unknown) {
  return typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor >= 25 &&
    valor <= 100
    ? valor
    : 100;
}

function larguraTexto(texto: string) {
  return Array.from(texto).reduce(
    (total, caractere) =>
      total + (LARGURAS_TEXTO_SLIDE[caractere.codePointAt(0)! - 32] ?? 24),
    0
  );
}

function linhasCampo(texto: string, maximo: number) {
  const linhas: string[] = [];
  let linha = "";
  let abreviado = false;
  for (const caractere of texto.replace(/\s+/gu, " ").trim()) {
    if (larguraTexto(linha + caractere) > LARGURA_LINHA_TEXTO_SLIDE) {
      const espaco = linha.lastIndexOf(" ");
      linhas.push(espaco > 0 ? linha.slice(0, espaco) : linha);
      linha = espaco > 0 ? linha.slice(espaco + 1) : "";
      if (linhas.length === maximo) {
        let ultima = linhas[maximo - 1];
        while (larguraTexto(ultima + "…") > LARGURA_LINHA_TEXTO_SLIDE) {
          ultima = Array.from(ultima).slice(0, -1).join("");
        }
        linhas[maximo - 1] = ultima.trimEnd() + "…";
        abreviado = true;
        break;
      }
    }
    linha += caractere;
  }
  if (!abreviado && linha.trim()) linhas.push(linha.trim());
  return { linhas, abreviado };
}

export function calcularLayoutDadosSlide(
  nome?: string | null,
  descricao?: string | null,
  alcance?: string | null,
  temData = false
) {
  const valores = [
    {
      rotulo: "Veículo",
      valor: nome?.trim() || "Veículo não informado",
      maximo: 3,
    },
    { rotulo: "Descrição", valor: limitarDescricaoSlide(descricao), maximo: 6 },
    { rotulo: "Alcance", valor: alcance?.trim(), maximo: 3 },
  ];
  const campos = valores
    .filter((campo) => campo.valor)
    .map((campo) => {
      const quebrado = linhasCampo(
        `${campo.rotulo}: ${campo.valor}`,
        campo.maximo
      );
      return {
        rotulo: campo.rotulo,
        ...quebrado,
        altura: quebrado.linhas.length * 22,
      };
    });
  const altura =
    campos.reduce((total, campo) => total + campo.altura, 0) +
    (campos.length - 1) * 8;
  let topo = (temData ? 455 : 500) - altura;
  return campos.map((campo) => {
    const resultado = { ...campo, topo };
    topo += campo.altura + 8;
    return resultado;
  });
}

export function limitarDescricaoSlide(valor?: string | null) {
  const texto = valor?.replace(/\s+/gu, " ").trim() ?? "";
  const caracteres = Array.from(texto);

  return caracteres.length > LIMITE_DESCRICAO_SLIDE
    ? caracteres.slice(0, LIMITE_DESCRICAO_SLIDE - 1).join("") + "…"
    : texto;
}

// Mantém a mesma reserva de espaço usada na exportação do PPTX.
export function calcularLayoutLinkSlide(valor?: string | null) {
  const link = valor?.trim() ?? "";
  const linhas: string[] = [];
  let linha = "";
  let largura = 0;
  let abreviado = false;

  for (const caractere of link) {
    const peso = /[il1.:/\-_?=]/.test(caractere)
      ? 0.5
      : /[MWmw@#%&]|[^\x00-\x7F]/.test(caractere)
        ? 2
        : /[A-Z]/.test(caractere)
          ? 1.2
          : 1;

    if (largura + peso > LARGURA_LINHA) {
      linhas.push(linha);
      linha = "";
      largura = 0;
      if (linhas.length === MAXIMO_LINHAS) {
        linhas[MAXIMO_LINHAS - 1] =
          Array.from(linhas[MAXIMO_LINHAS - 1])
            .slice(0, -3)
            .join("") + "…";
        abreviado = true;
        break;
      }
    }
    linha += caractere;
    largura += peso;
  }

  if (linha) linhas.push(linha);

  const alturaLink = linhas.length * 20;
  const topoLink = 490 - alturaLink;
  const topoImagem = 70;
  const alturaImagem = Math.min(360, topoLink - topoImagem - 12);

  return {
    texto: linhas.join("\n"),
    abreviado,
    alturaLink,
    topoLink,
    topoImagem,
    alturaImagem,
  };
}
