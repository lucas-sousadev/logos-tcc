import { API_URL } from "@/constants/api";
import { authenticatedFetch, type Usuario } from "@/services/api/auth";
import {
  anexarArquivo,
  fetchUpload,
  type ArquivoUpload,
} from "@/services/arquivoUpload";

export interface PerfilUsuario extends Usuario {
  cargo: string | null;
  cidade: string | null;
  uf: string | null;
  assessoria_nome: string;
  created_at: string;
  perfil_versao: string;
}

export interface DadosPerfil {
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  cidade: string;
  uf: string;
  perfil_versao: string;
  senha_atual?: string;
}

export class ErroPerfil extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ErroPerfil";
  }
}

async function lerResposta(response: Response): Promise<PerfilUsuario> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !data.usuario) {
    throw new ErroPerfil(
      data?.message || "Não foi possível carregar o perfil. Tente novamente.",
      response.status
    );
  }
  return data.usuario;
}

export async function buscarPerfil(
  signal?: AbortSignal
): Promise<PerfilUsuario> {
  return lerResposta(
    await authenticatedFetch(API_URL + "/api/perfil", {
      method: "GET",
      cache: "no-store",
      signal,
    })
  );
}

export async function salvarPerfil(
  dados: DadosPerfil,
  foto: ArquivoUpload | null,
  remover: boolean
): Promise<PerfilUsuario> {
  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(dados))
    formulario.append(campo, valor ?? "");
  if (remover) formulario.append("remover_foto", "1");
  if (foto) anexarArquivo(formulario, "foto", foto);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ErroPerfil(
          "O servidor demorou para confirmar o salvamento. Confira a versão atual antes de tentar novamente.",
          408
        )
      );
    }, 30_000);
  });
  try {
    const envio = authenticatedFetch(
      API_URL + "/api/perfil",
      { method: "POST", body: formulario, signal: controller.signal },
      fetchUpload
    ).then(lerResposta);
    return await Promise.race([envio, prazo]);
  } finally {
    clearTimeout(timer);
  }
}

export function obterUrlFotoPerfil(caminho?: string | null): string | null {
  if (
    !caminho ||
    !/^uploads\/perfis\/\d+\/\d+\/[a-f0-9]{32}\.(?:jpg|png|webp)$/.test(caminho)
  )
    return null;
  return API_URL + "/" + caminho;
}
