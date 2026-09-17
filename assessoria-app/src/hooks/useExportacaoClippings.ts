import {
  useRef,
  useState,
  type ComponentProps,
} from "react";

import { Platform } from "react-native";
import { usePreventRemove } from "expo-router/react-navigation";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type FeedbackAlert from "@/components/forms/FeedbackAlert";

import {
  exportarClippingsCsv,
  type FiltrosConsultaClipping,
  type PedidoExportacaoClipping,
} from "@/services/api/clipping";

type AlertaProps = ComponentProps<typeof FeedbackAlert>;

interface Aviso {
  variant: AlertaProps["variant"];
  title: string;
  message: string;
}

interface Opcoes {
  clienteId: number;
  ano: number;
  filtros: FiltrosConsultaClipping & {
    busca?: string;
  };
  permitido: boolean;
}

export function useExportacaoClippings({
  clienteId,
  ano,
  filtros,
  permitido,
}: Opcoes) {
  const trava = useRef(false);

  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  usePreventRemove(exportando, () => {});

  async function exportar(ids?: number[]) {
    if (trava.current || !permitido) return;

    if (ids !== undefined && ids.length === 0) return;

    trava.current = true;
    setExportando(true);
    setAviso(null);

    try {
      if (
        Platform.OS !== "web" &&
        !(await Sharing.isAvailableAsync())
      ) {
        throw new Error(
          "O compartilhamento de arquivos não está disponível neste dispositivo."
        );
      }

      const pedido: PedidoExportacaoClipping =
        ids !== undefined
          ? {
              modo: "selecionados",
              cliente_id: clienteId,
              ano_referencia: ano,
              ids: [...ids],
            }
          : {
              modo: "filtrados",
              cliente_id: clienteId,
              ano_referencia: ano,
              filtros: { ...filtros },
            };

      const conteudo = await exportarClippingsCsv(pedido);

      const nomeArquivo =
        `clippings-${clienteId}-${ano}-${Date.now()}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([conteudo], {
          type: "text/csv;charset=utf-8",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        try {
          link.href = url;
          link.download = nomeArquivo;

          document.body.appendChild(link);
          link.click();
        } finally {
          link.remove();

          // Dá ao navegador tempo para iniciar o download.
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        setAviso({
          variant: "success",
          title: "CSV gerado",
          message:
            `O download de ${nomeArquivo} foi solicitado ao navegador.`,
        });
      } else {
        const arquivo = new File(Paths.cache, nomeArquivo);

        arquivo.write(new Uint8Array(conteudo));

        await Sharing.shareAsync(arquivo.uri, {
          mimeType: "text/csv",
          dialogTitle: "Exportar clippings",
        });

        setAviso({
          variant: "info",
          title: "Arquivo preparado",
          message:
            "O CSV foi gerado e disponibilizado na janela de compartilhamento. " +
            "Salvar ou enviar depende da opção escolhida nessa janela.",
        });
      }
    } catch (error) {
      setAviso({
        variant: "error",
        title: "Não foi possível exportar",
        message:
          error instanceof Error
            ? error.message
            : "Tente novamente.",
      });
    } finally {
      trava.current = false;
      setExportando(false);
    }
  }

  function fecharAviso() {
    if (!trava.current) {
      setAviso(null);
    }
  }

  const alertaProps: AlertaProps = {
    visible: exportando || aviso !== null,
    variant: exportando ? "info" : aviso?.variant ?? "info",
    title: exportando ? "Preparando CSV" : aviso?.title ?? "",
    message: exportando
      ? "Aguarde enquanto os clippings são exportados."
      : aviso?.message ?? "",
    loading: exportando,
    primaryLabel: exportando ? "AGUARDE" : "ENTENDI",
    onClose: fecharAviso,
    onPrimary: fecharAviso,
  };

  return {
    exportando,
    exportar,
    alertaProps,
  };
}