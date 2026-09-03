import {
  authenticatedFetch,
} from "@/services/api/auth";

import { API_URL } from "@/constants/api";

export interface Veiculo {
  id: number;
  assessoria_id: number;
  nome: string;
  created_at: string;
  updated_at: string;
}

export interface ListarVeiculosParams {
  page?: number;
  limit?: number;
  busca?: string;
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
  nome: string
): Promise<Veiculo> {
  const response =
    await authenticatedFetch(
      `${API_URL}/api/veiculos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
        }),
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
        "Não foi possível criar o veículo."
    );
  }

  return data.veiculo;
}

export async function atualizarVeiculo(
  id: number,
  nome: string
): Promise<Veiculo> {
  const response =
    await authenticatedFetch(
      `${API_URL}/api/veiculos/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          nome,
        }).toString(),
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