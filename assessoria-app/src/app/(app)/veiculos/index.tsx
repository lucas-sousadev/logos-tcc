import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Image
} from "react-native";

import { useCallback, useState, useRef } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";
import { rotuloTier } from "@/constants/tier";
import VeiculoFilterModal, { FiltrosVeiculos } from "@/components/ui/Filtros/VeiculoFilterModal";
import FeedbackAlert, { type FeedbackAlertVariant } from "@/components/forms/FeedbackAlert";
import ContadorLista from "@/components/ui/ContadorLista";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import { useListaPaginada } from "@/hooks/useListaPaginada";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

import {
  Veiculo,
  listarVeiculos,
  excluirVeiculosEmLote,
  obterUrlLogoVeiculo,
} from "@/services/api/veiculo";

interface FeedbackState {
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDanger?: boolean;
  onPrimary?: () => void;
}

function resumoVinculos(veiculo: Veiculo): string {
  const contatos = Number(veiculo.contatos_vinculados) || 0;
  const clippings = Number(veiculo.clippings_vinculados) || 0;
  const partes: string[] = [];

  if (contatos > 0) {
    partes.push(`${contatos} ${contatos === 1 ? "contato" : "contatos"}`);
  }

  if (clippings > 0) {
    partes.push(`${clippings} ${clippings === 1 ? "clipping" : "clippings"}`);
  }

  return `${partes.join(" · ")}`;
}

const LIMITE_SELECAO_EM_LOTE = 100;

  function quantidadeFiltro(
    valorOriginal: string
  ): number | undefined {
    const valor = valorOriginal.trim();

    if (valor === "" || !/^\d+$/.test(valor)) {
      return undefined;
    }

    return Number(valor);
  }

