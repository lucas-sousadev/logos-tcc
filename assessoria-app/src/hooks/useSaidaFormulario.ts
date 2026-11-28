import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useIsFocused, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import type { ComponentProps } from "react";
import type FeedbackAlert from "@/components/forms/FeedbackAlert";

export function useSaidaFormulario(alterado: boolean, ocupado: boolean) {
  const navigation = useNavigation();
  const focado = useIsFocused();
  const pendente = useRef<{
    acao: () => void;
    remover: boolean;
    executarAposSalvar?: boolean;
  } | null>(null);
  const salvamentoSaida = useRef(false);
  const [avisar, setAvisar] = useState(false);
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || liberado || !focado || (!alterado && !ocupado))
      return;
    const impedirSaida = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", impedirSaida);
    return () => window.removeEventListener("beforeunload", impedirSaida);
  }, [alterado, ocupado, liberado, focado]);

  usePreventRemove(!liberado && (alterado || ocupado), ({ data }) => {
    if (ocupado || (pendente.current && !salvamentoSaida.current)) return;
    salvamentoSaida.current = false;
    pendente.current = {
      acao: () => navigation.dispatch(data.action),
      remover: true,
    };
    setAvisar(true);
  });

  useEffect(() => {
    if (!liberado || !focado || !pendente.current) return;
    const pedido = pendente.current;
    pendente.current = null;
    pedido.acao();
  }, [liberado, focado]);

  function continuar() {
    salvamentoSaida.current = false;
    pendente.current = null;
    setAvisar(false);
  }

  function confirmarSaida(
    acao: () => void,
    opcoes: { executarAposSalvar?: boolean } = {}
  ) {
    if (ocupado) return;
    salvamentoSaida.current = false;
    if (!alterado) {
      pendente.current = null;
      acao();
      return;
    }
    pendente.current = { acao, remover: false, ...opcoes };
    setAvisar(true);
  }

  function concluirSaida(acao: () => void) {
    salvamentoSaida.current = false;
    setAvisar(false);
    pendente.current = { acao, remover: true };
    setLiberado(true);
  }

  function iniciarSalvamentoSaida() {
    salvamentoSaida.current = pendente.current !== null;
    setAvisar(false);
  }

  function concluirSalvamento(aposSalvar: () => void) {
    const pedido = pendente.current;
    if (!salvamentoSaida.current || !pedido) {
      aposSalvar();
      return;
    }

    concluirSaida(() => {
      aposSalvar();
      if (pedido.executarAposSalvar !== false) pedido.acao();
    });
  }

  const alertaProps: ComponentProps<typeof FeedbackAlert> = {
    visible: avisar,
    variant: "warning",
    title: "Sair sem salvar?",
    message: "As alterações não salvas serão perdidas. Deseja continuar?",
    primaryLabel: "SAIR",
    secondaryLabel: "CONTINUAR",
    primaryDanger: true,
    onClose: continuar,
    onSecondary: continuar,
    onPrimary: () => {
      const pedido = pendente.current;
      setAvisar(false);
      if (!pedido) return;
      if (pedido.remover) setLiberado(true);
      else {
        pendente.current = null;
        pedido.acao();
      }
    },
  };

  return {
    confirmarSaida,
    concluirSaida,
    iniciarSalvamentoSaida,
    concluirSalvamento,
    alertaProps,
  };
}
