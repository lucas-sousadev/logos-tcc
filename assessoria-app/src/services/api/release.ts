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
  | "ENVIANDO"
  | "ENVIADO";

export const ROTULOS_STATUS: Record<StatusRelease, string> = {
  RASCUNHO: "Rascunho",
  AGENDADO: "Agendado",
  ENVIANDO: "Enviando",
  ENVIADO: "Enviado",
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
): Promise<ResumoRelease> {
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
    }).then(lerResposta<{ release: ResumoRelease }>);

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
        reject(new Error(
          "O envio ainda não foi confirmado. Confira a caixa de entrada antes de tentar novamente."
        ));
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
  arquivo: DocumentPickerAsset
): Promise<string> {
  const formulario = new FormData();
  const imagem = Platform.OS === "web" ? arquivo.file : new ExpoFile(arquivo.uri);

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
      API_URL + "/api/releases/imagens",
      { method: "POST", body: formulario, signal: controller.signal },
      Platform.OS === "web" ? fetch : expoFetch
    ).then(lerResposta<{ caminho: string }>);

    const { caminho } = await Promise.race([envio, prazo]);

    if (!/^\/uploads\/releases\/\d+\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(caminho)) {
      throw new Error("A API não retornou o endereço da imagem.");
    }

    return API_URL.replace(/\/$/, "") + caminho;
  } finally {
    clearTimeout(timer);
  }
}