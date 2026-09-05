import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useCallback, useState } from "react";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import Header from "@/components/layout/Header";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import SearchBar from "@/components/ui/SearchBar";

import FuncionarioFilterModal, {
  type FiltrosFuncionarios,
} from "@/components/ui/Filtros/FuncionariosFilterModal";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Funcionario } from "@/services/api/auth";
import { Ionicons } from "@expo/vector-icons";

export default function Funcionarios() {
  const router = useRouter();
  const { theme } = useTheme();

  const {
    listarFuncionarios,
    temPermissao
  } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");

  const [filtrosAberto, setFiltrosAberto] =
    useState(false);

  const [filtros, setFiltros] =
    useState<FiltrosFuncionarios>({
      ativo: undefined,
    });

  const [funcionarios, setFuncionarios] =
    useState<Funcionario[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [carregandoMais, setCarregandoMais] =
    useState(false);

  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [total, setTotal] = useState(0);

  const [erro, setErro] = useState("");

  const carregarPrimeiraPagina = useCallback(
    async () => {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await listarFuncionarios({
          page: 1,
          limit: 50,
          busca: buscaAplicada,
          ativo: filtros.ativo,
        });

        setFuncionarios(resposta.funcionarios);
        setPagina(resposta.pagination.page);
        setTotal(resposta.pagination.total);
        setTemMais(
          resposta.pagination.has_next
        );
      } catch (error) {
        console.error(
          "Erro ao carregar funcionários:",
          error
        );

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os funcionários."
        );
      } finally {
        setCarregando(false);
      }
    },
    [
      buscaAplicada,
      filtros.ativo,
      listarFuncionarios,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      carregarPrimeiraPagina();
    }, [carregarPrimeiraPagina])
  );

  async function carregarMais() {
    if (carregandoMais || !temMais) {
      return;
    }

    try {
      setCarregandoMais(true);
      setErro("");

      const paginaAtual = pagina + 1;

      const resposta = await listarFuncionarios({
        page: paginaAtual,
        limit: 50,
        busca: buscaAplicada,
        ativo: filtros.ativo,
      });

      setFuncionarios((atuais) => [
        ...atuais,
        ...resposta.funcionarios,
      ]);

      setPagina(resposta.pagination.page);
      setTotal(resposta.pagination.total);
      setTemMais(
        resposta.pagination.has_next
      );
    } catch (error) {
      console.error(
        "Erro ao carregar mais funcionários:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os funcionários."
      );
    } finally {
      setCarregandoMais(false);
    }
  }

  function realizarBusca() {
    setBuscaAplicada(busca.trim());
  }

  function aplicarFiltros(
    novosFiltros: FiltrosFuncionarios
  ) {
    setFiltros(novosFiltros);
    setFiltrosAberto(false);
  }

  if (!temPermissao("USUARIOS", "VISUALIZAR"))  {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <BackButton />

        <View style={styles.restricted}>
          <Text
            weight="Bold"
            style={styles.restrictedTitle}
          >
            Acesso restrito
          </Text>

          <Text style={styles.restrictedText}>
            Você não tem permissão para visualizar funcionários.
          </Text>
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
      <Header
        title="Funcionários"
        showBackButton
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar funcionários..."
          onSearch={realizarBusca}
          onFilterPress={() =>
            setFiltrosAberto(true)
          }
          filterActive={
            filtros.ativo !== undefined
          }
          onClear={() => setBuscaAplicada("")}
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
              ? "funcionário"
              : "funcionários"}
          </Text>

          {temPermissao("CONVITES", "VISUALIZAR") && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: "/convites",
                  params: {
                    origem: "funcionarios",
                  },
                })
              }
              style={[
                styles.convitesButton,
                {
                  backgroundColor:
                    theme.backgroundContainer,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Gerenciar convites"
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.textoContainer}
              />
            </TouchableOpacity>
          )}
        </View>

        {carregando ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={theme.primaria}
            />
          </View>
        ) : erro ? (
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
            <Text
              weight="Medium"
              style={[
                styles.error,
                { color: "#EF4444" },
              ]}
            >
              {erro}
            </Text>

            <Button
              title="TENTAR NOVAMENTE"
              size="small"
              onPress={carregarPrimeiraPagina}
            />
          </View>
        ) : funcionarios.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={styles.emptyTitle}
            >
              Nenhum funcionário encontrado
            </Text>

            <Text style={styles.emptyText}>
              Tente alterar a busca ou os filtros.
            </Text>
          </View>
        ) : (
          <>
            {funcionarios.map((funcionario) => (
              <TouchableOpacity
                key={funcionario.id}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: "/funcionarios/[id]",
                    params: {
                      id: funcionario.id.toString(),
                    },
                  })
                }
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.borda,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        theme.backgroundContainer,
                    },
                  ]}
                >
                  <Text
                    weight="Bold"
                    style={{
                      color: theme.textoContainer,
                      fontSize: 18,
                    }}
                  >
                    {funcionario.nome
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View style={styles.cardContent}>
                  <Text
                    weight="SemiBold"
                    style={styles.name}
                  >
                    {funcionario.nome}
                  </Text>

                  <Text style={styles.email}>
                    {funcionario.email}
                  </Text>

                  <Text
                    weight="Medium"
                    style={[
                      styles.status,
                      {
                        color:
                          funcionario.ativo === 1
                            ? theme.terciaria
                            : "#EF4444",
                      },
                    ]}
                  >
                    {funcionario.ativo === 1
                      ? "Ativo"
                      : "Inativo"}
                  </Text>
                </View>

                <Text
                  weight="Regular"
                  style={[styles.arrow, {color: theme.texto}]}
                >
                  ›
                </Text>
              </TouchableOpacity>
            ))}

            {temMais && (
              <Button
                title="CARREGAR MAIS"
                variant="outline"
                loading={carregandoMais}
                onPress={carregarMais}
                style={styles.moreButton}
              />
            )}
          </>
        )}
      </ScrollView>

      <FuncionarioFilterModal
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
    marginBottom: 12,
  },

  count: {
    fontSize: 13,
  },

  convitesButton: {
    width: 50,
    height: 45,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  loading: {
    paddingVertical: 40,
    alignItems: "center",
  },

  card: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 12,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },

  cardContent: {
    flex: 1,
    marginLeft: 12,
  },

  name: {
    fontSize: 17,
  },

  email: {
    fontSize: 13,
    marginTop: 3,
    color: "#808080",
  },

  status: {
    fontSize: 12,
    marginTop: 5,
  },

  arrow: {
    fontSize: 30,
    marginLeft: 8,
  },

  emptyCard: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 25,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 19,
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    textAlign: "center",
    color: "#808080",
    lineHeight: 20,
  },

  errorBox: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 18,
    alignItems: "center",
  },

  error: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 12,
  },

  moreButton: {
    marginTop: 4,
  },

  restricted: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  restrictedTitle: {
    fontSize: 24,
    marginBottom: 8,
  },

  restrictedText: {
    textAlign: "center",
    color: "#808080",
  },
});