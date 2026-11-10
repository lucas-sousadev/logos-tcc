import {
  useCallback,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/ui/SearchBar";
import Text from "@/components/ui/Text";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listarReleases,
  ROTULOS_STATUS,
  type ResumoRelease,
  type StatusRelease,
} from "@/services/api/release";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

export default function ListaReleases() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const podeVisualizar = temPermissao(
    "RELEASES",
    "VISUALIZAR"
  );

  const scroll = useRef<ScrollView>(null);
  const requisicaoAtual = useRef(0);

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [status, setStatus] = useState<
    StatusRelease | ""
  >("");
  const [statusTemporario, setStatusTemporario] =
    useState<StatusRelease | "">("");
  const [filtrosAbertos, setFiltrosAbertos] =
    useState(false);

  const [pagina, setPagina] = useState(1);
  const [releases, setReleases] = useState<
    ResumoRelease[]
  >([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const requisicao = ++requisicaoAtual.current;

    if (!podeVisualizar) {
      setReleases([]);
      setTotal(0);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const resposta = await listarReleases({
        page: pagina,
        busca: buscaAplicada,
        status,
      });

      if (requisicao !== requisicaoAtual.current) return;

      setReleases(resposta.releases);
      setTotal(resposta.pagination.total);
    } catch (error) {
      if (requisicao !== requisicaoAtual.current) return;

      setReleases([]);
      setTotal(0);
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os releases."
      );
    } finally {
      if (requisicao === requisicaoAtual.current) {
        setCarregando(false);
      }
    }
  }, [pagina, buscaAplicada, status, podeVisualizar]);

  useFocusEffect(
    useCallback(() => {
      void carregar();

      return () => {
        requisicaoAtual.current++;
      };
    }, [carregar])
  );

  function buscar() {
    const texto = busca.trim();

    if (pagina === 1 && texto === buscaAplicada) {
      void carregar();
      return;
    }

    setPagina(1);
    setBuscaAplicada(texto);
  }

  function aplicarStatus(valor: StatusRelease | "") {
    setStatus(valor);
    setPagina(1);
    setFiltrosAbertos(false);
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header title="Releases" />

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          onSearch={buscar}
          onClear={() => {
            setBusca("");
            setBuscaAplicada("");
            setPagina(1);
          }}
          placeholder="Buscar título ou assunto..."
          filterActive={status !== ""}
          onFilterPress={() => {
            setStatusTemporario(status);
            setFiltrosAbertos(true);
          }}
          containerStyle={{ marginBottom: 0 }}
        />

        <View style={styles.topo}>
          <Text style={{ color: theme.textoSub }}>
            {total}{" "}
            {total === 1 ? "release" : "releases"}
          </Text>

          {temPermissao("RELEASES", "CRIAR") ? (
            <Button
              icon="add-outline"
              title="RELEASE"
              size="small"
              style={styles.novo}
              onPress={() =>
                router.push("/releases/novo")
              }
            />
          ) : null}
        </View>

        <LimparFiltrosButton
          visible={status !== ""}
          onPress={() => aplicarStatus("")}
        />

        {!podeVisualizar ? (
          <Text>
            Você precisa da permissão de visualizar
            releases.
          </Text>
        ) : null}

        {erro ? (
          <View style={styles.mensagem}>
            <Text style={{ color: theme.erro }}>
              {erro}
            </Text>

            <Button
              title="TENTAR NOVAMENTE"
              size="small"
              onPress={() => void carregar()}
            />
          </View>
        ) : null}

        {carregando ? (
          <ActivityIndicator
            color={theme.textoTerciaria}
            size="large"
          />
        ) : null}

        {!carregando &&
        podeVisualizar &&
        !erro &&
        releases.length === 0 ? (
          <Text
            style={[
              styles.vazio,
              { color: theme.textoSub },
            ]}
          >
            Nenhum release encontrado.
          </Text>
        ) : null}

        {!carregando && !erro
          ? releases.map((release) => (
              <View
                key={release.id}
                style={[
                  styles.card,
                  { borderColor: theme.borda },
                ]}
              >
                <Text
                  weight="Bold"
                  style={styles.titulo}
                >
                  {release.titulo ||
                    "Release sem título"}
                </Text>

                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoTerciaria,
                  }}
                >
                  {release.cliente_nome ||
                    "Cliente a definir"}
                </Text>

                <Text
                  style={{
                    color:
                      release.status === "RASCUNHO"
                        ? theme.aviso
                        : theme.textoTerciaria,
                  }}
                >
                  {ROTULOS_STATUS[release.status]}
                </Text>

                <Text>
                  {release.total_destinatarios}{" "}
                  {release.total_destinatarios === 1
                    ? "destinatário"
                    : "destinatários"}
                </Text>

                <Text
                  style={[
                    styles.legenda,
                    { color: theme.textoSub },
                  ]}
                >
                  {dataISOParaBR(
                    (
                      release.data_referencia ||
                      release.updated_at
                    ).slice(0, 10)
                  )}
                  {" · "}
                  {release.criado_por_nome}
                </Text>
              </View>
            ))
          : null}

        {!carregando &&
        !erro &&
        podeVisualizar ? (
          <PaginacaoLista
            pagina={pagina}
            limite={20}
            total={total}
            onChange={(valor) => {
              setPagina(valor);
              scroll.current?.scrollTo({
                y: 0,
                animated: true,
              });
            }}
          />
        ) : null}
      </ScrollView>

      <FiltroModalBase
        visible={filtrosAbertos}
        subtitle="Releases"
        onClose={() => setFiltrosAbertos(false)}
        onClear={() => setStatusTemporario("")}
        onApply={() =>
          aplicarStatus(statusTemporario)
        }
      >
        <Text weight="SemiBold">SITUAÇÃO</Text>

        {(
          [
            "",
            ...Object.keys(ROTULOS_STATUS),
          ] as (StatusRelease | "")[]
        ).map((valor) => (
          <TouchableOpacity
            key={valor || "todos"}
            accessibilityRole="radio"
            accessibilityState={{
              checked: statusTemporario === valor,
            }}
            onPress={() =>
              setStatusTemporario(valor)
            }
            style={[
              styles.opcao,
              {
                borderColor: theme.borda,
                backgroundColor:
                  statusTemporario === valor
                    ? theme.backgroundContainer
                    : theme.background,
              },
            ]}
          >
            <Text
              style={{
                color:
                  statusTemporario === valor
                    ? theme.textoContainer
                    : theme.texto,
              }}
            >
              {valor
                ? ROTULOS_STATUS[valor]
                : "Todos"}
            </Text>
          </TouchableOpacity>
        ))}
      </FiltroModalBase>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 35,
  },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  novo: {
    width: "auto",
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  titulo: {
    fontSize: 16,
  },
  legenda: {
    fontSize: 12,
  },
  vazio: {
    textAlign: "center",
    paddingVertical: 24,
  },
  mensagem: {
    gap: 12,
  },
  opcao: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    minHeight: 44,
  },
});