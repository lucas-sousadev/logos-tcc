import { useEffect } from "react";
import { AppState, Platform } from "react-native";

export function useSincronizacaoPermissoes(
  ativa: boolean,
  recarregarPermissoes: () => Promise<void>
) {
  useEffect(() => {
    if (!ativa) return;

    const navegador =
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function" &&
      typeof window.removeEventListener === "function"
        ? window
        : null;
    const documento =
      Platform.OS === "web" &&
      typeof document !== "undefined" &&
      typeof document.addEventListener === "function" &&
      typeof document.removeEventListener === "function"
        ? document
        : null;

    function atualizar() {
      if (
        (AppState.currentState && AppState.currentState !== "active") ||
        documento?.visibilityState === "hidden"
      )
        return;
      void recarregarPermissoes().catch(() => {});
    }

    atualizar();
    const intervalo = setInterval(atualizar, 3_000);
    const inscricao = AppState.addEventListener("change", (estado) => {
      if (estado === "active") atualizar();
    });
    navegador?.addEventListener("focus", atualizar);
    navegador?.addEventListener("online", atualizar);
    documento?.addEventListener("visibilitychange", atualizar);

    return () => {
      clearInterval(intervalo);
      inscricao.remove();
      navegador?.removeEventListener("focus", atualizar);
      navegador?.removeEventListener("online", atualizar);
      documento?.removeEventListener("visibilitychange", atualizar);
    };
  }, [ativa, recarregarPermissoes]);
}
