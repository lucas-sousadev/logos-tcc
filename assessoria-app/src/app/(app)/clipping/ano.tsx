import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  RefreshControl
} from "react-native";

import { useCallback, useState } from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import { useVoltarNaPilha } from "@/hooks/useNavegacaoModulos";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import ClienteFilterModal, { type FiltrosClientes,} from "@/components/ui/Filtros/ClienteFilterModal";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";
import ContadorLista from "@/components/ui/ContadorLista";

import { useTheme } from "@/contexts/ThemeContext";
import {
  ClienteClippingAno,
  listarClientesDoAno,
} from "@/services/api/clipping";
import { useConsultaClipping } from "@/hooks/useConsultaClipping";
import { rotaOrigemClipping } from "@/utils/retornoClipping";

function filtrosClientesIniciais(): FiltrosClientes {
  return {
    estado: "",
    cidade: "",
    segmento: "",
    ativo: undefined,
  };
}

type RotaAno = {
  ano?: string;
  origemTipo?: string;
  origemId?: string;
};

export default function ClientesDoAno() {
  const params = useLocalSearchParams<RotaAno>();
  const ano = params.ano === undefined ? new Date().getFullYear() : Number(params.ano);
  return <ConteudoClientesDoAno key={String(ano)} ano={ano} params={params} />;
}

