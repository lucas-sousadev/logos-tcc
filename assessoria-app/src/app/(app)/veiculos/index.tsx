import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import VeiculoFilterModal, {
  FiltrosVeiculos,
} from "@/components/ui/Filtros/VeiculoFilterModal";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

import {
  Veiculo,
  listarVeiculos,
} from "@/services/api/veiculo";

export default function Veiculos() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosVeiculos>({
    ativo: undefined,
  });

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] =
    useState(false);

  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [total, setTotal] = useState(0);

  const [erro, setErro] = useState("");

  const carregarVeiculos = useCallback(
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

        const resposta = await listarVeiculos({
          page: paginaAtual,
          limit: 50,
          busca: buscaAtual,
          ativo: filtros.ativo,
        });

        if (reset) {
          setVeiculos(resposta.veiculos);
          setPagina(1);
        } else {
          setVeiculos((atuais) => [
            ...atuais,
            ...resposta.veiculos,
          ]);

          setPagina(paginaAtual);
        }

        setTotal(resposta.pagination.total);
        setTemMais(
          resposta.pagination.has_next
        );
      } catch (error) {
        console.error(
          "Erro ao carregar veículos:",
          error
        );

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os veículos."
        );
      } finally {
        setCarregando(false);
        setCarregandoMais(false);
      }
    },
    [pagina, buscaAplicada, filtros.ativo]
  );

  useFocusEffect(
    useCallback(() => {
      carregarVeiculos(true);
    }, [buscaAplicada, filtros.ativo])
  );

  function realizarBusca() {
    setBuscaAplicada(busca.trim());
  }

  function aplicarFiltros(novosFiltros: FiltrosVeiculos) {
    setPagina(1);
    setFiltros(novosFiltros);
    setFiltrosAberto(false);
  }

  function filtrosAtivos() {
    return filtros.ativo !== undefined;
  }

  function abrirVeiculo(id: number) {
    router.push({
      pathname: "/veiculos/[id]",
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
        <Header title="Veículos" />

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
      <Header title="Veículos" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar veículos..."
          onSearch={realizarBusca}
          onFilterPress={() => setFiltrosAberto(true)}
          filterActive={filtrosAtivos()}
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
              ? "veículo"
              : "veículos"}
          </Text>

          {temPermissao(
            "VEICULOS",
            "CRIAR"
          ) && (
            <Button
              title="NOVO"
              size="small"
              onPress={() =>
                router.push(
                  "/veiculos/novo"
                )
              }
              style={styles.newButton}
            />
          )}
        </View>

        {erro !== "" && (
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
                  color: theme.texto,
                },
              ]}
            >
              {erro}
            </Text>

            <Button
              title="TENTAR NOVAMENTE"
              size="small"
              onPress={() =>
                carregarVeiculos(true)
              }
            />
          </View>
        )}

        {erro === "" &&
        veiculos.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                borderColor: theme.borda,
              },
            ]}
          >
            <Ionicons
              name="newspaper-outline"
              size={36}
              color={theme.textoSub}
            />

            <Text
              weight="SemiBold"
              style={styles.emptyTitle}
            >
              Nenhum veículo encontrado
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
                : "Cadastre o primeiro veículo para começar."}
            </Text>
          </View>
        ) : (
          <>
            {veiculos.map((veiculo) => (
              <TouchableOpacity
                key={veiculo.id}
                activeOpacity={0.8}
                onPress={() =>
                  abrirVeiculo(veiculo.id)
                }
                style={[
                  styles.item,
                  {
                    backgroundColor:
                      theme.background,
                    borderColor: theme.borda,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor:
                        theme.backgroundContainer,
                    },
                  ]}
                >
                  <Ionicons
                    name="newspaper-outline"
                    size={21}
                    color={theme.textoContainer}
                  />
                </View>

                <View style={styles.itemInfo}>
                  <Text
                    weight="SemiBold"
                    style={styles.itemName}
                    numberOfLines={1}
                  >
                    {veiculo.nome}
                  </Text>

                  <Text
                    style={[
                      styles.itemMeta,
                      {
                        color:
                          theme.textoSub,
                      },
                    ]}
                  >
                    {veiculo.ativo === 1
                      ? "Ativo"
                      : "Inativo"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward-outline"
                  size={21}
                  color={theme.texto}
                />
              </TouchableOpacity>
            ))}

            {temMais && (
              <Button
                title="CARREGAR MAIS"
                variant="outline"
                loading={carregandoMais}
                onPress={() =>
                  carregarVeiculos(false)
                }
                style={styles.moreButton}
              />
            )}
          </>
        )}
      </ScrollView>
      <VeiculoFilterModal
        visible={filtrosAberto}
        filtros={filtros}
        onClose={() => setFiltrosAberto(false)}
        onApply={aplicarFiltros}
      />
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
    justifyContent: "space-between",
    marginBottom: 15,
  },

  count: {
    fontSize: 13,
  },

  newButton: {
    width: 85,
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

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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
