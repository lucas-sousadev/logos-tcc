import {
  CommonActions,
  type NavigationProp,
  type NavigationState,
  type ParamListBase,
  type TabNavigationState,
} from "expo-router/react-navigation";

export const MODULOS_APP = [
  "index", "clipping", "mailing", "releases", "mais", "clientes",
  "relatorios", "veiculos", "convites", "funcionarios", "templates",
] as const;

export type ModuloApp = (typeof MODULOS_APP)[number];
export type OrigemModulo = "inicio" | "mais";

type NavegacaoModulo = {
  getState: () => NavigationState | undefined;
  getParent: () => NavegacaoModulo | undefined;
  dispatch: NavigationProp<ParamListBase>["dispatch"];
};

let sequencia = 0;

export function ehModuloApp(nome: string): nome is ModuloApp {
  return MODULOS_APP.some((modulo) => modulo === nome);
}

export function criarEntradaModulo(
  estado: TabNavigationState<ParamListBase>,
  modulo: ModuloApp,
  origem: OrigemModulo = "inicio",
  tela = "index",
  parametros: Record<string, unknown> = {}
): TabNavigationState<ParamListBase> {
  const destino = estado.routes.findIndex((rota) => rota.name === modulo);
  if (destino < 0) return estado;

  // Uma nova entrada encerra as telas temporárias do módulo anterior.
  // Trocar a chave permite que beforeRemove consulte também os formulários filhos.
  const routes = estado.routes.map((rota, indice) => {
    if (indice !== estado.index && indice !== destino) return rota;

    const entrando = indice === destino;
    const params = {
      origemModulo: entrando ? origem : "inicio",
      ...(entrando ? parametros : {}),
    };
    const temPilha = !["index", "mais", "convites"].includes(rota.name);

    return {
      ...rota,
      key: `${rota.name}-entrada-${Date.now()}-${++sequencia}`,
      params,
      state: temPilha ? {
        stale: true as const,
        index: 0,
        routes: [{ name: entrando ? tela : "index", params }],
      } : undefined,
    };
  });

  const inicio = routes.find((rota) => rota.name === "index");
  const atual = routes[destino];
  const origemExplicita = origem === "mais" && modulo !== "mais" && modulo !== "index"
    ? routes.find((rota) => rota.name === "mais")
    : undefined;
  const chaves = [...new Set([inicio?.key, origemExplicita?.key, atual.key].filter(
    (chave): chave is string => chave !== undefined
  ))];
  const history = chaves.map((key) => ({ type: "route" as const, key }));

  return { ...estado, index: destino, routes, history };
}

export function abrirModuloNaNavegacao(
  navigation: NavegacaoModulo,
  modulo: ModuloApp,
  origem: OrigemModulo = "inicio",
  tela = "index",
  parametros: Record<string, unknown> = {}
): boolean {
  let atual: NavegacaoModulo | undefined = navigation;
  while (atual) {
    const estado = atual.getState();
    if (estado?.type === "tab") {
      const proximo = criarEntradaModulo(
        estado as TabNavigationState<ParamListBase>, modulo, origem, tela, parametros
      );
      atual.dispatch({ ...CommonActions.reset(proximo), target: estado.key });
      return true;
    }
    atual = atual.getParent();
  }
  return false;
}
