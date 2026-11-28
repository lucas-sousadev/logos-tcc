import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useIsFocused } from "expo-router";
import { protegerVoltarEdicaoWeb } from "@/utils/voltarEdicaoWeb";

type NavegacaoWeb = Window & {
  navigation?: { currentEntry?: { index: number } };
};

export function useVoltarEdicaoRelatorioWeb(
  alterado: boolean,
  ocupado: boolean,
  confirmarSaida: (acao: () => void) => void
) {
  const focado = useIsFocused();
  const controle = useRef({ ocupado, confirmarSaida });

  useEffect(() => {
    controle.current = { ocupado, confirmarSaida };
  }, [ocupado, confirmarSaida]);

  const ativo = alterado || ocupado;

  useEffect(() => {
    if (Platform.OS !== "web" || !focado || !ativo) return;

    const janela = window as NavegacaoWeb;
    const endereco = janela.location.href;
    const identificador = janela.history.state?.id;
    const indice = janela.navigation?.currentEntry?.index;
    let restaurando = false;
    let liberado = false;
    let deslocamento = -1;

    function restaurar() {
      const atual = janela.navigation?.currentEntry?.index;
      const distancia =
        indice !== undefined && atual !== undefined ? indice - atual : 1;

      if (distancia !== 0) janela.history.go(distancia);
    }

    function verificarVolta(evento: PopStateEvent) {
      if (liberado) return;

      // O navegador restaura a rota sem passar pelo beforeRemove do formulário.
      // Recupera a entrada atual antes que o roteador desmonte a edição.
      evento.stopImmediatePropagation();

      if (restaurando) {
        if (
          janela.location.href !== endereco ||
          janela.history.state?.id !== identificador
        ) {
          restaurar();
          return;
        }

        restaurando = false;
        if (controle.current.ocupado) return;

        controle.current.confirmarSaida(() => {
          liberado = true;
          janela.history.go(deslocamento);
        });
        return;
      }

      const destino = janela.navigation?.currentEntry?.index;
      deslocamento =
        indice !== undefined && destino !== undefined ? destino - indice : -1;
      if (deslocamento === 0) return;

      restaurando = true;
      restaurar();
    }

    return protegerVoltarEdicaoWeb(verificarVolta);
  }, [ativo, focado]);
}
