import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import ClippingDataInput from "@/components/clipping/ClippingDataInput";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  atualizarPeriodoRelatorio,
  buscarRelatorio,
  listarMateriasCandidatasRelatorio,
  type MateriaRelatorio,
  type PaginacaoRelatorio,
  type RelatorioDetalhado,
  type ResumoMateriasEdicao,
} from "@/services/api/relatorio";
import {
  dataBRParaISO,
  dataISOParaBR,
} from "@/utils/clippingFormatacao";

const LIMITE = 20;

type Periodo = {
  inicio: string;
  fim: string;
};

export default function EditarPeriodoRelatorio() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const [relatorio, setRelatorio] =
    useState<RelatorioDetalhado | null>(null);
  const [carregandoRelatorio, setCarregandoRelatorio] =
    useState(true);
  const [erroRelatorio, setErroRelatorio] = useState("");
  const [tentativaRelatorio, setTentativaRelatorio] =
    useState(0);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [erroInicio, setErroInicio] = useState("");
  const [erroFim, setErroFim] = useState("");
  const [periodo, setPeriodo] = useState<Periodo | null>(null);

  const [aba, setAba] = useState<"disponiveis" | "marcadas">(
    "disponiveis"
  );
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [materias, setMaterias] = useState<MateriaRelatorio[]>([]);
  const [marcadas, setMarcadas] = useState(
    new Map<number, MateriaRelatorio>()
  ); 
  const [resumo, setResumo] =useState<ResumoMateriasEdicao | null>(null);
    
  const [todasMarcadas, setTodasMarcadas] = useState(false);
  const [desmarcadas, setDesmarcadas] = useState<
    Map<number, MateriaRelatorio>
  >(() => new Map());
  const totalMarcadas = todasMarcadas
    ? Math.max(0, (resumo?.novas ?? 0) - desmarcadas.size)
    : marcadas.size;
  const [paginacao, setPaginacao] =
    useState<PaginacaoRelatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tentativaConsulta, setTentativaConsulta] = useState(0);
  const assinaturaRevisada = useRef<string | null>(null);

  useEffect(() => {
    if (!Number.isSafeInteger(id) || id < 1) {
      setErroRelatorio("Relatório inválido.");
      setCarregandoRelatorio(false);
      return;
    }

    let ativo = true;
    setCarregandoRelatorio(true);
    setErroRelatorio("");

    buscarRelatorio(id, 1)
      .then(({ relatorio: atual }) => {
        if (!ativo) return;

        setRelatorio(atual);
        setDataInicio(dataISOParaBR(atual.periodo_inicio));
        setDataFim(dataISOParaBR(atual.periodo_fim));
      })
      .catch((e) => {
        if (!ativo) return;
        setErroRelatorio(
          e instanceof Error
            ? e.message
            : "Não foi possível abrir o relatório."
        );
      })
      .finally(() => {
        if (ativo) setCarregandoRelatorio(false);
      });

    return () => {
      ativo = false;
    };
  }, [id, tentativaRelatorio]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagina(1);
      setBuscaAplicada(busca.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    if (!periodo) return;

    if (aba === "marcadas") {
      setCarregando(false);
      return;
    }

    let ativo = true;
    setCarregando(true);
    setErroConsulta("");

    listarMateriasCandidatasRelatorio(id, {
      periodo_inicio: periodo.inicio,
      periodo_fim: periodo.fim,
      page: pagina,
      limit: LIMITE,
      busca: buscaAplicada,
    })
      .then((resposta) => {
        if (!ativo) return;

        const novaAssinatura = resposta.resumo.assinatura;

        if (
            assinaturaRevisada.current !== null &&
            assinaturaRevisada.current !== novaAssinatura
        ) {
            assinaturaRevisada.current = novaAssinatura;
            setMarcadas(new Map());
            setDesmarcadas(new Map());
            setTodasMarcadas(false);
            setResumo(null);
            setMaterias([]);
            setPaginacao(null);
            setErroConsulta(
            "A lista de matérias mudou. Confira as disponíveis e toque em TENTAR NOVAMENTE."
            );
            return;
        }

        assinaturaRevisada.current = novaAssinatura;
        setMaterias(resposta.materias);
        setResumo(resposta.resumo);
        setPaginacao(resposta.pagination);
      })
      .catch((e) => {
        if (!ativo) return;

        setErroConsulta(
          e instanceof Error
            ? e.message
            : "Não foi possível consultar as matérias."
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [
    id,
    periodo,
    aba,
    pagina,
    buscaAplicada,
    tentativaConsulta,
  ]);

  const materiasMarcadas = useMemo(() => {
    const termo = buscaAplicada.toLocaleLowerCase("pt-BR");
    const fonte = todasMarcadas ? desmarcadas : marcadas;

    return [...fonte.values()]
        .filter(
        (materia) =>
            !termo ||
            [materia.pauta, materia.veiculo_nome].some((valor) =>
            (valor ?? "")
                .toLocaleLowerCase("pt-BR")
                .includes(termo)
            )
        )
        .sort(
        (a, b) =>
            (a.data_publicacao ?? "").localeCompare(
            b.data_publicacao ?? ""
            ) || a.id - b.id
        );
    }, [
    todasMarcadas,
    desmarcadas,
    marcadas,
    buscaAplicada,
    ]);

  const materiasVisiveis =
    aba === "marcadas"
      ? materiasMarcadas.slice(
          (pagina - 1) * LIMITE,
          pagina * LIMITE
        )
      : materias;

  const paginacaoVisivel =
    aba === "marcadas"
      ? {
          page: pagina,
          limit: LIMITE,
          total: materiasMarcadas.length,
          has_next: pagina * LIMITE < materiasMarcadas.length,
        }
      : paginacao;

  useEffect(() => {
    if (aba !== "marcadas") return;

    const ultima = Math.max(
      1,
      Math.ceil(materiasMarcadas.length / LIMITE)
    );

    if (pagina > ultima) setPagina(ultima);
  }, [aba, pagina, materiasMarcadas.length]);

  function revisar() {
    const inicio = dataBRParaISO(dataInicio);
    const fim = dataBRParaISO(dataFim);

    assinaturaRevisada.current = null;

    setErroInicio(
      inicio ? "" : "Informe uma data inicial válida."
    );
    setErroFim(
      fim ? "" : "Informe uma data final válida."
    );

    if (!inicio || !fim) return;

    if (inicio > fim) {
      setErroFim(
        "O fim não pode ser anterior ao início."
      );
      return;
    }

    setMarcadas(new Map());
    setDesmarcadas(new Map());
    setTodasMarcadas(false);
    setResumo(null);
    setPaginacao(null);
    setMaterias([]);
    setBusca("");
    setBuscaAplicada("");
    setPagina(1);
    setAba("disponiveis");
    setErroSalvar("");
    setPeriodo({ inicio, fim });
  }

  function alterarDatas() {
    setPeriodo(null);
    setResumo(null);
    setMarcadas(new Map());
    setDesmarcadas(new Map());
    setTodasMarcadas(false);
    setErroSalvar("");
    assinaturaRevisada.current = null;
  }

  function alternar(materia: MateriaRelatorio) {
    if (todasMarcadas) {
        setDesmarcadas((atuais) => {
        const proximo = new Map(atuais);

        if (proximo.has(materia.id)) {
            proximo.delete(materia.id);
        } else {
            proximo.set(materia.id, materia);
        }

        return proximo;
        });

        return;
    }

    setMarcadas((atuais) => {
        const proximo = new Map(atuais);

        if (proximo.has(materia.id)) {
        proximo.delete(materia.id);
        } else {
        proximo.set(materia.id, materia);
        }

        return proximo;
    });
    }

  async function salvar() {
    if (!periodo || !resumo || salvando) return;

    setSalvando(true);
    setErroSalvar("");

    try {
      await atualizarPeriodoRelatorio(id, {
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        ids_incluir: todasMarcadas ? [] : [...marcadas.keys()],
        ids_excluir: todasMarcadas
        ? [...desmarcadas.keys()]
        : [],
        incluir_todas: todasMarcadas,
        assinatura: resumo.assinatura, 
      });

      router.back();
    } catch (e) {
      const mensagem =
        e instanceof Error
          ? e.message
          : "Não foi possível salvar o período.";

      setErroSalvar(mensagem);

      if (mensagem.includes("lista de matérias mudou")) {
        assinaturaRevisada.current = null;
        setMarcadas(new Map());
        setDesmarcadas(new Map());
        setTodasMarcadas(false);
        setResumo(null);
        setMaterias([]);
        setPaginacao(null);
        setPagina(1);
        setAba("disponiveis");
        setTentativaConsulta((atual) => atual + 1);
      }
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
      <Header title="Período do relatório" showBackButton />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.conteudo}
      >
        {carregandoRelatorio ? (
          <ActivityIndicator color={theme.textoTerciaria} />
        ) : null}

        {erroRelatorio ? (
          <View style={styles.bloco}>
            <Text style={{ color: theme.erro }}>
              {erroRelatorio}
            </Text>
            <Button
              title="TENTAR NOVAMENTE"
              variant="outline"
              size="small"
              onPress={() =>
                setTentativaRelatorio((atual) => atual + 1)
              }
            />
          </View>
        ) : null}

        {relatorio ? (
          <>
            {!periodo ? (
            <View
                style={[
                styles.cartao,
                {
                    borderColor: theme.borda,
                    backgroundColor: theme.backgroundSecundario,
                },
                ]}
            >
                <Text weight="Bold">{relatorio.titulo}</Text>
                <Text style={{ color: theme.textoSub }}>
                {relatorio.cliente_nome}
                </Text>
                <Text style={{ color: theme.textoSub }}>
                Período atual: {dataISOParaBR(relatorio.periodo_inicio)} a{" "}
                {dataISOParaBR(relatorio.periodo_fim)}
                </Text>
            </View>
            ) : null}

            {!periodo ? (
              <View style={styles.bloco}>
                <Text weight="Bold" style={styles.titulo}>
                  Novo período
                </Text>

                <ClippingDataInput
                  label="INÍCIO DO PERÍODO"
                  value={dataInicio}
                  anoReferencia={new Date().getFullYear()}
                  error={erroInicio}
                  onChangeText={(valor) => {
                    setDataInicio(valor);
                    setErroInicio("");
                  }}
                />

                <ClippingDataInput
                  label="FIM DO PERÍODO"
                  value={dataFim}
                  anoReferencia={new Date().getFullYear()}
                  error={erroFim}
                  onChangeText={(valor) => {
                    setDataFim(valor);
                    setErroFim("");
                  }}
                />

                <Text style={{ color: theme.textoSub }}>
                  Os slides atuais permanecem, mesmo se estiverem
                  fora das novas datas. Você escolherá quais outras
                  matérias deseja incluir.
                </Text>

                <Button
                  title="REVISAR MATÉRIAS"
                  onPress={revisar}
                />
              </View>
            ) : (
              <>
                <View
                    style={[
                        styles.cartao,
                        {
                        borderColor: theme.borda,
                        backgroundColor: theme.backgroundSecundario,
                        },
                    ]}
                    >
                    <View style={styles.topoResumo}>
                        <View style={{ flex: 1 }}>
                        <Text weight="Bold" numberOfLines={1}>
                            {relatorio.titulo}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={{ color: theme.textoSub, fontSize: 12 }}
                        >
                            {relatorio.cliente_nome}
                        </Text>
                        </View>

                        <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Alterar datas do período"
                        onPress={alterarDatas}
                        style={[styles.atalhoDatas, { borderColor: theme.borda }]}
                        >
                        <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={theme.textoTerciaria}
                        />
                        <Text
                            weight="SemiBold"
                            style={{ color: theme.textoTerciaria, fontSize: 12 }}
                        >
                            ALTERAR
                        </Text>
                        </Pressable>
                    </View>

                    <View style={styles.linhaData}>
                        <Text style={[styles.rotuloData, { color: theme.textoSub }]}>
                        ATUAL
                        </Text>
                        <Text style={styles.valorData}>
                        {dataISOParaBR(relatorio.periodo_inicio)} a{" "}
                        {dataISOParaBR(relatorio.periodo_fim)}
                        </Text>
                    </View>

                    <View style={styles.linhaData}>
                        <Text
                        weight="SemiBold"
                        style={[
                            styles.rotuloData,
                            { color: theme.textoTerciaria },
                        ]}
                        >
                        NOVO
                        </Text>
                        <Text weight="SemiBold" style={styles.valorData}>
                        {dataISOParaBR(periodo.inicio)} a{" "}
                        {dataISOParaBR(periodo.fim)}
                        </Text>
                    </View>

                    {resumo ? (
                        <Text style={{ color: theme.textoSub, fontSize: 12 }}>
                        {resumo.ja_incluidas} já no relatório · {resumo.novas} para
                        escolher · {resumo.fora_do_periodo} fora das novas datas
                        </Text>
                    ) : null}
                    </View>
            
                <Input
                  label="BUSCAR MATÉRIAS"
                  placeholder="Pauta ou veículo"
                  value={busca}
                  onChangeText={setBusca}
                  clearable
                  containerStyle={styles.busca}
                />
                <View style={styles.abas}>
                  {(
                    [
                      ["disponiveis", "DISPONÍVEIS", resumo?.novas ?? 0],
                      [
                        "marcadas",
                        todasMarcadas ? "DESMARCADAS" : "MARCADAS",
                        todasMarcadas ? desmarcadas.size : marcadas.size,
                      ],
                    ] as const
                  ).map(([chave, titulo, quantidade]) => {
                    const ativa = aba === chave;

                    return (
                      <Pressable
                        key={chave}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: ativa }}
                        onPress={() => {
                          setAba(chave);
                          setPagina(1);
                        }}
                        style={[
                          styles.aba,
                          {
                            borderColor: ativa
                            ? theme.backgroundContainer
                            : theme.borda,
                            backgroundColor: ativa
                              ? theme.backgroundContainer
                              : theme.background,
                          },
                        ]}
                      >
                        <Text
                          weight="Bold"
                          style={{
                            color: ativa
                              ? theme.textoContainer
                              : theme.texto,
                          }}
                        >
                          {titulo} · {quantidade}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                        todasMarcadas
                        ? "Desmarcar todas as matérias do período"
                        : "Selecionar todas as matérias do período"
                    }
                    accessibilityState={{
                        disabled:
                        !resumo ||
                        resumo.novas === 0 ||
                        carregando ||
                        Boolean(erroConsulta),
                        selected: todasMarcadas,
                    }}
                    disabled={
                        !resumo ||
                        resumo.novas === 0 ||
                        carregando ||
                        Boolean(erroConsulta)
                    }
                    onPress={() => {
                        const selecionar = !todasMarcadas;

                        setMarcadas(new Map());
                        setDesmarcadas(new Map());
                        setTodasMarcadas(selecionar);
                        setAba("disponiveis");
                        setPagina(1);
                        setErroSalvar("");
                    }}
                    style={[
                        styles.selecionarTodas,
                        {
                        borderColor: todasMarcadas
                            ? theme.backgroundContainer
                            : theme.borda,
                        backgroundColor: todasMarcadas
                            ? theme.backgroundContainer
                            : theme.background,
                        opacity:
                            !resumo ||
                            resumo.novas === 0 ||
                            carregando ||
                            Boolean(erroConsulta)
                            ? 0.5
                            : 1,
                        },
                    ]}
                    >
                    <Ionicons
                        name={
                        todasMarcadas
                            ? "checkmark-circle"
                            : "checkmark-circle-outline"
                        }
                        size={19}
                        color={todasMarcadas
                            ? theme.textoContainer
                            : theme.texto}
                    />

                    <Text
                        weight="SemiBold"
                        style={{
                        color: todasMarcadas
                            ? theme.textoContainer
                            : theme.texto,
                        fontSize: 12,
                        }}
                    >
                        {todasMarcadas
                        ? "DESMARCAR TODAS"
                        : "SELECIONAR TODAS"}
                    </Text>
                    </Pressable>

                {carregando && aba === "disponiveis" ? (
                  <ActivityIndicator
                    color={theme.textoTerciaria}
                  />
                ) : null}

                {erroConsulta && aba === "disponiveis" ? (
                  <View style={styles.bloco}>
                    <Text style={{ color: theme.erro }}>
                      {erroConsulta}
                    </Text>
                    <Button
                      title="TENTAR NOVAMENTE"
                      variant="outline"
                      size="small"
                      onPress={() =>
                        setTentativaConsulta(
                          (atual) => atual + 1
                        )
                      }
                    />
                  </View>
                ) : null}

                {(!carregando || aba === "marcadas") &&
                (!erroConsulta || aba === "marcadas") &&
                materiasVisiveis.length === 0 ? (
                  <Text
                    style={[
                      styles.vazio,
                      { color: theme.textoSub },
                    ]}
                  >
                    {aba === "marcadas"
                        ? todasMarcadas
                            ? "Nenhuma matéria desmarcada."
                            : "Nenhuma matéria marcada."
                        : "Nenhuma matéria disponível nesta consulta."}
                  </Text>
                ) : null}

                {(!carregando || aba === "marcadas") &&
                (!erroConsulta || aba === "marcadas")
                  ? materiasVisiveis.map((materia) => {
                     const marcada = todasMarcadas
                        ? !desmarcadas.has(materia.id)
                        : marcadas.has(materia.id);

                      return (
                        <Pressable
                          key={materia.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: marcada,
                          }}
                          onPress={() => alternar(materia)}
                          style={[
                            styles.materia,
                            {
                                borderWidth: marcada ? 2.5 : 1,
                                borderColor: marcada
                                ? theme.textoTerciaria
                                : theme.textoSub,
                                backgroundColor: marcada
                                ? theme.backgroundSecundario
                                : theme.background,
                            },
                            ]}
                        >
                          <View style={styles.linha}>
                            <Text weight="SemiBold">
                              {dataISOParaBR(
                                materia.data_publicacao
                              )}
                            </Text>
                            <Text
                              weight="SemiBold"
                              numberOfLines={1}
                              style={[
                                styles.veiculo,
                                {
                                  color:
                                    theme.textoTerciaria,
                                },
                              ]}
                            >
                              {materia.veiculo_nome ||
                                "Sem veículo"}
                            </Text>
                            <Ionicons
                              name={
                                marcada
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={23}
                              color={theme.textoTerciaria}
                            />
                          </View>

                          <Text weight="Bold">
                            {materia.pauta || "Sem pauta"}
                          </Text>

                          {materia.imagem_anexo_id === null ? (
                            <Text
                              style={{
                                color: theme.aviso,
                                fontSize: 12,
                              }}
                            >
                              Sem imagem para o slide
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })
                  : null}

                {paginacaoVisivel &&
                paginacaoVisivel.total > 0 &&
                (aba === "marcadas" || (!carregando && !erroConsulta)) ? (
                  <View style={styles.paginacao}>
                    <Text
                      style={{
                        color: theme.textoSub,
                        textAlign: "center",
                      }}
                    >
                      Página {pagina} de{" "}
                      {Math.ceil(
                        paginacaoVisivel.total / LIMITE
                      )}
                    </Text>

                    <View style={styles.linha}>
                      <Button
                        title="ANTERIOR"
                        variant="outline"
                        size="small"
                        disabled={pagina === 1 || carregando}
                        onPress={() =>
                          setPagina((atual) => atual - 1)
                        }
                        style={styles.botaoPagina}
                      />
                      <Button
                        title="PRÓXIMA"
                        variant="outline"
                        size="small"
                        disabled={
                          !paginacaoVisivel.has_next ||
                          carregando
                        }
                        onPress={() =>
                          setPagina((atual) => atual + 1)
                        }
                        style={styles.botaoPagina}
                      />
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : null} 
      </ScrollView>

      {periodo ? (
        <View
          style={[
            styles.rodape,
            {
              borderTopColor: theme.borda,
              backgroundColor: theme.background,
            },
          ]}
        >
          <Text
            weight="SemiBold"
            style={{ textAlign: "center" }}
          >
            {totalMarcadas} nova(s) matéria(s) marcada(s)
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
            title="SALVAR PERÍODO"
            loading={salvando}
            disabled={
              !resumo ||
              carregando ||
              Boolean(erroConsulta)
            }
            onPress={() => void salvar()}
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
  conteudo: {
    padding: 15,
    paddingBottom: 28,
    gap: 12,
  },
  cartao: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 13,
    gap: 8,
  },
  bloco: {
    gap: 12,
  },
  titulo: {
    fontSize: 18,
  },
  topoResumo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
    },
    atalhoDatas: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    },
    linhaData: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    },
    rotuloData: {
    width: 43,
    fontSize: 11,
    },
    valorData: {
    flex: 1,
    fontSize: 12,
    },
  abas: {
    flexDirection: "row",
    gap: 8,
  },
  aba: {
    flex: 1,
    minHeight: 43,
    borderWidth: 1.5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  selecionarTodas: {
    width: "100%",
    minHeight: 42,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    },
  busca: {
    marginBottom: 0,
  },
  materia: {
    borderWidth: 1.5,
    borderRadius: 13,
    padding: 12,
    gap: 6,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  veiculo: {
    flex: 1,
  },
  vazio: {
    textAlign: "center",
    marginVertical: 24,
  },
  paginacao: {
    gap: 8,
  },
  botaoPagina: {
    flex: 1,
    width: "auto",
  },
  rodape: {
    borderTopWidth: 1,
    padding: 13,
    gap: 8,
  },

});