export default function Veiculos() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosVeiculos>({
    ativo: undefined,
    ordem: "nome",
    direcao: "ASC",
    minContatos: "",
    maxContatos: "",
    minClippings: "",
    maxClippings: "",
  });

  const [modoSelecao, setModoSelecao] = useState(false);

  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);

  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  function mostrarFeedback(dados: FeedbackState) {
    setFeedback(dados);
  }

  function fecharFeedback() {
    setFeedback(null);
  }

  const consultarPagina = useCallback(
    async (page: number, limit: number) => {
      const resposta = await listarVeiculos({
        page,
        limit,
        busca: buscaAplicada,
        ativo: filtros.ativo,
        ordem: filtros.ordem,
        direcao: filtros.direcao,
        min_contatos: quantidadeFiltro(
          filtros.minContatos
        ),
        max_contatos: quantidadeFiltro(
          filtros.maxContatos
        ),
        min_clippings: quantidadeFiltro(
          filtros.minClippings
        ),
        max_clippings: quantidadeFiltro(
          filtros.maxClippings
        ),
      });

      return {
        itens: resposta.veiculos,
        total: resposta.pagination.total,
      };
    },
    [
      buscaAplicada,
      filtros.ativo,
      filtros.ordem,
      filtros.direcao,
      filtros.minContatos,
      filtros.maxContatos,
      filtros.minClippings,
      filtros.maxClippings,
    ]
  );

  const {
    itens: veiculos,
    pagina,
    total,
    carregando,
    erro,
    limite,
    carregarPagina,
  } = useListaPaginada<Veiculo>({
    chave: JSON.stringify([buscaAplicada, filtros]),
    consultar: consultarPagina,
  });

  function carregarVeiculos(reset = false) {
    return carregarPagina(reset ? 1 : undefined);
  }

  useFocusEffect(
    useCallback(() => () => {
      setIdsSelecionados([]);
      setModoSelecao(false);
    }, [])
  );

  function realizarBusca() {
    sairModoSelecao();

    const texto = busca.trim();

    if (texto === buscaAplicada) {
      void carregarPagina(1);
    } else {
      setBuscaAplicada(texto);
    }
  }

  function limparBusca() {
    sairModoSelecao();
    setBusca("");

    if (buscaAplicada === "") {
      void carregarPagina(1);
    } else {
      setBuscaAplicada("");
    }
  }

  function aplicarFiltros(
    novosFiltros: FiltrosVeiculos
  ) {
    sairModoSelecao();

    const mesmos =
      JSON.stringify(novosFiltros) ===
      JSON.stringify(filtros);

    setFiltros(novosFiltros);
    setFiltrosAberto(false);

    if (mesmos) {
      void carregarPagina(1);
    }
  }

  function filtrosAtivos() {
    return (
      filtros.ativo !== undefined ||
      filtros.ordem !== "nome" ||
      filtros.direcao !== "ASC" ||
      filtros.minContatos.trim() !== "" ||
      filtros.maxContatos.trim() !== "" ||
      filtros.minClippings.trim() !== "" ||
      filtros.maxClippings.trim() !== ""
    );
  }

  function abrirVeiculo(id: number) {
    router.push({
      pathname: "/veiculos/[id]",
      params: {
        id: id.toString(),
      },
    });
  }

  function abrirModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(true);
  }

  function sairModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(false);
  }

  function alternarVeiculoSelecionado(id: number) {
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
          "Você pode selecionar até 100 veículos por vez. Desmarque algum veículo antes de selecionar outro.",
      });

      return;
    }

    setIdsSelecionados((atual) => [
      ...atual,
      id,
    ]);
  }

  function selecionarTodosVisiveis() {
    const idsVisiveis = veiculos.map(
      (veiculo) => veiculo.id
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
      .filter(
        (id) => !idsSelecionados.includes(id)
      )
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
          "Foram selecionados os primeiros veículos disponíveis até o limite de 100 por exclusão.",
      });
    }
  }

  function confirmarExclusaoSelecionados() {
    const quantidade = idsSelecionados.length;

    if (quantidade === 0) {
      mostrarFeedback({
        variant: "warning",
        title: "Nenhum veículo selecionado",
        message:
          "Selecione pelo menos um veículo para excluir.",
      });

      return;
    }

    mostrarFeedback({
      variant: "warning",
      title: `Excluir ${quantidade} veículo(s)?`,
      message:
        "Essa ação não pode ser desfeita. Caso algum veículo esteja vinculado a contatos, nenhum veículo será excluído.",
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
        await excluirVeiculosEmLote(ids);

      sairModoSelecao();

      await carregarVeiculos(true);

      mostrarFeedback({
        variant: "success",
        title: "Veículos excluídos",
        message:
          `${resultado.excluidos} veículo(s) ` +
          "foram excluídos com sucesso.",
      });
    } catch (error) {
      mostrarFeedback({
        variant: "error",
        title: "Não foi possível excluir",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir os veículos.",
      });
    } finally {
      setExcluindoSelecionados(false);
    }
  }

  const todosVeiculosVisiveisSelecionados =
    veiculos.length > 0 &&
    veiculos.every((veiculo) =>
      idsSelecionados.includes(veiculo.id)
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
        <Header title="Veículos" showBackButton />

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
      <Header title="Veículos" showBackButton />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ref={scrollRef}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar veículos..."
          onSearch={realizarBusca}
          onFilterPress={() => {
            sairModoSelecao();
            setFiltrosAberto(true);
          }}
          onClear={limparBusca}
          filterActive={filtrosAtivos()}
        />

        <View style={styles.topRow}>
          <ContadorLista>
            {total} {total === 1 ? "veiculo" : "veiculos"}
          </ContadorLista>

          {temPermissao(
            "VEICULOS",
            "CRIAR"
          ) && (
            <Button
              icon="add-outline"
              title="VEÍCULO"
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

        <LimparFiltrosButton
          visible={filtrosAtivos()}
          disabled={
            carregando ||
            excluindoSelecionados
          }
          onPress={() => {
            aplicarFiltros({
              ativo: undefined,
              ordem: "nome",
              direcao: "ASC",
              minContatos: "",
              maxContatos: "",
              minClippings: "",
              maxClippings: "",
            });
          }}
        />
        {temPermissao("VEICULOS", "EXCLUIR") &&
          veiculos.length > 0 ? (
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
                    Escolha os veículos que deseja excluir.
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
                    {todosVeiculosVisiveisSelecionados ||
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
                  SELECIONAR VEÍCULOS
                </Text>
              </TouchableOpacity>
            )
          ) : null}

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
                onPress={() => {
                  if (modoSelecao) {
                    alternarVeiculoSelecionado(veiculo.id);
                    return;
                  }

                  abrirVeiculo(veiculo.id);
                }}
                style={[
                  styles.item,
                  {
                    backgroundColor: theme.backgroundSecundario,
                    borderColor: theme.borda + "45",
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: veiculo.logo_path
                        ? theme.branco
                        : theme.primaria + "12",
                    },
                  ]}
                >
                  {veiculo.logo_path ? (
                    <Image
                      source={{
                        uri:
                          obterUrlLogoVeiculo(
                            veiculo.logo_path
                          ) ?? "",
                      }}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name="newspaper-outline"
                      size={21}
                      color={theme.textoTerciaria}
                    />
                  )}
                </View>

                <View style={styles.itemInfo}>
                  <Text
                    weight="SemiBold"
                    style={styles.itemName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {veiculo.nome}
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
                    {[
                      rotuloTier(veiculo.tier),
                      veiculo.descricao
                        ? veiculo.descricao
                        : "Sem descrição",
                      veiculo.ativo === 1
                        ? "Ativo"
                        : "Inativo",
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                  {(Number(veiculo.contatos_vinculados) > 0 ||
                    Number(veiculo.clippings_vinculados) > 0) ? (
                    <View style={styles.linkedInfo}>
                      <Ionicons
                        name="link-outline"
                        size={13}
                        color="#F59E0B"
                      />

                      <Text
                        weight="Medium"
                        numberOfLines={1}
                        style={[
                          styles.linkedText,
                          { color: "#F59E0B" },
                        ]}
                      >
                        {resumoVinculos(veiculo)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {modoSelecao ? (
                  <View
                    style={[
                      styles.selectionCheckbox,
                      {
                        borderColor: idsSelecionados.includes(veiculo.id)
                          ? theme.backgroundContainer
                          : theme.borda,
                        backgroundColor: idsSelecionados.includes(veiculo.id)
                          ? theme.backgroundContainer
                          : theme.background,
                      },
                    ]}
                  >
                    {idsSelecionados.includes(veiculo.id) ? (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.textoContainer}
                      />
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.itemArrow,
                      {
                        backgroundColor: theme.primaria + "0C",
                      },
                    ]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color={theme.textoTerciaria}
                    />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {!erro && total > 0 ? (
              <PaginacaoLista
                pagina={pagina}
                limite={limite}
                total={total}
                disabled={carregando || excluindoSelecionados}
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
      <VeiculoFilterModal
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
        loading={excluindoSelecionados}
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
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },

  count: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
  },

  linkedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  linkedText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
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
    width: "auto",
  },

  item: {
    width: "100%",
    minWidth: 0,
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  itemName: {
    fontSize: 14,
    lineHeight: 19,
  },

  itemMeta: {
    fontSize: 11,
    lineHeight: 15,
  },

  itemArrow: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
