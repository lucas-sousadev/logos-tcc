import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from "react-native";

import { useCallback, useState, useEffect } from "react";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useConsultaClipping } from "@/hooks/useConsultaClipping";
import AvisoClippingSalvo from "@/components/clipping/avisoClippingSalvo";
import Header from "@/components/layout/Header";
import { useVoltarNaPilha } from "@/hooks/useNavegacaoModulos";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import ClippingCard from "@/components/clipping/ClippingCard";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import ClippingFilterModal, { novosFiltrosClippings, converterFiltrosClipping, possuiFiltrosClipping,} from "@/components/ui/Filtros/ClippingFilterModal";
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ContadorLista from "@/components/ui/ContadorLista";
import SelecaoListaButton from "@/components/ui/SelecaoListaButton";

import { useSelecaoClippings } from "@/hooks/useSelecaoClipping";
import { useExportacaoClippings } from "@/hooks/useExportacaoClippings";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Clipping,
  listarClippings,
} from "@/services/api/clipping";
import { buscarCliente } from "@/services/api/cliente";
import { useClippingNovos } from "@/contexts/ClippingNovosContext";
import { rotaOrigemClipping } from "@/utils/retornoClipping";

type RotaClippings = {
  id?: string;
  ano?: string;
  clienteNome?: string;
  criadoId?: string;
  origemTipo?: string;
  origemId?: string;
  retornoVinculado?: "ano" | "origem";
};

export default function ClippingsDoCliente() {
  const params = useLocalSearchParams<RotaClippings>();
  return <ConteudoClippingsDoCliente key={JSON.stringify([params.id, params.ano])} params={params} />;
}

