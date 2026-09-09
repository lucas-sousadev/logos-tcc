import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import {
  useCallback,
  useState,
} from "react";

import {
  useFocusEffect,
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
  Cliente,
  listarClientes,
  obterUrlLogoCliente,
} from "@/services/api/cliente";

export default function Clientes() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");

  const [clientes, setClientes] = useState<
    Cliente[]
  >([]);

  const [carregando, setCarregando] =
    useState(true);

  const [carregandoMais, setCarregandoMais] =
    useState(false);

  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [total, setTotal] = useState(0);

  const [erro, setErro] = useState("");

  const carregarClientes = useCallback(
    async (
      reset = false,
      buscaAtual = buscaAplicada
    ) => {
      try {
        setErro("");

        if (reset) {
          setCarregando(true);
        } else {
          setCarregandoMais(true);
        }

        const paginaAtual = reset
          ? 1
          : pagina + 1;

        const resposta = await listarClientes({
          page: paginaAtual,
          limit: 50,
          busca: buscaAtual,
        });

        if (reset) {
          setClientes(resposta.clientes);
          setPagina(1);
        } else {
          setClientes((atuais) => [
            ...atuais,
            ...resposta.clientes,
          ]);

          setPagina(paginaAtual);
        }

        setTotal(resposta.pagination.total);

        setTemMais(
          resposta.pagination.has_next
        );
      } catch (error) {
        console.error(
          "Erro ao carregar clientes:",
          error
        );

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os clientes."
        );
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
      }
    },
    [pagina, buscaAplicada]
  );

  useFocusEffect(
    useCallback(() => {
      void carregarClientes(true);
    }, [buscaAplicada])
  );

  function realizarBusca() {
    setPagina(1);
    setBuscaAplicada(busca.trim());
  }

  function limparBusca() {
    setPagina(1);
    setBuscaAplicada("");
  }

  function abrirCliente(id: number) {
    router.push({
      pathname: "/clientes/[id]",
      params: {
        id: id.toString(),
      },
    });
  }

  if (carregando) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <Header title="Clientes" />

        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header title="Clientes" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar clientes..."
          onSearch={realizarBusca}
          onClear={limparBusca}
        />

        <View style={styles.topRow}>
          <Text
            weight="Medium"
            style={[
              styles.count,
              {
                color: theme.textoSub,
              },
            ]}
          >
            {total}{" "}
            {total === 1
              ? "cliente"
              : "clientes"}
          </Text>

          {temPermissao(
            "CLIENTES",
            "CRIAR"
          ) ? (
            <Button
              title="NOVO"
              size="small"
              onPress={() =>
                router.push("/clientes/novo")
              }
              style={styles.newButton}
            />
          ) : null}
        </View>

        {erro !== "" ? (
          <View
            style={[
              styles.errorBox,
              {
                borderColor: theme.borda,
                backgroundColor:
                  theme.backgroundContainer,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={theme.primaria}
            />

            <Text
              weight="Medium"
              style={[
                styles.errorText,
                {
                  color: theme.textoContainer,
                },
              ]}
            >
              {erro}
            </Text>

            <Button
              title="TENTAR NOVAMENTE"
              size="small"
              onPress={() =>
                void carregarClientes(true)
              }
            />
          </View>
        ) : null}

        {erro === "" && clientes.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                borderColor: theme.borda,
              },
            ]}
          >
            <Ionicons
              name="briefcase-outline"
              size={36}
              color={theme.textoSub}
            />

            <Text
              weight="SemiBold"
              style={styles.emptyTitle}
            >
              Nenhum cliente encontrado
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color: theme.textoSub,
                },
              ]}
            >
              {buscaAplicada
                ? "Tente alterar a busca."
                : "Cadastre o primeiro cliente para começar."}
            </Text>
          </View>
        ) : (
          clientes.map((cliente) => {
            const logoUrl = obterUrlLogoCliente(
              cliente.logo_path
            );

            const localizacao = [
              cliente.cidade,
              cliente.estado,
            ]
              .filter(Boolean)
              .join(" - ");

            const informacoes = [
              cliente.segmento,
              localizacao,
              cliente.ativo === 1
                ? "Ativo"
                : "Inativo",
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <TouchableOpacity
                key={cliente.id}
                activeOpacity={0.8}
                onPress={() =>
                  abrirCliente(cliente.id)
                }
                style={[
                  styles.item,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.borda,
                  },
                ]}
              >
                <View
                  style={[
                    styles.logoContainer,
                    {
                      backgroundColor:
                        theme.backgroundContainer,
                    },
                  ]}
                >
                  {logoUrl ? (
                    <Image
                      source={{ uri: logoUrl }}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name="briefcase-outline"
                      size={21}
                      color={theme.textoContainer}
                    />
                  )}
                </View>

                <View style={styles.itemInfo}>
                  <Text
                    weight="SemiBold"
                    style={styles.itemName}
                    numberOfLines={1}
                  >
                    {cliente.nome}
                  </Text>

                  <Text
                    style={[
                      styles.itemMeta,
                      {
                        color: theme.textoSub,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {informacoes || "Sem informações adicionais"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward-outline"
                  size={21}
                  color={theme.texto}
                />
              </TouchableOpacity>
            );
          })
        )}

        {temMais ? (
          <Button
            title="CARREGAR MAIS"
            variant="outline"
            loading={carregandoMais}
            onPress={() =>
              void carregarClientes(false)
            }
            style={styles.moreButton}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 30,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  count: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
  },

  newButton: {
    width: 90,
  },

  item: {
    minHeight: 74,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },

  logoImage: {
    width: "100%",
    height: "100%",
  },

  itemInfo: {
    flex: 1,
    marginRight: 10,
  },

  itemName: {
    fontSize: 14,
  },

  itemMeta: {
    fontSize: 11,
    marginTop: 4,
  },

  empty: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
    marginTop: 5,
  },

  emptyTitle: {
    fontSize: 15,
    marginTop: 12,
  },

  emptyText: {
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },

  errorBox: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginBottom: 15,
  },

  errorText: {
    fontSize: 12,
    textAlign: "center",
    marginVertical: 10,
  },

  moreButton: {
    marginTop: 5,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});