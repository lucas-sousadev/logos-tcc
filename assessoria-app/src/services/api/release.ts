import type { DocumentPickerAsset } from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";
import { API_URL } from "@/constants/api";
import { authenticatedFetch } from "@/services/api/auth";
import type {
  Jornalista,
  ListarJornalistasParams,
} from "@/services/api/jornalista";

export type StatusRelease =
  | "RASCUNHO"
  | "AGENDADO"
  | "NA_FILA"
  | "ENVIANDO"
  | "ENVIADO"
  | "PARCIAL"
  | "FALHOU"
  | "CANCELADO";

export const ROTULOS_STATUS: Record<StatusRelease, string> = {
  RASCUNHO: "Rascunho",
  AGENDADO: "Agendado",
  NA_FILA: "Na fila",
  ENVIANDO: "Enviando",
  ENVIADO: "Encaminhado ao servidor",
  PARCIAL: "Concluído com falhas",
  FALHOU: "Falha no envio",
  CANCELADO: "Cancelado",
};

export interface ResumoRelease {
  id: number;
  titulo: string;
  assunto: string;
  cliente_id: number | null;
  cliente_nome: string | null;
  criado_por: number;
  criado_por_nome: string;
  status: StatusRelease;
  total_destinatarios: number;
  created_at: string;
  updated_at: string;
  agendado_para: string | null;
  data_referencia?: string;
}

export interface DadosEnvioRelease {
  assunto: string;
  primeira_linha: string;
  nome_remetente: string;
  responder_para: string;
}

export interface DadosNovoRelease {
  titulo: string;
  cliente_id: number | null;
  jornalistas_ids: number[];
  chave_rascunho: string;
  template_id?: number | null;
  template_codigo?: string | null;
  template_assinatura?: string | null;
  blocos?: BlocoTemplateRelease[];
  dados_envio?: DadosEnvioRelease;
}

interface Paginacao {
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

interface RespostaApi {
  success: boolean;
  message?: string;
}

export class ErroApiRelease extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ErroApiRelease";
  }
}

async function lerResposta<T>(response: Response): Promise<T> {
  let dados: T & RespostaApi;

  try {
    dados = await response.json();
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }

  if (!dados || typeof dados !== "object") {
    throw new Error("A API retornou uma resposta inválida.");
  }

  if (!response.ok || dados.success !== true) {
    throw new ErroApiRelease(
      dados.message || "Não foi possível concluir a operação.",
      response.status
    );
  }

  return dados;
}

export async function listarReleases(
  params: {
    page?: number;
    busca?: string;
    status?: StatusRelease | "";
  } = {}
): Promise<{
  releases: ResumoRelease[];
  pagination: Paginacao;
}> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: "20",
  });

  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }

  if (params.status) {
    query.set("status", params.status);
  }

  const response = await authenticatedFetch(
    API_URL + "/api/releases?" + query.toString()
  );

  return lerResposta(response);
}

export async function criarRelease(
  dados: DadosNovoRelease
): Promise<DetalheRelease> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const prazo = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("O servidor demorou para confirmar o salvamento."));
      controller.abort();
    }, 30_000);
  });

  try {
    const envio = authenticatedFetch(API_URL + "/api/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
      signal: controller.signal,
    }).then(lerResposta<{ release: DetalheRelease }>);

    const { release } = await Promise.race([envio, prazo]);

    if (!Number.isSafeInteger(release?.id) || release.id < 1) {
      throw new Error("A API não confirmou o número do rascunho.");
    }

    return release;
  } finally {
    clearTimeout(timer);
  }
}

export async function enviarTesteRelease(
  email: string,
  dadosEnvio: DadosEnvioRelease,
  blocos: BlocoTemplateRelease[]
): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const prazo = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            "O envio ainda não foi confirmado. Confira a caixa de entrada antes de tentar novamente."
          )
        );
        controller.abort();
      }, 45_000);
    });

    const envio = authenticatedFetch(API_URL + "/api/releases/envio-teste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, dados_envio: dadosEnvio, blocos }),
      signal: controller.signal,
    }).then(lerResposta);

    await Promise.race([envio, prazo]);
  } finally {
    clearTimeout(timer);
  }
}

export type DestinatarioRelease = Pick<
  Jornalista,
  "id" | "nome" | "email" | "veiculo_nome" | "ativo"
