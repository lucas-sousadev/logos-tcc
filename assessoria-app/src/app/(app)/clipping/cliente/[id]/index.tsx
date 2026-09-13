import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useCallback, useState, useEffect } from "react";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
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
  }>();

  const ano = Number(params.ano);
  const clienteId = Number(params.id);

  const [clienteNome, setClienteNome] = useState("Cliente");
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
    async function carregarCliente() {
      if (!clienteId || Number.isNaN(clienteId)) {
        return;
      }

      try {
        const cliente = await buscarCliente(clienteId);
        setClienteNome(cliente.nome);
      } catch {
        setClienteNome("Cliente");
      }
    }

    void carregarCliente();
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

  function formatarData(data: string | null) {
    if (!data) return "Data pendente";

    const partes = data.split("-");
    if (partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
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

          {clippings.map((clipping) => {
            const estaExpandido =
              expandido === clipping.id;

            return (
              <View
                key={clipping.id}
                style={[
                  styles.clippingCard,
                  {
                    borderColor: theme.borda,
                    backgroundColor: theme.background,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    setExpandido(
                      estaExpandido ? null : clipping.id
                    )
                  }
                >
                  <View style={styles.cardTop}>
                    <View style={styles.dateBadge}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={theme.primaria}
                      />

                      <Text
                        weight="SemiBold"
                        style={styles.dateText}
                      >
                        {formatarData(
                          clipping.data_publicacao
                        )}
                      </Text>
                    </View>

                    <Ionicons
                      name={
                        estaExpandido
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={20}
                      color={theme.textoSub}
                    />
                  </View>

                  <Text
                    weight="SemiBold"
                    style={styles.pauta}
                    numberOfLines={estaExpandido ? undefined : 2}
                  >
                    {clipping.pauta || "Pauta pendente"}
                  </Text>

                  <Text
                    style={[
                      styles.meta,
                      { color: theme.textoSub },
                    ]}
                    numberOfLines={1}
                  >
                    {[
                      clipping.veiculo_nome ||
                        "Sem veículo",
                      clipping.categorias.length > 0
                        ? clipping.categorias.join(", ")
                        : "Sem categoria",
                      clipping.total_anexos > 0
                        ? `${clipping.total_anexos} anexo(s)`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </TouchableOpacity>

                {estaExpandido ? (
                  <View style={styles.expanded}>
                    <Text
                      style={[
                        styles.detail,
                        { color: theme.textoSub },
                      ]}
                    >
                      {clipping.programa_secao ||
                        "Programa/seção não informado"}
                    </Text>

                    {clipping.link ? (
                      <Text
                        style={[
                          styles.detail,
                          { color: theme.textoSub },
                        ]}
                        numberOfLines={2}
                      >
                        {clipping.link}
                      </Text>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        abrirDetalhes(clipping)
                      }
                      style={[
                        styles.detailButton,
                        {
                          backgroundColor:
                            theme.backgroundContainer,
                        },
                      ]}
                    >
                      <Text
                        weight="SemiBold"
                        style={{
                          color: theme.textoContainer,
                          fontSize: 12,
                        }}
                      >
                        VER DETALHES
                      </Text>

                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color={theme.textoContainer}
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}

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
    padding: 20,
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

  clippingCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  dateText: {
    fontSize: 11,
  },

  pauta: {
    fontSize: 14,
    lineHeight: 20,
  },

  meta: {
    fontSize: 11,
    marginTop: 8,
  },

  expanded: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D1D5DB",
    marginTop: 13,
    paddingTop: 12,
  },

  detail: {
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 7,
  },

  detailButton: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
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