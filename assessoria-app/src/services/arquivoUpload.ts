import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

export interface ArquivoUpload {
  uri: string;
  nome: string;
  mimeType?: string;
  file?: Blob;
}

export const fetchUpload =
  Platform.OS === "web" ? fetch : expoFetch;

export function anexarArquivo(
  formulario: FormData,
  campo: string,
  arquivo: ArquivoUpload
): void {
  const nome =
    arquivo.nome
      .split(/[\\/]/)
      .pop()
      ?.replace(/[\u0000-\u001f\u007f]/g, "_")
      .trim() || "arquivo";

  if (Platform.OS === "web") {
    if (!arquivo.file) {
      throw new Error(
        "Selecione o arquivo novamente antes de enviar."
      );
    }

    formulario.append(campo, arquivo.file, nome);
    return;
  }

  const nativo = new ExpoFile(arquivo.uri);

  if (!nativo.exists) {
    throw new Error(
      "Não foi possível acessar o arquivo selecionado. Selecione-o novamente."
    );
  }

  formulario.append(campo, nativo, nome);
}