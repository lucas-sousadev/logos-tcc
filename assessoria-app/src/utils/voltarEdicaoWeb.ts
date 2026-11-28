import { Platform } from "react-native";

type BloqueioVoltar = (evento: PopStateEvent) => void;
type ControleVoltar = { instalado: boolean; bloquear: BloqueioVoltar | null };

const escopo = globalThis as typeof globalThis & {
  __logosVoltarEdicaoWeb?: ControleVoltar;
};
const controle = (escopo.__logosVoltarEdicaoWeb ??= {
  instalado: false,
  bloquear: null,
});

// Registra antes do roteador para preservar o formulário durante a confirmação.
if (
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  !controle.instalado
) {
  window.addEventListener("popstate", (evento) => controle.bloquear?.(evento));
  controle.instalado = true;
}

export function protegerVoltarEdicaoWeb(bloquear: BloqueioVoltar) {
  controle.bloquear = bloquear;
  return () => {
    if (controle.bloquear === bloquear) controle.bloquear = null;
  };
}
