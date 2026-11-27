import { useCallback } from "react";
import { useRouter } from "expo-router";

import RelatorioListaCard from "@/components/relatorios/RelatorioListaCard";
import ListaVinculos from "@/components/ui/ListaVinculos";
import { useAuth } from "@/contexts/AuthContext";
import { listarRelatorios } from "@/services/api/relatorio";

type Props = (
  | { clienteId: number; clippingId?: never }
  | { clippingId: number; clienteId?: never }
) & { disabled?: boolean };

export default function RelatoriosVinculados({
  clienteId,
  clippingId,
  disabled = false,
}: Props) {
  const router = useRouter();
  const { usuario, temPermissao } = useAuth();
  const origemId = clippingId ?? clienteId;
  const doClipping = clippingId !== undefined;

  const consultar = useCallback(
    async (pagina: number, limite: number, signal: AbortSignal) => {
      const resposta = await listarRelatorios(
        {
          cliente_id: clienteId,
          clipping_id: clippingId,
          page: pagina,
          limit: limite,
        },
        signal
      );
      return { itens: resposta.relatorios, total: resposta.pagination.total };
    },
    [clienteId, clippingId]
  );

  if (
    !temPermissao("RELATORIOS", "VISUALIZAR") ||
    !Number.isSafeInteger(origemId) ||
    origemId <= 0
  ) {
    return null;
  }

  return (
    <ListaVinculos
      chave={`relatorios:${usuario?.assessoria_id}:${usuario?.id}:${doClipping ? "clipping" : "cliente"}:${origemId}`}
      titulo="Relatórios vinculados"
      descricao={
        doClipping
          ? "Relatórios que contêm este clipping entre os slides."
          : "Relatórios criados para este cliente."
      }
      vazio={
        doClipping
          ? "Nenhum relatório vinculado a este clipping."
          : "Nenhum relatório criado para este cliente."
      }
      disabled={disabled}
      consultar={consultar}
      renderItem={(relatorio) => (
        <RelatorioListaCard
          relatorio={relatorio}
          onPress={() => {
            if (!disabled) {
              router.navigate({
                pathname: "/relatorios/[id]",
                params: {
                  id: String(relatorio.id),
                  origemClippingId: doClipping ? String(origemId) : undefined,
                  origemClienteId: doClipping ? undefined : String(origemId),
                  origem: undefined,
                },
              });
            }
          }}
        />
      )}
    />
  );
}
