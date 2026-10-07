import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import FeedbackAlert, {
  type FeedbackAlertVariant,
} from "@/components/forms/FeedbackAlert";
import ClippingCard from "@/components/clipping/ClippingCard";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsultaClipping } from "@/hooks/useConsultaClipping";

import {
  excluirClippingsEmLote,
  listarClippingAnos,
  listarClippings,
  type AnoClipping,
  type Clipping,
} from "@/services/api/clipping";


type TipoVinculo = "cliente" | "veiculo";

interface Props {
  tipo: TipoVinculo;
  id: number;
  nome?: string;
}

interface Feedback {
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
}

const POR_PAGINA = 10;
const LIMITE_SELECAO = 100;

export default function ClippingsVinculados({
  tipo,
  id,
  nome,
}: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const podeVisualizar =
    temPermissao("CLIPPING", "VISUALIZAR");

  const podeExcluir =
    temPermissao("CLIPPING", "EXCLUIR");

  const [anoEscolhido, setAnoEscolhido] =
    useState<number | null>(null);

  const [pagina, setPagina] = useState(1);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [idsSelecionados, setIdsSelecionados] =
    useState<number[]>([]);

  const [confirmarExclusao, setConfirmarExclusao] =
    useState(false);

  const [excluindo, setExcluindo] = useState(false);
  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const consultarAnos = useCallback(async () => {
    if (!podeVisualizar) {
      return { anos: [] as AnoClipping[] };
    }

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("Cadastro inválido.");
    }

    return listarClippingAnos(
      tipo === "cliente"
        ? { cliente_id: id }
        : { veiculo_id: id }
    );
  }, [id, podeVisualizar, tipo]);

  const consultaAnos = useConsultaClipping(
    consultarAnos,
    `anos:${tipo}:${id}`
  );

  const anos = consultaAnos.dados?.anos ?? [];

  const anoDisponivel =
    anoEscolhido !== null &&
    anos.some(
      (item) =>
        Number(item.ano_referencia) === anoEscolhido
    );

  const ano =
    anoDisponivel
      ? anoEscolhido
      : Number(
          anos.find(
            (item) =>
              Number(item.total_clippings) > 0
          )?.ano_referencia ??
          anos[0]?.ano_referencia ??
          0
        ) || null;

  const totalGeral = anos.reduce(
    (total, item) =>
      total + Number(item.total_clippings),
    0
  );

  const consultarLista = useCallback(async () => {
    if (!podeVisualizar || ano === null) {
      return {
        clippings: [] as Clipping[],
        pagination: {
          page: 1,
          limit: POR_PAGINA,
          total: 0,
          has_next: false,
        },
      };
    }

    return listarClippings({
      ...(tipo === "cliente"
        ? { cliente_id: id }
        : { veiculo_id: id }),
      ano_referencia: ano,
      page: pagina,
      limit: POR_PAGINA,
    });
  }, [ano, id, pagina, podeVisualizar, tipo]);

  const consultaLista = useConsultaClipping(
    consultarLista,
    `lista:${tipo}:${id}:${ano}:${pagina}`
  );

  const clippings =
    consultaLista.dados?.clippings ?? [];

  const totalNoAno =
    consultaLista.dados?.pagination.total ?? 0;

  useEffect(() => {
    setPagina(1);
    setModoSelecao(false);
    setIdsSelecionados([]);
  }, [ano, id, tipo]);

  useFocusEffect(
    useCallback(() => {
      setModoSelecao(false);
      setIdsSelecionados([]);
    }, [id, tipo])
  );

  useEffect(() => {
    if (!consultaLista.dados || consultaLista.erro) {
      return;
    }

    const ultimaPagina = Math.max(
      1,
      Math.ceil(
        consultaLista.dados.pagination.total /
          POR_PAGINA
      )
    );

    if (pagina > ultimaPagina) {
      setPagina(ultimaPagina);
    }
  }, [
    consultaLista.dados,
    consultaLista.erro,
    pagina,
  ]);

  const idsDaPagina = clippings.map(
    (clipping) => clipping.id
  );

  const todosDaPagina =
    idsDaPagina.length > 0 &&
    idsDaPagina.every((itemId) =>
      idsSelecionados.includes(itemId)
    );

  const ocupado =
    excluindo ||
    consultaLista.carregando ||
    consultaLista.atualizando;

  function escolherAno(novoAno: number) {
    if (excluindo || novoAno === ano) return;
    setAnoEscolhido(novoAno);
  }

  function alternarSelecao(clippingId: number) {
    if (ocupado || !modoSelecao) return;

    if (idsSelecionados.includes(clippingId)) {
      setIdsSelecionados((atuais) =>
        atuais.filter(
          (itemId) => itemId !== clippingId
        )
      );
      return;
    }

    if (idsSelecionados.length >= LIMITE_SELECAO) {
      setFeedback({
        variant: "warning",
        title: "Limite de seleção",
        message:
          "Selecione até 100 clippings por vez.",
      });
      return;
    }

    setIdsSelecionados((atuais) => [
      ...atuais,
      clippingId,
    ]);
  }

  function alternarPaginaSelecionada() {
    if (ocupado || !modoSelecao) return;

    if (todosDaPagina) {
      const ids = new Set(idsDaPagina);

      setIdsSelecionados((atuais) =>
        atuais.filter((itemId) => !ids.has(itemId))
      );
      return;
    }

    const faltantes = idsDaPagina.filter(
      (itemId) =>
        !idsSelecionados.includes(itemId)
    );

    const vagas =
      LIMITE_SELECAO - idsSelecionados.length;

    if (vagas <= 0) {
      setFeedback({
        variant: "warning",
        title: "Limite de seleção",
        message:
          "Selecione até 100 clippings por vez.",
      });
      return;
    }

    setIdsSelecionados((atuais) => [
      ...atuais,
      ...faltantes.slice(0, vagas),
    ]);
  }

  function abrirAno() {
    if (ano === null || excluindo) return;

    router.push({
        pathname: "/clipping/ano",
        params: {
        ano: String(ano),
        origemTipo: tipo,
        origemId: String(id),
        },
    });
    }

    function abrirListaDoCliente(
    clienteId: number,
    clienteNome?: string
    ) {
    if (ano === null || excluindo) return;

    router.push({
        pathname: "/clipping/cliente/[id]" as never,
        params: {
        id: String(clienteId),
        ano: String(ano),
        clienteNome: clienteNome ?? "",
        origemTipo: tipo,
        origemId: String(id),
        retornoVinculado: "origem",
        },
    });
    }

    function abrirDetalhes(clippingId: number) {
    if (excluindo) return;

    router.push({
        pathname: "/clipping/[id]" as never,
        params: {
        id: String(clippingId),
        origemTipo: tipo,
        origemId: String(id),
        retornoVinculado: "origem",
        },
    });
    }

  async function excluirSelecionados() {
    if (
      excluindo ||
      idsSelecionados.length === 0
    ) {
      return;
    }

    setConfirmarExclusao(false);
    setExcluindo(true);

    try {
      const resposta =
        await excluirClippingsEmLote(
          [...idsSelecionados]
        );

      setIdsSelecionados([]);
      setModoSelecao(false);

      await Promise.all([
        consultaAnos.recarregar(),
        consultaLista.recarregar(),
      ]);

      const primeiroNaoExcluido =
        resposta.resultados.find(
          (item) => item.status !== "excluido"
        );

      setFeedback({
        variant:
          resposta.nao_excluidos > 0 ||
          resposta.limpeza_pendente
            ? "warning"
            : "success",
        title: "Exclusão concluída",
        message:
          `${resposta.excluidos} clipping(s) excluído(s). ` +
          `${resposta.nao_excluidos} preservado(s).` +
          (primeiroNaoExcluido
            ? ` ${primeiroNaoExcluido.message}`
            : "") +
          (resposta.limpeza_pendente
            ? " A limpeza de alguns arquivos ficou pendente no servidor."
            : ""),
      });
    } catch (error) {
      setFeedback({
        variant: "error",
        title: "Não foi possível excluir",
        message:
          error instanceof Error
            ? error.message
            : "Tente novamente.",
      });
    } finally {
      setExcluindo(false);
    }
  }

  if (!podeVisualizar) {
    return null;
  }

  return (
    <View style={styles.secao}>
      <View style={styles.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text weight="Bold">
            CLIPPINGS VINCULADOS
          </Text>

          <Text
            style={[
              styles.descricao,
              { color: theme.textoSub },
            ]}
          >
            {tipo === "cliente"
              ? "Publicações deste cliente"
              : "Publicações deste veículo"}
          </Text>
        </View>

        <View
          style={[
            styles.contador,
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
            }}
          >
            {totalGeral}
          </Text>
        </View>
      </View>

      {consultaAnos.carregando ? (
        <ActivityIndicator
          color={theme.textoTerciaria}
          style={styles.carregamento}
        />
      ) : consultaAnos.erro &&
        consultaAnos.dados === null ? (
        <View style={styles.mensagem}>
          <Text
            style={{
              color: theme.textoSub,
              textAlign: "center",
            }}
          >
            {consultaAnos.erro}
          </Text>

          <Button
            title="TENTAR NOVAMENTE"
            size="small"
            onPress={() =>
              void consultaAnos.recarregar()
            }
          />
        </View>
      ) : (
        <>
          <Text
            weight="SemiBold"
            style={styles.rotuloAno}
          >
            ANO DOS CLIPPINGS
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.listaAnos
            }
          >
            {anos.map((item) => {
              const anoItem = Number(
                item.ano_referencia
              );
              const ativo = anoItem === ano;

              return (
                <TouchableOpacity
                  key={anoItem}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: ativo,
                  }}
                  activeOpacity={0.8}
                  disabled={excluindo}
                  onPress={() =>
                    escolherAno(anoItem)
                  }
                  style={[
                    styles.ano,
                    {
                      borderColor: theme.borda,
                      backgroundColor: ativo
                        ? theme.backgroundContainer
                        : theme.background,
                    },
                  ]}
                >
                  <Text
                    weight="SemiBold"
                    style={{
                      color: ativo
                        ? theme.textoContainer
                        : theme.texto,
                    }}
                  >
                    {anoItem} ·{" "}
                    {Number(
                      item.total_clippings
                    )}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {ano !== null ? (
            <View style={styles.atalhos}>
            <TouchableOpacity
                activeOpacity={0.8}
                disabled={excluindo}
                onPress={abrirAno}
                style={[
                styles.atalho,
                {
                    backgroundColor: theme.backgroundContainer,
                    borderColor: theme.borda,
                },
                ]}
            >
                <Text
                weight="Bold"
                style={[
                    styles.atalhoTexto,
                    { color: theme.textoContainer },
                ]}
                >
                ABRIR ANO {ano}
                </Text>
            </TouchableOpacity>

            {tipo === "cliente" ? (
                <TouchableOpacity
                activeOpacity={0.8}
                disabled={excluindo}
                onPress={() => abrirListaDoCliente(id, nome)}
                style={[
                    styles.atalho,
                    {
                    backgroundColor: theme.backgroundContainer,
                    borderColor: theme.borda,
                    },
                ]}
                >
                <Text
                    weight="Bold"
                    style={[
                    styles.atalhoTexto,
                    { color: theme.textoContainer },
                    ]}
                >
                    LISTAGEM DO CLIENTE
                </Text>
                </TouchableOpacity>
            ) : null}
            </View>
          ) : null}

          <Text
            style={[
              styles.resumo,
              { color: theme.textoSub },
            ]}
          >
            {totalNoAno} clipping(s) neste ano
          </Text>

          {podeExcluir &&
          (clippings.length > 0 ||
            idsSelecionados.length > 0) ? (
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
                    {idsSelecionados.length} de {LIMITE_SELECAO} selecionado(s)
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
                    todosDaPagina
                        ? "Limpar seleção desta página"
                        : "Selecionar todos desta página"
                    }
                    disabled={ocupado || Boolean(consultaLista.erro)}
                    onPress={alternarPaginaSelecionada}
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
                    {todosDaPagina ? "LIMPAR" : "TODOS"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Excluir clippings selecionados"
                    disabled={
                    idsSelecionados.length === 0 ||
                    ocupado ||
                    Boolean(consultaLista.erro)
                    }
                    onPress={() => setConfirmarExclusao(true)}
                    style={[
                    styles.selectionIconButton,
                    {
                        backgroundColor: "#EF4444",
                        opacity:
                        idsSelecionados.length === 0 ||
                        ocupado ||
                        Boolean(consultaLista.erro)
                            ? 0.5
                            : 1,
                    },
                    ]}
                >
                    {excluindo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
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
                    accessibilityRole="button"
                    accessibilityLabel="Sair do modo de seleção"
                    disabled={ocupado}
                    onPress={() => {
                    setModoSelecao(false);
                    setIdsSelecionados([]);
                    }}
                    style={[
                    styles.selectionIconButton,
                    { backgroundColor: theme.backgroundContainer },
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
                accessibilityRole="button"
                accessibilityLabel="Selecionar clippings"
                disabled={ocupado || Boolean(consultaLista.erro)}
                onPress={() => setModoSelecao(true)}
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
                    SELECIONAR CLIPPINGS
                </Text>
              </TouchableOpacity>
            )
          ) : null}

          {consultaLista.carregando ? (
            <ActivityIndicator
              color={theme.textoTerciaria}
              style={styles.carregamento}
            />
          ) : consultaLista.erro &&
            consultaLista.dados === null ? (
            <View style={styles.mensagem}>
              <Text
                style={{
                  color: theme.textoSub,
                  textAlign: "center",
                }}
              >
                {consultaLista.erro}
              </Text>

              <Button
                title="TENTAR NOVAMENTE"
                size="small"
                onPress={() =>
                  void consultaLista.recarregar()
                }
              />
            </View>
          ) : clippings.length === 0 ? (
            <View
              style={[
                styles.mensagem,
                {
                  borderColor: theme.borda,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.textoSub,
                  textAlign: "center",
                }}
              >
                {totalGeral > 0
                  ? "Nenhum clipping neste ano. Escolha outro ano."
                  : "Nenhum clipping vinculado ainda."}
              </Text>
            </View>
          ) : (
            clippings.map((clipping) => {
                const selecionado =
                    idsSelecionados.includes(clipping.id);

                return (
                    <View key={clipping.id}>
                    <ClippingCard
                        clipping={clipping}
                        expandido={false}
                        abrirAoTocar
                        mostrarCliente={tipo === "veiculo"}
                        onAbrirDetalhes={() =>
                        abrirDetalhes(clipping.id)
                        }
                        modoSelecao={modoSelecao}
                        selecionado={selecionado}
                        bloqueado={ocupado}
                        onSelecionar={() =>
                        alternarSelecao(clipping.id)
                        }
                    />

                    {tipo === "veiculo" && !modoSelecao ? (
                        <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                            abrirListaDoCliente(
                            clipping.cliente_id,
                            clipping.cliente_nome
                            )
                        }
                        style={styles.linkCliente}
                        >
                        <Text
                            weight="SemiBold"
                            numberOfLines={1}
                            style={[
                            styles.linkClienteTexto,
                            { color: theme.textoTerciaria },
                            ]}
                        >
                            LISTAGEM DE {clipping.cliente_nome}
                        </Text>
                        <Ionicons
                            name="arrow-forward"
                            size={14}
                            color={theme.textoTerciaria}
                        />
                        </TouchableOpacity>
                    ) : null}
                    </View>
                );
            })
          )}
          {consultaLista.dados && !consultaLista.erro ? (
            <PaginacaoLista
                pagina={pagina}
                limite={POR_PAGINA}
                total={totalNoAno}
                disabled={ocupado}
                onChange={setPagina}
            />
            ) : null}
        </>
      )}

      <FeedbackAlert
        visible={confirmarExclusao}
        variant="warning"
        title="Excluir clippings selecionados?"
        message={
          `${idsSelecionados.length} clipping(s) serão enviados para exclusão. ` +
          "Os que estiverem vinculados a relatórios serão preservados e informados no resultado."
        }
        primaryLabel="EXCLUIR"
        secondaryLabel="CANCELAR"
        primaryDanger
        onClose={() =>
          setConfirmarExclusao(false)
        }
        onSecondary={() =>
          setConfirmarExclusao(false)
        }
        onPrimary={() =>
          void excluirSelecionados()
        }
      />

      <FeedbackAlert
        visible={feedback !== null}
        variant={
          feedback?.variant ?? "info"
        }
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        onClose={() =>
          setFeedback(null)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    marginTop: 28,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  descricao: {
    fontSize: 11,
    marginTop: 3,
  },
  contador: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rotuloAno: {
    fontSize: 11,
    marginBottom: 8,
  },
  listaAnos: {
    gap: 8,
    paddingBottom: 6,
  },
  ano: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  atalhos: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
atalho: {
  flex: 1,
  minWidth: 0,
  minHeight: 44,
  borderWidth: 1.5,
  borderRadius: 12,
  paddingHorizontal: 5,
  alignItems: "center",
  justifyContent: "center",
},
atalhoTexto: {
  fontSize: 11,
  textAlign: "center",
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
linkCliente: {
  alignSelf: "flex-end",
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  marginBottom: 9,
  paddingVertical: 2,
},
linkClienteTexto: {
  fontSize: 10,
  flexShrink: 1,
},
  resumo: {
    fontSize: 12,
    marginTop: 14,
    marginBottom: 10,
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
  carregamento: {
    marginVertical: 24,
  },
  mensagem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
});