import { API_URL } from "@/constants/api";
import { fetch as expoFetch } from "expo/fetch";
import { Directory, File as ExpoFile, Paths } from "expo-file-system";
import { Platform } from "react-native";
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
  total_pendentes: number;
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
  relatorio_id: number;
  logo_midia_id: number | null;
  imagem_midia_id: number | null;
  tipo: "CAPA" | "CLIPPING" | "COMPLEMENTAR" | "ENCERRAMENTO";
  origem_inclusao: "AUTOMATICA" | "MANUAL" | "ESTRUTURA";
  titulo: string | null;
  link: string | null;
  imagem_anexo_id: number | null;
  edicoes_json?: {
    clipping?: Partial<Record<"pauta" | "data_publicacao" | "link", string | null>>;
    veiculo?: Partial<Record<"nome" | "descricao" | "alcance", string | null>>;
    imagem_midia_id?: number | null;
    logo_midia_id?: number | null;
  } | null;
  revisao_pendente: boolean;
  revisao_veiculo_pendente: boolean;
  revisao_clipping_pendente: boolean;
  revisao_token?: string | null;
  novos_valores?: {
    veiculo: Record<string, string | number | string[] | null> | null;
    clipping: Record<string, string | number | string[] | null> | null;
  };
  campos_alterados?: {
    veiculo: string[];
    clipping: string[];
  };
  dados_json: {
    clipping?: {
      pauta?: string | null;
      data_publicacao?: string | null;
      link?: string | null;
    };
    veiculo?: {
      id?: number | null;
      nome?: string | null;
      descricao?: string | null;
      alcance?: string | null;
      logo_path?: string | null;
    };
    imagem?: {
      anexo_id?: number | null;
      arquivo_path?: string | null;
    };
  } | null;
}

export type OrigemRevisao = "novo" | "veiculo" | "clipping";

export interface RelatorioDetalhado extends ResumoRelatorio {
  criado_por: number;
  modelo_codigo: string;
  modelo_versao: number;
  configuracao_json: Record<string, unknown> | null;
  total_slides: number;
  total_pendentes: number;
  pendentes_por_origem: Record<OrigemRevisao, number>;
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
  page = 1,
  busca = "",
  revisao: "todas" | "pendentes" = "todas",
  origens: OrigemRevisao[] = ["novo", "veiculo", "clipping"]
): Promise<{
  relatorio: RelatorioDetalhado;
  slides: SlideRelatorio[];
  pagination: PaginacaoRelatorio;
}> {
  const query = new URLSearchParams({
    page: String(page),
    limit: "20",
    busca: busca.trim(),
    revisao,
  });

  if (revisao === "pendentes") {
    query.set("origens", origens.join(","));
  }
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${id}?${query.toString()}`
  );

  return lerResposta(response, "Não foi possível abrir o relatório.");
}

export type DecisaoRevisaoSlide =
  | "INCLUIR"
  | "ALTERAR"
  | "IGNORAR";

export interface DadosEdicaoSlide {
  pauta?: string | null;
  data_publicacao?: string | null;
  link?: string | null;
  veiculo_nome?: string | null;
  veiculo_descricao?: string | null;
  veiculo_alcance?: string | null;
  imagem_midia_id?: number | null;
  logo_midia_id?: number | null;
}

export interface ArquivoMidiaSlide {
  uri: string;
  nome: string;
  mimeType: string;
  file?: File;
}

export async function atualizarSlideRelatorio(
  relatorioId: number,
  slideId: number,
  dados: DadosEdicaoSlide
): Promise<{ slide_id: number }> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${relatorioId}/slides/${slideId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }
  );

  return lerResposta(response, "Não foi possível salvar o slide.");
}

export async function moverSlideRelatorio(
  relatorioId: number,
  slideId: number,
  novaOrdem: number
): Promise<{ slide_id: number; ordem: number }> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${relatorioId}/slides/${slideId}/ordem`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nova_ordem: novaOrdem }),
    }
  );

  return lerResposta(response, "Não foi possível mover o slide.");
}

