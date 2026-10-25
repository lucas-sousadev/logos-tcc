import { File as ExpoFile, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

import { API_URL } from "@/constants/api";
import { authenticatedFetch } from "@/services/api/auth";

export type OrigemCaptura = "clipping" | "relatorio";

export interface CapturaPagina {
  uri: string;
  largura: number;
  altura: number;
  incompleta: boolean;
  temProxima: boolean;
  liberar: () => void;
}

export async function capturarPagina(
  link: string,
  origem: OrigemCaptura,
  trecho = 0
): Promise<CapturaPagina> {
  const rota =
    origem === "clipping"
      ? "/api/clippings/capturar-pagina"
      : "/api/relatorios/capturar-pagina";

  const resposta = await authenticatedFetch(
    `${API_URL}${rota}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        link: link.trim(),
        trecho,
        }),
    },
    Platform.OS === "web" ? fetch : expoFetch
  );

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => null);
    throw new Error(
      typeof dados?.message === "string"
        ? dados.message
        : "Não foi possível capturar a página."
    );
  }

  if (
    !resposta.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("image/jpeg")
  ) {
    throw new Error("A API retornou uma imagem inválida.");
  }

  const largura = Number(resposta.headers.get("X-Captura-Largura"));
  const altura = Number(resposta.headers.get("X-Captura-Altura"));
  const incompleta = resposta.headers.get("X-Captura-Incompleta") === "1";
  const temProxima = resposta.headers.get("X-Captura-Tem-Proxima") === "1";

  if (
    !Number.isSafeInteger(largura) ||
    !Number.isSafeInteger(altura) ||
    largura < 1 ||
    altura < 1
  ) {
    throw new Error("A API não informou o tamanho da captura.");
  }

  if (Platform.OS === "web") {
    const imagem = await resposta.blob();
    const uri = URL.createObjectURL(imagem);

    return {
        uri,
        largura,
        altura,
        incompleta,
        temProxima,
        liberar: () => URL.revokeObjectURL(uri),
        };
  }

  const arquivo = new ExpoFile(
    Paths.cache,
    `captura-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  );

  arquivo.create();
  arquivo.write(new Uint8Array(await resposta.arrayBuffer()));

  return {
    uri: arquivo.uri,
    largura,
    altura,
    incompleta,
    temProxima,
    liberar: () => {
      if (arquivo.exists) arquivo.delete();
    },
  };
}