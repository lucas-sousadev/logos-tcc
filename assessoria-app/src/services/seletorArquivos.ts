import * as DocumentPicker from "expo-document-picker";

import type {
  DocumentPickerOptions,
  DocumentPickerResult,
} from "expo-document-picker";

import {
  Directory,
  File as ExpoFile,
  Paths,
} from "expo-file-system";

import { Platform } from "react-native";
import * as Crypto from "expo-crypto";

export type {
  DocumentPickerAsset,
  DocumentPickerOptions,
  DocumentPickerResult,
} from "expo-document-picker";

const MAX_BYTES = 30 * 1024 * 1024;

export async function getDocumentAsync(
  options: DocumentPickerOptions = {}
): Promise<DocumentPickerResult> {
  const resultado = await DocumentPicker.getDocumentAsync({
    ...options,
    copyToCacheDirectory: Platform.OS !== "android",
  });

  if (resultado.canceled || Platform.OS === "web") {
    return resultado;
  }

  const pasta = new Directory(
    Paths.cache,
    "logos-selecao-" + Crypto.randomUUID()
  );

  pasta.create();

  try {
    const assets = [];

    for (const [indice, asset] of resultado.assets.entries()) {
      const origem = new ExpoFile(asset.uri);
      const tamanho = asset.size ?? origem.size;

      if (tamanho > MAX_BYTES) {
        throw new Error(
          `O arquivo "${asset.name}" ultrapassa 30 MB.`
        );
      }

      const nome =
        asset.name
          .split(/[\\/]/)
          .pop()
          ?.replace(/[\u0000-\u001f\u007f]/g, "_")
          .trim() || "arquivo";

      const extensao =
        nome.match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? "";

      const copia = new ExpoFile(
        pasta,
        indice + "-" + Crypto.randomUUID() + extensao
      );

      await origem.copy(copia);

      if (!copia.exists || copia.size <= 0) {
        throw new Error(
          "Não foi possível ler o conteúdo do arquivo selecionado."
        );
      }

      assets.push({
        ...asset,
        name: nome,
        uri: copia.uri,
        size: copia.size,
      });
    }

    return {
      ...resultado,
      assets,
    };
  } catch (falha) {
    try {
      pasta.delete();
    } catch {
      // O sistema também pode limpar o cache.
    }

    throw new Error(
      falha instanceof Error &&
      falha.message.includes("ultrapassa")
        ? falha.message
        : "Não foi possível ler o arquivo selecionado. Confira se o download terminou e selecione-o novamente."
    );
  }
}