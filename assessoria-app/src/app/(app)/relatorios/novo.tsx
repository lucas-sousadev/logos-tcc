import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import ClippingDataInput from "@/components/clipping/ClippingDataInput";
import ClippingContexto from "@/components/clipping/ClippingContexto";
import { useTheme } from "@/contexts/ThemeContext";
import {
  criarRelatorio,
  listarMateriasRelatorio,
  listarClientesRelatorio,
  type MateriaRelatorio,
  type PaginacaoRelatorio,
} from "@/services/api/relatorio";
import {
  dataBRParaISO,
  dataISOParaBR,
} from "@/utils/clippingFormatacao";

type TipoLista =
  | "periodo"
  | "sem_data"
  | "desmarcados";

type ErrosCampos = {
  cliente?: string;
  titulo?: string;
  inicio?: string;
  fim?: string;
};

const LIMITE_PAGINA = 20;

export default function NovoRelatorio() {
  const router = useRouter();
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const params = useLocalSearchParams<{
    clienteId?: string;
    clienteNome?: string;
  }>();

  const clienteInicialId = Number(params.clienteId);
  const anoCalendario = new Date().getFullYear();

  const [cliente, setCliente] = useState<{
    id: number;
    nome: string;
  } | null>(
    Number.isSafeInteger(clienteInicialId) && clienteInicialId > 0
      ? {
          id: clienteInicialId,
          nome:
            params.clienteNome ??
            `Cliente #${clienteInicialId}`,
        }
      : null
  );

  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [inclusaoAutomatica, setInclusaoAutomatica] =
    useState(true);
  const [errosCampos, setErrosCampos] =
    useState<ErrosCampos>({});

  const [periodo, setPeriodo] = useState<{
    inicio: string;
    fim: string;
  } | null>(null);

  const [tipo, setTipo] = useState<TipoLista>("periodo");
  const [page, setPage] = useState(1);
  const [buscaMateria, setBuscaMateria] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [materias, setMaterias] = useState<
    MateriaRelatorio[]
  >([]);
  const [resumo, setResumo] = useState({
    no_periodo: 0,
    sem_data: 0,
  });
  const [pagination, setPagination] =
    useState<PaginacaoRelatorio | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [excluidos, setExcluidos] = useState<
    Map<number, MateriaRelatorio>
  >(() => new Map());

  const [semDataIncluidos, setSemDataIncluidos] =
    useState<Set<number>>(() => new Set());

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setBuscaAplicada(buscaMateria.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [buscaMateria]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [periodo]);

  useEffect(() => {
    if (!periodo || !cliente) return;

    if (tipo === "desmarcados") {
      setCarregando(false);
      setErroConsulta("");
      return;
    }

    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErroConsulta("");
      setMaterias([]);
      setPagination(null);

      try {
        const resposta = await listarMateriasRelatorio({
          cliente_id: cliente!.id,
          periodo_inicio: periodo!.inicio,
          periodo_fim: periodo!.fim,
          tipo: tipo === "sem_data" ? "sem_data" : "periodo",
          page,
          limit: LIMITE_PAGINA,
          busca: buscaAplicada,
        });

        if (!ativo) return;

        setMaterias(resposta.materias);
        setResumo(resposta.resumo);
        setPagination(resposta.pagination);
      } catch (e) {
        if (!ativo) return;

        setErroConsulta(
          e instanceof Error
            ? e.message
            : "Não foi possível consultar as matérias."
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [
    periodo,
    cliente,
    tipo,
    page,
    buscaAplicada,
    tentativa,
  ]);
    
  const materiasRetiradas = useMemo(() => {
    const termo = buscaAplicada
      .trim()
      .toLocaleLowerCase("pt-BR");

    return [...excluidos.values()]
      .filter((materia) => {
        if (!termo) return true;

        return [
          materia.pauta,
          materia.veiculo_nome,
        ].some((valor) =>
          (valor ?? "")
            .toLocaleLowerCase("pt-BR")
            .includes(termo)
        );
      })
      .sort(
        (a, b) =>
          (a.data_publicacao ?? "").localeCompare(
            b.data_publicacao ?? ""
          ) || a.id - b.id
      );
  }, [excluidos, buscaAplicada]);

  const materiasVisiveis =
    tipo === "desmarcados"
      ? materiasRetiradas.slice(
          (page - 1) * LIMITE_PAGINA,
          page * LIMITE_PAGINA
        )
      : materias;

  const paginacaoVisivel: PaginacaoRelatorio | null =
    tipo === "desmarcados"
      ? {
          page,
          limit: LIMITE_PAGINA,
          total: materiasRetiradas.length,
          has_next:
            page * LIMITE_PAGINA <
            materiasRetiradas.length,
        }
      : pagination;

  useEffect(() => {
    if (tipo !== "desmarcados") return;

    const ultimaPagina = Math.max(
      1,
      Math.ceil(
        materiasRetiradas.length / LIMITE_PAGINA
      )
    );

    if (page > ultimaPagina) {
      setPage(ultimaPagina);
    }
  }, [tipo, page, materiasRetiradas.length]);

  const totalSelecionado = useMemo(
    () =>
      Math.max(
        0,
        resumo.no_periodo - excluidos.size
      ) + semDataIncluidos.size,
    [resumo.no_periodo, excluidos, semDataIncluidos]
  );

  function verMaterias() {
    const inicio = dataBRParaISO(dataInicio);
    const fim = dataBRParaISO(dataFim);
    const novosErros: ErrosCampos = {};

    if (!cliente) {
      novosErros.cliente = "Selecione um cliente.";
    }

    if (!titulo.trim()) {
      novosErros.titulo =
        "Informe o título do relatório.";
    }

    if (!dataInicio.trim()) {
      novosErros.inicio =
        "Informe o início do período.";
    } else if (!inicio) {
      novosErros.inicio =
        "Informe uma data válida em DD/MM/AAAA.";
    }

    if (!dataFim.trim()) {
      novosErros.fim =
        "Informe o fim do período.";
    } else if (!fim) {
      novosErros.fim =
        "Informe uma data válida em DD/MM/AAAA.";
    }

    if (inicio && fim && inicio > fim) {
      novosErros.fim =
        "O fim não pode ser anterior ao início.";
    }

    setErrosCampos(novosErros);

    if (
      Object.keys(novosErros).length > 0 ||
      !inicio ||
      !fim
    ) {
      return;
    }

    setTipo("periodo");
    setPage(1);
    setBuscaMateria("");
    setBuscaAplicada("");
    setResumo({
      no_periodo: 0,
      sem_data: 0,
    });
    setExcluidos(new Map());
    setSemDataIncluidos(new Set());
    setErroConsulta("");
    setErroSalvar("");
    setPeriodo({ inicio, fim });
  }

  function alternarMateria(materia: MateriaRelatorio) {
    if (tipo === "sem_data") {
      setSemDataIncluidos((atual) => {
        const proximo = new Set(atual);

        if (proximo.has(materia.id)) {
          proximo.delete(materia.id);
        } else {
          proximo.add(materia.id);
        }

        return proximo;
      });

      return;
    }

    setExcluidos((atual) => {
      const proximo = new Map(atual);

      if (proximo.has(materia.id)) {
        proximo.delete(materia.id);
      } else {
        proximo.set(materia.id, materia);
      }

      return proximo;
    });
  }

  async function salvar() {
    if (
      !cliente ||
      !periodo ||
      salvando ||
      carregando ||
      erroConsulta
    ) {
      return;
    }

    setSalvando(true);
    setErroSalvar("");

    try {
      const resposta = await criarRelatorio({
        cliente_id: cliente.id,
        titulo: titulo.trim(),
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        inclusao_automatica: inclusaoAutomatica,
        ids_excluidos: [...excluidos.keys()],
        ids_sem_data_incluidos: [
          ...semDataIncluidos,
        ],
      });

      router.replace({
        pathname: "/relatorios/[id]",
        params: {
          id: String(resposta.relatorio.id),
        },
      });
    } catch (e) {
      setErroSalvar(
        e instanceof Error
          ? e.message
          : "Não foi possível criar o relatório."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title={
          periodo
            ? "Escolher matérias"
            : "Novo relatório"
        }
        showBackButton
        onBackPress={() => {
          if (periodo) {
            setPeriodo(null);
            setErroConsulta("");
            setErroSalvar("");
          } else {
            router.back();
          }
        }}
      />

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          periodo
            ? styles.contentSelection
            : styles.contentForm,
        ]}
      >
        {!periodo ? (
          <>
            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              Dados do relatório
            </Text>

            <ClippingContexto
              apenasCliente
              buscarClientes={listarClientesRelatorio}
              clienteId={cliente?.id ?? null}
              clienteNome={cliente?.nome ?? ""}
              ano={anoCalendario}
              anoPelaData={false}
              erroCliente={errosCampos.cliente}
              onCliente={(selecionado) => {
                setCliente({
                  id: selecionado.id,
                  nome: selecionado.nome,
                });
                setErrosCampos((atual) => ({
                  ...atual,
                  cliente: undefined,
                }));
              }}
            />

            <Input
              label="TÍTULO"
              value={titulo}
              onChangeText={(valor) => {
                setTitulo(valor);
                setErrosCampos((atual) => ({
                  ...atual,
                  titulo: undefined,
                }));
              }}
              error={errosCampos.titulo}
              placeholder="Ex.: Relatório de março"
              maxLength={200}
              clearable
            />

            <ClippingDataInput
              label="INÍCIO DO PERÍODO"
              value={dataInicio}
              anoReferencia={anoCalendario}
              onChangeText={(valor) => {
                setDataInicio(valor);
                setErrosCampos((atual) => ({
                  ...atual,
                  inicio: undefined,
                  fim: undefined,
                }));
              }}
              error={errosCampos.inicio}
            />

            <ClippingDataInput
              label="FIM DO PERÍODO"
              value={dataFim}
              anoReferencia={anoCalendario}
              onChangeText={(valor) => {
                setDataFim(valor);
                setErrosCampos((atual) => ({
                  ...atual,
                  fim: undefined,
                }));
              }}
              error={errosCampos.fim}
            />

            <View
              style={[
                styles.automaticCard,
                {
                  borderColor: theme.borda,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <View style={styles.automaticText}>
                <Text weight="SemiBold">
                  Incluir novas matérias automaticamente
                </Text>

                <Text
                  style={{ color: theme.textoSub }}
                >
                  Novos clippings deste cliente dentro
                  do período entrarão para revisão.
                </Text>
              </View>

              <Switch
                value={inclusaoAutomatica}
                onValueChange={
                  setInclusaoAutomatica
                }
                trackColor={{
                  true: theme.borda,
                  false: theme.textoSub,
                }}
              />
            </View>

            <Button
              title="ESCOLHER MATÉRIAS"
              onPress={verMaterias}
            />
          </>
        ) : (
          <>
            <View
              style={[
                styles.reportSummary,
                { borderColor: theme.borda,
                  backgroundColor: theme.background
                 },
              ]}
            >
              <Text
                weight="Bold"
                style={[styles.reportTitle, {color: theme.texto}]}
              >
                {titulo.trim()}
              </Text>

              <Text
                style={{ color: theme.textoTerciaria }}
              >
                {cliente?.nome}
              </Text>
                
              <Text
                style={{ color: theme.texto, fontSize: 13}}
              >
                {dataISOParaBR(periodo.inicio)} a{" "}
                {dataISOParaBR(periodo.fim)}
              </Text>
            </View>

            <View
              style={[
                styles.selectionHelp,
                {
                  borderColor: theme.borda,
                  backgroundColor:
                    theme.background,
                },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={19}
                color={theme.textoSecundaria}
              />

              <Text
                style={[
                  styles.selectionHelpText,
                  { color: theme.textoSub },
                ]}
              >
                As matérias do período já estão
                selecionadas. As sem data só entram se você as
                selecionar.
              </Text>
            </View>

            <View style={styles.tabs}>
              {(
                [
                  {
                    chave: "periodo",
                    texto: "NO PERÍODO",
                    quantidade: resumo.no_periodo,
                  },
                  {
                    chave: "sem_data",
                    texto: "SEM DATA",
                    quantidade: resumo.sem_data,
                  },
                  {
                    chave: "desmarcados",
                    texto: "DESMARCADOS",
                    quantidade: excluidos.size,
                  },
                ] as const
              ).map((aba) => {
                const ativa = tipo === aba.chave;

                return (
                  <Pressable
                    key={aba.chave}
                    accessibilityRole="tab"
                    accessibilityLabel={`${aba.texto}: ${aba.quantidade} matérias`}
                    accessibilityState={{ selected: ativa }}
                    onPress={() => {
                      if (ativa) return;
                      setTipo(aba.chave);
                      setPage(1);
                    }}
                    style={[
                      styles.tab,
                      {
                        borderColor: theme.borda,
                        backgroundColor: ativa
                          ? theme.backgroundContainer
                          : theme.background,
                      },
                    ]}
                  >
                    <Text
                      weight="Bold"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[
                        styles.tabText,
                        {
                          color: ativa
                            ? theme.textoContainer
                            : theme.texto,
                        },
                      ]}
                    >
                      {aba.texto}
                    </Text>

                    <Text
                      weight="Bold"
                      style={{
                        color: ativa
                          ? theme.textoContainer
                          : theme.textoTerciaria,
                        fontSize: 12,
                      }}
                    >
                      {aba.quantidade}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Input
              label="BUSCAR MATÉRIAS"
              value={buscaMateria}
              onChangeText={setBuscaMateria}
              placeholder="Pauta ou veículo"
              clearable
              containerStyle={
                styles.searchContainer
              }
            />

            {carregando ? (
              <ActivityIndicator
                color={theme.textoTerciaria}
                style={styles.loading}
              />
            ) : null}

            {erroConsulta ? (
              <View
                style={[
                  styles.messageCard,
                  { borderColor: theme.erro },
                ]}
              >
                <Text
                  style={{ color: theme.erro }}
                >
                  {erroConsulta}
                </Text>

                <Button
                  title="TENTAR NOVAMENTE"
                  variant="outline"
                  size="small"
                  onPress={() =>
                    setTentativa(
                      (atual) => atual + 1
                    )
                  }
                />
              </View>
            ) : null}

            {!carregando &&
            !erroConsulta &&
            materiasVisiveis.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { borderColor: theme.borda },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={26}
                  color={theme.textoSub}
                />

                <Text
                  weight="SemiBold"
                  style={{
                    textAlign: "center",
                  }}
                >
                  Nenhuma matéria encontrada
                </Text>

                <Text
                  style={{
                    color: theme.textoSub,
                    textAlign: "center",
                  }}
                >
                  {buscaAplicada
                    ? "Tente outra pauta ou veículo."
                    : tipo === "desmarcados"
                      ? "Nenhuma matéria foi retirada do relatório."
                      : tipo === "sem_data"
                        ? "Este cliente não tem clippings sem data."
                        : "Confira o cliente e as datas do período."}
                </Text>

                {!buscaAplicada &&
                tipo === "periodo" ? (
                  <Button
                    title="ALTERAR DADOS"
                    variant="outline"
                    size="small"
                    onPress={() =>
                      setPeriodo(null)
                    }
                  />
                ) : null}
              </View>
            ) : null}

            {!carregando && !erroConsulta
              ? materiasVisiveis.map((materia) => {
                  const selecionada =
                    tipo === "sem_data"
                      ? semDataIncluidos.has(materia.id)
                      : !excluidos.has(materia.id);

                  return (
                    <Pressable
                      key={materia.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: selecionada,
                      }}
                      onPress={() =>
                        alternarMateria(materia)
                      }
                      style={[
                        styles.materiaCard,
                        {
                          borderColor: selecionada ? theme.borda : theme.textoSub,
                          borderWidth: selecionada ? 2 : 1.5,
                          backgroundColor: selecionada
                            ? theme.backgroundSecundario
                            : theme.background,
                        }
                      ]}
                    >
                      <View
                        style={[
                          styles.materiaTop,
                          { paddingRight: selecionada ? 30 : 82 },
                        ]}
                      >
                        <View
                          style={
                            styles.materiaInfo
                          }
                        >
                          <Text
                            style={
                              styles.materiaData
                            }
                          >
                            {materia.data_publicacao
                              ? dataISOParaBR(
                                  materia.data_publicacao
                                )
                              : "SEM DATA"}
                          </Text>

                          <Text
                            weight="SemiBold"
                            numberOfLines={1}
                            style={{ color: theme.textoTerciaria }}
                          >
                            {materia.veiculo_nome || "Sem veículo"}
                          </Text>
                        </View>

                        <View style={styles.materiaAcao}>
                          <Ionicons
                            name={
                              selecionada
                                ? "checkmark-circle"
                                : "add-circle-outline"
                            }
                            size={25}
                            color={theme.textoTerciaria}
                          />

                          {!selecionada ? (
                            <Text
                              weight="SemiBold"
                              style={{
                                color: theme.textoTerciaria,
                                fontSize: 11,
                              }}
                            >
                              INCLUIR
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <Text
                        weight="Bold"
                        style={
                          styles.materiaPauta
                        }
                      >
                        {materia.pauta ||
                          "Sem pauta"}
                      </Text>

                      {materia.programa_secao ||
                      materia.categorias
                        .length > 0 ? (
                        <Text
                          numberOfLines={2}
                          style={{
                            color:
                              theme.textoSub,
                          }}
                        >
                          {[
                            materia.programa_secao,
                            materia.categorias.join(
                              ", "
                            ),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      ) : null}

                      {selecionada &&
                      materia.imagem_anexo_id ===
                        null ? (
                        <View
                          style={
                            styles.imageNotice
                          }
                        >
                          <Ionicons
                            name="image-outline"
                            size={15}
                            color={
                              theme.aviso
                            }
                          />
                          <Text
                            style={{
                              color:
                                theme.aviso,
                              fontSize: 12,
                            }}
                          >
                            Sem imagem para o
                            slide
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              : null}

            {!carregando &&
          !erroConsulta &&
          paginacaoVisivel &&
          paginacaoVisivel.total > 0 ? (
            <View style={styles.pagination}>
              <Text
                style={{
                  color: theme.textoSub,
                  textAlign: "center",
                }}
              >
                Página {page} de{" "}
                {Math.ceil(
                  paginacaoVisivel.total / LIMITE_PAGINA
                )}{" "}
                · {paginacaoVisivel.total}{" "}
                {paginacaoVisivel.total === 1
                  ? "matéria"
                  : "matérias"}{" "}
                nesta aba
              </Text>

              <View style={styles.paginationButtons}>
                <Button
                  title="ANTERIOR"
                  variant="outline"
                  size="small"
                  disabled={page === 1}
                  onPress={() =>
                    setPage((atual) => atual - 1)
                  }
                  style={styles.paginationButton}
                />

                <Button
                  title="PRÓXIMA"
                  variant="outline"
                  size="small"
                  disabled={!paginacaoVisivel.has_next}
                  onPress={() =>
                    setPage((atual) => atual + 1)
                  }
                  style={styles.paginationButton}
                />
              </View>
            </View>
          ) : null}
          </>
        )}
      </ScrollView>

      {periodo ? (
        <View
          style={[
            styles.footer,
            {
              borderTopColor:
                theme.borda,
              backgroundColor:
                theme.background,
            },
          ]}
        >
          <Text
            weight="SemiBold"
            style={{
              textAlign: "center",
            }}
          >
            {totalSelecionado}{" "}
            {totalSelecionado === 1
              ? "matéria selecionada"
              : "matérias selecionadas"}
          </Text>

          {erroSalvar ? (
            <Text
              style={{
                color: theme.erro,
                textAlign: "center",
              }}
            >
              {erroSalvar}
            </Text>
          ) : null}

          <Button
            title="CRIAR RELATÓRIO"
            loading={salvando}
            disabled={
              carregando ||
              Boolean(erroConsulta)
            }
            onPress={salvar}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 24,
  },
  contentForm: {
    gap: 0,
  },
  contentSelection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  automaticCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 14,
  },
  automaticText: {
    flex: 1,
    gap: 4,
  },
  reportSummary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  reportTitle: {
    fontSize: 16,
  },
  selectionHelp: {
    flexDirection: "row",
    alignItems: "center",
  
    gap: 8,
    padding: 5,
  },
  selectionHelpText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 10,
    textAlign: "center",
  },
  searchContainer: {
    marginBottom: 0,
  },
  loading: {
    marginVertical: 25,
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
  },
  materiaCard: {
    borderRadius: 13,
    padding: 12,
    gap: 4.5,
  },
  materiaAcao: {
    position: "absolute",
    right: 0,
    top: -3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  materiaTop: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 82,
  },
  materiaInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  materiaData: {
    fontSize: 13,
  },
  materiaPauta: {
    fontSize: 14,
  },
  imageNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pagination: {
    gap: 10,
    marginTop: 4,
  },
  paginationButtons: {
    flexDirection: "row",
    gap: 8,
  },
  paginationButton: {
    flex: 1,
    width: "auto",
    paddingHorizontal: 8,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
});