import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useEffect, useState, useRef } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePreventRemove } from "expo-router/react-navigation";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import ContadorLista from "@/components/ui/ContadorLista";
import FeedbackAlert, {
  type FeedbackAlertVariant,
} from "@/components/forms/FeedbackAlert";
import ClippingCard from "@/components/clipping/ClippingCard";
import SelecaoListaButton from "../ui/SelecaoListaButton";

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
  onExcluindoChange?: (excluindo: boolean) => void;
}

interface Feedback {
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
}

const POR_PAGINA = 10;
const LIMITE_SELECAO = 100;

function AvisoAtualizacao({
  mensagem,
  onRetry,
}: {
  mensagem: string;
  onRetry: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.avisoAtualizacao, { borderColor: theme.erro }]}>
      <Text style={[styles.avisoAtualizacaoTexto, { color: theme.erro }]}>
        {mensagem} Os dados exibidos podem estar desatualizados.
      </Text>

      <TouchableOpacity accessibilityRole="button" onPress={onRetry}>
        <Text
          weight="SemiBold"
          style={{ color: theme.textoTerciaria, fontSize: 11 }}
        >
          TENTAR NOVAMENTE
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ClippingsVinculados({
  tipo,
  id,
  nome,
  onExcluindoChange,
}: Props) {
  const router = useRouter();
  const { origemClippingId } = useLocalSearchParams<{
    origemClippingId?: string;
  }>();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const podeVisualizar = temPermissao("CLIPPING", "VISUALIZAR");

  const podeExcluir = temPermissao("CLIPPING", "EXCLUIR");

  const [anoEscolhido, setAnoEscolhido] = useState<number | null>(null);
  const [listaAnosAberta, setListaAnosAberta] = useState(false);

  const [pagina, setPagina] = useState(1);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);

  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const [excluindo, setExcluindo] = useState(false);
  const travaExclusao = useRef(false);
  usePreventRemove(excluindo, () => {});

  useEffect(() => {
    onExcluindoChange?.(excluindo);
  }, [excluindo, onExcluindoChange]);

  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const consultarAnos = useCallback(async () => {
    if (!podeVisualizar) {
      return { anos: [] as AnoClipping[] };
    }

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("Cadastro inválido.");
    }

    return listarClippingAnos(
      tipo === "cliente" ? { cliente_id: id } : { veiculo_id: id }
    );
  }, [id, podeVisualizar, tipo]);

  const consultaAnos = useConsultaClipping(consultarAnos, `anos:${tipo}:${id}`);

  const anos = consultaAnos.dados?.anos ?? [];

  const opcaoAno =
    anos.find((item) => Number(item.ano_referencia) === anoEscolhido) ??
    anos.find((item) => Number(item.total_clippings) > 0) ??
    anos[0];
  const ano = Number(opcaoAno?.ano_referencia) || null;

  const totalGeral = anos.reduce(
    (total, item) => total + Number(item.total_clippings),
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
      ...(tipo === "cliente" ? { cliente_id: id } : { veiculo_id: id }),
      ano_referencia: ano,
      page: pagina,
      limit: POR_PAGINA,
    });
  }, [ano, id, pagina, podeVisualizar, tipo]);

  const ajustarPagina = useCallback(
    (resposta: Awaited<ReturnType<typeof listarClippings>>) => {
      const ultimaPagina = Math.max(
        1,
        Math.ceil(resposta.pagination.total / POR_PAGINA)
      );
      if (pagina > ultimaPagina) {
        setPagina(ultimaPagina);
      }
    },
    [pagina]
  );

  const consultaLista = useConsultaClipping(
    consultarLista,
    `lista:${tipo}:${id}:${ano}:${pagina}`,
    ajustarPagina
  );

  const clippings = consultaLista.dados?.clippings ?? [];

  const totalNoAno = consultaLista.dados?.pagination.total ?? 0;

  const clippingsPorCliente = new Map<number, Clipping[]>();

  if (tipo === "veiculo") {
    for (const clipping of clippings) {
      const grupo = clippingsPorCliente.get(clipping.cliente_id);

      if (grupo) {
        grupo.push(clipping);
      } else {
        clippingsPorCliente.set(clipping.cliente_id, [clipping]);
      }
    }
  }

  const chaveSelecao = `${tipo}:${id}:${ano}`;
  const [selecaoAnterior, setSelecaoAnterior] = useState(chaveSelecao);

  if (selecaoAnterior !== chaveSelecao) {
    setSelecaoAnterior(chaveSelecao);
    setPagina(1);
    setListaAnosAberta(false);
    setModoSelecao(false);
    setConfirmarExclusao(false);
    setIdsSelecionados([]);
  }

  useFocusEffect(
    useCallback(() => {
      setListaAnosAberta(false);
      setModoSelecao(false);
      setIdsSelecionados([]);
      setConfirmarExclusao(false);
    }, [])
  );

  const idsDaPagina = clippings.map((clipping) => clipping.id);

  const todosDaPagina =
    idsDaPagina.length > 0 &&
    idsDaPagina.every((itemId) => idsSelecionados.includes(itemId));

  const ocupado =
    excluindo || consultaLista.carregando || consultaLista.atualizando;

  const selecaoBloqueada = ocupado || Boolean(consultaLista.erro);
  const navegacaoBloqueada = excluindo || modoSelecao;

  function escolherAno(novoAno: number) {
    if (navegacaoBloqueada) return;

    setListaAnosAberta(false);
    if (novoAno !== ano) {
      setAnoEscolhido(novoAno);
    }
  }

  function alternarSelecao(clippingId: number) {
    if (selecaoBloqueada || !modoSelecao) return;

    if (idsSelecionados.includes(clippingId)) {
      setIdsSelecionados((atuais) =>
        atuais.filter((itemId) => itemId !== clippingId)
      );
      return;
    }

    if (idsSelecionados.length >= LIMITE_SELECAO) {
      setFeedback({
        variant: "warning",
        title: "Limite de seleção",
        message: "Selecione até 100 clippings por vez.",
      });
      return;
    }

    setIdsSelecionados((atuais) => [...atuais, clippingId]);
  }

  function alternarPaginaSelecionada() {
    if (selecaoBloqueada || !modoSelecao) return;

    if (todosDaPagina) {
      const ids = new Set(idsDaPagina);

      setIdsSelecionados((atuais) =>
        atuais.filter((itemId) => !ids.has(itemId))
      );
      return;
    }

    const faltantes = idsDaPagina.filter(
      (itemId) => !idsSelecionados.includes(itemId)
    );

    const vagas = LIMITE_SELECAO - idsSelecionados.length;

    if (vagas <= 0) {
      setFeedback({
        variant: "warning",
        title: "Limite de seleção",
        message: "Selecione até 100 clippings por vez.",
      });
      return;
    }

    setIdsSelecionados((atuais) => [...atuais, ...faltantes.slice(0, vagas)]);
  }

  function abrirAno() {
    if (ano === null || excluindo || modoSelecao) return;

    router.navigate({
      pathname: "/clipping/ano",
      params: {
        ano: String(ano),
        origemTipo: tipo,
        origemId: String(id),
      },
    });
  }

  function abrirListaDoCliente(clienteId: number, clienteNome?: string) {
    if (ano === null || excluindo || modoSelecao) return;

    router.navigate({
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

    if (tipo === "veiculo" && Number(origemClippingId) === clippingId) {
      router.navigate({
        pathname: "/clipping/[id]",
        params: { id: String(clippingId) },
      });
      return;
    }

    router.navigate({
      pathname: "/clipping/[id]" as never,
      params: {
        id: String(clippingId),
        origemTipo: tipo,
        origemId: String(id),
        retornoVinculado: "origem",
      },
    });
  }

  function renderizarClipping(clipping: Clipping) {
    return (
      <ClippingCard
        key={clipping.id}
        clipping={clipping}
        expandido={false}
        abrirAoTocar
        onAbrirDetalhes={() => abrirDetalhes(clipping.id)}
        modoSelecao={modoSelecao}
        selecionado={idsSelecionados.includes(clipping.id)}
        bloqueado={selecaoBloqueada}
        onSelecionar={() => alternarSelecao(clipping.id)}
      />
    );
  }

  async function excluirSelecionados() {
    if (
      travaExclusao.current ||
      excluindo ||
      idsSelecionados.length === 0 ||
      consultaLista.erro
    ) {
      return;
    }

    const ids = [...idsSelecionados];

    travaExclusao.current = true;
    setConfirmarExclusao(false);
    setExcluindo(true);

    let retorno: Feedback;

    try {
      const resposta = await excluirClippingsEmLote(ids);
      const preservados = resposta.resultados.filter(
        (item) => item.status !== "excluido"
      );

      const mensagens = [
        `${resposta.excluidos} de ${ids.length} clipping(s) excluído(s).`,
        ...preservados.map((item) => `#${item.id}: ${item.message}`),
      ];

      if (resposta.limpeza_pendente) {
        mensagens.push(
          "A limpeza de alguns arquivos ficou pendente no servidor."
        );
      }

      retorno = {
        variant:
          preservados.length > 0 || resposta.limpeza_pendente
            ? "warning"
            : "success",
        title:
          preservados.length > 0
            ? "Resultado da exclusão"
            : "Clippings excluídos",
        message: mensagens.join("\n\n"),
      };
    } catch (error) {
      retorno = {
        variant: "warning",
        title: "Resultado não confirmado",
        message:
          (error instanceof Error
            ? error.message
            : "Não foi possível receber o resultado.") +
          "\n\nParte da exclusão pode ter sido concluída. Confira a lista atualizada antes de tentar novamente.",
      };
    }

    setIdsSelecionados([]);
    setModoSelecao(false);

    try {
      const [anosAtualizados, listaAtualizada] = await Promise.all([
        consultaAnos.recarregar(),
        consultaLista.recarregar(),
      ]);

      if (!anosAtualizados || !listaAtualizada) {
        throw new Error("Não foi possível atualizar os dados.");
      }
    } catch {
      retorno = {
        ...retorno,
        variant: "warning",
        message:
          retorno.message +
          "\n\nNão foi possível atualizar a listagem. Atualize-a antes de outra exclusão.",
      };
    } finally {
      setFeedback(retorno);
      setExcluindo(false);
      travaExclusao.current = false;
    }
  }

  if (!podeVisualizar) {
    return null;
  }

  return (
    <View style={styles.secao}>
      <View style={styles.cabecalho}>
        <View style={styles.info}>
          <Text weight="SemiBold" style={styles.titulo}>
            Clippings vinculados
          </Text>

          <Text style={[styles.descricao, { color: theme.textoSub }]}>
            {tipo === "cliente"
              ? "Publicações deste cliente"
              : "Publicações deste veículo"}
          </Text>
        </View>

        {!consultaAnos.erro && !consultaAnos.carregando ? (
          <ContadorLista>{totalGeral}</ContadorLista>
        ) : null}
      </View>

      {consultaAnos.erro && consultaAnos.dados ? (
        <AvisoAtualizacao
          mensagem={consultaAnos.erro}
          onRetry={() => void consultaAnos.recarregar()}
        />
      ) : null}

      {consultaAnos.carregando ? (
        <ActivityIndicator
          color={theme.textoTerciaria}
          style={styles.carregamento}
        />
      ) : consultaAnos.erro && consultaAnos.dados === null ? (
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
            onPress={() => void consultaAnos.recarregar()}
          />
        </View>
      ) : (
        <>
          {opcaoAno && ano !== null ? (
            <>
              <Text
                weight="Medium"
                style={[styles.rotuloAno, { color: theme.textoSub }]}
              >
                Ano das publicações
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Ano dos clippings, ${ano}`}
                accessibilityState={{
                  expanded: listaAnosAberta,
                  disabled: navegacaoBloqueada,
                }}
                activeOpacity={0.8}
                disabled={navegacaoBloqueada}
                onPress={() => setListaAnosAberta((aberta) => !aberta)}
                style={[
                  styles.linhaAno,
                  styles.seletorAno,
                  {
                    borderColor: theme.borda + "45",
                    backgroundColor: theme.backgroundSecundario,
                    opacity: navegacaoBloqueada ? 0.6 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconeAno,
                    { backgroundColor: theme.primaria + "0C" },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={theme.textoTerciaria}
                  />
                </View>
                <Text weight="Bold" style={styles.textoAno}>
                  {ano}
                </Text>
                <Text style={[styles.totalAno, { color: theme.textoSub }]}>
                  {opcaoAno.total_clippings}{" "}
                  {Number(opcaoAno.total_clippings) === 1
                    ? "clipping"
                    : "clippings"}
                </Text>
                <Ionicons
                  name={listaAnosAberta ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.textoTerciaria}
                />
              </TouchableOpacity>

              {listaAnosAberta ? (
                <View
                  accessibilityRole="radiogroup"
                  style={[
                    styles.listaAnos,
                    {
                      borderColor: theme.borda,
                      backgroundColor: theme.backgroundSecundario,
                    },
                  ]}
                >
                  {anos.map((item) => {
                    const anoItem = Number(item.ano_referencia);
                    const ativo = anoItem === ano;

                    return (
                      <TouchableOpacity
                        key={anoItem}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: ativo }}
                        activeOpacity={0.8}
                        onPress={() => escolherAno(anoItem)}
                        style={[
                          styles.linhaAno,
                          styles.opcaoAno,
                          ativo && { backgroundColor: theme.primaria + "12" },
                        ]}
                      >
                        <Text
                          weight="SemiBold"
                          style={[
                            styles.textoAno,
                            ativo && { color: theme.textoTerciaria },
                          ]}
                        >
                          {anoItem}
                        </Text>
                        <Text
                          style={[
                            styles.totalAno,
                            {
                              color: ativo
                                ? theme.textoTerciaria
                                : theme.textoSub,
                            },
                          ]}
                        >
                          {item.total_clippings}{" "}
                          {Number(item.total_clippings) === 1
                            ? "clipping"
                            : "clippings"}
                        </Text>
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={theme.textoTerciaria}
                          style={{ opacity: ativo ? 1 : 0 }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}

          {ano !== null ? (
            <View style={styles.atalhos}>
              <Button
                title={"ABRIR " + ano}
                icon="calendar-outline"
                variant="outline"
                size="small"
                disabled={navegacaoBloqueada}
                onPress={abrirAno}
                style={styles.atalho}
              />
              {tipo === "cliente" ? (
                <Button
                  title="VER LISTAGEM"
                  icon="list-outline"
                  variant="outline"
                  size="small"
                  disabled={navegacaoBloqueada}
                  onPress={() => abrirListaDoCliente(id, nome)}
                  style={styles.atalho}
                />
              ) : null}
            </View>
          ) : null}

          {podeExcluir &&
          (clippings.length > 0 || idsSelecionados.length > 0) ? (
            modoSelecao ? (
              <View
                style={[
                  styles.selectionToolbar,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.borda,
                    marginTop: 12,
                  },
                ]}
              >
                <View style={styles.selectionInfo}>
                  <Text weight="SemiBold" style={styles.selectionTitle}>
                    {idsSelecionados.length} de {LIMITE_SELECAO} selecionado(s)
                  </Text>
                  <Text
                    style={[
                      styles.selectionSubtitle,
                      { color: theme.textoSub },
                    ]}
                  >
                    TODOS marca apenas esta página.
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
                  disabled={selecaoBloqueada}
                  onPress={alternarPaginaSelecionada}
                  style={[styles.selectAllButton, { borderColor: theme.borda }]}
                >
                  <Text
                    weight="SemiBold"
                    style={[styles.selectAllText, { color: theme.texto }]}
                  >
                    {todosDaPagina ? "LIMPAR" : "TODOS"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir clippings selecionados"
                  disabled={idsSelecionados.length === 0 || selecaoBloqueada}
                  onPress={() => setConfirmarExclusao(true)}
                  style={[
                    styles.selectionIconButton,
                    {
                      backgroundColor: "#EF4444",
                      opacity:
                        idsSelecionados.length === 0 || selecaoBloqueada
                          ? 0.5
                          : 1,
                    },
                  ]}
                >
                  {excluindo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="trash-outline" size={19} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Sair do modo de seleção"
                  disabled={excluindo}
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
              <SelecaoListaButton
                title="SELECIONAR CLIPPINGS"
                disabled={selecaoBloqueada}
                style={{ marginTop: 12 }}
                onPress={() => {
                  setListaAnosAberta(false);
                  setModoSelecao(true);
                }}
              />
            )
          ) : null}

          {consultaLista.erro && consultaLista.dados ? (
            <AvisoAtualizacao
              mensagem={consultaLista.erro}
              onRetry={() => void consultaLista.recarregar()}
            />
          ) : null}

          {consultaLista.carregando ? (
            <ActivityIndicator
              color={theme.textoTerciaria}
              style={styles.carregamento}
            />
          ) : consultaLista.erro && consultaLista.dados === null ? (
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
                onPress={() => void consultaLista.recarregar()}
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
          ) : tipo === "veiculo" ? (
            Array.from(clippingsPorCliente, ([clienteId, grupo]) => {
              const clienteNome =
                grupo[0].cliente_nome?.trim() || `Cliente #${clienteId}`;

              return (
                <View key={clienteId} style={styles.grupoCliente}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Ver listagem de ${clienteNome}`}
                    accessibilityState={{ disabled: navegacaoBloqueada }}
                    activeOpacity={0.8}
                    disabled={navegacaoBloqueada}
                    onPress={() => abrirListaDoCliente(clienteId, clienteNome)}
                    style={[
                      styles.cabecalhoGrupoCliente,
                      {
                        backgroundColor: theme.primaria + "08",
                        borderColor: theme.borda + "25",
                      },
                    ]}
                  >
                    <Ionicons
                      name="briefcase-outline"
                      size={17}
                      color={theme.textoTerciaria}
                    />
                    <Text
                      weight="SemiBold"
                      numberOfLines={1}
                      style={[
                        styles.nomeGrupoCliente,
                        { color: theme.alteracao },
                      ]}
                    >
                      {clienteNome}
                    </Text>
                    {!navegacaoBloqueada ? (
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={theme.textoTerciaria}
                      />
                    ) : null}
                  </TouchableOpacity>

                  {grupo.map(renderizarClipping)}
                </View>
              );
            })
          ) : (
            clippings.map(renderizarClipping)
          )}
          {consultaLista.dados && !consultaLista.erro ? (
            <PaginacaoLista
              pagina={pagina}
              limite={POR_PAGINA}
              total={totalNoAno}
              disabled={selecaoBloqueada}
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
        onClose={() => setConfirmarExclusao(false)}
        onSecondary={() => setConfirmarExclusao(false)}
        onPrimary={() => void excluirSelecionados()}
      />

      <FeedbackAlert
        visible={feedback !== null}
        variant={feedback?.variant ?? "info"}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        onClose={() => setFeedback(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avisoAtualizacao: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  avisoAtualizacaoTexto: {
    fontSize: 11,
    lineHeight: 17,
  },

  secao: {
    marginTop: 16,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  titulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  rotuloAno: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  linhaAno: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  seletorAno: {
    borderWidth: 1,
    borderRadius: 14,
  },
  iconeAno: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  textoAno: {
    flex: 1,
    fontSize: 14,
  },
  totalAno: {
    flexShrink: 1,
    fontSize: 12,
  },
  listaAnos: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
  },
  opcaoAno: {
    borderRadius: 8,
  },
  atalhos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  atalho: {
    flex: 1,
    width: "auto",
    minWidth: 128,
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
  grupoCliente: {
    marginBottom: 6,
  },
  cabecalhoGrupoCliente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  nomeGrupoCliente: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
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
