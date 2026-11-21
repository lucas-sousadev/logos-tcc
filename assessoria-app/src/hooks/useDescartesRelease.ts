import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { processarDescartesRelease } from "@/services/releaseDescarte";

export function useDescartesRelease() {
  const { usuario } = useAuth();

  const conta = usuario
    ? usuario.assessoria_id + "-" + usuario.id
    : null;

  useEffect(() => {
    if (!conta) return;

    const processar = () => {
      void processarDescartesRelease(conta).catch(() => {});
    };

    processar();

    const intervalo = setInterval(processar, 30_000);

    const app = AppState.addEventListener(
      "change",
      (status) => {
        if (status === "active") {
          processar();
        }
      }
    );

    const navegador =
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function" &&
      typeof window.removeEventListener === "function"
        ? window
        : null;

    navegador?.addEventListener("online", processar);

    return () => {
      clearInterval(intervalo);
      app.remove();
      navegador?.removeEventListener("online", processar);
    };
  }, [conta]);
}