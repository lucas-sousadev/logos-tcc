import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useCallback, useState, useEffect } from "react";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import ClippingCard from "@/components/clipping/ClippingCard";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Clipping,
  listarClippings,
} from "@/services/api/clipping";
import { buscarCliente } from "@/services/api/cliente";

export default function ClippingsDoCliente() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const params = useLocalSearchParams<{
    id?: string;
    ano?: string;
    clienteNome?: string;
  }>();

  const ano = Number(params.ano);
  const clienteId = Number(params.id);

 const nomeNaRota = params.clienteNome?.trim() || "";

  const [clienteCarregado, setClienteCarregado] = useState<{
    id: number;
    nome: string;
  } | null>(null);

  const clienteNome =
    clienteCarregado?.id === clienteId
      ? clienteCarregado.nome
      : nomeNaRota || `Cliente #${clienteId}`;
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [clippings, setClippings] = useState<Clipping[]>(
    []
  );
  const [total, setTotal] = useState(0);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    if (!Number.isSafeInteger(clienteId) || clienteId <= 0) {
      return;
    }

    async function carregarCliente() {
      try {
        const cliente = await buscarCliente(clienteId);

        if (ativo) {
          setClienteCarregado({
            id: clienteId,
            nome: cliente.nome,
          });
        }
      } catch {
        // Mantém o nome recebido pela navegação ou a identificação por ID.
      }
    }

    void carregarCliente();

    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const carregarClippings = useCallback(async () => {
    if (
      !ano ||
      Number.isNaN(ano) ||
      !clienteId ||
      Number.isNaN(clienteId)
    ) {
      setErro("Cliente ou ano inválido.");
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const resposta = await listarClippings({
        cliente_id: clienteId,
        ano_referencia: ano,
        busca: buscaAplicada,
        page: 1,
        limit: 50,
      });

      setClippings(resposta.clippings);
      setTotal(resposta.pagination.total);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os clippings."
      );
    } finally {
      setCarregando(false);
    }
  }, [ano, clienteId, buscaAplicada]);

  useFocusEffect(
    useCallback(() => {
      void carregarClippings();
    }, [carregarClippings])
  );

  function abrirNovo() {
    router.push({
      pathname: "/clipping/novo",
      params: {
        ano: String(ano),
        clienteId: String(clienteId),
        clienteNome,
      },
    });
  }

  function abrirDetalhes(clipping: Clipping) {
    router.push({
      pathname: "/clipping/[id]" as never,
      params: {
        id: String(clipping.id),
      },
    });
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title={clienteNome}
        showBackButton
      />

      {carregando ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <SearchBar
            value={busca}
            onChangeText={setBusca}
            onSearch={() =>
              setBuscaAplicada(busca.trim())
            }
            onClear={() => {
              setBusca("");
              setBuscaAplicada("");
            }}
            placeholder="Buscar pauta, veículo ou categoria..."
          />

          <View style={styles.topRow}>
            <Text
              style={[
                styles.count,
                { color: theme.textoSub },
              ]}
            >
              {total} clipping(s) em {ano}
            </Text>

            {temPermissao("CLIPPING", "CRIAR") ? (
              <Button
                title="NOVO"
                size="small"
                onPress={abrirNovo}
                style={styles.newButton}
              />
            ) : null}
          </View>

          {erro ? (
            <View
              style={[
                styles.errorBox,
                { borderColor: theme.borda },
              ]}
            >
              <Text style={styles.errorText}>
                {erro}
              </Text>

              <Button
                title="TENTAR NOVAMENTE"
                size="small"
                onPress={() => void carregarClippings()}
              />
            </View>
          ) : null}

          {clippings.map((clipping) => (
            <ClippingCard
              key={clipping.id}
              clipping={clipping}
              expandido={expandido === clipping.id}
              onAlternarExpansao={() =>
                setExpandido((atual) =>
                  atual === clipping.id ? null : clipping.id
                )
              }
              onAbrirDetalhes={() => abrirDetalhes(clipping)}
            />
          ))}

          {clippings.length === 0 ? (
            <View
              style={[
                styles.empty,
                { borderColor: theme.borda },
              ]}
            >
              <Text weight="SemiBold">
                Nenhum clipping encontrado
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  { color: theme.textoSub },
                ]}
              >
                Cadastre a primeira publicação deste cliente.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  count: {
    flex: 1,
    fontSize: 12,
  },

  newButton: {
    width: 100,
  },

  empty: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 7,
  },

  errorBox: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginBottom: 16,
  },

  errorText: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10,
  },
});