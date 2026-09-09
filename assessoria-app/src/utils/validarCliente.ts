export const MAX_NOME_CLIENTE = 150;
export const MAX_EMAIL_CLIENTE = 150;
export const MAX_TELEFONE_CLIENTE = 30;
export const MAX_CNPJ_CLIENTE = 18;
export const MAX_SITE_CLIENTE = 500;
export const MAX_CIDADE_CLIENTE = 100;
export const MAX_ESTADO_CLIENTE = 100;
export const MAX_DESCRICAO_CLIENTE = 2000;
export const MAX_SEGMENTO_CLIENTE = 100;
export const MAX_RESPONSAVEL_CLIENTE = 100;

export type CampoCliente =
  | "nome"
  | "email"
  | "telefone"
  | "cnpj"
  | "site"
  | "cidade"
  | "estado"
  | "descricao"
  | "segmento"
  | "responsavel";

export type ErrosCliente = Partial<
  Record<CampoCliente, string>
>;

export interface DadosClienteParaValidacao {
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  site: string;
  cidade: string;
  estado: string;
  descricao: string;
  segmento: string;
  responsavel: string;
}

function tamanho(valor: string): number {
  return Array.from(valor.trim()).length;
}

function excede(
  valor: string,
  limite: number
): boolean {
  return tamanho(valor) > limite;
}

function normalizarCnpj(valor: string): string {
  return valor
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function calcularDigito(
  valor: string,
  pesos: number[]
): number {
  const soma = valor
    .split("")
    .reduce((total, caractere, indice) => {
      return (
        total +
        (caractere.charCodeAt(0) - 48) *
          pesos[indice]
      );
    }, 0);

  const resto = soma % 11;

  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(cnpj: string): boolean {
  const valor = normalizarCnpj(cnpj);

  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(valor)) {
    return false;
  }

  if (new Set(valor.split("")).size === 1) {
    return false;
  }

  const base = valor.slice(0, 12);

  const primeiroDigito = calcularDigito(
    base,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  if (Number(valor[12]) !== primeiroDigito) {
    return false;
  }

  const segundoDigito = calcularDigito(
    `${base}${primeiroDigito}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return Number(valor[13]) === segundoDigito;
}

function siteValido(site: string): boolean {
  try {
    const url = new URL(site);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function validarFormularioCliente(
  dados: DadosClienteParaValidacao
): ErrosCliente {
  const erros: ErrosCliente = {};

  if (!dados.nome.trim()) {
    erros.nome = "Informe o nome do cliente.";
  } else if (
    excede(dados.nome, MAX_NOME_CLIENTE)
  ) {
    erros.nome =
      `O nome do cliente deve possuir no máximo ` +
      `${MAX_NOME_CLIENTE} caracteres.`;
  }

  const email = dados.email.trim();

  if (email) {
    if (excede(email, MAX_EMAIL_CLIENTE)) {
      erros.email =
        `O e-mail deve possuir no máximo ` +
        `${MAX_EMAIL_CLIENTE} caracteres.`;
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      erros.email = "Informe um e-mail válido.";
    }
  }

  const telefone = dados.telefone.trim();

  if (telefone) {
    if (excede(telefone, MAX_TELEFONE_CLIENTE)) {
      erros.telefone =
        `O telefone deve possuir no máximo ` +
        `${MAX_TELEFONE_CLIENTE} caracteres.`;
    } else {
      const telefoneNumerico = telefone.replace(
        /\D/g,
        ""
      );

      if (!/^\d{10,11}$/.test(telefoneNumerico)) {
        erros.telefone =
          "O telefone deve possuir 10 ou 11 dígitos.";
      }
    }
  }

  const cnpj = dados.cnpj.trim();

  if (cnpj) {
    if (excede(cnpj, MAX_CNPJ_CLIENTE)) {
      erros.cnpj =
        `O CNPJ deve possuir no máximo ` +
        `${MAX_CNPJ_CLIENTE} caracteres.`;
    } else if (!cnpjValido(cnpj)) {
      erros.cnpj = "Informe um CNPJ válido.";
    }
  }

  const site = dados.site.trim();

  if (site) {
    if (excede(site, MAX_SITE_CLIENTE)) {
      erros.site =
        `O site deve possuir no máximo ` +
        `${MAX_SITE_CLIENTE} caracteres.`;
    } else if (!siteValido(site)) {
      erros.site =
        "Informe um site válido, iniciando com http:// ou https://.";
    }
  }

  const camposComLimite = [
    [
      "cidade",
      dados.cidade,
      MAX_CIDADE_CLIENTE,
      "A cidade",
    ],
    [
      "estado",
      dados.estado,
      MAX_ESTADO_CLIENTE,
      "O estado",
    ],
    [
      "descricao",
      dados.descricao,
      MAX_DESCRICAO_CLIENTE,
      "A descrição",
    ],
    [
      "segmento",
      dados.segmento,
      MAX_SEGMENTO_CLIENTE,
      "O segmento",
    ],
    [
      "responsavel",
      dados.responsavel,
      MAX_RESPONSAVEL_CLIENTE,
      "O responsável",
    ],
  ] as const;

  camposComLimite.forEach(
    ([campo, valor, limite, rotulo]) => {
      if (excede(valor, limite)) {
        erros[campo] =
          `${rotulo} deve possuir no máximo ` +
          `${limite} caracteres.`;
      }
    }
  );

  return erros;
}