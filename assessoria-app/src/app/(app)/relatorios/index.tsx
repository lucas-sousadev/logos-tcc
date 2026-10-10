import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";
import RelatorioFilterModal, {
  novosFiltrosRelatorios,
  possuiFiltrosRelatorios,
  type FiltrosRelatorios,
} from "@/components/ui/Filtros/RelatorioFilterModal";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listarRelatorios,
  type ResumoRelatorio,
} from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

const LIMITE_PAGINA = 20;

export default function ListaRelatorios() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtros, setFiltros] = useState<FiltrosRelatorios>(
    novosFiltrosRelatorios
  );
  const [modalAberto, setModalAberto] = useState(false);

  const [relatorios, setRelatorios] = useState<ResumoRelatorio[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const requisicaoAtual = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const carregar = useCallback(
    async (
      paginaAtual: number,
      filtrosAtuais: FiltrosRelatorios,
      buscaAtual: string
    ) => {
      const requisicao = ++requisicaoAtual.current;

      setCarregando(true);
      setErro("");

      try {
        const resposta = await listarRelatorios({
          page: paginaAtual,
          limit: LIMITE_PAGINA,
          busca: buscaAtual,
          ano: filtrosAtuais.ano
            ? Number(filtrosAtuais.ano)
            : undefined,
          inclusao: filtrosAtuais.inclusao,
          pendencias: filtrosAtuais.pendencias,
          ordem: filtrosAtuais.ordem,
        });

        if (requisicao !== requisicaoAtual.current) return;

        setRelatorios(resposta.relatorios);
        setTotal(resposta.pagination.total);
        setTemMais(resposta.pagination.has_next);
      } catch (e) {
        if (requisicao === requisicaoAtual.current) {
          setRelatorios([]);
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar os relatórios."
          );
        }
      } finally {
        if (requisicao === requisicaoAtual.current) {
          setCarregando(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void carregar(pagina, filtros, buscaAplicada);

      return () => {
        requisicaoAtual.current++;
      };
    }, [carregar, pagina, filtros, buscaAplicada])
  );

  function aplicarFiltros(novos: FiltrosRelatorios) {
    setModalAberto(false);
    setPagina(1);
    setFiltros(novos);
  }

  function buscar() {
    const texto = busca.trim();

    if (texto === buscaAplicada && pagina === 1) {
      void carregar(1, filtros, texto);
      return;
    }

    setPagina(1);
    setBuscaAplicada(texto);
  }

  function limparBusca() {
    setPagina(1);
    setBusca("");
    setBuscaAplicada("");
  }

  function mudarPagina(destino: number) {
    if (carregando || destino < 1) return;

    setPagina(destino);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  const filtrosAtivos = possuiFiltrosRelatorios(filtros);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header title="Relatórios" showBackButton />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          onSearch={buscar}
          onClear={limparBusca}
          onFilterPress={() => setModalAberto(true)}
          filterActive={filtrosAtivos}
          placeholder="Buscar relatório ou cliente..."
        />

        <View style={styles.topRow}>
          <Text
            weight="Medium"
            style={[
              styles.count,
              { color: theme.textoSub },
            ]}
          >
            {total} {total === 1 ? "relatório" : "relatórios"}
          </Text>

          {temPermissao("RELATORIOS", "CRIAR") ? (
            <Button
              title="NOVO"
              size="small"
              onPress={() =>
                router.push("/relatorios/novo")
              }
              style={styles.newButton}
            />
          ) : null}
        </View>

        <LimparFiltrosButton
          visible={filtrosAtivos}
          disabled={carregando}
          onPress={() => aplicarFiltros(novosFiltrosRelatorios())}
        />

        {erro ? (
          <View
            style={[
              styles.messageBox,
              {
                borderColor: theme.borda,
                backgroundColor: theme.background,
              },
            ]}
          >
            <Text style={{ color: theme.erro }}>
              {erro}
            </Text>

            <Button
              title="TENTAR NOVAMENTE"
              size="small"
              onPress={() => void carregar(pagina, filtros, buscaAplicada)}
            />
          </View>
        ) : null}

        {carregando ? (
          <ActivityIndicator
            size="large"
            color={theme.textoTerciaria}
            style={styles.loading}
          />
        ) : relatorios.length === 0 && !erro ? (
          <View style={styles.empty}>
            <Ionicons
              name="document-text-outline"
              size={30}
              color={theme.textoSub}
            />

            <Text
              style={{
                color: theme.textoSub,
                textAlign: "center",
              }}
            >
              Nenhum relatório encontrado.
            </Text>
          </View>
        ) : (
          relatorios.map((relatorio) => (
            <TouchableOpacity
              key={relatorio.id}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Abrir relatório ${relatorio.titulo}`}
              onPress={() =>
                router.push({
                  pathname: "/relatorios/[id]",
                  params: {
                    id: String(relatorio.id),
                  },
                })
              }
              style={[
                styles.card,
                {
                  borderColor: theme.borda,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleArea}>
                  <Text
                    weight="Bold"
                    style={styles.cardTitle}
                  >
                    {relatorio.titulo}
                  </Text>

                  <Text
                    weight="SemiBold"
                    style={{
                      color: theme.textoTerciaria,
                    }}
                  >
                    {relatorio.cliente_nome}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={21}
                  color={theme.texto}
                />
              </View>

              <View
                style={[
                  styles.cardSection,
                  { borderTopColor: `${theme.borda}55` },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.textoSub}
                />

                <Text style={{ color: theme.texto }}>
                  {dataISOParaBR(
                    relatorio.periodo_inicio
                  )}{" "}
                  a{" "}
                  {dataISOParaBR(
                    relatorio.periodo_fim
                  )}
                </Text>
              </View>

              <View style={styles.cardBottom}>
                <Text style={{ color: theme.textoTerciaria }}>
                  {relatorio.total_materias}{" "}
                  {relatorio.total_materias === 1
                    ? "matéria"
                    : "matérias"}
                </Text>

                <Text style={{ color: theme.textoSub }}>
                  ·
                </Text>

                <Text style={{ color: theme.texto }}>
                  Inclusão automática{" "}
                  {relatorio.inclusao_automatica
                    ? "ativa"
                    : "pausada"}
                </Text>
              </View>

              {relatorio.novos_pendentes > 0 ? (
                <View
                  style={[
                    styles.pending,
                    {
                      backgroundColor:
                        `${theme.aviso}18`,
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={theme.aviso}
                  />

                  <Text
                    weight="SemiBold"
                    style={{ color: theme.aviso }}
                  >
                    {relatorio.novos_pendentes}{" "}
                    {relatorio.novos_pendentes === 1
                      ? "slide novo para revisar"
                      : "slides novos para revisar"}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))
        )}

        {!carregando && !erro && total > 0 ? (
          <View style={styles.pagination}>
            <Text
              style={[
                styles.paginationInfo,
                { color: theme.textoSub },
              ]}
            >
              Exibindo {(pagina - 1) * LIMITE_PAGINA + 1}–
              {Math.min(pagina * LIMITE_PAGINA, total)} de {total}
              {" · "}Página {pagina} de{" "}
              {Math.ceil(total / LIMITE_PAGINA)}
            </Text>

            <View style={styles.paginationButtons}>
              <Button
                title="ANTERIOR"
                variant="outline"
                size="small"
                disabled={pagina === 1}
                onPress={() => mudarPagina(pagina - 1)}
                style={styles.paginationButton}
              />

              <Button
                title="PRÓXIMA"
                variant="outline"
                size="small"
                disabled={!temMais}
                onPress={() => mudarPagina(pagina + 1)}
                style={styles.paginationButton}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <RelatorioFilterModal
        visible={modalAberto}
        filtros={filtros}
        onClose={() => setModalAberto(false)}
        onApply={aplicarFiltros}
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  count: {
    flex: 1,
    fontSize: 13,
  },
  newButton: {
    width: "auto",
  },
  loading: {
    marginTop: 32,
  },
  messageBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 45,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    gap: 11,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitleArea: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    fontSize: 15,
  },
  cardSection: {
    borderTopWidth: 1,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  pending: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  pagination: {
    marginTop: 8,
    gap: 10,
  },
  paginationInfo: {
    textAlign: "center",
    fontSize: 12,
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
});