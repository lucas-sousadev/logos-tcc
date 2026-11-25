import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type Icone = ComponentProps<typeof Ionicons>["name"];
export type VerificarPermissao = (modulo: string, acao: string) => boolean;

export const MODULOS_NAVEGACAO = [
  {
    id: "clipping",
    titulo: "Clipping",
    rotulo: "Clipping",
    descricao: "Matérias e publicações",
    icone: "document-text-outline",
    ativo: "document-text",
    permissao: "CLIPPING",
    grupo: "Conteúdo e comunicação",
  },
  {
    id: "mailing",
    titulo: "Mailing",
    rotulo: "Mailing",
    descricao: "Contatos e jornalistas",
    icone: "people-outline",
    ativo: "people",
    permissao: "MAILING",
    grupo: "Conteúdo e comunicação",
  },
  {
    id: "releases",
    titulo: "Releases",
    rotulo: "Releases",
    descricao: "Envios e resultados",
    icone: "newspaper-outline",
    ativo: "newspaper",
    permissao: "RELEASES",
    grupo: "Conteúdo e comunicação",
  },
  {
    id: "templates",
    titulo: "Templates",
    rotulo: "Templates",
    descricao: "Modelos para seus releases",
    icone: "albums-outline",
    ativo: "albums",
    permissao: "TEMPLATES",
    grupo: "Conteúdo e comunicação",
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    rotulo: "Relatórios",
    descricao: "Slides e acompanhamento",
    icone: "bar-chart-outline",
    ativo: "bar-chart",
    permissao: "RELATORIOS",
    grupo: "Conteúdo e comunicação",
  },
  {
    id: "clientes",
    titulo: "Clientes",
    rotulo: "Clientes",
    descricao: "Clientes da assessoria",
    icone: "business-outline",
    ativo: "business",
    permissao: "CLIENTES",
    grupo: "Cadastros",
  },
  {
    id: "veiculos",
    titulo: "Veículos",
    rotulo: "Veículos",
    descricao: "Veículos de comunicação",
    icone: "radio-outline",
    ativo: "radio",
    permissao: "VEICULOS",
    grupo: "Cadastros",
  },
  {
    id: "funcionarios",
    titulo: "Funcionários",
    rotulo: "Equipe",
    descricao: "Pessoas e permissões",
    icone: "person-circle-outline",
    ativo: "person-circle",
    permissao: "USUARIOS",
    grupo: "Equipe",
  },
  {
    id: "convites",
    titulo: "Convites",
    rotulo: "Convites",
    descricao: "Acessos para novos funcionários",
    icone: "mail-outline",
    ativo: "mail",
    permissao: "CONVITES",
    grupo: "Equipe",
  },
] as const satisfies readonly {
  id: string;
  titulo: string;
  rotulo: string;
  descricao: string;
  icone: Icone;
  ativo: Icone;
  permissao: string;
  grupo: string;
}[];

export type ModuloAtalho = (typeof MODULOS_NAVEGACAO)[number]["id"];
export type AtalhosBarra = [ModuloAtalho | null, ModuloAtalho | null];
export type ModuloNavegacao = (typeof MODULOS_NAVEGACAO)[number];

export function modulosDisponiveis(temPermissao: VerificarPermissao) {
  return MODULOS_NAVEGACAO.filter(
    (modulo) =>
      temPermissao(modulo.permissao, "VISUALIZAR") ||
      (modulo.id === "templates" && temPermissao("TEMPLATES", "CRIAR"))
  );
}

export function normalizarAtalhos(
  valor: unknown,
  disponiveis: readonly ModuloNavegacao[]
): AtalhosBarra {
  const ids = new Set<string>(disponiveis.map((modulo) => modulo.id));
  const entrada = Array.isArray(valor) ? valor : [];
  const resultado: AtalhosBarra = [null, null];

  for (const vaga of [0, 1] as const) {
    const id = entrada[vaga];
    if (
      typeof id === "string" &&
      ids.has(id) &&
      !resultado.includes(id as ModuloAtalho)
    ) {
      resultado[vaga] = id as ModuloAtalho;
    }
  }

  const prioridade = [
    "clipping",
    "releases",
    ...disponiveis.map((modulo) => modulo.id),
  ];
  for (const vaga of [0, 1] as const) {
    if (resultado[vaga]) continue;
    resultado[vaga] =
      (prioridade.find(
        (id) => ids.has(id) && !resultado.includes(id as ModuloAtalho)
      ) as ModuloAtalho | undefined) ?? null;
  }
  return resultado;
}

export function trocarAtalho(
  atalhos: AtalhosBarra,
  vaga: 0 | 1,
  modulo: ModuloAtalho
): AtalhosBarra {
  const proximo: AtalhosBarra = [...atalhos];
  const outra = vaga === 0 ? 1 : 0;
  if (proximo[outra] === modulo) proximo[outra] = proximo[vaga];
  proximo[vaga] = modulo;
  return proximo;
}

export const ACOES_CRIACAO = [
  {
    modulo: "releases",
    titulo: "Novo release",
    descricao: "Conteúdo e destinatários",
    icone: "paper-plane-outline",
    permissao: "RELEASES",
    tela: "novo",
  },
  {
    modulo: "clipping",
    titulo: "Novo clipping",
    descricao: "Uma matéria no clipping",
    icone: "document-text-outline",
    permissao: "CLIPPING",
    tela: "novo",
  },
  {
    modulo: "mailing",
    titulo: "Novo contato",
    descricao: "Um jornalista no mailing",
    icone: "person-add-outline",
    permissao: "MAILING",
    tela: "novo",
  },
  {
    modulo: "relatorios",
    titulo: "Novo relatório",
    descricao: "Slides e resultados",
    icone: "bar-chart-outline",
    permissao: "RELATORIOS",
    tela: "novo",
  },
  {
    modulo: "clientes",
    titulo: "Novo cliente",
    descricao: "Um cliente da assessoria",
    icone: "business-outline",
    permissao: "CLIENTES",
    tela: "novo",
  },
  {
    modulo: "veiculos",
    titulo: "Novo veículo",
    descricao: "Um veículo de comunicação",
    icone: "radio-outline",
    permissao: "VEICULOS",
    tela: "novo",
  },
  {
    modulo: "templates",
    titulo: "Novo template",
    descricao: "Um modelo de release",
    icone: "albums-outline",
    permissao: "TEMPLATES",
    tela: "index",
  },
] as const satisfies readonly {
  modulo: ModuloAtalho;
  titulo: string;
  descricao: string;
  icone: Icone;
  permissao: string;
  tela: string;
}[];
