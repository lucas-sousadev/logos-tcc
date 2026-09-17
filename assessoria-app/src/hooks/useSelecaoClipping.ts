import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";

import { usePreventRemove } from "expo-router/react-navigation";

import type FeedbackAlert from "@/components/forms/FeedbackAlert";

import {
  excluirClippingsEmLote,
  type Clipping,
} from "@/services/api/clipping";

const LIMITE = 100;

type AlertaProps = ComponentProps<typeof FeedbackAlert>;

interface Aviso {
  variant: AlertaProps["variant"];
  title: string;
  message: string;
}

interface Opcoes {
  chave: string;
  clippings: Clipping[];
  bloqueado: boolean;
  podeExcluir: boolean;
  aoConcluir: (idsExcluidos: number[]) => Promise<void>;
}

export function useSelecaoClippings({
  chave,
  clippings,
  bloqueado,
  podeExcluir,
  aoConcluir,
}: Opcoes) {
  const trava = useRef(false);

  const [modo, setModo] = useState(false);
  const [chaveSelecao, setChaveSelecao] = useState(chave);
  const [ids, setIds] = useState<number[]>([]);
  const [confirmacao, setConfirmacao] = useState<number[] | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  usePreventRemove(excluindo, () => {});

  useEffect(() => {
    if (trava.current) return;

    setChaveSelecao(chave);
    setModo(false);
    setIds([]);
    setConfirmacao(null);
  }, [chave]);

  const mesmaConsulta = chaveSelecao === chave;
  const ativo = mesmaConsulta && modo;

  const visiveis = clippings
    .map((clipping) => clipping.id)
    .slice(0, LIMITE);

  const selecionados = mesmaConsulta
    ? ids.filter((id) => visiveis.includes(id))
    : [];

  const todosSelecionados =
    visiveis.length > 0 &&
    visiveis.every((id) => selecionados.includes(id));

  function alternarModo() {
    if (trava.current || bloqueado) return;

    setChaveSelecao(chave);
    setIds([]);
    setModo(!ativo);
  }

  function alternarItem(id: number) {
    if (
      trava.current ||
      bloqueado ||
      !ativo ||
      !visiveis.includes(id)
    ) {
      return;
    }

    if (selecionados.includes(id)) {
      setIds(selecionados.filter((atual) => atual !== id));
      return;
    }

    if (selecionados.length >= LIMITE) {
      setAviso({
        variant: "info",
        title: "Limite de seleção",
        message: `Selecione até ${LIMITE} clippings por vez.`,
      });
      return;
    }

    setIds([...selecionados, id]);
  }

  function alternarPagina() {
    if (trava.current || bloqueado || !ativo) return;

    setIds(todosSelecionados ? [] : visiveis);
  }

  function solicitarExclusao() {
    if (
      trava.current ||
      bloqueado ||
      !podeExcluir ||
      selecionados.length === 0
    ) {
      return;
    }

    setAviso(null);
    setConfirmacao([...selecionados]);
  }

  function fecharAlerta() {
    if (trava.current) return;

    setConfirmacao(null);
    setAviso(null);
  }

  async function confirmarExclusao() {
    if (
      trava.current ||
      bloqueado ||
      !podeExcluir ||
      !confirmacao?.length
    ) {
      return;
    }

    trava.current = true;
    setExcluindo(true);

    const idsEnviados = [...confirmacao];
    let idsExcluidos: number[] = [];
    let resultadoAviso: Aviso;

    try {
      const resposta = await excluirClippingsEmLote(idsEnviados);

      idsExcluidos = resposta.resultados
        .filter((item) => item.status === "excluido")
        .map((item) => item.id);

      const pendentes = resposta.resultados.filter(
        (item) => item.status !== "excluido"
      );

      const mensagens = [
        `${idsExcluidos.length} de ${idsEnviados.length} clipping(s) excluído(s).`,
      ];

      if (pendentes.length > 0) {
        mensagens.push(
          ...pendentes.map((item) => {
            const clipping = clippings.find(
              (registro) => registro.id === item.id
            );

            const pauta = clipping?.pauta?.trim();

            const identificacao = pauta
              ? `#${item.id} — ${pauta.slice(0, 80)}`
              : `Clipping #${item.id}`;

            return `${identificacao}\n${item.message}`;
          })
        );
      }

      if (resposta.limpeza_pendente) {
        mensagens.push(
          "A exclusão foi registrada, mas a limpeza de alguns arquivos ficou pendente no servidor."
        );
      }

      resultadoAviso = {
        variant:
          pendentes.length > 0 || resposta.limpeza_pendente
            ? "warning"
            : "success",
        title:
          idsExcluidos.length === idsEnviados.length
            ? "Clippings excluídos"
            : "Resultado da exclusão",
        message: mensagens.join("\n\n"),
      };
    } catch (error) {
      resultadoAviso = {
        variant: "error",
        title: "Resultado não confirmado",
        message:
          (error instanceof Error
            ? error.message
            : "Não foi possível receber o resultado da exclusão.") +
          "\n\nA lista será atualizada. Confira os registros antes de tentar novamente, pois parte da operação pode ter sido concluída.",
      };
    }

    // Limpa a seleção para não repetir uma operação sem conferir a lista.
    setIds([]);
    setModo(false);

    try {
      await aoConcluir(idsExcluidos);
    } catch {
      resultadoAviso = {
        ...resultadoAviso,
        variant: "warning",
        message:
          resultadoAviso.message +
          "\n\nNão foi possível atualizar a listagem. Atualize-a antes de realizar outra exclusão.",
      };
    } finally {
      setConfirmacao(null);
      setAviso(resultadoAviso);
      trava.current = false;
      setExcluindo(false);
    }
  }

  const alertaProps: AlertaProps = {
    visible: confirmacao !== null || aviso !== null,
    variant: confirmacao ? "warning" : aviso?.variant ?? "info",
    title: confirmacao
      ? "Excluir clippings selecionados?"
      : aviso?.title ?? "",
    message: confirmacao
      ? `Você selecionou ${confirmacao.length} clipping(s). Os registros que puderem ser excluídos serão removidos junto com seus anexos.\n\nClippings com vínculos que impedem a exclusão serão preservados e informados no resultado.\n\nEsta ação não pode ser desfeita.`
      : aviso?.message ?? "",
    primaryLabel: confirmacao ? "EXCLUIR" : "ENTENDI",
    secondaryLabel: confirmacao ? "CANCELAR" : undefined,
    primaryDanger: confirmacao !== null,
    loading: excluindo,
    onClose: fecharAlerta,
    onSecondary: fecharAlerta,
    onPrimary: confirmacao
      ? () => void confirmarExclusao()
      : fecharAlerta,
  };

  return {
    ativo,
    excluindo,
    selecionados,
    todosSelecionados,
    limite: LIMITE,
    alternarModo,
    alternarItem,
    alternarPagina,
    solicitarExclusao,
    alertaProps,
  };
}