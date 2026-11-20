import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useCallback, useState, useRef} from "react";
import {
  useRouter,
} from "expo-router";

import Header from "@/components/layout/Header";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import SearchBar from "@/components/ui/SearchBar";
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";
import ContadorLista from "@/components/ui/ContadorLista";
import FuncionarioFilterModal, {
  type FiltrosFuncionarios,
} from "@/components/ui/Filtros/FuncionariosFilterModal";
import PaginacaoLista from "@/components/ui/PaginacaoLista";

import { useListaPaginada } from "@/hooks/useListaPaginada";
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
  const scrollRef = useRef<ScrollView>(null);
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

  const consultarPagina = useCallback(
    async (page: number, limit: number) => {
      const resposta = await listarFuncionarios({
        page,
        limit,
        busca: buscaAplicada,
        ativo: filtros.ativo,
      });

      return {
        itens: resposta.funcionarios,
        total: resposta.pagination.total,
      };
    },
    [
      buscaAplicada,
      filtros.ativo,
      listarFuncionarios,
    ]
  );

  const {
    itens: funcionarios,
    pagina,
    total,
    carregando,
    erro,
    limite,
    carregarPagina,
  } = useListaPaginada<Funcionario>({
    chave: JSON.stringify([buscaAplicada, filtros]),
    consultar: consultarPagina,
    habilitado: temPermissao(
      "USUARIOS",
      "VISUALIZAR"
    ),
  });

  function carregarPrimeiraPagina() {
    return carregarPagina(1);
  }

  function realizarBusca() {
    const texto = busca.trim();

    if (texto === buscaAplicada) {
      void carregarPagina(1);
    } else {
      setBuscaAplicada(texto);
    }
  }

  function limparBusca() {
    setBusca("");

    if (buscaAplicada === "") {
      void carregarPagina(1);
    } else {
      setBuscaAplicada("");
    }
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
        ref={scrollRef}
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
          onClear={limparBusca}
        />

        <View style={styles.topRow}>
          <ContadorLista>
            {total} {total === 1 ? "colaborador" : "colaboradores"}
          </ContadorLista>

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
          disabled={carregando}
          onPress={() => {
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

            {!erro && total > 0 ? (
              <PaginacaoLista
                pagina={pagina}
                limite={limite}
                total={total}
                disabled={carregando}
                onChange={(destino) => {
                  void carregarPagina(destino);

                  scrollRef.current?.scrollTo({
                    y: 0,
                    animated: false,
                  });
                }}
              />
            ) : null}
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
    flexWrap: "nowrap",
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