function ConteudoClientesDoAno({ ano, params }: { ano: number; params: RotaAno }) {
  const router = useRouter();
  const voltarNaPilha = useVoltarNaPilha();
  const { theme } = useTheme();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");

  const [pagina, setPagina] = useState(1);
  const [filtrosAberto, setFiltrosAberto] = useState(false);

  const [filtros, setFiltros] =
    useState<FiltrosClientes>(filtrosClientesIniciais);

  const filtrosAtivos =
    filtros.ativo !== undefined ||
    Boolean(filtros.estado.trim()) ||
    Boolean(filtros.cidade.trim()) ||
    Boolean(filtros.segmento.trim());


  const consultarClientes = useCallback(async () => {
    if (
      !Number.isInteger(ano) ||
      ano < 1000 ||
      ano > 9999
    ) {
      throw new Error("Ano de referência inválido.");
    }

    return listarClientesDoAno(ano, {
      ...filtros,
      busca: buscaAplicada,
      page: pagina,
      limit: 50,
    });
  }, [ano, buscaAplicada, filtros, pagina]);

  const ajustarPagina = useCallback((resposta: Awaited<ReturnType<typeof listarClientesDoAno>>) => {
    const ultima = Math.max(1, Math.ceil(resposta.pagination.total / 50));
    if (pagina > ultima) setPagina(ultima);
  }, [pagina]);

  const {
    dados,
    carregando,
    atualizando,
    erro,
    recarregar: carregarClientes,
  } = useConsultaClipping(
    consultarClientes,
    JSON.stringify([ano, buscaAplicada, filtros, pagina]),
    ajustarPagina
  );

  const clientes = dados?.clientes ?? [];
  const total = dados?.pagination.total ?? 0;


  function voltar() {
    const origem = rotaOrigemClipping(
      params.origemTipo,
      params.origemId
    );

    if (origem) {
      router.navigate(origem);
      return;
    }

    if (voltarNaPilha()) return;

    router.dismissTo("/clipping");
  }

  function pesquisar() {
    const texto = busca.trim();
    if (texto === buscaAplicada && pagina === 1) {
      void carregarClientes();
      return;
    }
    setBuscaAplicada(texto);
    setPagina(1);
  }

  function limparBusca() {
    setBusca("");
    setBuscaAplicada("");
    setPagina(1);
  }

  function abrirCliente(cliente: ClienteClippingAno) {
    router.push({
      pathname: "/clipping/cliente/[id]" as never,
      params: {
        id: String(cliente.id),
        ano: String(ano),
        clienteNome: cliente.nome,
        origemTipo: params.origemTipo,
        origemId: params.origemId,
        retornoVinculado: "ano",
      },
    });
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title={`Clientes ${ano}`}
        showBackButton
        onBackPress={voltar}
      />

      {carregando ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
              <RefreshControl
                refreshing={atualizando}
                onRefresh={() => void carregarClientes()}
                tintColor={theme.primaria}
                colors={[theme.primaria]}
              />
            }
        >
          <SearchBar
            value={busca}
            onChangeText={setBusca}
            onSearch={pesquisar}
            onClear={limparBusca}
            placeholder="Buscar cliente..."
            onFilterPress={() => setFiltrosAberto(true)}
            filterActive={filtrosAtivos}
          />

          <View style={styles.topRow}>
            <ContadorLista>
              {total} {total === 1 ? "cliente" : "clientes"}
              {" em "}
              {ano}
            </ContadorLista>
          </View>

          {erro ? (
            <View
              style={[
                styles.errorBox,
                { borderColor: theme.borda },
              ]}
            >
              <Text style={styles.errorText}>
                {erro}
              </Text>

              <Button
                title="TENTAR NOVAMENTE"
                size="small"
                onPress={() => void carregarClientes()}
              />
            </View>
          ) : null}

          <LimparFiltrosButton
            visible={filtrosAtivos}
            disabled={carregando || atualizando}
            onPress={() => {
              setFiltros(filtrosClientesIniciais());
              setPagina(1);
              setFiltrosAberto(false);
            }}
          />
          {clientes.map((cliente) => (
            <TouchableOpacity
              key={cliente.id}
              activeOpacity={0.8}
              onPress={() => abrirCliente(cliente)}
              style={[
                styles.clientCard,
                {
                  borderColor: theme.borda + "45",
                  backgroundColor: theme.backgroundSecundario,
                },
              ]}
            >
              <View
                style={[
                  styles.clientIcon,
                  { backgroundColor: theme.primaria + "12" },
                ]}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={21}
                  color={theme.textoTerciaria}
                />
              </View>

              <View style={styles.clientInfo}>
                <Text
                  weight="SemiBold"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.clientName}
                >
                  {cliente.nome}
                </Text>

                <View style={styles.clientVinculos}>
                  <Ionicons
                    name="attach-outline"
                    size={14}
                    color={theme.alteracao}
                  />

                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.clientMeta,
                      { color:  theme.alteracao },
                    ]}
                  >
                    {cliente.total_clippings}{" "}
                    {Number(cliente.total_clippings) === 1
                      ? "clipping"
                      : "clippings"}
                    {" • "}
                    {ano}
                  </Text>
                </View>

                {cliente.ativo !== 1 ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.clientState,
                      { color: theme.textoSub },
                    ]}
                  >
                    Cliente inativo
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.clientArrow,
                  { backgroundColor: theme.primaria + "0C" },
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={theme.textoTerciaria}
                />
              </View>
            </TouchableOpacity>
          ))}

          {!erro && clientes.length === 0 ? (
            <View
              style={[
                styles.empty,
                { borderColor: theme.borda },
              ]}
            >
              <Text weight="SemiBold">
                Nenhum cliente encontrado
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  { color: theme.textoSub },
                ]}
              >
                Tente alterar a busca ou cadastre um novo clipping.
              </Text>
            </View>
          ) : null}
          {!erro ? (
            <PaginacaoLista
              pagina={pagina}
              limite={50}
              total={total}
              disabled={atualizando}
              onChange={setPagina}
            />
          ) : null}
        </ScrollView>
      )}
      {filtrosAberto ? (
        <ClienteFilterModal
          visible
          filtros={filtros}
          onClose={() => setFiltrosAberto(false)}
          onApply={(novosFiltros) => {
            setFiltros(novosFiltros);
            setPagina(1);
            setFiltrosAberto(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  topRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  count: {
    flex: 1,
    fontSize: 12,
  },

  newButton: {
    width: "auto",
    borderRadius: 12
  },

  clientCard: {
    minWidth: 0,
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  clientIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  clientInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  clientName: {
    fontSize: 14,
    lineHeight: 19,
  },

  clientVinculos: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  clientMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
  },

  clientState: {
    fontSize: 10,
    lineHeight: 14,
  },

  clientArrow: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 7,
  },

  errorBox: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginBottom: 16,
  },

  errorText: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10,
  },
});