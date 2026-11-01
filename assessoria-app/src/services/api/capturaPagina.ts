import { File as ExpoFile, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

import { API_URL } from "@/constants/api";
import { authenticatedFetch } from "@/services/api/auth";

export type OrigemCaptura = "clipping" | "relatorio";
export type EstadoCaptura = "aguardando" | "processando";

export interface CapturaPagina {
  uri: string;
  largura: number;
  altura: number;
  incompleta: boolean;
  temProxima: boolean;
  liberar: () => void;
}

interface OpcoesCaptura {
  signal?: AbortSignal;
  onProgresso?: (estado: EstadoCaptura) => void;
}

function erroCancelamento(): Error {
  return Object.assign(new Error("A captura foi cancelada."), {
    name: "AbortError",
  });
}

function conferirSinal(sinal: AbortSignal): void {
  if (sinal.aborted) throw erroCancelamento();
}

function esperar(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    if (sinal.aborted) {
      rejeitar(erroCancelamento());
      return;
    }

    const cancelar = () => {
      clearTimeout(prazo);
      sinal.removeEventListener("abort", cancelar);
      rejeitar(erroCancelamento());
    };

    const prazo = setTimeout(() => {
      sinal.removeEventListener("abort", cancelar);
      resolver();
    }, ms);

    sinal.addEventListener("abort", cancelar, { once: true });
  });
}

async function solicitar(
  rota: string,
  dados: Record<string, unknown>,
  sinal?: AbortSignal
): Promise<Response> {
  const controlador = new AbortController();
  const cancelar = () => controlador.abort();

  if (sinal?.aborted) controlador.abort();

  sinal?.addEventListener("abort", cancelar, { once: true });

  let expirou = false;

  const prazo = setTimeout(() => {
    expirou = true;
    controlador.abort();
  }, 15_000);

  try {
    return await authenticatedFetch(
      `${API_URL}${rota}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
        signal: controlador.signal,
      },
      Platform.OS === "web" ? fetch : expoFetch
    );
  } catch (erro) {
    if (sinal?.aborted) throw erroCancelamento();

    if (expirou) {
      throw new Error("A conexão com a captura demorou demais. Tente novamente.");
    }

    throw erro;
  } finally {
    clearTimeout(prazo);
    sinal?.removeEventListener("abort", cancelar);
  }
}

async function conferirResposta(resposta: Response): Promise<void> {
  if (resposta.ok) return;

  const dados = await resposta.json().catch(() => null);

  throw new Error(
    typeof dados?.message === "string"
      ? dados.message
      : "Não foi possível capturar a página."
  );
}

async function lerCaptura(
  resposta: Response,
  sinal: AbortSignal
): Promise<CapturaPagina> {
  const largura = Number(resposta.headers.get("X-Captura-Largura"));
  const altura = Number(resposta.headers.get("X-Captura-Altura"));
  if (
    !Number.isSafeInteger(largura) ||
    !Number.isSafeInteger(altura) ||
    largura < 1 ||
    largura > 1280 ||
    altura < 1 ||
    altura > 1200
  ) {
    throw new Error("A API não informou um tamanho válido para a captura.");
  }

  const comum = {
    largura,
    altura,
    incompleta: resposta.headers.get("X-Captura-Incompleta") === "1",
    temProxima: resposta.headers.get("X-Captura-Tem-Proxima") === "1",
  };

  if (Platform.OS === "web") {
    const imagem = await resposta.blob();
    conferirSinal(sinal);

    if (imagem.size < 1 || imagem.size > 4 * 1024 * 1024) {
      throw new Error("A captura tem um tamanho inválido.");
    }

    const uri = URL.createObjectURL(imagem);

    return {
      ...comum,
      uri,
      liberar: () => URL.revokeObjectURL(uri),
    };
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  conferirSinal(sinal);

  if (bytes.length < 1 || bytes.length > 4 * 1024 * 1024) {
    throw new Error("A captura tem um tamanho inválido.");
  }

  const arquivo = new ExpoFile(
    Paths.cache,
    `captura-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  );

  try {
    arquivo.create();
    arquivo.write(bytes);
  } catch (erro) {
    if (arquivo.exists) arquivo.delete();

    throw erro;
  }

  return {
    ...comum,
    uri: arquivo.uri,
    liberar: () => {
      if (arquivo.exists) arquivo.delete();
    },
  };
}

export async function capturarPagina(
  link: string,
  origem: OrigemCaptura,
  trecho = 0,
  opcoes: OpcoesCaptura = {}
): Promise<CapturaPagina> {
  const rota =
    origem === "clipping"
      ? "/api/clippings/capturar-pagina"
      : "/api/relatorios/capturar-pagina";

  const controlador = new AbortController();
  const cancelar = () => controlador.abort();

  if (opcoes.signal?.aborted) controlador.abort();

  opcoes.signal?.addEventListener("abort", cancelar, { once: true });

  let expirou = false;

  const prazoTotal = setTimeout(() => {
    expirou = true;
    controlador.abort();
  }, 240_000);

  let capturaId: string | null = null;

  try {
    conferirSinal(controlador.signal);

    // espera o ID chegar pra cancelar também se o modal fechar durante a criação
    let resposta = await solicitar(rota, {
      acao: "iniciar",
      link: link.trim(),
      trecho,
    });

    await conferirResposta(resposta);

    const inicio = await resposta.json().catch(() => null);

    if (resposta.status !== 202 || typeof inicio?.captura?.id !== "string") {
      throw new Error("A API não informou o identificador da captura.");
    }

    capturaId = inicio.captura.id;
    let estado: unknown = inicio.captura.estado;

    while (true) {
      conferirSinal(controlador.signal);

      if (estado !== "aguardando" && estado !== "processando") {
        throw new Error("A API retornou um estado de captura inválido.");
      }

      opcoes.onProgresso?.(estado);

      // faz uma consulta por vez pra não acumular pedidos se a conexão ficar lenta
      await esperar(1500, controlador.signal);
      resposta = await solicitar(
        rota,
        { acao: "consultar", captura_id: capturaId },
        controlador.signal
      );

      await conferirResposta(resposta);

      if (
        resposta.status === 200 &&
        resposta.headers
          .get("Content-Type")
          ?.toLowerCase()
          .startsWith("image/jpeg")
      ) {
        return await lerCaptura(resposta, controlador.signal);
      }

      const dados = await resposta.json().catch(() => null);

      if (resposta.status !== 202 || dados?.captura?.id !== capturaId) {
        throw new Error("A API retornou uma resposta de captura inválida.");
      }

      estado = dados.captura.estado;
    }
  } catch (erro) {
    if (expirou) {
      throw new Error("A captura demorou demais. Tente novamente em instantes.");
    }

    throw erro;
  } finally {
    clearTimeout(prazoTotal);
    opcoes.signal?.removeEventListener("abort", cancelar);
    controlador.abort();

    if (capturaId) {
      // libera a cópia no servidor ou deixa expirar se a conexão cair
      void solicitar(rota, {
        acao: "cancelar",
        captura_id: capturaId,
      }).catch(() => { });
    }
  }
}
