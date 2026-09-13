import { API_URL } from "@/constants/api";
import {
  authenticatedFetch,
  getToken,
} from "@/services/api/auth";
import type { Tier } from "@/constants/tier";

interface ApiEnvelope {
  success: boolean;
  message?: string;
}

async function lerResposta<T>(
  response: Response,
  mensagemPadrao: string
): Promise<T> {
  const texto = await response.text();

  let dados: T & ApiEnvelope;

  try {
    dados = JSON.parse(texto) as T & ApiEnvelope;
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }

  if (!response.ok || !dados.success) {
    throw new Error(dados.message || mensagemPadrao);
  }

  return dados as T;
}

export interface AnoClipping {
  ano_referencia: number;
  total_clippings: number;
  total_clientes: number;
}

export interface ClienteClippingAno {
  id: number;
  nome: string;
  logo_path: string | null;
  ativo: number;
  total_clippings: number;
}

export interface Clipping {
  id: number;
  assessoria_id: number;
  cliente_id: number;
  veiculo_id: number | null;
  ano_referencia: number;
  data_publicacao: string | null;
  categorias: string[];
  programa_secao: string | null;
  pauta: string | null;
  tier: Tier | null;
  inicio_segundos: number | null;
  fim_segundos: number | null;
  link: string | null;
  observacoes: string | null;
  criado_por: number;
  arquivado_em: string | null;
  arquivado_por: number | null;
  created_at: string;
  updated_at: string;
  duracao_segundos: number | null;
  cliente_nome: string;
  veiculo_nome: string | null;
  veiculo_descricao: string | null;
  veiculo_alcance: string | null;
  veiculo_logo_path: string | null;
  total_anexos: number;
}

export interface DadosClipping {
  cliente_id: number;
  ano_referencia: number;
  veiculo_id?: number | null;
  data_publicacao?: string | null;
  categorias?: string[];
  programa_secao?: string | null;
  pauta?: string | null;
  tier?: Tier | null;
  inicio_segundos?: number | null;
  fim_segundos?: number | null;
  link?: string | null;
  observacoes?: string | null;
}

export type DadosAtualizacaoClipping =
  Partial<DadosClipping>;

export interface Paginacao {
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

export interface AnexoClipping {
  id: number;
  assessoria_id: number;
  clipping_id: number;
  criado_por: number;
  anexo_origem_id: number | null;
  tipo: "IMAGEM" | "VIDEO" | "AUDIO" | "DOCUMENTO";
  origem: string;
  nome_original: string;
  mime_type: string;
  tamanho_bytes: number;
  ordem: number;
  principal: number | null;
  imagem_relatorio: number | null;
  url_origem: string | null;
  capturado_em: string | null;
  created_at: string;
  updated_at: string;
  metadados: Record<string, unknown> | null;
  arquivo_endpoint: string;
}

export interface ArquivoClippingSelecionado {
  uri: string;
  nome: string;
  mimeType: string;
  file?: File;
}

export async function listarClippingAnos(): Promise<{
  anos: AnoClipping[];
}> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/anos`
  );

  const dados = await lerResposta<{
    anos: AnoClipping[];
  }>(
    response,
    "Não foi possível carregar os anos dos clippings."
  );

  return {
    anos: dados.anos,
  };
}

export async function listarClientesDoAno(
  ano: number,
  params: {
    busca?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  ano_referencia: number;
  clientes: ClienteClippingAno[];
  pagination: Paginacao;
}> {
  const query = new URLSearchParams();

  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 100));

  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }

  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/anos/${ano}/clientes?${query.toString()}`
  );

  const dados = await lerResposta<{
    ano_referencia: number;
    clientes: ClienteClippingAno[];
    pagination: Paginacao;
  }>(
    response,
    "Não foi possível carregar os clientes do ano."
  );

  return {
    ano_referencia: dados.ano_referencia,
    clientes: dados.clientes,
    pagination: dados.pagination,
  };
}

