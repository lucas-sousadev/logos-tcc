import { Platform } from "react-native";
import { Directory, type File } from "expo-file-system";
import * as Crypto from "expo-crypto";

export interface ResultadoSalvamento {
  status: "salvo" | "solicitado" | "cancelado";
  nome: string;
  mensagem: string;
}

let seletorOcupado = false;

function foiCancelado(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;

  const codigo =
    "code" in erro ? String(erro.code) : "";

  const mensagem =
    "message" in erro ? String(erro.message) : "";

  return (
    /PICKER_CANCELLED|FILE_PICKING_CANCELLED/.test(codigo) ||
    /cancelled by the user|canceled by the user/i.test(
      mensagem
    )
  );
}

export async function salvarArquivo(
  conteudo: ArrayBuffer,
  nomeInformado: string,
  mimeType: string
): Promise<ResultadoSalvamento> {
  const nome = nomeInformado
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "_")
    .trim();

  if (!nome || nome === "." || nome === "..") {
    throw new Error("Nome de arquivo inválido.");
  }

  if (conteudo.byteLength === 0) {
    throw new Error("O arquivo gerado está vazio.");
  }

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([conteudo], { type: mimeType })
    );

    const link = document.createElement("a");

    try {
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );
    }

    return {
      status: "solicitado",
      nome,
      mensagem:
        `O download de ${nome} foi solicitado ao navegador.`,
    };
  }

  if (seletorOcupado) {
    throw new Error(
      "Conclua a escolha da pasta que já está aberta."
    );
  }

  seletorOcupado = true;

  try {
    let pasta: Directory;

    try {
      pasta = await Directory.pickDirectoryAsync();
    } catch (erro) {
      if (foiCancelado(erro)) {
        return {
          status: "cancelado",
          nome,
          mensagem: "Salvamento cancelado.",
        };
      }

      throw new Error(
        "Não foi possível abrir a escolha de pasta. Tente novamente."
      );
    }

    // Preserva exportações anteriores com o mesmo nome.
    const ponto = nome.lastIndexOf(".");
    const sufixo = "-" + Crypto.randomUUID().slice(0, 8);

    const nomeDestino =
      ponto > 0
        ? nome.slice(0, ponto) +
          sufixo +
          nome.slice(ponto)
        : nome + sufixo;

    let destino: File | null = null;

    try {
      destino = pasta.createFile(nomeDestino, mimeType);
      destino.write(new Uint8Array(conteudo));
    } catch {
      try {
        destino?.delete();
      } catch {
        // A pasta pode ter perdido a permissão de escrita.
      }

      throw new Error(
        "Não foi possível gravar o arquivo. Confira o espaço disponível e escolha uma pasta com permissão de escrita."
      );
    }

    return {
      status: "salvo",
      nome: nomeDestino,
      mensagem:
        `${nomeDestino} foi salvo na pasta escolhida.`,
    };
  } finally {
    seletorOcupado = false;
  }
}