> & { elegivel: boolean };

function parametrosDestinatarios(filtros: ListarJornalistasParams) {
  const query = new URLSearchParams();

  for (const campo of [
    "busca",
    "estado",
    "cidade",
    "cargo",
    "veiculo_id",
    "ativo",
  ] as const) {
    const valor = filtros[campo];

    if (valor !== undefined && valor !== "") {
      query.set(campo, String(valor));
    }
  }

  return query;
}

export async function listarDestinatariosRelease(
  filtros: ListarJornalistasParams
): Promise<{ jornalistas: DestinatarioRelease[]; pagination: Paginacao }> {
  const query = parametrosDestinatarios(filtros);
  query.set("page", String(filtros.page ?? 1));
  query.set("limit", String(filtros.limit ?? 30));

  const response = await authenticatedFetch(
    API_URL + "/api/releases/destinatarios?" + query.toString()
  );

  return lerResposta(response);
}

export async function selecionarDestinatariosDoFiltro(
  filtros: ListarJornalistasParams,
  signal?: AbortSignal
): Promise<{
  jornalistas: DestinatarioRelease[];
  total_encontrados: number;
  total_ignorados: number;
}> {
  const query = parametrosDestinatarios(filtros);
  const response = await authenticatedFetch(
    API_URL + "/api/releases/destinatarios?" + query.toString(),
    { signal }
  );

  return lerResposta(response);
}

export interface BlocoTemplateRelease {
  id: string;
  tipo:
    | "titulo"
    | "linha_fina"
    | "texto"
    | "imagem"
    | "contato"
    | "divisor"
    | "espacamento"
    | "botao"
    | "arquivo";
  texto?: string;
  url?: string;
  legenda?: string;
}

export interface TemplateRelease {
  id: number | null;
  codigo: string | null;
  nome: string;
  origem: "LOGOS" | "ASSESSORIA";
  assinatura: string;
  disponivel: boolean;
  blocos: BlocoTemplateRelease[];
}

export async function listarTemplatesRelease(
  params: {
    page?: number;
    busca?: string;
    origem?: "TODOS" | "LOGOS" | "ASSESSORIA";
  } = {}
): Promise<{
  templates: TemplateRelease[];
  pagination: Paginacao;
}> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: "20",
    origem: params.origem ?? "TODOS",
  });

  if (params.busca?.trim()) {
    query.set("busca", params.busca.trim());
  }

  const response = await authenticatedFetch(
    API_URL + "/api/releases/templates?" + query.toString()
  );

  return lerResposta(response);
}

export async function carregarImagemRelease(
  arquivo: DocumentPickerAsset,
  contexto: "RELEASES" | "TEMPLATES" = "RELEASES"
): Promise<string> {
  const formulario = new FormData();
  const imagem =
    Platform.OS === "web" ? arquivo.file : new ExpoFile(arquivo.uri);

  if (!imagem) {
    throw new Error("A imagem selecionada não está disponível.");
  }

  formulario.append("arquivo", imagem, arquivo.name);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const prazo = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("O envio da imagem demorou demais. Tente novamente."));
        controller.abort();
      }, 45_000);
    });

    const envio = authenticatedFetch(
      API_URL +
        (contexto === "TEMPLATES"
          ? "/api/templates/imagens"
          : "/api/releases/imagens"),
      { method: "POST", body: formulario, signal: controller.signal },
      Platform.OS === "web" ? fetch : expoFetch
    ).then(lerResposta<{ caminho: string }>);

    const { caminho } = await Promise.race([envio, prazo]);

    if (
      !/^\/api\/releases\/imagens\/[1-9]\d*\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(
        caminho
      )
    ) {
      throw new Error("A API não retornou o endereço da imagem.");
    }

    return API_URL.replace(/\/$/, "") + caminho;
  } finally {
    clearTimeout(timer);
  }
}

export function obterEndpointImagemRelease(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const base = new URL(API_URL);
    const imagem = new URL(url);
    const prefixo = base.pathname.replace(/\/+$/, "");

    if (
      imagem.origin !== base.origin ||
      imagem.username ||
      imagem.password ||
      !imagem.pathname.startsWith(prefixo + "/")
    ) {
      return null;
    }

    const caminho = imagem.pathname.slice(prefixo.length);
    const partes = caminho.match(
      /^\/(?:api\/releases\/imagens|uploads\/releases)\/([1-9]\d*)\/([a-f0-9]{64}\.(?:jpg|png|webp))$/
    );

    return partes ? "/releases/imagens/" + partes[1] + "/" + partes[2] : null;
  } catch {
    return null;
  }
}