function ConteudoClippingsDoCliente({ params }: { params: RotaClippings }) {
  const router = useRouter();
  const voltarNaPilha = useVoltarNaPilha();
  const { width } = useWindowDimensions();
  const compacto = width < 380;
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const { novos, marcarVisualizado } = useClippingNovos();

  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtros, setFiltros] = useState(novosFiltrosClippings);
  const [pagina, setPagina] = useState(1);

  const filtrosAtivos = possuiFiltrosClipping(filtros);


  const ano = Number(params.ano);
  const clienteId = Number(params.id);
  const criadoId = Number(params.criadoId);

  const mostrarAviso =
    Number.isSafeInteger(criadoId) && criadoId > 0;

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
  const [expandido, setExpandido] = useState<number | null>(null);


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

  const chaveConsulta = JSON.stringify([
    clienteId,
    ano,
    buscaAplicada,
    filtros,
    pagina,
  ]);

  const consultarClippings = useCallback(async () => {
    if (
      !Number.isSafeInteger(clienteId) ||
      clienteId <= 0 ||
      !Number.isInteger(ano) ||
      ano < 1000 ||
      ano > 9999
    ) {
      throw new Error("Cliente ou ano inválido.");
    }

    return listarClippings({
      ...converterFiltrosClipping(filtros),
      cliente_id: clienteId,
      ano_referencia: ano,
      busca: buscaAplicada,
      page: pagina,
      limit: 50,
    });
  }, [ano, clienteId, buscaAplicada, filtros, pagina]);

  const ajustarPagina = useCallback((resposta: Awaited<ReturnType<typeof listarClippings>>) => {
    const ultima = Math.max(1, Math.ceil(resposta.pagination.total / 50));
    if (pagina > ultima) setPagina(ultima);
  }, [pagina]);

  const {
    dados,
    carregando,
    atualizando,
    erro,
    recarregar: carregarClippings,
    atualizarDados,
  } = useConsultaClipping(
    consultarClippings,
    chaveConsulta,
    ajustarPagina
  );

  const clippings = dados?.clippings ?? [];
  const total = dados?.pagination.total ?? 0;

  const podeExportar = temPermissao("CLIPPING", "EXPORTAR");

  const exportacao = useExportacaoClippings({
    clienteId,
    ano,
    permitido: podeExportar,
    filtros: {
      ...converterFiltrosClipping(filtros),
      busca: buscaAplicada,
    },
  });

  const selecao = useSelecaoClippings({
    chave: chaveConsulta,
    clippings,
    bloqueado:
      carregando ||
      atualizando ||
      Boolean(erro) ||
      exportacao.exportando,
    podeExcluir: temPermissao("CLIPPING", "EXCLUIR"),

    aoConcluir: async (idsExcluidos) => {
      const removidos = new Set(idsExcluidos);

      idsExcluidos.forEach(marcarVisualizado);

      // remove imediatamente os registros com exclusão confirmada. se a atualização falhar, eles não reaparecem na lista antiga
      if (dados && removidos.size > 0) {
        const quantidadeRemovida = dados.clippings.filter(
          (clipping) => removidos.has(clipping.id)
        ).length;

        const novoTotal = Math.max(
          0,
          dados.pagination.total - quantidadeRemovida
        );

        atualizarDados({
          ...dados,
          clippings: dados.clippings.filter(
            (clipping) => !removidos.has(clipping.id)
          ),
          pagination: {
            ...dados.pagination,
            total: novoTotal,
            has_next:
              dados.pagination.page * dados.pagination.limit <
              novoTotal,
          },
        });
      }
      
      setExpandido(null);
      await carregarClippings();
    },
  });

  function exportarResultados() {
        if (
          !podeExportar ||
          carregando ||
          atualizando ||
          erro ||
          selecao.excluindo ||
          exportacao.exportando
        ) {
          return;
        }

        void exportacao.exportar();
      }

      function exportarSelecionados() {
        if (
          !podeExportar ||
          carregando ||
          atualizando ||
          erro ||
          selecao.excluindo ||
          exportacao.exportando ||
          selecao.selecionados.length === 0
        ) {
          return;
        }

        void exportacao.exportar(selecao.selecionados);
      }


  function fecharAviso() {
    router.setParams({
      criadoId: "",
    });
  }

  function visualizarCriado() {
    if (!mostrarAviso) return;

    router.push({
      pathname: "/clipping/[id]",
      params: {
        id: String(criadoId),
        ...(rotaOrigemClipping(
          params.origemTipo,
          params.origemId
        )
          ? {
              origemTipo: params.origemTipo,
              origemId: params.origemId,
              retornoVinculado: "lista",
            }
          : {}),
      },
    });
  }

  function voltar() {
    if (selecao.excluindo || exportacao.exportando) return;
    
    const origem = rotaOrigemClipping(
      params.origemTipo,
      params.origemId
    );

    if (origem) {
      if (params.retornoVinculado === "ano") {
        router.navigate({
          pathname: "/clipping/ano",
          params: {
            ano: String(ano),
            origemTipo: params.origemTipo!,
            origemId: params.origemId!,
          },
        });
      } else {
        router.navigate(origem);
      }
      return;
    }

    if (voltarNaPilha()) return;

    if (Number.isInteger(ano) && ano >= 1000 && ano <= 9999) {
      router.replace({
        pathname: "/clipping/ano",
        params: {
          ano: String(ano),
        },
      });
      return;
    }

    router.dismissTo("/clipping");
  }

  function abrirNovo() {
    if (selecao.excluindo || exportacao.exportando) return;

    router.push({
      pathname: "/clipping/novo",
      params: {
        ano: String(ano),
        clienteId: String(clienteId),
        clienteNome,
        origemTipo: params.origemTipo,
        origemId: params.origemId,
        retornoVinculado: params.retornoVinculado,
      },
    });
  }

  function abrirImportacao() {
    if (selecao.excluindo || exportacao.exportando) return;

    router.push({
      pathname: "/clipping/importar",
      params: {
        clienteId: String(clienteId),
        ano: String(ano),
        clienteNome,
        origemTipo: params.origemTipo,
        origemId: params.origemId,
        retornoVinculado: params.retornoVinculado,
      },
    });
  }

  function abrirDetalhes(clipping: Clipping) {
    if (selecao.excluindo || exportacao.exportando) return;

    const origem = rotaOrigemClipping(params.origemTipo, params.origemId);

    router.push({
      pathname: "/clipping/[id]" as never,
      params: {
        id: String(clipping.id),
        ...(origem
        ? {
            origemTipo: params.origemTipo,
            origemId: params.origemId,
            retornoVinculado: "lista",
          }
        : {}),
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
        onBackPress={voltar}
      />

      {mostrarAviso ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
        >
          <AvisoClippingSalvo
            mensagem={`Novo clipping cadastrado em ${ano}. Clique em ver para abrir os detalhes.`}
            onVisualizar={visualizarCriado}
            onFechar={fecharAviso}
          />
        </View>
      ) : null}

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
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              enabled={!selecao.excluindo}
              onRefresh={() => {
                if (!selecao.excluindo) {
                  void carregarClippings();
                }
              }}
              tintColor={theme.primaria}
              colors={[theme.primaria]}
            />
          }
        >
          <SearchBar
            value={busca}
            onChangeText={setBusca}
            onSearch={() => {
              setBuscaAplicada(busca.trim());
              setPagina(1);
              setExpandido(null);
            }}
            onClear={() => {
              setBusca("");
              setBuscaAplicada("");
              setPagina(1);
              setExpandido(null);
            }}
            onFilterPress={() => setFiltrosAberto(true)}
            filterActive={filtrosAtivos}
            placeholder="Buscar pauta, veículo, programa ou categoria..."
          />

          <View style={[styles.topRow, compacto && styles.topRowCompact]}>
            <ContadorLista style={compacto ? styles.contadorCompacto : undefined}>
              {total} {total === 1 ? "clipping" : "clippings"}
              {" em "}
              {ano}
            </ContadorLista>

            <View style={[styles.topActions, compacto && styles.topActionsCompact]}>
              {!selecao.ativo &&
                temPermissao("CLIPPING", "IMPORTAR") ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Importar clippings de um arquivo CSV"
                    disabled={
                      carregando ||
                      atualizando ||
                      Boolean(erro) ||
                      selecao.excluindo ||
                      exportacao.exportando
                    }
                    onPress={abrirImportacao}
                    style={[
                      styles.exportButton,
                    compacto && styles.exportButtonCompact,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.borda,
                        opacity:
                          carregando ||
                          atualizando ||
                          Boolean(erro) ||
                          selecao.excluindo ||
                          exportacao.exportando
                            ? 0.5
                            : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="download-outline"
                      size={20}
                      color={theme.texto}
                    />
                  </TouchableOpacity>
                ) : null}

              {podeExportar && !selecao.ativo ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Exportar resultados filtrados de todas as páginas"
                  disabled={
                    total === 0 ||
                    carregando ||
                    atualizando ||
                    Boolean(erro) ||
                    selecao.excluindo ||
                    exportacao.exportando
                  }
                  onPress={exportarResultados}
                  style={[
                    styles.exportButton,
                      compacto && styles.exportButtonCompact,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.borda,
                      opacity:
                        total === 0 ||
                        carregando ||
                        atualizando ||
                        Boolean(erro) ||
                        selecao.excluindo ||
                        exportacao.exportando
                          ? 0.5
                          : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={20}
                    color={theme.texto}
                  />
                </TouchableOpacity>
              ) : null}
              
              {!selecao.ativo && temPermissao("CLIPPING", "CRIAR") ? (
                <Button
                  icon="add-outline"
                  title="NOVO"
                  size="small"
                  disabled={selecao.excluindo}
                  onPress={abrirNovo}
                  style={[styles.newButton, compacto && styles.newButtonCompact]}
                />
              ) : null}
            </View>
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

          <LimparFiltrosButton
            visible={filtrosAtivos}
            disabled={
              carregando ||
              atualizando ||
              selecao.excluindo
            }
            onPress={() => {
              setFiltros(novosFiltrosClippings());
              setPagina(1);
              setExpandido(null);
              setFiltrosAberto(false);
            }}
          />
          
          {(temPermissao("CLIPPING", "EXCLUIR") ||
            podeExportar
            ) && clippings.length > 0 ? (
            selecao.ativo ? (
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
                    {selecao.selecionados.length} de{" "}
                    {selecao.limite} selecionado(s)
                  </Text>

                  <Text
                    style={[
                      styles.selectionSubtitle,
                      { color: theme.textoSub },
                    ]}
                  >
                    Escolha os clippings desta página.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selecao.todosSelecionados
                      ? "Limpar seleção"
                      : "Selecionar todos desta página"
                  }
                  onPress={selecao.alternarPagina}
                  disabled={
                    selecao.excluindo ||
                    atualizando ||
                    Boolean(erro)
                  }
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
                    {selecao.todosSelecionados ||
                    selecao.selecionados.length >= selecao.limite
                      ? "LIMPAR"
                      : "TODOS"}
                  </Text>
                </TouchableOpacity>

                {temPermissao("CLIPPING", "EXCLUIR") ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Excluir clippings selecionados"
                    onPress={selecao.solicitarExclusao}
                    disabled={
                      selecao.selecionados.length === 0 ||
                      selecao.excluindo ||
                      atualizando ||
                      Boolean(erro)
                    }
                    style={[
                      styles.selectionIconButton,
                      {
                        backgroundColor: "#EF4444",
                        opacity:
                          selecao.selecionados.length === 0 ||
                          selecao.excluindo ||
                          atualizando ||
                          Boolean(erro)
                            ? 0.5
                            : 1,
                      },
                    ]}
                  >
                    {selecao.excluindo ? (
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
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Sair do modo de seleção"
                  onPress={selecao.alternarModo}
                  disabled={
                    selecao.excluindo ||
                    atualizando ||
                    Boolean(erro)
                  }
                  style={[
                    styles.selectionIconButton,
                    {
                      backgroundColor: theme.backgroundContainer,
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
              <SelecaoListaButton
                title="SELECIONAR CLIPPINGS"
                disabled={
                  selecao.excluindo ||
                  atualizando ||
                  Boolean(erro)
                }
                onPress={() => {
                  setExpandido(null);
                  selecao.alternarModo();
                }}
              />
            )
          ) : null}

          {selecao.ativo && podeExportar ? (
            <Button
              title={`EXPORTAR SELECIONADOS (${selecao.selecionados.length})`}
              variant="outline"
              size="small"
              disabled={
                selecao.selecionados.length === 0 ||
                carregando ||
                atualizando ||
                Boolean(erro) ||
                selecao.excluindo ||
                exportacao.exportando
              }
              onPress={exportarSelecionados}
              style={styles.selectionStartButton}
            />
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
              novo={novos.has(clipping.id)}
              modoSelecao={selecao.ativo}
              selecionado={selecao.selecionados.includes(clipping.id)}
              bloqueado={
                selecao.excluindo ||
                (selecao.ativo && (atualizando || Boolean(erro)))
              }
              onSelecionar={() => selecao.alternarItem(clipping.id)}
            />
          ))}

          {!erro && clippings.length === 0 ? (
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
                {buscaAplicada || filtrosAtivos
                  ? "Nenhum registro corresponde à busca e aos filtros aplicados."
                  : "Cadastre uma publicação para este cliente e ano."}
              </Text>
            </View>
          ) : null}
          {!erro ? (
            <PaginacaoLista
              pagina={pagina}
              limite={50}
              total={total}
              disabled={atualizando || selecao.excluindo}
              onChange={(novaPagina) => {
                setPagina(novaPagina);
                setExpandido(null);
              }}
            /> 
          ) : null}
        </ScrollView>
      )}
      {filtrosAberto ? (
        <ClippingFilterModal
          clienteNome={clienteNome}
          ano={ano}
          filtros={filtros}
          onClose={() => setFiltrosAberto(false)}
          onApply={(novosFiltros) => {
            setFiltros(novosFiltros);
            setPagina(1);
            setExpandido(null);
            setFiltrosAberto(false);
          }}
        />
      ) : null}

      <FeedbackAlert {...selecao.alertaProps} />
      <FeedbackAlert {...exportacao.alertaProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRowCompact: { gap: 6 },
  topActionsCompact: { gap: 4 },
  contadorCompacto: { paddingHorizontal: 8 },
  exportButtonCompact: { width: 34, height: 34, borderRadius: 10 },
  newButtonCompact: { paddingHorizontal: 8 },
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
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },

  topActions: {
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },

  count: {
    flex: 1,
    fontSize: 12,
  },

  newButton: {
    width: "auto",
    borderRadius: 12,
  },

  exportButton: {
    width: 42,
    height: 40,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: 10,
    marginBottom: 12,
  },

  selectionInfo: {
    flex: 1,
    minWidth: 100,
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
