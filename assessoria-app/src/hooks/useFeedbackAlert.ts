import { useState, type ComponentProps } from "react";
import type FeedbackAlert from "@/components/forms/FeedbackAlert";

type Props = ComponentProps<typeof FeedbackAlert>;

export type AvisoFeedback = Omit<Props, "visible" | "loading" | "onClose"> & {
  onClose?: () => void;
};

export function useFeedbackAlert(ocupado = false) {
  const [aviso, mostrar] = useState<AvisoFeedback | null>(null);

  function fechar() {
    if (ocupado) return;
    mostrar(null);
    aviso?.onClose?.();
  }

  const alertaProps: Props = {
    ...aviso,
    visible: aviso !== null,
    variant: aviso?.variant ?? "info",
    title: aviso?.title ?? "",
    message: aviso?.message ?? "",
    loading: ocupado,
    onClose: fechar,
    onPrimary: aviso?.onPrimary ?? fechar,
    onSecondary: aviso?.onSecondary ?? fechar,
  };

  return { mostrar, fechar, alertaProps };
}
