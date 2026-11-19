import { API_URL } from "@/constants/api";
import { authenticatedFetch } from "@/services/api/auth";
import {
  ErroApiRelease,
  type BlocoTemplateRelease,
  type TemplateRelease,
} from "@/services/api/release";

export type OrigemTemplate = "TODOS" | "LOGOS" | "ASSESSORIA";

async function ler<T>(resposta: Response): Promise<T> {
  let dados: { success?: boolean; message?: string };

  try {
    dados = await resposta.json();
  } catch {
    throw new ErroApiRelease(
      "A API retornou uma resposta inválida.",
      resposta.status
    );
  }

  if (!resposta.ok || !dados?.success) {
    throw new ErroApiRelease(
      dados?.message || "Não foi possível concluir a operação.",
      resposta.status
    );
  }

  return dados as T;
}

export async function listarTemplates(params: {
  page: number;
  busca: string;
  origem: OrigemTemplate;
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: "20",
    busca: params.busca.trim(),
    origem: params.origem,
  });

  return ler<{
    templates: TemplateRelease[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      has_next: boolean;
    };
  }>(
    await authenticatedFetch(
      API_URL + "/api/templates?" + query
    )
  );
}

export async function salvarTemplate(
  dados: {
    nome: string;
    blocos: BlocoTemplateRelease[];
  },
  atual?: TemplateRelease
): Promise<TemplateRelease> {
  if (atual && atual.id === null) {
    throw new Error("Crie uma cópia do padrão do LOGOS.");
  }

  const resposta = await authenticatedFetch(
    API_URL + "/api/templates" + (atual ? "/" + atual.id : ""),
    {
      method: atual ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        atual
          ? { ...dados, assinatura: atual.assinatura }
          : dados
      ),
    }
  );

  return (
    await ler<{ template: TemplateRelease }>(resposta)
  ).template;
}

export async function removerTemplate(id: number): Promise<void> {
  await ler(
    await authenticatedFetch(
      API_URL + "/api/templates/" + id,
      { method: "DELETE" }
    )
  );
}