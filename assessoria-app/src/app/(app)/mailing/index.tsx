import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useState, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import MailingFilterModal from "@/components/ui/Filtros/MailingFilterModal";
import type {
  FiltrosMailing,
} from "@/components/ui/Filtros/MailingFilterModal";

import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

import { Jornalista, listarJornalistas } from "@/services/api/jornalista";

export default function Mailing() {
  const router = useRouter();
  const { theme } = useTheme();
  
  const {
    usuario, temPermissao
  } = useAuth();


  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");

  const [jornalistas, setJornalistas] =
    useState<Jornalista[]>([]);

  const [filtrosAberto, setFiltrosAberto] = useState(false);

  const [filtros, setFiltros] =
    useState<FiltrosMailing>({
      estado: "",
      cidade: "",
      cargo: "",
      ativo: 1,
    });

  const [carregando, setCarregando] =
    useState(true);

  const [carregandoMais, setCarregandoMais] =
    useState(false);

  const [pagina, setPagina] = useState(1);

  const [temMais, setTemMais] =
    useState(false);

  const [total, setTotal] = useState(0);
  

  const carregarJornalistas = useCallback(
  async (reset = false) => {
    try {
      if (reset) {
        setCarregando(true);
        setPagina(1);
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
          busca: buscaAplicada,
          estado: filtros.estado,
          cidade: filtros.cidade,
          cargo: filtros.cargo,
          veiculo_id: filtros.veiculoId,
          ativo: filtros.ativo,
        });

      if (reset) {
        setJornalistas(resposta.jornalistas);
      } else {
        setJornalistas((atual) => [
          ...atual,
          ...resposta.jornalistas,
        ]);
      }

      setPagina(paginaAtual);

      setTotal(
        resposta.pagination.total
      );

      setTemMais(
        resposta.pagination.has_next
      );
    } catch (error) {
      console.error(
        "Erro ao carregar mailing:",
        error
      );
    } finally {
      setCarregando(false);
      setCarregandoMais(false);
    }
  },
  [
    pagina,
    buscaAplicada,
    filtros,
  ]
); 

  useFocusEffect(
    useCallback(() => {
      carregarJornalistas(true);
    }, [
      carregarJornalistas,
    ])
  );

  function realizarBusca() {
    setBuscaAplicada(
      busca.trim()
    );
  }

  function abrirFiltros() {
    setFiltrosAberto(true);
  }

  function aplicarFiltros(
    novosFiltros: FiltrosMailing
  ) {
    setPagina(1);
    setFiltros(novosFiltros);
    setFiltrosAberto(false);
  }

  function filtrosAtivos() {
    return Boolean(
      filtros.estado ||
      filtros.cidade ||
      filtros.cargo ||
      filtros.veiculoId ||
      filtros.ativo !== 1
    );
  }

  if (carregando) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor:
              theme.background,
          },
        ]}
      >
        <Header title="Mailing" />

        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            theme.background,
        },
      ]}
    >
      <Header title="Mailing" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar contatos, e-mail..."
          onSearch={realizarBusca}
          onFilterPress={abrirFiltros}
          filterActive={filtrosAtivos()}
          onClear={() => setBuscaAplicada("")}
        />

        <View style={styles.topRow}>
          <Text
            weight="Medium"
            style={[
              styles.count,
              {
                color: theme.textoSub,
              },
            ]}
          >
            {total} contatos
          </Text>

          {temPermissao("MAILING", "CRIAR") && (
            <Button
              title="NOVO"
              size="small"
              onPress={() =>
                router.push(
                  "/mailing/formulario"
                )
              }
              style={styles.newButton}
            />
          )}
        </View>

        {jornalistas.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                borderColor:
                  theme.borda,
              },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={34}
              color={theme.textoSub}
            />

            <Text
              weight="SemiBold"
              style={styles.emptyTitle}
            >
              Nenhum contato encontrado
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    theme.textoSub,
                },
              ]}
            >
              Tente alterar a busca ou os filtros.
            </Text>
          </View>
        ) : (
          jornalistas.map((jornalista) => (
            <TouchableOpacity
              key={jornalista.id}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname:
                    "/mailing/[id]",
                  params: {
                    id:
                      jornalista.id.toString(),
                  },
                })
              }
              style={[
                styles.item,
                {
                  backgroundColor:
                    theme.background,
                  borderColor:
                    theme.borda,
                },
              ]}
            >
              <View style={styles.itemMain}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        theme
                          .backgroundContainer,
                    },
                  ]}
                >
                  <Text
                    weight="Bold"
                    style={{
                      color:
                        theme
                          .textoContainer,
                    }}
                  >
                    {jornalista.nome
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View
                  style={styles.itemInfo}
                >
                  <Text
                    weight="SemiBold"
                    style={
                      styles.itemName
                    }
                  >
                    {jornalista.nome}
                  </Text>

                  <Text
                    style={[
                      styles.itemEmail,
                      {
                        color:
                          theme.textoSub,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {jornalista.email}
                  </Text>

                  <Text
                    style={[
                      styles.itemMeta,
                      {
                        color:
                          theme.texto,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {[
                      jornalista.cargo,
                      jornalista.cidade &&
                        jornalista.estado
                        ? `${jornalista.cidade} - ${jornalista.estado}`
                        : jornalista.cidade ||
                          jornalista.estado,
                      jornalista.veiculo_nome,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward-outline"
                  size={21}
                  color={theme.texto}
                />
              </View>
            </TouchableOpacity>
          ))
        )}

        {temMais && (
          <Button
            title="CARREGAR MAIS"
            variant="outline"
            loading={carregandoMais}
            onPress={() =>
              carregarJornalistas(false)
            }
            style={styles.moreButton}
          />
        )}
      </ScrollView>
      <MailingFilterModal
        visible={filtrosAberto}
        filtros={filtros}
        onClose={() => setFiltrosAberto(false)}
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
    marginBottom: 12,
  },

  count: {
    fontSize: 13,
  },

  newButton: {
    width: 85,
  },

  item: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },

  itemMain: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 23,

    justifyContent: "center",
    alignItems: "center",
  },

  itemInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  itemName: {
    fontSize: 16,
  },

  itemEmail: {
    fontSize: 12,
    marginTop: 2,
  },

  itemMeta: {
    fontSize: 12,
    marginTop: 5,
  },

  empty: {
    minHeight: 220,
    borderWidth: 1.5,
    borderRadius: 16,

    justifyContent: "center",
    alignItems: "center",

    padding: 25,
    marginTop: 10,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
  },

  emptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 13,
  },

  moreButton: {
    marginTop: 8,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});