export interface DetalheRelease extends ResumoRelease {
  chave_rascunho?: string | null;
  template_id: number | null;
  template_codigo: string | null;
  versao_edicao: string;
  blocos: BlocoTemplateRelease[];
  primeira_linha: string;
  nome_remetente: string;
  responder_para: string;
  destinatarios: {
    id: number;
    jornalista_id: number | null;
    jornalista_nome: string | null;
    jornalista_ativo: number | null;
    jornalista_email: string | null;
    veiculo_nome: string | null;
    email: string;
    status: StatusDestinatarioRelease;
  }[];
}

export type StatusDestinatarioRelease =
  | "PENDENTE"
  | "ENVIANDO"
  | "ENVIADO"
  | "ERRO"
  | "CANCELADO";

export interface SituacaoEnvioRelease {
  aberturas: MetricasAberturaRelease;
  release: {
    id: number;
    status: StatusRelease;
    agendado_para: string | null;
    agendamento_fuso: "America/Sao_Paulo";
    iniciado_em: string | null;
    enviado_em: string | null;
  };
  totais: {
    total: number;
    pendentes: number;
    processando: number;
    aceitos: number;
    falhas: number;
    cancelados: number;
    repetiveis: number;
    incertos: number;
    aguardando_retentativa: number;
  };
  destinatarios: {
    id: number;
    email: string;
    nome: string | null;
    status: StatusDestinatarioRelease;
    enviado_em: string | null;
    erro_mensagem: string | null;
    tentativas: number;
    ultima_tentativa_em: string | null;
    proxima_tentativa_em: string | null;
    erro_tipo: TipoFalhaRelease | null;
    smtp_codigo: number | null;
    rastreamento_abertura: boolean;
    aberto_em: string | null;
    aberturas_quantidade: number;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface MetricasAberturaRelease {
  coleta_configurada: boolean;
  envios_rastreados: number;
  envios_sem_rastreamento: number;
  destinatarios_abertos: number;
  carregamentos_registrados: number;
  aberturas_sem_confirmacao: number;
  taxa_percentual: number | null;
}

export async function buscarRelease(
  id: number,
  signal?: AbortSignal
): Promise<DetalheRelease> {
  const dados = await lerResposta<{
    release: DetalheRelease;
  }>(await authenticatedFetch(API_URL + "/api/releases/" + id, { signal }));

  return dados.release;
}

export async function consultarEnvioRelease(
  id: number,
  consulta: {
    page: number;
    status: StatusDestinatarioRelease | "TODOS";
  },
  signal?: AbortSignal
): Promise<SituacaoEnvioRelease> {
  const query = new URLSearchParams({
    page: String(consulta.page),
    status: consulta.status,
  });

  return (
    await lerResposta<{ envio: SituacaoEnvioRelease }>(
      await authenticatedFetch(
        API_URL + "/api/releases/" + id + "/envio?" + query,
        { signal }
      )
    )
  ).envio;
}

export async function solicitarEnvioRelease(
  id: number,
  versao?: string
): Promise<SituacaoEnvioRelease> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const prazo = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            "A solicitação ainda não foi confirmada. Confira o andamento antes de tentar novamente."
          )
        );
        controller.abort();
      }, 30_000);
    });

    const requisicao = authenticatedFetch(
      API_URL + "/api/releases/" + id + "/enviar",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(versao ? { versao_edicao: versao } : {}),
        signal: controller.signal,
      }
    ).then(lerResposta<{ envio: SituacaoEnvioRelease }>);

    return (await Promise.race([requisicao, prazo])).envio;
  } finally {
    clearTimeout(timer);
  }
}

export type DadosEdicaoRelease = Omit<
  DadosNovoRelease,
  | "chave_rascunho"
  | "template_id"
  | "template_codigo"
  | "blocos"
  | "dados_envio"
> & {
  versao_edicao: string;
  template_id: number | null;
  template_codigo: string | null;
  blocos: BlocoTemplateRelease[];
  dados_envio: DadosEnvioRelease;
};