export async function listarPautas(
  clienteId: number,
  busca?: string
): Promise<{ pautas: string[] }> {
  const query = new URLSearchParams();

  query.set("cliente_id", String(clienteId));

  if (busca?.trim()) {
    query.set("busca", busca.trim());
  }

  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/pautas?${query.toString()}`
  );

  const dados = await lerResposta<{
    pautas: string[];
  }>(
    response,
    "Não foi possível carregar as pautas."
  );

  return {
    pautas: dados.pautas,
  };
}

export async function listarClippings(params: {
  cliente_id: number;
  ano_referencia: number;
  busca?: string;
  page?: number;
  limit?: number;
}): Promise<{
  clippings: Clipping[];
  pagination: Paginacao;
}> {
  const query = new URLSearchParams();

  query.set("cliente_id", String(params.cliente_id));
  query.set("ano_referencia", String(params.ano_referencia));
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 50));

  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }

  const response = await authenticatedFetch(
    `${API_URL}/api/clippings?${query.toString()}`
  );

  const dados = await lerResposta<{
    clippings: Clipping[];
    pagination: Paginacao;
  }>(
    response,
    "Não foi possível carregar os clippings."
  );

  return {
    clippings: dados.clippings,
    pagination: dados.pagination,
  };
}

export async function buscarClipping(
  id: number
): Promise<Clipping> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/${id}`
  );

  const dados = await lerResposta<{
    success: boolean;
    message?: string;
    clipping?: Clipping;
  }>(
    response,
    "Não foi possível carregar o clipping."
  );

  if (!dados.clipping) {
    throw new Error("Clipping não encontrado.");
  }

  return dados.clipping;
}

export async function criarClipping(
  dados: DadosClipping
): Promise<Clipping> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clippings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dados),
    }
  );

  const resposta = await lerResposta<{
    success: boolean;
    message?: string;
    clipping?: Clipping;
  }>(
    response,
    "Não foi possível criar o clipping."
  );

  if (!resposta.clipping) {
    throw new Error("A API não retornou o clipping criado.");
  }

  return resposta.clipping;
}

export async function atualizarClipping(
  id: number,
  dados: DadosAtualizacaoClipping
): Promise<Clipping> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dados),
    }
  );

  const resposta = await lerResposta<{
    success: boolean;
    message?: string;
    clipping?: Clipping;
  }>(
    response,
    "Não foi possível atualizar o clipping."
  );

  if (!resposta.clipping) {
    throw new Error("A API não retornou o clipping atualizado.");
  }

  return resposta.clipping;
}

export async function listarAnexos(
  clippingId: number,
  params: {
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  anexos: AnexoClipping[];
  pagination: Paginacao;
}> {
  const query = new URLSearchParams();

  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 50));

  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/${clippingId}/anexos?${query.toString()}`
  );

  const dados = await lerResposta<{
    anexos: AnexoClipping[];
    pagination: Paginacao;
  }>(
    response,
    "Não foi possível carregar os anexos."
  );

  return {
    anexos: dados.anexos,
    pagination: dados.pagination,
  };
}

export async function enviarAnexo(
  clippingId: number,
  arquivo: ArquivoClippingSelecionado
): Promise<AnexoClipping> {
  const formData = new FormData();

  const multipart = arquivo.file ?? {
    uri: arquivo.uri,
    name: arquivo.nome,
    type: arquivo.mimeType,
  };

  formData.append(
    "arquivo",
    multipart as unknown as Blob
  );

  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/${clippingId}/anexos`,
    {
      method: "POST",
      body: formData,
    }
  );

  const dados = await lerResposta<{
    success: boolean;
    message?: string;
    anexo?: AnexoClipping;
  }>(
    response,
    "Não foi possível enviar o anexo."
  );

  if (!dados.anexo) {
    throw new Error("A API não retornou o anexo enviado.");
  }

  return dados.anexo;
}

export async function atualizarAnexo(
  clippingId: number,
  anexoId: number,
  dados: {
    principal?: boolean | null;
    imagem_relatorio?: boolean | null;
    ordem?: number;
  }
): Promise<AnexoClipping> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/${clippingId}/anexos/${anexoId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dados),
    }
  );

  const resposta = await lerResposta<{
    success: boolean;
    message?: string;
    anexo?: AnexoClipping;
  }>(
    response,
    "Não foi possível atualizar o anexo."
  );

  if (!resposta.anexo) {
    throw new Error("A API não retornou o anexo atualizado.");
  }

  return resposta.anexo;
}

export async function excluirAnexo(
  clippingId: number,
  anexoId: number
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_URL}/api/clippings/${clippingId}/anexos/${anexoId}`,
    {
      method: "DELETE",
    }
  );

  await lerResposta(
    response,
    "Não foi possível excluir o anexo."
  );
}

export function obterUrlArquivoAnexo(
  endpoint: string
): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const caminho = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  return `${API_URL}/api${caminho}`;
}

export async function obterTokenParaArquivo(): Promise<
  string | null
> {
  return getToken();
}