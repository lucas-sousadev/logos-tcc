import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

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
import RelatorioListaCard from "@/components/relatorios/RelatorioListaCard";
import ContadorLista from "@/components/ui/ContadorLista";
import PaginacaoLista from "@/components/ui/PaginacaoLista";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listarRelatorios,
  type ResumoRelatorio,
} from "@/services/api/relatorio";

const LIMITE_PAGINA = 20;

export default function ListaRelatorios() {
  const params = useLocalSearchParams<{ pendencias?: string }>();
  const pendencias = params.pendencias === "com" ? "com" : "todas";
  return <ConteudoRelatorios key={pendencias} pendenciasDaRota={pendencias} />;
}

function ConteudoRelatorios({ pendenciasDaRota }: { pendenciasDaRota: "com" | "todas" }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtros, setFiltros] = useState<FiltrosRelatorios>(() => ({
    ...novosFiltrosRelatorios(),
    pendencias: pendenciasDaRota,
  }));
  const [modalAberto, setModalAberto] = useState(false);

  const [relatorios, setRelatorios] = useState<ResumoRelatorio[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
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

        const ultima = Math.max(1, Math.ceil(resposta.pagination.total / LIMITE_PAGINA));
        if (paginaAtual > ultima) {
          setPagina(ultima);
          return;
        }
        setRelatorios(resposta.relatorios);
        setTotal(resposta.pagination.total);
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
          <ContadorLista>
            {total} {total === 1 ? "relatório" : "relatórios"}
          </ContadorLista>

          {temPermissao("RELATORIOS", "CRIAR") ? (
            <Button
              icon="add-outline"
              title="RELATÓRIO"
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
            <RelatorioListaCard
              key={relatorio.id}
              relatorio={relatorio}
              onPress={() =>
                router.push({
                  pathname: "/relatorios/[id]",
                  params: {
                    id: String(relatorio.id),
                  },
                })
              }
            />
          ))
        )}

        {!carregando && !erro && total > 0 ? (
          <PaginacaoLista
            pagina={pagina}
            limite={LIMITE_PAGINA}
            total={total}
            disabled={carregando}
            onChange={mudarPagina}
          />
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
    flexWrap: "nowrap",
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