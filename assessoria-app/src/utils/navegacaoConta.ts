import type { NavigationState } from "expo-router/react-navigation";

export type TelaConta = "perfil" | "configuracoes";
const TELAS_CONTA = ["perfil", "configuracoes", "personalizar-barra"];

export function criarEntradaConta(estado: NavigationState, destino: TelaConta) {
  const abertas = estado.routes.slice(0, estado.index + 1);
  const primeira = abertas.findIndex((rota) => TELAS_CONTA.includes(rota.name));
  const origem = primeira < 0 ? abertas : abertas.slice(0, primeira);
  if (primeira === abertas.length - 1 && abertas[primeira]?.name === destino)
    return estado;

  return {
    ...estado,
    index: origem.length,
    routes: [...origem, { name: destino }],
  };
}
