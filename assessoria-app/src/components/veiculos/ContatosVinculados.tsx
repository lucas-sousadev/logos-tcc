import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useCallback, useEffect, useRef, useState } from "react";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import Text from "@/components/ui/Text";
import ContadorLista from "@/components/ui/ContadorLista";
import FeedbackAlert, {
  type FeedbackAlertVariant,
} from "@/components/forms/FeedbackAlert";
import SelecaoListaButton from "../ui/SelecaoListaButton";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import {
  excluirJornalistasEmLote,
  listarJornalistas,
  type Jornalista,
} from "@/services/api/jornalista";

interface FeedbackState {
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDanger?: boolean;
  onPrimary?: () => void;
}

interface ContatosVinculadosProps {
  veiculoId: number;
  totalVinculados: number;
  onContatosAlterados: () => Promise<void>;
  onExcluindoChange?: (excluindo: boolean) => void;
}

const LIMITE_SELECAO_EM_LOTE = 100;
const POR_PAGINA = 10;

export default function ContatosVinculados({
  veiculoId,
  totalVinculados,
  onContatosAlterados,
  onExcluindoChange,
}: ContatosVinculadosProps) {
  const router = useRouter();
  const { origemMailingId } = useLocalSearchParams<{
    origemMailingId?: string;
  }>();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const podeVisualizar = temPermissao("MAILING", "VISUALIZAR");

  const podeExcluir = temPermissao("MAILING", "EXCLUIR");

  const [contatos, setContatos] = useState<Jornalista[]>([]);

  const [pagina, setPagina] = useState(1);

  const [total, setTotal] = useState(totalVinculados);
  const requisicao = useRef(0);
  const travaExclusao = useRef(false);

  const [carregando, setCarregando] = useState(true);

  const [erro, setErro] = useState("");

  const [modoSelecao, setModoSelecao] = useState(false);

  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);

  const [excluindo, setExcluindo] = useState(false);
  usePreventRemove(excluindo, () => {});

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    onExcluindoChange?.(excluindo);
  }, [excluindo, onExcluindoChange]);

  function mostrarFeedback(dados: FeedbackState) {
    setFeedback(dados);
  }

  function fecharFeedback() {
    setFeedback(null);
  }

  const carregarContatos = useCallback(async (): Promise<boolean> => {
    if (!podeVisualizar || !Number.isSafeInteger(veiculoId) || veiculoId <= 0) {
      return false;
    }

    const numero = ++requisicao.current;
    setCarregando(true);
    setErro("");

    try {
      const resposta = await listarJornalistas({
        page: pagina,
        limit: POR_PAGINA,
        veiculo_id: veiculoId,
        ordem: "nome",
        direcao: "ASC",
      });

      if (numero !== requisicao.current) return false;

      setTotal(resposta.pagination.total);

      const ultimaPagina = Math.max(
        1,
        Math.ceil(resposta.pagination.total / POR_PAGINA)
      );

      if (pagina > ultimaPagina) {
        setPagina(ultimaPagina);
      } else {
        setContatos(resposta.jornalistas);
      }

      return true;
    } catch (error) {
      if (numero !== requisicao.current) return false;

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os contatos vinculados."
      );
      return false;
    } finally {
      if (numero === requisicao.current) {
        setCarregando(false);
      }
    }
  }, [pagina, podeVisualizar, veiculoId]);

  const [veiculoAnterior, setVeiculoAnterior] = useState(veiculoId);
  if (veiculoAnterior !== veiculoId) {
    setVeiculoAnterior(veiculoId);
    setContatos([]);
    setTotal(totalVinculados);
    setPagina(1);
    setModoSelecao(false);
    setIdsSelecionados([]);
  }

  useFocusEffect(
    useCallback(() => {
      setModoSelecao(false);
      setIdsSelecionados([]);
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      void carregarContatos();

      return () => {
        requisicao.current += 1;
      };
    }, [carregarContatos])
  );

  function abrirModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(true);
  }

  function sairModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(false);
  }

  function alternarContatoSelecionado(contatoId: number) {
    if (carregando || excluindo || erro || !modoSelecao) return;

    if (idsSelecionados.includes(contatoId)) {
      setIdsSelecionados((atual) => atual.filter((id) => id !== contatoId));

      return;
    }

    if (idsSelecionados.length >= LIMITE_SELECAO_EM_LOTE) {
      mostrarFeedback({
        variant: "warning",
        title: "Limite de seleção atingido",
        message: "Você pode selecionar até 100 contatos por vez.",
      });

      return;
    }

    setIdsSelecionados((atual) => [...atual, contatoId]);
  }

  function selecionarTodosVisiveis() {
    if (carregando || excluindo || erro || !modoSelecao) return;

    const idsVisiveis = contatos.map((contato) => contato.id);

    const todosSelecionados =
      idsVisiveis.length > 0 &&
      idsVisiveis.every((contatoId) => idsSelecionados.includes(contatoId));

    if (todosSelecionados) {
      const idsDaPagina = new Set(idsVisiveis);
      setIdsSelecionados((atuais) =>
        atuais.filter((id) => !idsDaPagina.has(id))
      );
      return;
    }

    const vagasRestantes = LIMITE_SELECAO_EM_LOTE - idsSelecionados.length;

    if (vagasRestantes <= 0) {
      mostrarFeedback({
        variant: "warning",
        title: "Limite de seleção atingido",
        message: "Você pode selecionar até 100 contatos por vez.",
      });
      return;
    }

    const idsParaAdicionar = idsVisiveis
      .filter((contatoId) => !idsSelecionados.includes(contatoId))
      .slice(0, vagasRestantes);

    setIdsSelecionados((atual) => [...atual, ...idsParaAdicionar]);
  }

  function confirmarExclusao() {
    const quantidade = idsSelecionados.length;

    if (quantidade === 0) {
      mostrarFeedback({
        variant: "warning",
        title: "Nenhum contato selecionado",
        message: "Selecione pelo menos um contato para excluir.",
      });

      return;
    }

    mostrarFeedback({
      variant: "warning",
      title: `Excluir ${quantidade} contato(s)?`,
      message:
        "Os contatos serão excluídos permanentemente. Essa ação não pode ser desfeita.",
      primaryLabel: "EXCLUIR",
      secondaryLabel: "CANCELAR",
      primaryDanger: true,
      onPrimary: excluirSelecionados,
    });
  }

  async function excluirSelecionados() {
    const ids = [...idsSelecionados];

    if (
      travaExclusao.current ||
      ids.length === 0 ||
      !podeExcluir ||
      carregando ||
      erro
    ) {
      return;
    }

    travaExclusao.current = true;
    fecharFeedback();
    setExcluindo(true);

    try {
      const resultado = await excluirJornalistasEmLote(ids);

      sairModoSelecao();

      const [listaAtualizada, resumoAtualizado] = await Promise.allSettled([
        carregarContatos(),
        onContatosAlterados(),
      ]);

      const atualizado =
        listaAtualizada.status === "fulfilled" &&
        listaAtualizada.value &&
        resumoAtualizado.status === "fulfilled";

      mostrarFeedback({
        variant: atualizado ? "success" : "warning",
        title: "Contatos excluídos",
        message:
          `${resultado.excluidos} contato(s) ` +
          "foram excluídos com sucesso." +
          (atualizado
            ? ""
            : " A lista ou a contagem não pôde ser atualizada. Confira os dados antes de outra exclusão."),
      });
    } catch (error) {
      mostrarFeedback({
        variant: "error",
        title: "Não foi possível excluir",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir os contatos.",
      });
    } finally {
      travaExclusao.current = false;
      setExcluindo(false);
    }
  }

  if (!podeVisualizar) {
    return null;
  }

  const todosVisiveisSelecionados =
    contatos.length > 0 &&
    contatos.every((contato) => idsSelecionados.includes(contato.id));

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text weight="SemiBold" style={styles.title}>
            Contatos vinculados
          </Text>

          <Text style={[styles.subtitle, { color: theme.textoSub }]}>
            Contatos atualmente associados a este veículo.
          </Text>
        </View>

        {!erro ? <ContadorLista>{total}</ContadorLista> : null}
      </View>

      {podeExcluir && (contatos.length > 0 || idsSelecionados.length > 0) ? (
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
              <Text weight="SemiBold" style={styles.selectionTitle}>
                {idsSelecionados.length} de {LIMITE_SELECAO_EM_LOTE}{" "}
                selecionado(s)
              </Text>

              <Text
                style={[styles.selectionSubtitle, { color: theme.textoSub }]}
              >
                TODOS marca apenas esta página.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={selecionarTodosVisiveis}
              disabled={carregando || excluindo || Boolean(erro)}
              style={[styles.selectAllButton, { borderColor: theme.borda }]}
            >
              <Text
                weight="SemiBold"
                style={[styles.selectAllText, { color: theme.texto }]}
              >
                {todosVisiveisSelecionados ? "LIMPAR" : "TODOS"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={confirmarExclusao}
              disabled={
                idsSelecionados.length === 0 ||
                carregando ||
                excluindo ||
                Boolean(erro)
              }
              style={[
                styles.selectionIconButton,
                {
                  backgroundColor: "#EF4444",
                  opacity:
                    idsSelecionados.length === 0 ||
                    carregando ||
                    excluindo ||
                    Boolean(erro)
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
              onPress={sairModoSelecao}
              disabled={excluindo}
              style={[
                styles.selectionIconButton,
                {
                  backgroundColor: theme.backgroundContainer,
                },
              ]}
            >
              <Ionicons name="close" size={20} color={theme.textoContainer} />
            </TouchableOpacity>
          </View>
        ) : (
          <SelecaoListaButton
            title="SELECIONAR CONTATOS"
            disabled={carregando || excluindo || Boolean(erro)}
            onPress={abrirModoSelecao}
          />
        )
      ) : null}

      {carregando && contatos.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.textoTerciaria} />
        </View>
      ) : erro ? (
        <View style={[styles.empty, { borderColor: theme.borda }]}>
          <Text
            style={{
              color: "#EF4444",
              textAlign: "center",
            }}
          >
            {erro}
          </Text>
          <Button
            title="TENTAR NOVAMENTE"
            size="small"
            onPress={() => void carregarContatos()}
          />
        </View>
      ) : contatos.length === 0 ? (
        <View style={[styles.empty, { borderColor: theme.borda }]}>
          <Ionicons name="people-outline" size={28} color={theme.textoSub} />

          <Text style={[styles.emptyText, { color: theme.textoSub }]}>
            Nenhum contato está vinculado a este veículo.
          </Text>
        </View>
      ) : (
        contatos.map((contato) => (
          <TouchableOpacity
            key={contato.id}
            accessibilityRole="button"
            accessibilityLabel={
              modoSelecao
                ? `Selecionar contato ${contato.nome}`
                : `Abrir contato ${contato.nome}`
            }
            accessibilityState={{
              disabled: carregando || excluindo || Boolean(erro),
              selected: modoSelecao && idsSelecionados.includes(contato.id),
            }}
            activeOpacity={0.8}
            disabled={carregando || excluindo || Boolean(erro)}
            onPress={() => {
              if (modoSelecao) {
                alternarContatoSelecionado(contato.id);
                return;
              }

              router.navigate({
                pathname: "/mailing/[id]",
                params: {
                  id: contato.id.toString(),
                  ...(Number(origemMailingId) === contato.id
                    ? {}
                    : {
                        origem: "veiculo",
                        veiculo_id: veiculoId.toString(),
                        origemNavegacao: undefined,
                      }),
                },
              });
            }}
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundSecundario,
                borderColor: theme.borda + "45",
                opacity: carregando || excluindo ? 0.6 : 1,
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
                style={{
                  color: theme.textoTerciaria,
                }}
              >
                {contato.nome.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.cardInfo}>
              <Text
                weight="SemiBold"
                style={styles.cardName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {contato.nome}
              </Text>

              <Text
                numberOfLines={1}
                style={[styles.cardDetail, { color: theme.textoSub }]}
              >
                {contato.email || contato.telefone || "Sem e-mail e telefone"}
              </Text>

              <Text
                numberOfLines={1}
                style={[styles.cardMeta, { color: theme.texto }]}
              >
                {[
                  contato.cargo,
                  contato.cidade && contato.estado
                    ? `${contato.cidade} - ${contato.estado}`
                    : contato.cidade || contato.estado,
                ]
                  .filter(Boolean)
                  .join(" • ") || "Sem informações adicionais"}
              </Text>
            </View>

            {modoSelecao ? (
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: idsSelecionados.includes(contato.id)
                      ? theme.backgroundContainer
                      : theme.borda,
                    backgroundColor: idsSelecionados.includes(contato.id)
                      ? theme.backgroundContainer
                      : theme.background,
                  },
                ]}
              >
                {idsSelecionados.includes(contato.id) ? (
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
                  styles.cardArrow,
                  { backgroundColor: theme.primaria + "0C" },
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
        ))
      )}

      {!erro && contatos.length > 0 ? (
        <PaginacaoLista
          pagina={pagina}
          limite={POR_PAGINA}
          total={total}
          disabled={carregando || excluindo}
          onChange={setPagina}
        />
      ) : null}

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
  section: {
    marginTop: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    fontSize: 14,
    lineHeight: 20,
  },

  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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

  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  loading: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    minHeight: 100,
    borderWidth: 1.5,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
  },

  emptyText: {
    fontSize: 12,
    textAlign: "center",
  },

  card: {
    minHeight: 82,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  cardName: {
    fontSize: 14,
    lineHeight: 19,
  },

  cardDetail: {
    fontSize: 11,
    lineHeight: 15,
  },

  cardMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  cardArrow: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
