import {
  authenticatedFetch,
} from "@/services/api/auth";

import { API_URL } from "@/constants/api";

export interface Cliente {
  id: number;
  assessoria_id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  site: string | null;
  cidade: string | null;
  estado: string | null;
  descricao: string | null;
  segmento: string | null;
  responsavel: string | null;
  logo_path: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export interface DadosCliente {
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  site?: string;
  cidade?: string;
  estado?: string;
  descricao?: string;
  segmento?: string;
  responsavel?: string;
  ativo?: boolean;
}

export interface ArquivoLogoCliente {
  uri: string;
  nome: string;
  mimeType: string;
  file?: File;
}

export interface ListarClientesParams {
  page?: number;
  limit?: number;
  busca?: string;
  estado?: string;
  cidade?: string;
  segmento?: string;
  ativo?: number;
}

export interface ListarClientesResponse {
  success: boolean;
  clientes: Cliente[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
  };
  message?: string;
}

export async function listarClientes(
  params: ListarClientesParams = {}
): Promise<ListarClientesResponse> {
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
    query.set("busca", params.busca.trim());
  }

  if (params.estado?.trim()) {
    query.set("estado", params.estado.trim());
  }

  if (params.cidade?.trim()) {
    query.set("cidade", params.cidade.trim());
  }

  if (params.segmento?.trim()) {
    query.set(
      "segmento",
      params.segmento.trim()
    );
  }

  if (params.ativo !== undefined) {
    query.set("ativo", String(params.ativo));
  }

  const response = await authenticatedFetch(
    `${API_URL}/api/clientes?${query.toString()}`,
    {
      method: "GET",
    }
  );

  const textoResposta = await response.text();

  let dados: ListarClientesResponse;

  try {
    dados = JSON.parse(textoResposta);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !dados.success ||
    !dados.clientes ||
    !dados.pagination
  ) {
    throw new Error(
      dados.message ||
        "Não foi possível carregar os clientes."
    );
  }

  return dados;
}

export async function buscarCliente(
  id: number
): Promise<Cliente> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clientes/${id}`,
    {
      method: "GET",
    }
  );

  const textoResposta = await response.text();

  let dados: {
    success: boolean;
    cliente?: Cliente;
    message?: string;
  };

  try {
    dados = JSON.parse(textoResposta);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !dados.success ||
    !dados.cliente
  ) {
    throw new Error(
      dados.message ||
        "Não foi possível carregar o cliente."
    );
  }

  return dados.cliente;
}

export async function criarCliente(
  dados: DadosCliente,
  logo?: ArquivoLogoCliente
): Promise<Cliente> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clientes`,
    {
      method: "POST",
      body: criarFormDataCliente(dados, logo),
    }
  );

  return lerRespostaCliente(
    response,
    "Não foi possível cadastrar o cliente."
  );
}

export async function atualizarClienteComLogo(
  id: number,
  dados: DadosCliente,
  logo?: ArquivoLogoCliente,
  removerLogo = false
): Promise<Cliente> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clientes/${id}/atualizar-com-logo`,
    {
      method: "POST",
      body: criarFormDataCliente(
        dados,
        logo,
        removerLogo
      ),
    }
  );

  return lerRespostaCliente(
    response,
    "Não foi possível atualizar o cliente."
  );
}

export async function excluirCliente(
  id: number
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clientes/${id}`,
    {
      method: "DELETE",
    }
  );

  const textoResposta = await response.text();

  let dados: {
    success: boolean;
    message?: string;
  };

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
        "Não foi possível excluir o cliente."
    );
  }
}

export interface ExcluirClientesEmLoteResponse {
  success: boolean;
  message: string;
  excluidos: number;
}

export async function excluirClientesEmLote(
  ids: number[]
): Promise<ExcluirClientesEmLoteResponse> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clientes/excluir-lote`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    }
  );

  const textoResposta = await response.text();

  let dados: ExcluirClientesEmLoteResponse;

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
        "Não foi possível excluir os clientes."
    );
  }

  return dados;
}

export function obterUrlLogoCliente(
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

function criarFormDataCliente(
  dados: DadosCliente,
  logo?: ArquivoLogoCliente,
  removerLogo = false
): FormData {
  const formData = new FormData();

  formData.append("nome", dados.nome);
  formData.append("email", dados.email ?? "");
  formData.append("telefone", dados.telefone ?? "");
  formData.append("cnpj", dados.cnpj ?? "");
  formData.append("site", dados.site ?? "");
  formData.append("cidade", dados.cidade ?? "");
  formData.append("estado", dados.estado ?? "");
  formData.append(
    "descricao",
    dados.descricao ?? ""
  );
  formData.append(
    "segmento",
    dados.segmento ?? ""
  );
  formData.append(
    "responsavel",
    dados.responsavel ?? ""
  );
  formData.append(
    "ativo",
    String(dados.ativo ?? true)
  );

  if (removerLogo) {
    formData.append("remover_logo", "true");
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

async function lerRespostaCliente(
  response: Response,
  mensagemPadrao: string
): Promise<Cliente> {
  const textoResposta = await response.text();

  let dados: {
    success: boolean;
    message?: string;
    cliente?: Cliente;
  };

  try {
    dados = JSON.parse(textoResposta);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !dados.success ||
    !dados.cliente
  ) {
    throw new Error(
      dados.message || mensagemPadrao
    );
  }

  return dados.cliente;
}