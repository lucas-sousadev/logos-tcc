import {
  validarNomeVeiculo,
} from "@/utils/validarVeiculo";

export const MAX_NOME_JORNALISTA = 150;
export const MAX_EMAIL_JORNALISTA = 180;
export const MAX_TELEFONE_JORNALISTA = 30;
export const MAX_CARGO_JORNALISTA = 100;
export const MAX_ESTADO_JORNALISTA = 100;
export const MAX_CIDADE_JORNALISTA = 100;
export const MAX_OBSERVACOES_JORNALISTA = 2000;

export type CampoJornalista =
  | "nome"
  | "email"
  | "telefone"
  | "cargo"
  | "estado"
  | "cidade"
  | "observacoes"
  | "veiculo";

export type ErrosJornalista = Partial<
  Record<CampoJornalista, string>
>;

interface DadosJornalistaParaValidacao {
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  estado: string;
  cidade: string;
  observacoes: string;
  veiculoId: number | null;
  veiculoNome: string;
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

export function validarFormularioJornalista(
  dados: DadosJornalistaParaValidacao
): ErrosJornalista {
  const erros: ErrosJornalista = {};

  if (!dados.nome.trim()) {
    erros.nome = "Informe o nome do contato.";
  } else if (
    excede(dados.nome, MAX_NOME_JORNALISTA)
  ) {
    erros.nome =
      `O nome deve possuir no máximo ` +
      `${MAX_NOME_JORNALISTA} caracteres.`;
  }

  const email = dados.email.trim();

  if (!email) {
    erros.email = "Informe o e-mail do contato.";
  } else if (
    excede(email, MAX_EMAIL_JORNALISTA)
  ) {
    erros.email =
      `O e-mail deve possuir no máximo ` +
      `${MAX_EMAIL_JORNALISTA} caracteres.`;
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    erros.email = "Informe um e-mail válido.";
  }

  if (
    dados.telefone.trim() &&
    excede(dados.telefone, MAX_TELEFONE_JORNALISTA)
  ) {
    erros.telefone =
      `O telefone deve possuir no máximo ` +
      `${MAX_TELEFONE_JORNALISTA} caracteres.`;
  } else if (dados.telefone.trim()) {
    const telefoneNumerico =
      dados.telefone.replace(/\D/g, "");

    if (!/^\d{10,11}$/.test(telefoneNumerico)) {
      erros.telefone =
        "O telefone deve possuir 10 ou 11 dígitos.";
    }
  }

  const camposComLimite = [
    ["cargo", dados.cargo, MAX_CARGO_JORNALISTA, "O cargo"],
    ["estado", dados.estado, MAX_ESTADO_JORNALISTA, "O estado"],
    ["cidade", dados.cidade, MAX_CIDADE_JORNALISTA, "A cidade"],
    [
      "observacoes",
      dados.observacoes,
      MAX_OBSERVACOES_JORNALISTA,
      "As observações",
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

  if (dados.veiculoId === null) {
    const erroVeiculo = validarNomeVeiculo(
      dados.veiculoNome
    );

    if (erroVeiculo) {
      erros.veiculo = erroVeiculo;
    }
  }

  return erros;
}