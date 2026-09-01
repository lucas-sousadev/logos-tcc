import {
  authenticatedFetch,
} from "@/services/api/auth";
import { API_URL } from "@/constants/api";

export interface Jornalista {
  id: number;
  assessoria_id: number;

  nome: string;
  email: string;
  telefone: string | null;

  cargo: string | null;
  estado: string | null;
  cidade: string | null;

  veiculo_id: number | null;
  veiculo_nome: string | null;

  observacoes: string | null;

  ativo: number;

  created_at: string;
  updated_at: string;
}

export interface ListarJornalistasParams {
  page?: number;
  limit?: number;

  busca?: string;
  estado?: string;
  cidade?: string;
  cargo?: string;
  veiculo_id?: number;
  ativo?: number;

  ordem?: string;
  direcao?: "ASC" | "DESC";
}

export interface ListarJornalistasResponse {
  success: boolean;
  jornalistas: Jornalista[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
  };
  message?: string;
}

export interface CriarJornalistaData {
  nome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  estado?: string;
  cidade?: string;
  veiculo_id?: number;
  observacoes?: string;
}

export interface CriarJornalistaResponse {
  success: boolean;
  message: string;
  jornalista_id?: number;
}

export interface AtualizarJornalistaData {
  nome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  estado?: string;
  cidade?: string;
  veiculo_id?: number;
  observacoes?: string;
  ativo?: boolean;
}

export interface AtualizarJornalistaResponse {
  success: boolean;
  message: string;
}

export interface ExcluirJornalistaResponse {
  success: boolean;
  message: string;
}

export async function listarJornalistas(
  params: ListarJornalistasParams = {}
): Promise<ListarJornalistasResponse> {
  const query = new URLSearchParams();

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

  if (params.estado?.trim()) {
    query.set(
      "estado",
      params.estado.trim()
    );
  }

  if (params.cidade?.trim()) {
    query.set(
      "cidade",
      params.cidade.trim()
    );
  }

  if (params.cargo?.trim()) {
    query.set(
      "cargo",
      params.cargo.trim()
    );
  }

  if (
    params.veiculo_id !== undefined
  ) {
    query.set(
      "veiculo_id",
      String(params.veiculo_id)
    );
  }

  if (
    params.ativo !== undefined
  ) {
    query.set(
      "ativo",
      String(params.ativo)
    );
  }

  if (params.ordem) {
    query.set(
      "ordem",
      params.ordem
    );
  }

  if (params.direcao) {
    query.set(
      "direcao",
      params.direcao
    );
  }

  const response =
    await authenticatedFetch(
        `${API_URL}/api/jornalistas?${query.toString()}`,
        {
        method: "GET",
        }
    );

  const responseText =
    await response.text();

  let data: ListarJornalistasResponse;

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
    !data.jornalistas ||
    !data.pagination
  ) {
    throw new Error(
      data.message ||
        "Não foi possível carregar o mailing."
    );
  }

  return data;
}

export async function buscarJornalista(
  id: number
): Promise<Jornalista> {
  const response =
    await authenticatedFetch(
        `${API_URL}/api/jornalistas/${id}`,
        {
        method: "GET",
        }
    );

  const responseText =
    await response.text();

  let data: {
    success: boolean;
    jornalista?: Jornalista;
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
    !data.jornalista
  ) {
    throw new Error(
      data.message ||
        "Não foi possível carregar o jornalista."
    );
  }

  return data.jornalista;
}

export async function criarJornalista(
  dados: CriarJornalistaData
): Promise<CriarJornalistaResponse> {
  const response =
    await authenticatedFetch(
        `${API_URL}/api/jornalistas`,
        {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
        }
    );

  const responseText =
    await response.text();

  let data: CriarJornalistaResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.message ||
        "Não foi possível cadastrar o jornalista."
    );
  }

  return data;
}

export async function atualizarJornalista(
  id: number,
  dados: AtualizarJornalistaData
): Promise<AtualizarJornalistaResponse> {
  const response =
    await authenticatedFetch(
        `${API_URL}/api/jornalistas/${id}`,
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

  let data: AtualizarJornalistaResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.message ||
        "Não foi possível atualizar o jornalista."
    );
  }

  return data;
}

export async function excluirJornalista(
  id: number
): Promise<ExcluirJornalistaResponse> {
  const response =
    await authenticatedFetch(
        `${API_URL}/api/jornalistas/${id}`,
        {
        method: "DELETE",
        }
    );

  const responseText =
    await response.text();

  let data: ExcluirJornalistaResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.message ||
        "Não foi possível excluir o jornalista."
    );
  }

  return data;
}