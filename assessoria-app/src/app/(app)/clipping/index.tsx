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
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AnoClipping,
  listarClippingAnos,
} from "@/services/api/clipping";

export default function Clipping() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [anos, setAnos] = useState<AnoClipping[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const anoAtual = new Date().getFullYear();

  const carregarAnos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await listarClippingAnos();

      const possuiAnoAtual = resposta.anos.some(
        (item) => item.ano_referencia === anoAtual
      );

      const lista = possuiAnoAtual
        ? resposta.anos
        : [
            {
              ano_referencia: anoAtual,
              total_clippings: 0,
              total_clientes: 0,
            },
            ...resposta.anos,
          ];

      setAnos(
        [...lista].sort((a, b) => {
          const aAtual = a.ano_referencia === anoAtual;
          const bAtual = b.ano_referencia === anoAtual;

          if (aAtual !== bAtual) {
            return aAtual ? -1 : 1;
          }

          return b.ano_referencia - a.ano_referencia;
        })
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os anos."
      );
    } finally {
      setCarregando(false);
    }
  }, [anoAtual]);

  useFocusEffect(
    useCallback(() => {
      void carregarAnos();
    }, [carregarAnos])
  );

  function abrirAno(ano: number) {
    router.push({
      pathname: "/clipping/ano",
      params: {
        ano: String(ano),
      },
    });
  }

  function novoClipping() {
    router.push({
      pathname: "/clipping/novo",
      params: {
        ano: String(anoAtual),
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
      <Header title="Clipping" />

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
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>

              <Text
                style={[
                  styles.subtitle,
                  { color: theme.textoSub },
                ]}
              >
                Escolha o ano para acessar os clientes e publicações.
              </Text>
            </View>

            {temPermissao("CLIPPING", "CRIAR") ? (
              <Button
                title="CLIPPING RÁPIDO"
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
                {
                  borderColor: theme.borda,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color="#EF4444"
              />

              <Text style={styles.errorText}>
                {erro}
              </Text>

              <Button
                title="TENTAR NOVAMENTE"
                size="small"
                onPress={() => void carregarAnos()}
              />
            </View>
          ) : null}

          {anos.map((item) => (
            <TouchableOpacity
              key={item.ano_referencia}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityHint="Abrir os clientes e publicações deste ano"
              onPress={() => abrirAno(item.ano_referencia)}
              style={[
                styles.yearCard,
                {
                  borderColor: theme.borda,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <View style={styles.yearHeader}>
                <Text
                  weight="Bold"
                  style={[styles.yearText, {color: theme.textoTerciaria}]}
                >
                  {item.ano_referencia}
                </Text>

                <View style={styles.yearHeaderRight}>
                  {item.ano_referencia === anoAtual ? (
                    <Text
                      weight="SemiBold"
                      style={[
                        styles.yearBadge,
                        {
                          color: theme.textoTerciaria,
                          backgroundColor: theme.borda + "18",
                        },
                      ]}
                    >
                      Ano atual
                    </Text>
                  ) : null}

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.textoSub}
                    accessible={false}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.yearStats,
                  { borderTopColor: theme.borda + "40" },
                ]}
              >
                <View style={styles.yearStat}>
                  <Text
                    weight="SemiBold"
                    style={styles.yearStatNumber}
                  >
                    {item.total_clippings.toLocaleString("pt-BR")}
                  </Text>

                  <Text
                    style={[
                      styles.yearStatLabel,
                      { color: theme.textoSub },
                    ]}
                  >
                    {item.total_clippings === 1
                      ? "publicação"
                      : "publicações"}
                  </Text>
                </View>

                <View style={styles.yearStat}>
                  <Text
                    weight="SemiBold"
                    style={styles.yearStatNumber}
                  >
                    {item.total_clientes.toLocaleString("pt-BR")}
                  </Text>

                  <Text
                    style={[
                      styles.yearStatLabel,
                      { color: theme.textoSub },
                    ]}
                  >
                    {item.total_clientes === 1
                      ? "cliente com publicações"
                      : "clientes com publicações"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {anos.length === 0 ? (
            <View
              style={[
                styles.empty,
                { borderColor: theme.borda },
              ]}
            >
              <Text weight="SemiBold">
                Nenhum ano disponível
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  { color: theme.textoSub },
                ]}
              >
                Crie o primeiro clipping para iniciar o agrupamento.
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },

  headerInfo: {
    flex: 1,
  },

  title: {
    fontSize: 19,
  },

  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  newButton: {
    width: 120,
    padding: 10
  },

  yearCard: {
    minHeight: 150,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  yearHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 8,
  },

  yearHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  yearText: {
    fontSize: 28,
    lineHeight: 34,
  },

  yearBadge: {
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  yearStats: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },

  yearStat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  yearStatNumber: {
    fontSize: 22,
    lineHeight: 28,
  },

  yearStatLabel: {
    fontSize: 12,
    lineHeight: 18,
  },

  empty: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 24,
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
    marginVertical: 10,
  },
});