import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";

export function liberarArquivoCapturado(uri: string) {
  if (Platform.OS === "web") {
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
    return;
  }
  try {
    const arquivo = new ExpoFile(uri);
    if (arquivo.exists) arquivo.delete();
  } catch {
    // O cache também pode ser limpo pelo sistema operacional.
  }
}
