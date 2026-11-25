import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import {
  consultarEnvioRelease,
  ErroApiRelease,
  listarReleases,
  type ResumoRelease,
  type SituacaoEnvioRelease,
} from "@/services/api/release";

interface Consulta {
  chave: string;
  release: ResumoRelease | null;
  envio: SituacaoEnvioRelease | null;
  carregando: boolean;
  erro: string;
  erroEstatisticas: string;
}

function consultaInicial(chave: string): Consulta {
  return {
    chave,
    release: null,
    envio: null,
    carregando: true,
    erro: "",
    erroEstatisticas: "",
  };
}

export function useUltimoReleaseDashboard(recarga: number) {
  const { usuario } = useAuth();
  const conta = usuario ? usuario.assessoria_id + "-" + usuario.id : "";
  const [tentativa, setTentativa] = useState(0);
  const chave = conta + "/" + recarga + "/" + tentativa;
  const [consulta, setConsulta] = useState<Consulta>(() => consultaInicial(""));

  useFocusEffect(
    useCallback(() => {
      if (!conta) return;

      let ativa = true;
      const controller = new AbortController();
      const prazo = setTimeout(() => controller.abort(), 20_000);

      async function carregar() {
        setConsulta(consultaInicial(chave));

        try {
          const lista = await listarReleases(
            { page: 1, limit: 1, ordem: "criados_recentes" },
            controller.signal
          );
          if (!ativa) return;

          const release = lista.releases[0] ?? null;
          let envio: SituacaoEnvioRelease | null = null;
          let erroEstatisticas = "";

          if (release) {
            try {
              envio = await consultarEnvioRelease(
                release.id,
                { page: 1, status: "TODOS" },
                controller.signal
              );
            } catch (erro) {
              if (
                controller.signal.aborted ||
                (erro instanceof ErroApiRelease &&
                  [401, 403, 404].includes(erro.status))
              ) {
                throw erro;
              }
              erroEstatisticas = "Não foi possível carregar as estatísticas.";
            }
          }

          if (!ativa) return;
          if (controller.signal.aborted) throw new Error("Tempo esgotado.");

          setConsulta({
            chave,
            release,
            envio,
            carregando: false,
            erro: "",
            erroEstatisticas,
          });
        } catch {
          if (!ativa) return;
          setConsulta({
            ...consultaInicial(chave),
            carregando: false,
            erro: controller.signal.aborted
              ? "O último release demorou para responder. Tente novamente."
              : "Não foi possível carregar o último release.",
          });
        } finally {
          clearTimeout(prazo);
        }
      }

      void carregar();
      return () => {
        ativa = false;
        clearTimeout(prazo);
        controller.abort();
      };
    }, [chave, conta])
  );

  const atual = consulta.chave === chave ? consulta : consultaInicial(chave);

  return {
    ...atual,
    carregando: Boolean(conta) && atual.carregando,
    atualizar: () => setTentativa((valor) => valor + 1),
  };
}