async function alterarRelease<T>(
  id: number,
  method: "PUT" | "DELETE",
  dados: unknown
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    return await lerResposta<T>(
      await authenticatedFetch(API_URL + "/api/releases/" + id, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
        signal: controller.signal,
      })
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function atualizarRelease(
  id: number,
  dados: DadosEdicaoRelease
): Promise<DetalheRelease> {
  return (await alterarRelease<{ release: DetalheRelease }>(id, "PUT", dados))
    .release;
}

export async function excluirRelease(
  id: number,
  versao: string
): Promise<void> {
  await alterarRelease(id, "DELETE", {
    versao_edicao: versao,
  });
}
export interface PedidoRascunhoRelease {
  id: number | null;
  chave: string;
  versao: string | null;
  dados: Omit<DadosEdicaoRelease, "versao_edicao">;
}

export async function descartarRascunhoRelease(
  chave: string,
  conta: string
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const resposta = await authenticatedFetch(
      API_URL + "/api/releases/rascunho/descartar",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave_rascunho: chave, conta }),
        signal: controller.signal,
      }
    );
    const resultado = await lerResposta<{
      descartado: boolean;
      envio_preservado: boolean;
    }>(resposta);
    if (
      typeof resultado.descartado !== "boolean" ||
      typeof resultado.envio_preservado !== "boolean"
    ) {
      throw new Error("O servidor não confirmou o descarte do rascunho.");
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function sincronizarRascunhoRelease(
  pedido: PedidoRascunhoRelease
): Promise<DetalheRelease> {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const resposta = await authenticatedFetch(
      API_URL + "/api/releases/rascunho",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pedido),
        signal: controller.signal,
      }
    );

    const { release } = await lerResposta<{
      release: DetalheRelease;
    }>(resposta);

    if (
      !Number.isSafeInteger(release?.id) ||
      !/^[a-f0-9]{64}$/.test(release.versao_edicao)
    ) {
      throw new Error("O servidor não confirmou a versão do rascunho.");
    }

    return release;
  } finally {
    clearTimeout(timer);
  }
}

export type TipoFalhaRelease =
  | "TEMPORARIA"
  | "PERMANENTE"
  | "CONFIGURACAO"
  | "INCERTA";

export interface ResultadoProgramacaoRelease {
  release: DetalheRelease;
  envio: SituacaoEnvioRelease;
}

async function alterarProgramacaoRelease(
  id: number,
  acao: "agendar" | "cancelar-agendamento" | "cancelar-envio",
  dados: { versao_edicao: string; data?: string; hora?: string }
): Promise<ResultadoProgramacaoRelease> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    return await lerResposta<ResultadoProgramacaoRelease>(
      await authenticatedFetch(API_URL + "/api/releases/" + id + "/" + acao, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
        signal: controller.signal,
      })
    );
  } catch (erro) {
    if (controller.signal.aborted) {
      throw new Error(
        "A operação ainda não foi confirmada. Atualize o release para conferir o resultado antes de tentar novamente."
      );
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

export function agendarRelease(
  id: number,
  versao: string,
  horario: { data: string; hora: string }
) {
  return alterarProgramacaoRelease(id, "agendar", {
    versao_edicao: versao,
    ...horario,
  });
}

export function cancelarAgendamentoRelease(id: number, versao: string) {
  return alterarProgramacaoRelease(id, "cancelar-agendamento", {
    versao_edicao: versao,
  });
}

export function cancelarEnvioRelease(id: number, versao: string) {
  return alterarProgramacaoRelease(id, "cancelar-envio", {
    versao_edicao: versao,
  });
}

export async function repetirFalhasRelease(
  id: number
): Promise<SituacaoEnvioRelease> {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const resposta = await authenticatedFetch(
      API_URL + "/api/releases/" + id + "/repetir-falhas",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      }
    );

    const dados = await lerResposta<{
      envio: SituacaoEnvioRelease;
    }>(resposta);

    return dados.envio;
  } catch (erro) {
    if (controller.signal.aborted) {
      throw new Error(
        "A solicitação demorou para responder. Atualize o acompanhamento antes de tentar novamente."
      );
    }

    throw erro;
  } finally {
    clearTimeout(timer);
  }
}
