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
  chave: string
) {
  const ativo = useRef(false);
  const requisicao = useRef(0);

  const [estado, setEstado] = useState<EstadoConsulta<T>>({
    chave,
    dados: null,
    carregando: true,
    erro: "",
  });

  const recarregar = useCallback(async () => {
    if (!ativo.current) return;

    const numero = ++requisicao.current;

    setEstado((anterior) => ({
      chave,
      dados: anterior.chave === chave ? anterior.dados : null,
      carregando: true,
      erro: "",
    }));

    try {
      const dados = await consultar();

      if (!ativo.current || numero !== requisicao.current) {
        return;
      }

      setEstado({
        chave,
        dados,
        carregando: false,
        erro: "",
      });
    } catch (error) {
      if (!ativo.current || numero !== requisicao.current) {
        return;
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
    }
  }, [chave, consultar]);

  useFocusEffect(
    useCallback(() => {
      ativo.current = true;
      void recarregar();

      return () => {
        ativo.current = false;
        requisicao.current += 1;
      };
    }, [recarregar])
  );

  const atual = estado.chave === chave ? estado : null;
  const dados = atual?.dados ?? null;
  const emCarregamento = atual?.carregando ?? true;
  const atualizarDados = useCallback(
    (dados: T) => {
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