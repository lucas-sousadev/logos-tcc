import { useCallback } from "react";
import { useLocalSearchParams, useNavigation, usePathname, useRouter, type Href } from "expo-router";
import {
  abrirModuloNaNavegacao, ehModuloApp,
  type ModuloApp, type OrigemModulo,
} from "@/utils/navegacaoModulos";

export function useAbrirModulo() {
  const navigation = useNavigation();
  const router = useRouter();

  return useCallback((
    modulo: ModuloApp,
    origem: OrigemModulo = "inicio",
    tela = "index",
    parametros: Record<string, unknown> = {}
  ) => {
    if (abrirModuloNaNavegacao(navigation, modulo, origem, tela, parametros)) return;
    router.replace({
      pathname: modulo === "index" ? "/" : `/${modulo}`,
      params: { origemModulo: origem, ...parametros },
    } as Href);
  }, [navigation, router]);
}

export function useRetornoSeguro(fallback?: Href) {
  const navigation = useNavigation();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{
    origemModulo?: string; origemNavegacao?: string; origem?: string;
  }>();
  const abrirModulo = useAbrirModulo();
  const { origemModulo, origemNavegacao, origem } = params;

  return useCallback(() => {
    if (!navigation.isFocused()) return;
    const partes = pathname.split("/").filter(Boolean);
    const modulo = partes[0] ?? "index";
    const raiz = partes.length <= 1 && ehModuloApp(modulo);

    if (origemNavegacao === "inicio" || origem === "dashboard") {
      abrirModulo("index");
      return;
    }
    if (raiz) {
      abrirModulo(origemModulo === "mais" && modulo !== "mais" ? "mais" : "index");
      return;
    }

    const estado = navigation.getState();
    if (estado?.type === "stack" && estado.index > 0) {
      navigation.goBack();
      return;
    }
    if (fallback) {
      router.replace(fallback);
    } else if (ehModuloApp(modulo)) {
      abrirModulo(modulo);
    } else {
      router.replace("/");
    }
  }, [navigation, pathname, origemModulo, origemNavegacao, origem, abrirModulo, fallback, router]);
}

export function useVoltarNaPilha() {
  const navigation = useNavigation();
  const abrirModulo = useAbrirModulo();
  const { origemNavegacao, origem } = useLocalSearchParams<{
    origemNavegacao?: string; origem?: string;
  }>();
  return useCallback(() => {
    if (!navigation.isFocused()) return false;
    if (origemNavegacao === "inicio" || origem === "dashboard") {
      abrirModulo("index");
      return true;
    }
    const estado = navigation.getState();
    if (estado?.type !== "stack" || estado.index < 1) return false;
    navigation.goBack();
    return true;
  }, [navigation, origemNavegacao, origem, abrirModulo]);
}

export function useAbrirTelaInicial() {
  const abrirModulo = useAbrirModulo();
  return useCallback((destino: Href) => {
    const pathname = typeof destino === "string" ? destino : destino.pathname;
    const [modulo, ...partes] = pathname.split("/").filter(Boolean);
    if (!modulo || !ehModuloApp(modulo)) return;
    let tela = partes.join("/") || "index";
    if (tela.endsWith("[id]") && modulo !== "releases") tela += "/index";
    const parametros = typeof destino === "string" ? {} : destino.params;
    abrirModulo(modulo, "inicio", tela, {
      ...parametros,
      ...(tela !== "index" ? { origemNavegacao: "inicio" } : {}),
    });
  }, [abrirModulo]);
}
