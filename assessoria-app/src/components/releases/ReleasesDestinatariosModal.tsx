import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/ui/SearchBar";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import Text from "@/components/ui/Text";
import MailingFilterModal, {
  type FiltrosMailing,
} from "@/components/ui/Filtros/MailingFilterModal";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listarDestinatariosRelease,
  selecionarDestinatariosDoFiltro,
  type DestinatarioRelease,
} from "@/services/api/release";

const LIMITE_PAGINA = 30;

interface Props {
  selecionados: DestinatarioRelease[];
  onAlternar: (jornalista: DestinatarioRelease) => void;
  onAdicionar: (jornalistas: DestinatarioRelease[]) => void;
  onClose: () => void;
}

export default function ReleaseDestinatariosModal({
  selecionados,
  onAlternar,
  onAdicionar,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [contatos, setContatos] = useState<
    DestinatarioRelease[]
  >([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [avisoSelecao, setAvisoSelecao] = useState("");
  const [erroSelecao, setErroSelecao] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [somenteSelecionados, setSomenteSelecionados] =
    useState(false);
  const [modalFiltros, setModalFiltros] = useState(false);
  const [selecionandoTodos, setSelecionandoTodos] =
    useState(false);

  const [filtros, setFiltros] = useState<FiltrosMailing>({
    estado: "",
    cidade: "",
    cargo: "",
    ativo: 1,
  });

  const operacao = useRef<AbortController | null>(null);

  const ids = new Set(
    selecionados.map((contato) => contato.id)
  );

  useEffect(
    () => () => operacao.current?.abort(),
    []
  );

  useEffect(() => {
    if (somenteSelecionados) return;

    let ativo = true;

    setCarregando(true);
    setErro("");
    setContatos([]);

    async function carregar() {
      try {
        const resposta = await listarDestinatariosRelease({
          page: pagina,
          limit: LIMITE_PAGINA,
          busca: buscaAplicada,
          estado: filtros.estado,
          cidade: filtros.cidade,
          cargo: filtros.cargo,
          veiculo_id: filtros.veiculoId,
          ativo: filtros.ativo,
        });

        if (!ativo) return;

        setContatos(resposta.jornalistas);
        setTotal(resposta.pagination.total);
      } catch (error) {
        if (!ativo) return;

        setTotal(0);
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os jornalistas."
        );
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [
    pagina,
    buscaAplicada,
    filtros,
    tentativa,
    somenteSelecionados,
  ]);

  const termo = buscaAplicada.toLocaleLowerCase();

  const selecionadosFiltrados = selecionados.filter(
    (contato) =>
      [
        contato.nome,
        contato.email,
        contato.veiculo_nome,
      ].some((valor) =>
        valor?.toLocaleLowerCase().includes(termo)
      )
  );

  const totalAtual = somenteSelecionados
    ? selecionadosFiltrados.length
    : total;

  const paginaAtual = somenteSelecionados
    ? Math.min(
        pagina,
        Math.max(
          1,
          Math.ceil(totalAtual / LIMITE_PAGINA)
        )
      )
    : pagina;

  const inicio = (paginaAtual - 1) * LIMITE_PAGINA;

  const lista = somenteSelecionados
    ? selecionadosFiltrados.slice(
        inicio,
        inicio + LIMITE_PAGINA
      )
    : contatos;

  const filtrosAtivos = Boolean(
    filtros.estado ||
      filtros.cidade ||
      filtros.cargo ||
      filtros.veiculoId ||
      filtros.ativo !== 1
  );

  function fechar() {
    operacao.current?.abort();
    onClose();
  }

  function buscar(texto: string) {
    if (operacao.current) return;

    setBusca(texto);
    setBuscaAplicada(texto.trim());
    setPagina(1);
    setAvisoSelecao("");
    setErroSelecao("");
  }

  async function selecionarTodos() {
    if (
      operacao.current ||
      carregando ||
      erro ||
      somenteSelecionados
    ) {
      return;
    }

    const controlador = new AbortController();

    operacao.current = controlador;
    setSelecionandoTodos(true);
    setAvisoSelecao("");
    setErroSelecao("");

    try {
      const resposta =
        await selecionarDestinatariosDoFiltro(
          {
            busca: buscaAplicada,
            estado: filtros.estado,
            cidade: filtros.cidade,
            cargo: filtros.cargo,
            veiculo_id: filtros.veiculoId,
            ativo: filtros.ativo,
          },
          controlador.signal
        );

      if (controlador.signal.aborted) return;

      const todosIds = new Set([
        ...selecionados.map((contato) => contato.id),
        ...resposta.jornalistas.map(
          (contato) => contato.id
        ),
      ]);

      if (todosIds.size > 10000) {
        throw new Error(
          "A seleção total ultrapassa 10.000 jornalistas. Remova contatos ou refine os filtros."
        );
      }

      onAdicionar(resposta.jornalistas);

      const ignorados =
        resposta.total_ignorados > 0
          ? " " +
            resposta.total_ignorados +
            " contatos inativos ou com e-mail inválido foram ignorados."
          : "";

      setAvisoSelecao(
        resposta.jornalistas.length +
          " jornalistas do filtro selecionados." +
          ignorados
      );
    } catch (error) {
      if (controlador.signal.aborted) return;

      setErroSelecao(
        error instanceof Error
          ? error.message
          : "Não foi possível selecionar os jornalistas."
      );
    } finally {
      if (operacao.current === controlador) {
        operacao.current = null;

        if (!controlador.signal.aborted) {
          setSelecionandoTodos(false);
        }
      }
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={fechar}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <Header
          title="Destinatários"
          showBackButton
          showSettings={false}
          onBackPress={fechar}
        />

        <View style={styles.content}>
          <SearchBar
            value={busca}
            onChangeText={(texto) => {
              if (!operacao.current) {
                setBusca(texto);
              }
            }}
            onSearch={() => buscar(busca)}
            onClear={() => buscar("")}
            placeholder="Buscar jornalista..."
            filterActive={filtrosAtivos}
            onFilterPress={
              somenteSelecionados
                ? undefined
                : () => {
                    if (!operacao.current) {
                      setModalFiltros(true);
                    }
                  }
            }
            containerStyle={{ marginBottom: 0 }}
          />

          <View style={styles.acoes}>
            <Button
              title={
                somenteSelecionados
                  ? "MAILING"
                  : "SELECIONADOS (" +
                    selecionados.length +
                    ")"
              }
              size="small"
              variant="outline"
              style={styles.botaoAcao}
              disabled={selecionandoTodos}
              onPress={() => {
                setSomenteSelecionados(
                  (valor) => !valor
                );
                setPagina(1);
              }}
            />

            {!somenteSelecionados ? (
              <Button
                title="SELECIONAR TODOS"
                size="small"
                style={styles.botaoAcao}
                loading={selecionandoTodos}
                disabled={
                  carregando ||
                  Boolean(erro) ||
                  total === 0
                }
                onPress={() =>
                  void selecionarTodos()
                }
              />
            ) : null}
          </View>

          {!somenteSelecionados && carregando ? (
            <ActivityIndicator
              color={theme.textoTerciaria}
            />
          ) : (
            <Text
              style={[
                styles.contagem,
                { color: theme.textoSub },
              ]}
            >
              {lista.length > 0
                ? "Exibindo " +
                  (inicio + 1) +
                  "–" +
                  (inicio + lista.length) +
                  " de "
                : "0 de "}
              {totalAtual} jornalistas
              {somenteSelecionados
                ? " selecionados"
                : " encontrados"}
            </Text>
          )}

          {selecionandoTodos ? (
            <Text>
              Selecionando todos os jornalistas do filtro...
            </Text>
          ) : null}

          {avisoSelecao ? (
            <Text
              style={{ color: theme.textoTerciaria }}
            >
              {avisoSelecao}
            </Text>
          ) : null}

          {erroSelecao ? (
            <Text style={{ color: theme.erro }}>
              {erroSelecao}
            </Text>
          ) : null}

          {!somenteSelecionados && erro ? (
            <View style={styles.mensagem}>
              <Text style={{ color: theme.erro }}>
                {erro}
              </Text>

              <Button
                title="TENTAR NOVAMENTE"
                size="small"
                onPress={() =>
                  setTentativa((valor) => valor + 1)
                }
              />
            </View>
          ) : null}

          <FlatList
            data={lista}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.lista}
            ListEmptyComponent={
              somenteSelecionados ||
              (!carregando && !erro) ? (
                <Text>Nenhum contato encontrado.</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const selecionado = ids.has(item.id);

              const elegivel = item.elegivel;

              const bloqueado =
                selecionandoTodos ||
                (!elegivel && !selecionado);

              return (
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: selecionado,
                    disabled: bloqueado,
                  }}
                  disabled={bloqueado}
                  onPress={() => onAlternar(item)}
                  style={[
                    styles.contato,
                    {
                      borderColor: theme.borda,
                      opacity:
                        elegivel || selecionado
                          ? 1
                          : 0.5,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      selecionado
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={23}
                    color={theme.textoTerciaria}
                  />

                  <View style={styles.info}>
                    <Text weight="SemiBold">
                      {item.nome}
                    </Text>

                    <Text>
                      {item.email ||
                        "Contato sem e-mail"}
                    </Text>

                    <Text
                      style={{ color: theme.textoSub }}
                    >
                      {item.veiculo_nome ||
                        "Veículo não informado"}
                    </Text>

                    {!elegivel ? (
                      <Text
                        style={{ color: theme.erro }}
                      >
                        Revise o contato no Mailing.
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {somenteSelecionados ||
          (!carregando && !erro) ? (
            <PaginacaoLista
              pagina={paginaAtual}
              limite={LIMITE_PAGINA}
              total={totalAtual}
              disabled={selecionandoTodos}
              onChange={setPagina}
            />
          ) : null}

          <Button
            title={
              "CONCLUIR (" +
              selecionados.length +
              ")"
            }
            disabled={selecionandoTodos}
            onPress={fechar}
          />
        </View>
      </View>

      <MailingFilterModal
        visible={modalFiltros}
        filtros={filtros}
        onClose={() => setModalFiltros(false)}
        onApply={(novos) => {
          if (operacao.current) return;

          setFiltros(novos);
          setPagina(1);
          setAvisoSelecao("");
          setErroSelecao("");
          setModalFiltros(false);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  acoes: {
    flexDirection: "row",
    gap: 8,
  },
  botaoAcao: {
    flex: 1,
    width: "auto",
    paddingHorizontal: 8,
    minHeight: 48,
  },
  contagem: {
    fontSize: 12,
  },
  lista: {
    gap: 8,
    paddingBottom: 6,
  },
  contato: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  mensagem: {
    gap: 8,
  },
});