export async function enviarMidiaSlideRelatorio(
  relatorioId: number,
  slideId: number,
  tipo: "imagem" | "logo",
  arquivo: ArquivoMidiaSlide
): Promise<number> {
  const formData = new FormData();
  let pastaTemporaria: Directory | null = null;

  try {
    if (Platform.OS === "web") {
      if (!arquivo.file) {
        throw new Error("O arquivo selecionado não está disponível.");
      }

      formData.append("arquivo", arquivo.file, arquivo.nome);
    } else {
      const original = new ExpoFile(arquivo.uri);

      if (!original.exists) {
        throw new Error("O arquivo selecionado não está mais disponível.");
      }

      const nome = arquivo.nome
        .split(/[\\/]/)
        .pop()
        ?.replace(/[\u0000-\u001f\u007f]/g, "_")
        .trim() || "imagem";
      pastaTemporaria = new Directory(
        Paths.cache,
        `slide-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      pastaTemporaria.create();
      const copia = new ExpoFile(pastaTemporaria, nome);
      await original.copy(copia);
      formData.append("arquivo", copia, nome);
    }

    const response = await authenticatedFetch(
      `${API_URL}/api/relatorios/${relatorioId}/slides/${slideId}/midias/${tipo}`,
      { method: "POST", body: formData },
      Platform.OS === "web" ? fetch : expoFetch
    );
    const dados = await lerResposta<{ midia_id: number }>(
      response,
      "Não foi possível enviar a imagem do slide."
    );

    if (!Number.isSafeInteger(dados.midia_id) || dados.midia_id < 1) {
      throw new Error("A API não retornou a imagem enviada.");
    }

    return dados.midia_id;
  } finally {
    if (pastaTemporaria?.exists) {
      try {
        pastaTemporaria.delete();
      } catch {
        // o cache ainda pode ser limpo pelo sistema
      }
    }
  }
}

export async function decidirRevisaoSlide(
  relatorioId: number,
  slideId: number,
  decisao: DecisaoRevisaoSlide,
  revisaoToken: string
): Promise<{
  slide_id: number;
  decisao: DecisaoRevisaoSlide;
  removido: boolean;
  origens_decididas: Array<"VEICULO" | "CLIPPING">;
}> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${relatorioId}/slides/${slideId}/decisao`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisao,
        revisao_token: revisaoToken,
      }),
    }
  );

  return lerResposta(
    response,
    "Não foi possível registrar a decisão do slide."
  );
}

export interface ClienteSelecaoRelatorio {
  id: number;
  nome: string;
  ativo: number;
}

export async function listarClientesRelatorio(params: {
  busca: string;
  page: number;
  limit: number;
}): Promise<{
  clientes: ClienteSelecaoRelatorio[];
  pagination: PaginacaoRelatorio;
}> {
  const query = new URLSearchParams({
    busca: params.busca.trim(),
    page: String(params.page),
    limit: String(params.limit),
  });

  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/clientes?${query.toString()}`
  );

  return lerResposta(
    response,
    "Não foi possível carregar os clientes."
  );
}

export interface DadosEdicaoRelatorio {
  titulo: string;
  inclusao_automatica: boolean;
}

export async function atualizarRelatorio(
  id: number,
  dados: DadosEdicaoRelatorio
): Promise<{ relatorio: RelatorioDetalhado }> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }
  );

  return lerResposta(
    response,
    "Não foi possível atualizar o relatório."
  );
}

export async function excluirRelatorio(
  id: number
): Promise<{ message: string }> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${id}`,
    { method: "DELETE" }
  );

  return lerResposta(
    response,
    "Não foi possível excluir o relatório."
  );
}

export async function excluirSlidesRelatorio(
  relatorioId: number,
  slideIds: number[]
): Promise<{ slides_excluidos: number }> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${relatorioId}/slides/excluir-lote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slide_ids: slideIds }),
    }
  );

  return lerResposta(
    response,
    "Não foi possível excluir os slides."
  );
}

export interface ResumoMateriasEdicao {
  novas: number;
  ja_incluidas: number;
  fora_do_periodo: number;
  assinatura: string;
}

export async function listarMateriasCandidatasRelatorio(
  id: number,
  params: {
    periodo_inicio: string;
    periodo_fim: string;
    page?: number;
    limit?: number;
    busca?: string;
  }
): Promise<{
  materias: MateriaRelatorio[];
  resumo: ResumoMateriasEdicao;
  pagination: PaginacaoRelatorio;
}> {
  const query = new URLSearchParams({
    periodo_inicio: params.periodo_inicio,
    periodo_fim: params.periodo_fim,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }

  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${id}/materias-candidatas?${query}`
  );

  return lerResposta(
    response,
    "Não foi possível consultar as matérias disponíveis."
  );
}

export async function atualizarPeriodoRelatorio(
  id: number,
  dados: {
    periodo_inicio: string;
    periodo_fim: string;
    ids_incluir: number[];
    ids_excluir: number[];
    incluir_todas: boolean;
    assinatura: string;
  }
): Promise<{
  relatorio: RelatorioDetalhado;
  materias_incluidas: number;
}> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${id}/periodo`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }
  );

  return lerResposta(
    response,
    "Não foi possível atualizar o período."
  );
}

export async function gerarPptxTeste(
  id: number
): Promise<ArrayBuffer> {
  const response = await authenticatedFetch(
    `${API_URL}/api/relatorios/${id}/pptx-teste`
  );

  if (!response.ok) {
    let mensagem = "Não foi possível gerar o PPTX.";

    try {
      const dados = await response.json();
      if (typeof dados.message === "string") {
        mensagem = dados.message;
      }
    } catch {
      // mantém a mensagem padrão
    }

    throw new Error(mensagem);
  }

  return response.arrayBuffer();
}
