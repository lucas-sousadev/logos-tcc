import { useEffect, useRef, useState } from "react";

import {
  buscarRelatorio,
  type OrigemRevisao,
  type PaginacaoRelatorio,
  type SlideRelatorio,
} from "@/services/api/relatorio";

export type PaginaSlidesRelatorio = Awaited<ReturnType<typeof buscarRelatorio>>;

export interface NavegacaoSlidesRelatorio {
  posicao: number | null;
  total: number;
  carregando: boolean;
  bloqueada: boolean;
  erro: string;
  anterior?: () => void;
  proximo?: () => void;
}

interface Opcoes {
  id: number;
  slide: SlideRelatorio | null;
  slides: SlideRelatorio[];
  paginacao: PaginacaoRelatorio;
  busca: string;
  revisao: "todas" | "pendentes";
  origens: OrigemRevisao[];
  versao: number;
  ativo: boolean;
  bloqueado: boolean;
  onAbrir: (slide: SlideRelatorio) => void;
  onPagina: (resposta: PaginaSlidesRelatorio) => void;
}

export function useNavegacaoSlidesRelatorio({
  id,
  slide,
  slides,
  paginacao,
  busca,
  revisao,
  origens,
  versao,
  ativo,
  bloqueado,
  onAbrir,
  onPagina,
}: Opcoes) {
  const requisicao = useRef(0);
  const ocupado = useRef(false);
  const [estado, setEstado] = useState<{
    chave: string;
    carregando: boolean;
    erro: string;
  } | null>(null);
  const chave = JSON.stringify([
    id,
    slide?.id,
    paginacao.page,
    busca,
    revisao,
    origens,
    versao,
    ativo,
  ]);

  useEffect(() => {
    return () => {
      requisicao.current += 1;
      ocupado.current = false;
    };
  }, [chave]);

  function cancelar() {
    requisicao.current += 1;
    ocupado.current = false;
    setEstado(null);
  }

  const indice = slides.findIndex((item) => item.id === slide?.id);
  const anterior = slide
    ? slides.filter((item) => item.ordem < slide.ordem).at(-1)
    : undefined;
  const proximo = slide
    ? slides.find((item) => item.ordem > slide.ordem)
    : undefined;
  const carregando = estado?.chave === chave && estado.carregando;

  async function navegar(direcao: -1 | 1) {
    if (!ativo || !slide || bloqueado || ocupado.current) return;

    const vizinho = direcao === -1 ? anterior : proximo;
    if (vizinho) {
      setEstado(null);
      onAbrir(vizinho);
      return;
    }

    if (
      (direcao === -1 && paginacao.page <= 1) ||
      (direcao === 1 && !paginacao.has_next)
    ) {
      return;
    }

    const numero = ++requisicao.current;
    ocupado.current = true;
    setEstado({ chave, carregando: true, erro: "" });

    try {
      const resposta = await buscarRelatorio(
        id,
        paginacao.page + direcao,
        busca,
        revisao,
        origens
      );
      if (numero !== requisicao.current) return;

      const destino =
        direcao === -1 ? resposta.slides.at(-1) : resposta.slides[0];
      if (
        resposta.pagination.page !== paginacao.page + direcao ||
        !destino ||
        (direcao === -1
          ? destino.ordem >= slide.ordem
          : destino.ordem <= slide.ordem)
      ) {
        throw new Error(
          "A lista de slides mudou. Feche a prévia e atualize o relatório."
        );
      }

      onPagina(resposta);
      onAbrir(destino);
    } catch (error) {
      if (numero !== requisicao.current) return;

      setEstado({
        chave,
        carregando: false,
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o próximo slide. Tente novamente.",
      });
    } finally {
      if (numero === requisicao.current) {
        ocupado.current = false;
        setEstado((atual) =>
          atual?.chave === chave ? { ...atual, carregando: false } : atual
        );
      }
    }
  }

  const navegacao: NavegacaoSlidesRelatorio = {
    posicao:
      indice >= 0 ? (paginacao.page - 1) * paginacao.limit + indice + 1 : null,
    total: paginacao.total,
    carregando,
    bloqueada: bloqueado || !ativo,
    erro: estado?.chave === chave ? estado.erro : "",
    anterior:
      slide && (anterior || paginacao.page > 1)
        ? () => void navegar(-1)
        : undefined,
    proximo:
      slide && (proximo || paginacao.has_next)
        ? () => void navegar(1)
        : undefined,
  };

  return { navegacao, cancelar };
}
