import { API_URL } from "@/constants/api";
import { authenticatedFetch } from "@/services/api/auth";

export type ModuloDuplicacao = "clipping" | "releases";

export class ErroDuplicacao extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ErroDuplicacao";
  }
}

export async function duplicarCadastro(
  modulo: ModuloDuplicacao,
  id: number,
  opcoes: { incluirAnexos: boolean; chave: string }
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ErroDuplicacao(
          "O servidor demorou para confirmar a duplicação.",
          408
        )
      );
    }, 60_000);
  });

  try {
    const enviar = async () => {
      const response = await authenticatedFetch(
        `${API_URL}/api/${modulo === "clipping" ? "clippings" : "releases"}/${id}/duplicar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            modulo === "clipping"
              ? { incluir_anexos: opcoes.incluirAnexos }
              : { chave_rascunho: opcoes.chave }
          ),
          signal: controller.signal,
        }
      );
      const dados = await response.json().catch(() => null);
      if (!dados || typeof dados !== "object") {
        throw new ErroDuplicacao(
          "A API não confirmou o resultado da duplicação.",
          0
        );
      }
      if (!response.ok || !dados?.success) {
        throw new ErroDuplicacao(
          dados?.message || "Não foi possível duplicar o registro.",
          response.status
        );
      }
      const copia = modulo === "clipping" ? dados.clipping : dados.release;
      if (!Number.isSafeInteger(copia?.id) || copia.id <= 0) {
        throw new ErroDuplicacao(
          "A API não confirmou a cópia. Confira a lista antes de tentar novamente.",
          0
        );
      }
      return {
        id: copia.id as number,
        destinatariosIgnorados: Number(dados.destinatarios_nao_copiados ?? 0),
      };
    };
    return await Promise.race([enviar(), prazo]);
  } finally {
    clearTimeout(timer);
  }
}
