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
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";

import FuncionarioFilterModal, {
  type FiltrosFuncionarios,
} from "@/components/ui/Filtros/FuncionariosFilterModal";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Funcionario } from "@/services/api/auth";
import { Ionicons } from "@expo/vector-icons";

function obterIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.charAt(0) ?? "";

  const ultima =
    partes.length > 1
      ? partes[partes.length - 1].charAt(0)
      : "";

  return (
    (primeira + ultima).toLocaleUpperCase("pt-BR") || "?"
  );
}

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

          {temPermissao("CONVITES", "VISUALIZAR") ? (
            <Button
              title="CONVITES"
              icon="mail-outline"
              size="small"
              style={styles.convitesButton}
              onPress={() =>
                router.push({
                  pathname: "/convites",
                  params: {
                    origem: "funcionarios",
                  },
                })
              }
            />
          ) : null}
        </View>

        <LimparFiltrosButton
          visible={filtros.ativo !== undefined}
          disabled={carregando || carregandoMais}
          onPress={() => {
            setPagina(1);

            aplicarFiltros({
              ativo: undefined,
            });
          }}
        />
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
            {funcionarios.map((funcionario) => {
              const ativo = funcionario.ativo === 1;

              const corStatus = ativo
                ? theme.alteracao
                : theme.textoSub;

              return (
                <TouchableOpacity
                  key={funcionario.id}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={
                    funcionario.nome +
                    ". " +
                    funcionario.email +
                    ". " +
                    (ativo ? "Ativo." : "Inativo.")
                  }
                  accessibilityHint="Abre o cadastro do funcionário."
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
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda + "45",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: theme.primaria + "12",
                      },
                    ]}
                  >
                    <Text
                      weight="Bold"
                      style={[
                        styles.avatarTexto,
                        { color: theme.textoTerciaria },
                      ]}
                    >
                      {obterIniciais(funcionario.nome)}
                    </Text>
                  </View>

                  <View style={styles.cardContent}>
                    <Text
                      weight="SemiBold"
                      numberOfLines={1}
                      style={styles.name}
                    >
                      {funcionario.nome}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.email,
                        { color: theme.textoSub },
                      ]}
                    >
                      {funcionario.email}
                    </Text>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: corStatus + "14",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusPonto,
                          { backgroundColor: corStatus },
                        ]}
                      />

                      <Text
                        weight="SemiBold"
                        style={[
                          styles.statusTexto,
                          { color: corStatus },
                        ]}
                      >
                        {ativo ? "Ativo" : "Inativo"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.cardSeta,
                      {
                        backgroundColor: theme.primaria + "0A",
                      },
                    ]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.textoTerciaria}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}

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
    gap: 12,
    marginBottom: 12,
  },

  count: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
  },

  convitesButton: {
    width: "auto",
    flexShrink: 0,
    paddingHorizontal: 12,
  },

  loading: {
    paddingVertical: 40,
    alignItems: "center",
  },

  card: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarTexto: {
    fontSize: 15,
    lineHeight: 20,
  },

  cardContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },

  name: {
    fontSize: 15,
    lineHeight: 21,
  },

  email: {
    fontSize: 12,
    lineHeight: 17,
  },

  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 2,
  },

  statusPonto: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  statusTexto: {
    fontSize: 10,
    lineHeight: 14,
  },

  cardSeta: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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