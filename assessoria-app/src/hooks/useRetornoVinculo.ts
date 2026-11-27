import { useCallback } from "react";
import { useNavigation, useRouter } from "expo-router";

export function useRetornoVinculo(
  tipo: "contato" | "clipping",
  origemId?: string
) {
  const router = useRouter();
  const navigation = useNavigation();
  const numero =
    typeof origemId === "string" && /^[1-9]\d*$/.test(origemId)
      ? Number(origemId)
      : 0;

  return useCallback(() => {
    if (
      !navigation.isFocused() ||
      !Number.isSafeInteger(numero) ||
      numero <= 0
    ) {
      return false;
    }

    // encerra apenas este retorno para não criar ciclos entre os vínculos
    router.setParams(
      tipo === "contato"
        ? { origemContatoId: undefined }
        : { origemClippingId: undefined }
    );
    router.navigate({
      pathname: tipo === "contato" ? "/mailing/[id]" : "/clipping/[id]",
      params: { id: String(numero) },
    });
    return true;
  }, [navigation, numero, router, tipo]);
}
