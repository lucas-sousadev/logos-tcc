import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import FeedbackAlert, {
  type FeedbackAlertVariant,
} from "@/components/forms/FeedbackAlert";

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
}

const LIMITE_SELECAO_EM_LOTE = 100;

export default function ContatosVinculados({
  veiculoId,
  totalVinculados,
  onContatosAlterados,
}: ContatosVinculadosProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const podeVisualizar =
    temPermissao("MAILING", "VISUALIZAR");

  const podeExcluir =
    temPermissao("MAILING", "EXCLUIR");

  const [
    contatos,
    setContatos,
  ] = useState<Jornalista[]>([]);

  const [
    pagina,
    setPagina,
  ] = useState(1);

  const [
    temMais,
    setTemMais,
  ] = useState(false);

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [
    carregandoMais,
    setCarregandoMais,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    modoSelecao,
    setModoSelecao,
  ] = useState(false);

  const [
    idsSelecionados,
    setIdsSelecionados,
  ] = useState<number[]>([]);

  const [
    excluindo,
    setExcluindo,
  ] = useState(false);

  const [
    feedback,
    setFeedback,
  ] = useState<FeedbackState | null>(null);

  useEffect(() => {
    if (!podeVisualizar) {
      return;
    }

    void carregarContatos(true);
  }, [veiculoId, podeVisualizar]);

  function mostrarFeedback(dados: FeedbackState) {
    setFeedback(dados);
  }

  function fecharFeedback() {
    setFeedback(null);
  }

  async function carregarContatos(
    reset = false
  ) {
    if (
      !veiculoId ||
      Number.isNaN(veiculoId) ||
      carregando ||
      carregandoMais
    ) {
      return;
    }

    try {
      setErro("");

      if (reset) {
        setCarregando(true);
        setContatos([]);
        setPagina(1);
        setTemMais(false);
      } else {
        setCarregandoMais(true);
      }

      const paginaAtual = reset
        ? 1
        : pagina + 1;

      const resposta =
        await listarJornalistas({
          page: paginaAtual,
          limit: 50,
          veiculo_id: veiculoId,
          ativo: undefined,
          ordem: "nome",
          direcao: "ASC",
        });

      if (reset) {
        setContatos(resposta.jornalistas);
        setPagina(1);
      } else {
        setContatos((atuais) => [
          ...atuais,
          ...resposta.jornalistas,
        ]);

        setPagina(paginaAtual);
      }

      setTemMais(
        resposta.pagination.has_next
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os contatos vinculados."
      );
    } finally {
      setCarregando(false);
      setCarregandoMais(false);
    }
  }

  function abrirModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(true);
  }

  function sairModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(false);
  }

  function alternarContatoSelecionado(
    contatoId: number
  ) {
    if (idsSelecionados.includes(contatoId)) {
      setIdsSelecionados((atual) =>
        atual.filter((id) => id !== contatoId)
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
          "Você pode selecionar até 100 contatos por vez.",
      });

      return;
    }

    setIdsSelecionados((atual) => [
      ...atual,
      contatoId,
    ]);
  }

  function selecionarTodosVisiveis() {
    const idsVisiveis = contatos.map(
      (contato) => contato.id
    );

    const todosSelecionados =
      idsVisiveis.length > 0 &&
      idsVisiveis.every((contatoId) =>
        idsSelecionados.includes(contatoId)
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
        (contatoId) =>
          !idsSelecionados.includes(contatoId)
      )
      .slice(0, vagasRestantes);

    setIdsSelecionados((atual) => [
      ...atual,
      ...idsParaAdicionar,
    ]);
  }

  function confirmarExclusao() {
    const quantidade = idsSelecionados.length;

    if (quantidade === 0) {
      mostrarFeedback({
        variant: "warning",
        title: "Nenhum contato selecionado",
        message:
          "Selecione pelo menos um contato para excluir.",
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

    if (ids.length === 0) {
      return;
    }

    fecharFeedback();
    setExcluindo(true);

    try {
      const resultado =
        await excluirJornalistasEmLote(ids);

      sairModoSelecao();

      await carregarContatos(true);
      await onContatosAlterados();

      mostrarFeedback({
        variant: "success",
        title: "Contatos excluídos",
        message:
          `${resultado.excluidos} contato(s) ` +
          "foram excluídos com sucesso.",
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
      setExcluindo(false);
    }
  }

  if (!podeVisualizar) {
    return null;
  }

  const todosVisiveisSelecionados =
    contatos.length > 0 &&
    contatos.every((contato) =>
      idsSelecionados.includes(contato.id)
    );

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            weight="Bold"
            style={styles.title}
          >
            CONTATOS VINCULADOS
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: theme.textoSub },
            ]}
          >
            Contatos atualmente associados a este veículo.
          </Text>
        </View>

        <View
          style={[
            styles.count,
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
              fontSize: 12,
            }}
          >
            {totalVinculados}
          </Text>
        </View>
      </View>

      {podeExcluir && contatos.length > 0 ? (
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
                Escolha os contatos que deseja excluir.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={selecionarTodosVisiveis}
              disabled={excluindo}
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
                {todosVisiveisSelecionados ||
                idsSelecionados.length >=
                  LIMITE_SELECAO_EM_LOTE
                  ? "LIMPAR"
                  : "TODOS"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={confirmarExclusao}
              disabled={
                idsSelecionados.length === 0 ||
                excluindo
              }
              style={[
                styles.selectionIconButton,
                {
                  backgroundColor: "#EF4444",
                  opacity:
                    idsSelecionados.length === 0 ||
                    excluindo
                      ? 0.5
                      : 1,
                },
              ]}
            >
              {excluindo ? (
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
              disabled={excluindo}
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
              SELECIONAR CONTATOS
            </Text>
          </TouchableOpacity>
        )
      ) : null}

      {carregando ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="small"
            color={theme.primaria}
          />
        </View>
      ) : erro ? (
        <View
          style={[
            styles.empty,
            { borderColor: theme.borda },
          ]}
        >
          <Text
            style={{
              color: "#EF4444",
              textAlign: "center",
            }}
          >
            {erro}
          </Text>
        </View>
      ) : contatos.length === 0 ? (
        <View
          style={[
            styles.empty,
            { borderColor: theme.borda },
          ]}
        >
          <Ionicons
            name="people-outline"
            size={28}
            color={theme.textoSub}
          />

          <Text
            style={[
              styles.emptyText,
              { color: theme.textoSub },
            ]}
          >
            Nenhum contato está vinculado a este veículo.
          </Text>
        </View>
      ) : (
        contatos.map((contato) => (
          <TouchableOpacity
            key={contato.id}
            activeOpacity={0.8}
            onPress={() => {
              if (modoSelecao) {
                alternarContatoSelecionado(contato.id);
                return;
              }

              router.push({
                pathname: "/mailing/[id]",
                params: {
                  id: contato.id.toString(),
                  origem: "veiculo",
                  veiculo_id: veiculoId.toString(),
                },
              });
            }}
            style={[
              styles.card,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <View
              style={[
                styles.avatar,
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
                {contato.nome.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.cardInfo}>
              <Text
                weight="SemiBold"
                style={styles.cardName}
              >
                {contato.nome}
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.cardDetail,
                  { color: theme.textoSub },
                ]}
              >
                {contato.email ||
                  contato.telefone ||
                  "Sem e-mail e telefone"}
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.cardMeta,
                  { color: theme.texto },
                ]}
              >
                {[
                  contato.cargo,
                  contato.cidade && contato.estado
                    ? `${contato.cidade} - ${contato.estado}`
                    : contato.cidade || contato.estado,
                ]
                  .filter(Boolean)
                  .join(" • ") ||
                  "Sem informações adicionais"}
              </Text>
            </View>

            {modoSelecao ? (
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor:
                      idsSelecionados.includes(
                        contato.id
                      )
                        ? theme.backgroundContainer
                        : theme.borda,
                    backgroundColor:
                      idsSelecionados.includes(
                        contato.id
                      )
                        ? theme.backgroundContainer
                        : theme.background,
                  },
                ]}
              >
                {idsSelecionados.includes(
                  contato.id
                ) ? (
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
        ))
      )}

      {temMais ? (
        <Button
          title="CARREGAR MAIS"
          variant="outline"
          loading={carregandoMais}
          onPress={() =>
            carregarContatos(false)
          }
          style={styles.moreButton}
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
    marginTop: 28,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 13,
  },

  subtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  count: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
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
    minHeight: 74,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  cardInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  cardName: {
    fontSize: 15,
  },

  cardDetail: {
    fontSize: 12,
    marginTop: 2,
  },

  cardMeta: {
    fontSize: 11,
    marginTop: 3,
  },

  moreButton: {
    marginTop: 4,
  },
});