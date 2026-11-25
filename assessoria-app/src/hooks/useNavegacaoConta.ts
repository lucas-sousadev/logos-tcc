import { useCallback } from "react";
import { useNavigation, useRouter } from "expo-router";
import { CommonActions } from "expo-router/react-navigation";
import { criarEntradaConta, type TelaConta } from "@/utils/navegacaoConta";

export function useAbrirTelaConta() {
  const navigation = useNavigation();
  const router = useRouter();

  return useCallback(
    (destino: TelaConta) => {
      if (!navigation.isFocused()) return;
      let atual: typeof navigation | undefined = navigation;
      while (atual) {
        const estado = atual.getState();
        if (
          estado?.type === "stack" &&
          estado.routeNames.includes("perfil") &&
          estado.routeNames.includes("configuracoes")
        ) {
          const proximo = criarEntradaConta(estado, destino);
          if (proximo !== estado)
            atual.dispatch({
              ...CommonActions.reset(proximo),
              target: estado.key,
            });
          return;
        }
        atual = atual.getParent();
      }
      router.navigate(destino === "perfil" ? "/perfil" : "/configuracoes");
    },
    [navigation, router]
  );
}
