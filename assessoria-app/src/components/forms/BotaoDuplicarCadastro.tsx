import { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import * as Crypto from "expo-crypto";

import FeedbackAlert from "@/components/forms/FeedbackAlert";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import {
  duplicarCadastro,
  ErroDuplicacao,
  type ModuloDuplicacao,
} from "@/services/api/duplicacao";

interface Props {
  modulo: ModuloDuplicacao;
  id: number;
  totalAnexos?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onOcupado: (valor: boolean) => void;
  onDuplicado: (id: number) => void;
}

export default function BotaoDuplicarCadastro({
  modulo,
  id,
  totalAnexos = 0,
  disabled = false,
  style,
  onOcupado,
  onDuplicado,
}: Props) {
  const { temPermissao } = useAuth();
  const [aviso, setAviso] = useState<"confirmar" | "sucesso" | "erro">(
    "confirmar"
  );
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [copiaId, setCopiaId] = useState<number | null>(null);
  const chave = useRef<string | null>(null);
  const trava = useRef(false);
  const montado = useRef(true);
  const dominio = modulo === "clipping" ? "CLIPPING" : "RELEASES";
  const permitido =
    temPermissao(dominio, "VISUALIZAR") && temPermissao(dominio, "CRIAR");
  const incluirAnexos = temPermissao("CLIPPING", "ANEXAR");

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  function fechar() {
    if (trava.current || !aberto) {
      return;
    }
    setAberto(false);
    if (aviso === "sucesso" && copiaId !== null) {
      chave.current = null;
      onDuplicado(copiaId);
    }
  }

  async function duplicar() {
    if (trava.current || disabled || !permitido) {
      return;
    }
    trava.current = true;
    setCarregando(true);
    onOcupado(true);
    try {
      chave.current ??= Crypto.randomUUID();
      const resultado = await duplicarCadastro(modulo, id, {
        incluirAnexos,
        chave: chave.current,
      });
      if (!montado.current) {
        return;
      }
      setCopiaId(resultado.id);
      setMensagem(
        modulo === "clipping"
          ? "A cópia do clipping foi criada e pode ser editada nos detalhes."
          : "A cópia foi salva como um novo rascunho. Revise os dados antes de enviar." +
              (resultado.destinatariosIgnorados > 0
                ? ` ${resultado.destinatariosIgnorados} destinatário(s) indisponível(is) ou com e-mail repetido não foram copiados.`
                : "")
      );
      setAviso("sucesso");
    } catch (falha) {
      if (!montado.current) {
        return;
      }
      const incerta =
        !(falha instanceof ErroDuplicacao) ||
        [0, 408].includes(falha.status) ||
        falha.status >= 500;
      setMensagem(
        (falha instanceof ErroDuplicacao
          ? falha.message
          : "Não foi possível confirmar a duplicação. Verifique sua conexão.") +
          (incerta && modulo === "clipping"
            ? " Confira se a cópia apareceu na lista antes de repetir a operação."
            : "")
      );
      setAviso("erro");
    } finally {
      trava.current = false;
      if (montado.current) {
        setCarregando(false);
        onOcupado(false);
      }
    }
  }

  if (!permitido && !aberto) {
    return null;
  }

  return (
    <>
      {permitido ? (
        <Button
          title="DUPLICAR"
          icon="copy-outline"
          variant="outline"
          style={style}
          disabled={disabled || carregando}
          onPress={() => {
            setAviso("confirmar");
            setAberto(true);
          }}
        />
      ) : null}
      <FeedbackAlert
        visible={aberto}
        loading={carregando}
        variant={
          aviso === "confirmar"
            ? "info"
            : aviso === "sucesso"
              ? "success"
              : "error"
        }
        title={
          aviso === "confirmar"
            ? `Duplicar ${modulo === "clipping" ? "clipping" : "release"}?`
            : aviso === "sucesso"
              ? "Cópia criada"
              : "Não foi possível duplicar"
        }
        message={
          aviso === "confirmar"
            ? modulo === "clipping"
              ? "Será criado um novo clipping com os mesmos dados. " +
                (totalAnexos > 0
                  ? incluirAnexos
                    ? "Os anexos terão arquivos próprios na cópia."
                    : "Os anexos não serão copiados porque seu acesso não permite anexar arquivos."
                  : "")
              : "Será criado um novo rascunho com o conteúdo e os destinatários ainda válidos. O envio, o agendamento e as métricas serão reiniciados."
            : mensagem
        }
        primaryLabel={
          aviso === "confirmar"
            ? "DUPLICAR"
            : aviso === "sucesso"
              ? "ABRIR"
              : "ENTENDI"
        }
        secondaryLabel={aviso === "confirmar" ? "CANCELAR" : undefined}
        onPrimary={aviso === "confirmar" ? () => void duplicar() : fechar}
        onSecondary={fechar}
        onClose={fechar}
      />
    </>
  );
}
