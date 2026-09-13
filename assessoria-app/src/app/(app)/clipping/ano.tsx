import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useCallback, useState } from "react";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ClienteClippingAno,
  listarClientesDoAno,
} from "@/services/api/clipping";

export default function ClientesDoAno() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const params = useLocalSearchParams<{
    ano?: string;
  }>();

  const ano =
    Number(params.ano) || new Date().getFullYear();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");
  const [clientes, setClientes] = useState<
    ClienteClippingAno[]
  >([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregarClientes = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await listarClientesDoAno(
        ano,
        {
          busca: buscaAplicada,
          page: 1,
          limit: 100,
        }
      );

      setClientes(resposta.clientes);
      setTotal(resposta.pagination.total);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os clientes."
      );
    } finally {
      setCarregando(false);
    }
  }, [ano, buscaAplicada]);

  useFocusEffect(
    useCallback(() => {
      void carregarClientes();
    }, [carregarClientes])
  );

  function pesquisar() {
    setBuscaAplicada(busca.trim());
  }

  function limparBusca() {
    setBusca("");
    setBuscaAplicada("");
  }

  function abrirCliente(cliente: ClienteClippingAno) {
    router.push({
        pathname: "/clipping/cliente/[id]" as never,
        params: {
            id: String(cliente.id),
            ano: String(ano),
        },
    });
  }

  function novoClipping() {
    router.push({
      pathname: "/clipping/novo",
      params: {
        ano: String(ano),
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
        >
          <SearchBar
            value={busca}
            onChangeText={setBusca}
            onSearch={pesquisar}
            onClear={limparBusca}
            placeholder="Buscar cliente..."
          />

          <View style={styles.topRow}>
            <Text
              style={[
                styles.count,
                { color: theme.textoSub },
              ]}
            >
              {total} cliente(s) disponíveis
            </Text>

            {temPermissao("CLIPPING", "CRIAR") ? (
              <Button
                title="NOVO"
                size="small"
                onPress={novoClipping}
                style={styles.newButton}
              />
            ) : null}
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

          {clientes.map((cliente) => (
            <TouchableOpacity
              key={cliente.id}
              activeOpacity={0.8}
              onPress={() => abrirCliente(cliente)}
              style={[
                styles.clientCard,
                {
                  borderColor: theme.borda,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <View
                style={[
                  styles.clientIcon,
                  {
                    backgroundColor:
                      theme.backgroundContainer,
                  },
                ]}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={22}
                  color={theme.textoContainer}
                />
              </View>

              <View style={styles.clientInfo}>
                <Text
                  weight="SemiBold"
                  style={styles.clientName}
                  numberOfLines={1}
                >
                  {cliente.nome}
                </Text>

                <Text
                  style={[
                    styles.clientMeta,
                    { color: theme.textoSub },
                  ]}
                >
                  {cliente.total_clippings} clipping(s)
                  {cliente.ativo !== 1
                    ? " • Cliente inativo"
                    : ""}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={21}
                color={theme.textoSub}
              />
            </TouchableOpacity>
          ))}

          {clientes.length === 0 ? (
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
        </ScrollView>
      )}
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
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  count: {
    flex: 1,
    fontSize: 12,
  },

  newButton: {
    width: 100,
  },

  clientCard: {
    minHeight: 76,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  clientIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  clientInfo: {
    flex: 1,
  },

  clientName: {
    fontSize: 14,
  },

  clientMeta: {
    fontSize: 11,
    marginTop: 5,
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