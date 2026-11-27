import { useCallback } from "react";
import { useRouter } from "expo-router";

import ReleaseListaCard from "@/components/releases/ReleaseListaCard";
import ListaVinculos from "@/components/ui/ListaVinculos";
import { useAuth } from "@/contexts/AuthContext";
import { listarReleases } from "@/services/api/release";

interface Props {
  contatoId: number;
  disabled?: boolean;
}

export default function ReleasesVinculados({
  contatoId,
  disabled = false,
}: Props) {
  const router = useRouter();
  const { usuario, temPermissao } = useAuth();

  const consultar = useCallback(
    async (pagina: number, limite: number, signal: AbortSignal) => {
      const resposta = await listarReleases(
        {
          jornalista_id: contatoId,
          page: pagina,
          limit: limite,
        },
        signal
      );
      return { itens: resposta.releases, total: resposta.pagination.total };
    },
    [contatoId]
  );

  if (
    !temPermissao("RELEASES", "VISUALIZAR") ||
    !Number.isSafeInteger(contatoId) ||
    contatoId <= 0
  ) {
    return null;
  }

  return (
    <ListaVinculos
      chave={`releases-contato:${usuario?.assessoria_id}:${usuario?.id}:${contatoId}`}
      titulo="Releases vinculados"
      descricao="Releases que incluem este contato entre os destinatários."
      vazio="Nenhum release vinculado a este contato."
      disabled={disabled}
      consultar={consultar}
      renderItem={(release) => (
        <ReleaseListaCard
          release={release}
          onPress={() => {
            if (!disabled) {
              router.navigate({
                pathname: "/releases/[id]",
                params: {
                  id: String(release.id),
                  origemContatoId: String(contatoId),
                  origemNavegacao: undefined,
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
