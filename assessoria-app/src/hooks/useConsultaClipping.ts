import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import { ErroApiClipping } from "@/services/api/clipping";

interface EstadoConsulta<T> {
  chave: string;
  dados: T | null;
  carregando: boolean;
  erro: string;
}

export function useConsultaClipping<T>(
  consultar: () => Promise<T>,
  chave: string,
  aoReceber?: (dados: T) => void
) {
  const ativo = useRef(false);
  const requisicao = useRef(0);
  const chaveAtiva = useRef(chave);

  const [estado, setEstado] = useState<EstadoConsulta<T>>({
    chave,
    dados: null,
    carregando: true,
    erro: "",
  });

  const recarregar = useCallback(async (): Promise<boolean> => {
    if (!ativo.current || chaveAtiva.current !== chave) return false;

    const numero = ++requisicao.current;

    setEstado((anterior) => ({
      chave,
      dados: anterior.chave === chave ? anterior.dados : null,
      carregando: true,
      erro: "",
    }));

    try {
      const dados = await consultar();

      if (!ativo.current || chaveAtiva.current !== chave || numero !== requisicao.current) {
        return false;
      }

      aoReceber?.(dados);

      if (!ativo.current || chaveAtiva.current !== chave || numero !== requisicao.current) {
        return false;
      }

      setEstado({
        chave,
        dados,
        carregando: false,
        erro: "",
      });
      return true;
    } catch (error) {
      if (!ativo.current || chaveAtiva.current !== chave || numero !== requisicao.current) {
        return false;
      }

      const limparDados =
        error instanceof ErroApiClipping &&
        [401, 403, 404].includes(error.status);

      setEstado((anterior) => ({
        chave,
        dados:
          !limparDados && anterior.chave === chave
            ? anterior.dados
            : null,
        carregando: false,
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar os dados.",
      }));
      return false;
    }
  }, [chave, consultar, aoReceber]);

  useFocusEffect(
    useCallback(() => {
      ativo.current = true;
      chaveAtiva.current = chave;
      void recarregar();

      return () => {
        ativo.current = false;
        requisicao.current += 1;
      };
    }, [recarregar, chave])
  );

  const atual = estado.chave === chave ? estado : null;
  const dados = atual?.dados ?? null;
  const emCarregamento = atual?.carregando ?? true;
  const atualizarDados = useCallback(
    (dados: T) => {
      if (!ativo.current || chaveAtiva.current !== chave) return;
      // Impede uma consulta anterior de sobrescrever os dados recém-salvos.
      requisicao.current += 1;

      setEstado({
        chave,
        dados,
        carregando: false,
        erro: "",
      });
    },
    [chave]
  );

  return {
    dados,
    erro: atual?.erro ?? "",
    carregando: emCarregamento && dados === null,
    atualizando: emCarregamento && dados !== null,
    recarregar,
    atualizarDados,
  };
}
