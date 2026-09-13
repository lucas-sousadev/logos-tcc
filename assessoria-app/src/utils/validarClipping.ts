import type { Tier } from "@/constants/tier";

export const MAX_DATA_PUBLICACAO = 10;
export const MAX_CATEGORIAS = 500;
export const MAX_PROGRAMA_SECAO = 150;
export const MAX_PAUTA = 2000;
export const MAX_LINK = 2048;
export const MAX_OBSERVACOES = 5000;
export const MAX_VEICULO = 150;

export type CampoClipping =
  | "cliente"
  | "dataPublicacao"
  | "categorias"
  | "programaSecao"
  | "pauta"
  | "veiculo"
  | "tier"
  | "inicioSegundos"
  | "fimSegundos"
  | "link"
  | "observacoes";

export type ErrosClipping = Partial<
  Record<CampoClipping, string>
>;

export interface DadosClippingParaValidacao {
  clienteId: number | null;
  anoReferencia: number;
  dataPublicacao: string;
  categorias: string;
  programaSecao: string;
  pauta: string;
  veiculoId: number | null;
  veiculoNome: string;
  tier: Tier | null;
  inicioSegundos: string;
  fimSegundos: string;
  link: string;
  observacoes: string;
}

function excede(
  valor: string,
  limite: number
): boolean {
  return Array.from(valor.trim()).length > limite;
}

function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const [ano, mes, dia] = valor
    .split("-")
    .map(Number);

  const data = new Date(
    Date.UTC(ano, mes - 1, dia)
  );

  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

function segundosValidos(valor: string): boolean {
  return /^\d+$/.test(valor.trim());
}

export function validarFormularioClipping(
  dados: DadosClippingParaValidacao
): ErrosClipping {
  const erros: ErrosClipping = {};

  if (
    dados.clienteId === null ||
    !Number.isInteger(dados.clienteId) ||
    dados.clienteId <= 0
  ) {
    erros.cliente = "Selecione o cliente do clipping.";
  }

  if (
    !Number.isInteger(dados.anoReferencia) ||
    dados.anoReferencia < 1
  ) {
    erros.dataPublicacao =
      "O ano de referência é inválido.";
  }

  const data = dados.dataPublicacao.trim();

  if (data) {
    if (!dataValida(data)) {
      erros.dataPublicacao =
        "Informe uma data válida no formato AAAA-MM-DD.";
    }
  }

  const categorias = dados.categorias
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    excede(
      dados.categorias,
      MAX_CATEGORIAS
    )
  ) {
    erros.categorias =
      `As categorias devem possuir no máximo ${MAX_CATEGORIAS} caracteres.`;
  }

  if (
    categorias.some(
      (categoria) =>
        Array.from(categoria).length > 100
    )
  ) {
    erros.categorias =
      "Cada categoria deve possuir no máximo 100 caracteres.";
  }

  if (
    excede(
      dados.programaSecao,
      MAX_PROGRAMA_SECAO
    )
  ) {
    erros.programaSecao =
      `O programa ou seção deve possuir no máximo ${MAX_PROGRAMA_SECAO} caracteres.`;
  }

  if (
    excede(dados.pauta, MAX_PAUTA)
  ) {
    erros.pauta =
      `A pauta deve possuir no máximo ${MAX_PAUTA} caracteres.`;
  }

  if (
    dados.veiculoId === null &&
    excede(dados.veiculoNome, MAX_VEICULO)
  ) {
    erros.veiculo =
      `O nome do veículo deve possuir no máximo ${MAX_VEICULO} caracteres.`;
  }

  if (
    dados.tier !== null &&
    (dados.tier < 1 || dados.tier > 3)
  ) {
    erros.tier = "O Tier deve estar entre 1 e 3.";
  }

  const inicio = dados.inicioSegundos.trim();
  const fim = dados.fimSegundos.trim();

  if (inicio && !segundosValidos(inicio)) {
    erros.inicioSegundos =
      "O início deve ser um número inteiro maior ou igual a zero.";
  }

  if (fim && !segundosValidos(fim)) {
    erros.fimSegundos =
      "O fim deve ser um número inteiro maior ou igual a zero.";
  }

  if (
    inicio &&
    fim &&
    segundosValidos(inicio) &&
    segundosValidos(fim) &&
    Number(fim) < Number(inicio)
  ) {
    erros.fimSegundos =
      "O fim não pode ser menor que o início.";
  }

  const link = dados.link.trim();

  if (link) {
    if (excede(link, MAX_LINK)) {
      erros.link =
        `O link deve possuir no máximo ${MAX_LINK} caracteres.`;
    } else if (!/^https?:\/\/\S+$/i.test(link)) {
      erros.link =
        "Informe um link válido iniciado por http:// ou https://.";
    }
  }

  if (
    excede(
      dados.observacoes,
      MAX_OBSERVACOES
    )
  ) {
    erros.observacoes =
      `As observações devem possuir no máximo ${MAX_OBSERVACOES} caracteres.`;
  }

  return erros;
}