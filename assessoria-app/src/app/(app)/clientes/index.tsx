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
import ClienteFilterModal, { FiltrosClientes } from "@/components/ui/Filtros/ClienteFilterModal";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import FeedbackAlert, { type FeedbackAlertVariant } from "@/components/forms/FeedbackAlert";
import {
  Cliente,
  listarClientes,
  obterUrlLogoCliente,
  excluirClientesEmLote,
} from "@/services/api/cliente";

interface FeedbackState {
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDanger?: boolean;
  onPrimary?: () => void;
}

const LIMITE_SELECAO_EM_LOTE = 100;

export default function Clientes() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");
  
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtros, setFiltros] =
  useState<FiltrosClientes>({
    estado: "",
    cidade: "",
    segmento: "",
    ativo: undefined,
  });
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
  const [modoSelecao, setModoSelecao] = useState(false);

  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);

  const [
    excluindoSelecionados,
    setExcluindoSelecionados,
  ] = useState(false);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null); 

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
          estado: filtros.estado,
          cidade: filtros.cidade,
          segmento: filtros.segmento,
          ativo: filtros.ativo,
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
        [
      pagina,
      buscaAplicada,
      filtros.estado,
      filtros.cidade,
      filtros.segmento,
      filtros.ativo,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      void carregarClientes(true);

      return () => {
        setIdsSelecionados([]);
        setModoSelecao(false);
      };
    }, [
      buscaAplicada,
      filtros.estado,
      filtros.cidade,
      filtros.segmento,
      filtros.ativo,
    ])
  );

  function realizarBusca() {
    sairModoSelecao();
    setPagina(1);
    setBuscaAplicada(busca.trim());
  }

  function limparBusca() {
    sairModoSelecao();
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

  function aplicarFiltros(
    novosFiltros: FiltrosClientes
  ) {
    sairModoSelecao();
    setPagina(1);
    setFiltros(novosFiltros);
    setFiltrosAberto(false);
  }

  function filtrosAtivos() {
    return (
      filtros.ativo !== undefined ||
      filtros.estado.trim() !== "" ||
      filtros.cidade.trim() !== "" ||
      filtros.segmento.trim() !== ""
    );
  }

  function mostrarFeedback(
  dados: FeedbackState
) {
  setFeedback(dados);
}

function fecharFeedback() {
  setFeedback(null);
}

function abrirModoSelecao() {
  setIdsSelecionados([]);
  setModoSelecao(true);
}

function sairModoSelecao() {
  setIdsSelecionados([]);
  setModoSelecao(false);
}

function alternarClienteSelecionado(id: number) {
  if (idsSelecionados.includes(id)) {
    setIdsSelecionados((atual) =>
      atual.filter((item) => item !== id)
    );

    return;
  }

  if (
    idsSelecionados.length >=
    LIMITE_SELECAO_EM_LOTE
  ) {
    mostrarFeedback({
      variant: "warning",
      title: "Limite de seleção atingido",
      message:
        "Você pode selecionar até 100 clientes por vez. Desmarque algum cliente antes de selecionar outro.",
    });

    return;
  }

  setIdsSelecionados((atual) => [
    ...atual,
    id,
  ]);
}

  function selecionarTodosVisiveis() {
    const idsVisiveis = clientes.map(
      (cliente) => cliente.id
    );

    const todosSelecionados =
      idsVisiveis.length > 0 &&
      idsVisiveis.every((id) =>
        idsSelecionados.includes(id)
      );

    if (
      todosSelecionados ||
      idsSelecionados.length >=
        LIMITE_SELECAO_EM_LOTE
    ) {
      setIdsSelecionados([]);
      return;
    }

    const vagasRestantes =
      LIMITE_SELECAO_EM_LOTE -
      idsSelecionados.length;

    const idsParaAdicionar = idsVisiveis
      .filter((id) => !idsSelecionados.includes(id))
      .slice(0, vagasRestantes);

    setIdsSelecionados((atual) => [
      ...atual,
      ...idsParaAdicionar,
    ]);

    const existemMaisVisiveis =
      idsVisiveis.filter(
        (id) => !idsSelecionados.includes(id)
      ).length > idsParaAdicionar.length;

    if (existemMaisVisiveis) {
      mostrarFeedback({
        variant: "info",
        title: "Limite de seleção atingido",
        message:
          "Foram selecionados os primeiros clientes disponíveis até o limite de 100 por exclusão.",
      });
    }
  }

  function confirmarExclusaoSelecionados() {
    const quantidade = idsSelecionados.length;

    if (quantidade === 0) {
      mostrarFeedback({
        variant: "warning",
        title: "Nenhum cliente selecionado",
        message:
          "Selecione pelo menos um cliente para excluir.",
      });

      return;
    }

    mostrarFeedback({
      variant: "warning",
      title:
        quantidade === 1
          ? "Excluir cliente?"
          : `Excluir ${quantidade} clientes?`,
      message:
        "Essa ação não pode ser desfeita. Caso algum cliente possua registros vinculados, nenhum cliente será excluído.",
      primaryLabel: "EXCLUIR",
      secondaryLabel: "CANCELAR",
      primaryDanger: true,
      onPrimary: excluirSelecionados,
    });
  }

  async function excluirSelecionados() {
    const ids = [...idsSelecionados];

    if (ids.length === 0) {
      return;
    }

    fecharFeedback();
    setExcluindoSelecionados(true);

    try {
      const resultado =
        await excluirClientesEmLote(ids);

      sairModoSelecao();

      await carregarClientes(true);

      mostrarFeedback({
        variant: "success",
        title: "Clientes excluídos",
        message:
          `${resultado.excluidos} cliente(s) ` +
          "foram excluídos com sucesso.",
      });
    } catch (error) {
      mostrarFeedback({
        variant: "error",
        title: "Não foi possível excluir",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir os clientes.",
      });
    } finally {
      setExcluindoSelecionados(false);
    }
  }

  const todosClientesVisiveisSelecionados =
    clientes.length > 0 &&
    clientes.every((cliente) =>
      idsSelecionados.includes(cliente.id)
    );

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
          onFilterPress={() => {
            sairModoSelecao();
            setFiltrosAberto(true);
          }}
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
        
        {temPermissao("CLIENTES", "EXCLUIR") &&
          clientes.length > 0 ? (
            modoSelecao ? (
              <View
                style={[
                  styles.selectionToolbar,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.borda,
                  },
                ]}
              >
                <View style={styles.selectionInfo}>
                  <Text
                    weight="SemiBold"
                    style={styles.selectionTitle}
                  >
                    {idsSelecionados.length} de{" "}
                    {LIMITE_SELECAO_EM_LOTE} selecionado(s)
                  </Text>

                  <Text
                    style={[
                      styles.selectionSubtitle,
                      { color: theme.textoSub },
                    ]}
                  >
                    Escolha os clientes que deseja excluir.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={selecionarTodosVisiveis}
                  disabled={excluindoSelecionados}
                  style={[
                    styles.selectAllButton,
                    { borderColor: theme.borda },
                  ]}
                >
                  <Text
                    weight="SemiBold"
                    style={[
                      styles.selectAllText,
                      { color: theme.texto },
                    ]}
                  >
                    {todosClientesVisiveisSelecionados ||
                    idsSelecionados.length >=
                      LIMITE_SELECAO_EM_LOTE
                      ? "LIMPAR"
                      : "TODOS"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={confirmarExclusaoSelecionados}
                  disabled={
                    idsSelecionados.length === 0 ||
                    excluindoSelecionados
                  }
                  style={[
                    styles.selectionIconButton,
                    {
                      backgroundColor: "#EF4444",
                      opacity:
                        idsSelecionados.length === 0 ||
                        excluindoSelecionados
                          ? 0.5
                          : 1,
                    },
                  ]}
                >
                  {excluindoSelecionados ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={sairModoSelecao}
                  disabled={excluindoSelecionados}
                  style={[
                    styles.selectionIconButton,
                    {
                      backgroundColor:
                        theme.backgroundContainer,
                    },
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={theme.textoContainer}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={abrirModoSelecao}
                style={[
                  styles.selectionStartButton,
                  { borderColor: theme.borda },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={19}
                  color={theme.texto}
                />

                <Text
                  weight="SemiBold"
                  style={[
                    styles.selectionStartText,
                    { color: theme.texto },
                  ]}
                >
                  SELECIONAR CLIENTES
                </Text>
              </TouchableOpacity>
            )
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
                onPress={() => {
                  if (modoSelecao) {
                    alternarClienteSelecionado(cliente.id);
                    return;
                  }

                  abrirCliente(cliente.id);
                }}
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

                {modoSelecao ? (
                  <View
                    style={[
                      styles.selectionCheckbox,
                      {
                        borderColor: idsSelecionados.includes(cliente.id)
                          ? theme.backgroundContainer
                          : theme.borda,
                        backgroundColor: idsSelecionados.includes(
                          cliente.id
                        )
                          ? theme.backgroundContainer
                          : theme.background,
                      },
                    ]}
                  >
                    {idsSelecionados.includes(cliente.id) ? (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.textoContainer}
                      />
                    ) : null}
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward-outline"
                    size={21}
                    color={theme.texto}
                  />
                )}
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
      <ClienteFilterModal
        visible={filtrosAberto}
        filtros={filtros}
        onClose={() => setFiltrosAberto(false)}
        onApply={aplicarFiltros}
      />
      <FeedbackAlert
        visible={feedback !== null}
        variant={feedback?.variant ?? "info"}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        primaryLabel={feedback?.primaryLabel}
        secondaryLabel={feedback?.secondaryLabel}
        primaryDanger={feedback?.primaryDanger}
        onClose={fecharFeedback}
        onPrimary={() => {
          if (feedback?.onPrimary) {
            void feedback.onPrimary();
            return;
          }

          fecharFeedback();
        }}
        onSecondary={fecharFeedback}
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
    gap: 10,
    marginBottom: 12,
  },

  count: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
  },

  selectionStartButton: {
    minHeight: 42,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },

  selectionStartText: {
    fontSize: 12,
  },

  selectionToolbar: {
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    marginBottom: 12,
  },

  selectionInfo: {
    flex: 1,
  },

  selectionTitle: {
    fontSize: 13,
  },

  selectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  selectAllButton: {
    height: 36,
    borderWidth: 1.5,
    borderRadius: 18,
    justifyContent: "center",
    paddingHorizontal: 11,
  },

  selectAllText: {
    fontSize: 11,
  },

  selectionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  selectionCheckbox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
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