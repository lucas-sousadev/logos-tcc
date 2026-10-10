import { API_URL } from "@/constants/api";
import { authenticatedFetch } from "@/services/api/auth";

export interface PaginacaoRelatorio {
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

export interface ResumoRelatorio {
  id: number;
  cliente_id: number;
  cliente_nome: string;
  titulo: string;
  periodo_inicio: string;
  periodo_fim: string;
  inclusao_automatica: boolean;
  total_materias: number;
  novos_pendentes: number;
  created_at: string;
  updated_at: string;
}

export interface MateriaRelatorio {
  id: number;
  cliente_id: number;
  ano_referencia: number;
  data_publicacao: string | null;
  pauta: string | null;
  veiculo_nome: string | null;
  programa_secao: string | null;
  categorias: string[];
  imagem_anexo_id: number | null;
}

export interface SlideRelatorio {
  id: number;
  clipping_id: number | null;
  ordem: number;
  tipo: "CAPA" | "CLIPPING" | "COMPLEMENTAR" | "ENCERRAMENTO";
  origem_inclusao: "AUTOMATICA" | "MANUAL" | "ESTRUTURA";
  revisao_pendente: boolean;
  imagem_anexo_id: number | null;
  titulo: string | null;
  link: string | null;
  dados_json: {
    clipping?: {
      pauta?: string | null;
      data_publicacao?: string | null;
    };
    veiculo?: {
      nome?: string | null;
    };
  } | null;
}

export interface RelatorioDetalhado extends ResumoRelatorio {
  criado_por: number;
  modelo_codigo: string;
  modelo_versao: number;
  configuracao_json: Record<string, unknown> | null;
}

export interface DadosNovoRelatorio {
  cliente_id: number;
  titulo: string;
  periodo_inicio: string;
  periodo_fim: string;
  inclusao_automatica: boolean;
  ids_excluidos: number[];
  ids_sem_data_incluidos: number[];
}

type RespostaApi = {
  success: boolean;
  message?: string;
};

async function lerResposta<T>(
  response: Response,
  mensagemPadrao: string
): Promise<T> {
  const texto = await response.text();
  let dados: T & RespostaApi;

  try {
    dados = JSON.parse(texto) as T & RespostaApi;
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }

  if (!response.ok || !dados.success) {
    throw new Error(dados.message || mensagemPadrao);
  }

  return dados;
}

export async function listarRelatorios(params: {
  page?: number;
  limit?: number;
  busca?: string;
  cliente_id?: number;
  ano?: number;
  inclusao?: "todas" | "ativa" | "pausada";
  pendencias?: "todas" | "com" | "sem";
  ordem?: "recentes" | "antigos" | "mais_materias";
} = {}): Promise<{
  relatorios: ResumoRelatorio[];
  pagination: PaginacaoRelatorio;
}> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }

  if (params.cliente_id) {
    query.set("cliente_id", String(params.cliente_id));
  }

  if (params.ano) {
    query.set("ano", String(params.ano));
  }

  if (params.inclusao && params.inclusao !== "todas") {
    query.set("inclusao", params.inclusao);
  }

  if (params.pendencias && params.pendencias !== "todas") {
    query.set("pendencias", params.pendencias);
  }

  if (params.ordem && params.ordem !== "recentes") {
    query.set("ordem", params.ordem);
  }

  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios?${query.toString()}`
  );

  return lerResposta(
    response,
    "Não foi possível carregar os relatórios."
  );
}

export async function listarMateriasRelatorio(params: {
  cliente_id: number;
  periodo_inicio: string;
  periodo_fim: string;
  tipo: "periodo" | "sem_data";
  page?: number;
  limit?: number;
  busca?: string;
}): Promise<{
  materias: MateriaRelatorio[];
  resumo: {
    no_periodo: number;
    sem_data: number;
  };
  pagination: PaginacaoRelatorio;
}> {
  const query = new URLSearchParams({
    cliente_id: String(params.cliente_id),
    periodo_inicio: params.periodo_inicio,
    periodo_fim: params.periodo_fim,
    tipo: params.tipo,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }

  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/materias?${query.toString()}`
  );

  return lerResposta(
    response,
    "Não foi possível consultar as matérias."
  );
}

export async function criarRelatorio(
  dados: DadosNovoRelatorio
): Promise<{ relatorio: { id: number; total_materias: number } }> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }
  );

  return lerResposta(
    response,
    "Não foi possível criar o relatório."
  );
}

export async function buscarRelatorio(
  id: number,
  page = 1
): Promise<{
  relatorio: RelatorioDetalhado;
  slides: SlideRelatorio[];
  pagination: PaginacaoRelatorio;
}> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${id}?page=${page}&limit=20`
  );

  return lerResposta(
    response,
    "Não foi possível abrir o relatório."
  );
}