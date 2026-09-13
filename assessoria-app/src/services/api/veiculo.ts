import {
  authenticatedFetch,
} from "@/services/api/auth";

import { API_URL } from "@/constants/api";
import type { Tier } from "@/constants/tier";

export interface Veiculo {
  id: number;
  assessoria_id: number;
  nome: string;
  descricao: string | null;
  logo_path: string | null;
  alcance: string | null;
  tier: Tier | null;
  ativo: number;
  contatos_vinculados: number;
  created_at: string;
  updated_at: string;
}

export interface DadosVeiculo {
  nome: string;
  descricao?: string;
  logo_path?: string | null;
  alcance?: string;
  tier?: Tier | null;
  ativo?: boolean;
}

export interface ArquivoLogoVeiculo {
  uri: string;
  nome: string;
  mimeType: string;
  file?: File;
}

export interface ListarVeiculosParams {
  page?: number;
  limit?: number;
  busca?: string;
  ativo?: number;
  ordem?: "nome" | "vinculos";
  direcao?: "ASC" | "DESC";
  min_contatos?: number;
  max_contatos?: number;
}

export interface ListarVeiculosResponse {
  success: boolean;
  veiculos: Veiculo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
  };
  message?: string;
}

export async function listarVeiculos(
  params: ListarVeiculosParams = {}
): Promise<ListarVeiculosResponse> {
  const query =
    new URLSearchParams();

  query.set(
    "page",
    String(params.page ?? 1)
  );

  query.set(
    "limit",
    String(params.limit ?? 50)
  );

  if (params.busca?.trim()) {
    query.set(
      "busca",
      params.busca.trim()
    );
  }

  if (params.ativo !== undefined) {
    query.set("ativo", String(params.ativo));
  }

  if (params.ordem) {
  query.set("ordem", params.ordem);
}

  if (params.direcao) {
    query.set("direcao", params.direcao);
  }

  if (params.min_contatos !== undefined) {
    query.set(
      "min_contatos",
      String(params.min_contatos)
    );
  }

  if (params.max_contatos !== undefined) {
    query.set(
      "max_contatos",
      String(params.max_contatos)
    );
  }
  const response =
    await authenticatedFetch(
      `${API_URL}/api/veiculos?${query.toString()}`,
      {
        method: "GET",
      }
    );

  const responseText =
    await response.text();

  let data: ListarVeiculosResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.veiculos ||
    !data.pagination
  ) {
    throw new Error(
      data.message ||
        "Não foi possível carregar os veículos."
    );
  }

  return data;
}

export async function buscarVeiculo(
  id: number
): Promise<Veiculo> {
  const response =
    await authenticatedFetch(
      `${API_URL}/api/veiculos/${id}`,
      {
        method: "GET",
      }
    );

  const responseText =
    await response.text();

  let data: {
    success: boolean;
    veiculo?: Veiculo;
    message?: string;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.veiculo
  ) {
    throw new Error(
      data.message ||
        "Não foi possível carregar o veículo."
    );
  }

  return data.veiculo;
}

export async function criarVeiculo(
  dados: DadosVeiculo,
  logo?: ArquivoLogoVeiculo
): Promise<Veiculo> {
  const response = await authenticatedFetch(
    `${API_URL}/api/veiculos`,
    logo
      ? {
          method: "POST",
          body: criarFormDataVeiculo(
            dados,
            logo
          ),
        }
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dados),
        }
  );

  return lerRespostaVeiculo(
    response,
    "Não foi possível criar o veículo."
  );
}

export async function atualizarVeiculo(
  id: number,
  dados: DadosVeiculo
): Promise<Veiculo> {
  const response =
    await authenticatedFetch(
      `${API_URL}/api/veiculos/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      }
    );

  const responseText =
    await response.text();

  let data: {
    success: boolean;
    message?: string;
    veiculo?: Veiculo;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.veiculo
  ) {
    throw new Error(
      data.message ||
        "Não foi possível atualizar o veículo."
    );
  }

  return data.veiculo;
}

export async function atualizarVeiculoComLogo(
  id: number,
  dados: DadosVeiculo,
  logo?: ArquivoLogoVeiculo,
  removerLogo = false
): Promise<Veiculo> {
  const response = await authenticatedFetch(
    `${API_URL}/api/veiculos/${id}/atualizar-com-logo`,
    {
      method: "POST",
      body: criarFormDataVeiculo(
        dados,
        logo,
        removerLogo
      ),
    }
  );

  return lerRespostaVeiculo(
    response,
    "Não foi possível atualizar o veículo."
  );
}

export async function excluirVeiculo(
  id: number
): Promise<void> {
  const response =
    await authenticatedFetch(
      `${API_URL}/api/veiculos/${id}`,
      {
        method: "DELETE",
      }
    );

  const responseText =
    await response.text();

  let data: {
    success: boolean;
    message?: string;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
        "Não foi possível excluir o veículo."
    );
  }
}

export interface ExcluirVeiculosEmLoteResponse {
  success: boolean;
  message: string;
  excluidos: number;
}

export async function excluirVeiculosEmLote(
  ids: number[]
): Promise<ExcluirVeiculosEmLoteResponse> {
  const response = await authenticatedFetch(
    `${API_URL}/api/veiculos/excluir-lote`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    }
  );

  const textoResposta = await response.text();

  let dados: ExcluirVeiculosEmLoteResponse;

  try {
    dados = JSON.parse(textoResposta);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok || !dados.success) {
    throw new Error(
      dados.message ||
        "Não foi possível excluir os veículos."
    );
  }

  return dados;
}


export function obterUrlLogoVeiculo(
  logoPath?: string | null
): string | null {
  const caminho = logoPath?.trim();

  if (!caminho) {
    return null;
  }

  if (/^https?:\/\//i.test(caminho)) {
    return caminho;
  }

  return (
    `${API_URL}/` +
    caminho.replace(/^\/+/, "")
  );
}

function criarFormDataVeiculo(
  dados: DadosVeiculo,
  logo?: ArquivoLogoVeiculo,
  removerLogo = false
): FormData {
  const formData = new FormData();

  formData.append("nome", dados.nome);
  formData.append(
    "descricao",
    dados.descricao ?? ""
  );
  formData.append(
    "alcance",
    dados.alcance ?? ""
  );
  formData.append(
    "ativo",
    String(dados.ativo ?? true)
  );

  if (removerLogo) {
    formData.append("remover_logo", "true");
  }

  if (dados.tier !== undefined) {
    formData.append("tier", dados.tier === null ? "" : String(dados.tier));
  }

  if (logo) {
    const arquivo = logo.file ?? {
      uri: logo.uri,
      name: logo.nome,
      type: logo.mimeType,
    };

    formData.append(
      "logo",
      arquivo as unknown as Blob
    );
  }

  return formData;
}

async function lerRespostaVeiculo(
  response: Response,
  mensagemPadrao: string
): Promise<Veiculo> {
  const responseText = await response.text();

  let data: {
    success: boolean;
    message?: string;
    veiculo?: Veiculo;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.veiculo
  ) {
    throw new Error(
      data.message || mensagemPadrao
    );
  }

  return data.veiculo;
}