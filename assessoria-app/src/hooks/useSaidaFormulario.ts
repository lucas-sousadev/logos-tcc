import { useEffect, useRef, useState } from "react";
import { useIsFocused, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import type { ComponentProps } from "react";
import type FeedbackAlert from "@/components/forms/FeedbackAlert";

export function useSaidaFormulario(alterado: boolean, ocupado: boolean) {
  const navigation = useNavigation();
  const focado = useIsFocused();
  const pendente = useRef<{ acao: () => void; remover: boolean } | null>(null);
  const [avisar, setAvisar] = useState(false);
  const [liberado, setLiberado] = useState(false);

  usePreventRemove(!liberado && (alterado || ocupado), ({ data }) => {
    if (ocupado || pendente.current) return;
    pendente.current = { acao: () => navigation.dispatch(data.action), remover: true };
    setAvisar(true);
  });

  useEffect(() => {
    if (!liberado || !focado || !pendente.current) return;
    const pedido = pendente.current;
    pendente.current = null;
    pedido.acao();
  }, [liberado, focado]);

  function continuar() {
    pendente.current = null;
    setAvisar(false);
  }

  function confirmarSaida(acao: () => void) {
    if (ocupado) return;
    if (!alterado) { acao(); return; }
    pendente.current = { acao, remover: false };
    setAvisar(true);
  }

  function concluirSaida(acao: () => void) {
    pendente.current = { acao, remover: true };
    setLiberado(true);
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
      else { pendente.current = null; pedido.acao(); }
    },
  };

  return { confirmarSaida, concluirSaida, alertaProps };
}
