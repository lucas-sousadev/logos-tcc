import type { Tier } from "@/constants/tier";
import {
  dataBRParaISO,
  validarTrecho,
} from "@/utils/clippingFormatacao";

export const MAX_DATA_PUBLICACAO = 10;
export const MAX_CATEGORIAS = 20;
export const MAX_CARACTERES_CATEGORIA = 80;
export const MAX_PROGRAMA_SECAO = 150;
export const MAX_PAUTA = 250;
export const MAX_LINK = 2048;
export const MAX_OBSERVACOES = 1500;
export const MAX_VEICULO = 150;

export type CampoClipping =
  | "cliente"
  | "anoReferencia"
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

export type ErrosClipping =
  Partial<Record<CampoClipping, string>>;

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

function excede(valor: string, limite: number): boolean {
  return Array.from(valor.trim()).length > limite;
}

export function obterAnoDaPublicacao(
  valor: string
): number | null {
  const iso = dataBRParaISO(valor);

  return iso ? Number(iso.slice(0, 4)) : null;
}

export function normalizarCategorias(
  texto: string
): string[] {
  const vistos = new Set<string>();

  return texto
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const chave = item.toLowerCase();

      if (!item || vistos.has(chave)) return false;

      vistos.add(chave);
      return true;
    });
}

function linkValido(texto: string): boolean {
  if (/[\s\\\u0000-\u001f\u007f]/.test(texto)) {
    return false;
  }

  const partes =
    /^https?:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(texto);

  if (!partes) return false;

  const autoridade = partes[1];
  const hostPorta = autoridade.slice(
    autoridade.lastIndexOf("@") + 1
  );

  const endereco =
    /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(
      hostPorta
    );

  if (!endereco) return false;

  const [, host, porta] = endereco;

  if (porta && Number(porta) > 65535) return false;

  // Verificação básica para endereços IPv6.
  // A API realiza a validação definitiva do endereço.
  if (host.startsWith("[")) {
    return host.includes(":");
  }

  return host
    .replace(/\.$/, "")
    .split(".")
    .every((parte) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(parte)
    );
}

export function identificarCampoErroClipping(
  mensagem: string
): CampoClipping | null {
  const texto = mensagem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\bcliente\b/.test(texto)) return "cliente";
  if (/\bano\b/.test(texto)) return "anoReferencia";
  if (/\bdata\b/.test(texto)) return "dataPublicacao";
  if (/\bcategorias?\b/.test(texto)) return "categorias";
  if (/\bprograma\b|\bsecao\b/.test(texto)) {
    return "programaSecao";
  }
  if (/\bpauta\b/.test(texto)) return "pauta";
  if (/\bveiculo\b/.test(texto)) return "veiculo";
  if (/\btier\b/.test(texto)) return "tier";

  // A mensagem de fim inválido também menciona o início.
  if (/\bfim\b/.test(texto)) return "fimSegundos";
  if (/\binicio\b/.test(texto)) return "inicioSegundos";

  if (/\blink\b/.test(texto)) return "link";
  if (/\bobservac/.test(texto)) return "observacoes";

  return null;
}

export function validarFormularioClipping(
  dados: DadosClippingParaValidacao
): ErrosClipping {
  const erros: ErrosClipping = {};

  if (
    dados.clienteId === null ||
    !Number.isSafeInteger(dados.clienteId) ||
    dados.clienteId <= 0
  ) {
    erros.cliente = "Selecione o cliente do clipping.";
  }

  if (
    !Number.isInteger(dados.anoReferencia) ||
    dados.anoReferencia < 1000 ||
    dados.anoReferencia > 9999
  ) {
    erros.anoReferencia =
      "Informe um ano de referência entre 1000 e 9999.";
  }

  if (
    dados.dataPublicacao.trim() &&
    dataBRParaISO(dados.dataPublicacao) === null
  ) {
    erros.dataPublicacao =
      "Informe uma data válida no formato DD/MM/AAAA.";
  }

  const categorias = normalizarCategorias(dados.categorias);

  if (categorias.length > MAX_CATEGORIAS) {
    erros.categorias =
      `Informe até ${MAX_CATEGORIAS} categorias.`;
  } else if (
    categorias.some((item) =>
      excede(item, MAX_CARACTERES_CATEGORIA)
    )
  ) {
    erros.categorias =
      `Cada categoria deve possuir no máximo ` +
      `${MAX_CARACTERES_CATEGORIA} caracteres.`;
  }

  if (excede(dados.programaSecao, MAX_PROGRAMA_SECAO)) {
    erros.programaSecao =
      `O programa ou seção deve possuir no máximo ` +
      `${MAX_PROGRAMA_SECAO} caracteres.`;
  }

  if (excede(dados.pauta, MAX_PAUTA)) {
    erros.pauta =
      `A pauta deve possuir no máximo ${MAX_PAUTA} caracteres.`;
  }

  if (
    dados.veiculoId !== null &&
    (
      !Number.isSafeInteger(dados.veiculoId) ||
      dados.veiculoId <= 0
    )
  ) {
    erros.veiculo = "Selecione um veículo válido.";
  } else if (
    dados.veiculoId === null &&
    dados.veiculoNome.trim()
  ) {
    erros.veiculo = excede(dados.veiculoNome, MAX_VEICULO)
      ? `O nome do veículo deve possuir no máximo ${MAX_VEICULO} caracteres.`
      : "Selecione o veículo na lista ou cadastre-o. Para deixar pendente, limpe o campo.";
  }

  if (
    dados.tier !== null &&
    ![1, 2, 3].includes(dados.tier)
  ) {
    erros.tier = "Escolha Tier 1, 2, 3 ou Não definido.";
  }

  Object.assign(
    erros,
    validarTrecho(dados.inicioSegundos, dados.fimSegundos)
  );

  const link = dados.link.trim();

  if (excede(link, MAX_LINK)) {
    erros.link =
      `O link deve possuir no máximo ${MAX_LINK} caracteres.`;
  } else if (link && !linkValido(link)) {
    erros.link =
      "Informe um link completo com http:// ou https://.";
  }

  if (excede(dados.observacoes, MAX_OBSERVACOES)) {
    erros.observacoes =
      `As observações devem possuir no máximo ` +
      `${MAX_OBSERVACOES} caracteres.`;
  }

  return erros;
}