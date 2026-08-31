import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import { useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import BackButton from "@/components/ui/BackButton";
import Text from "@/components/ui/Text";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Funcionario } from "@/services/auth";

export default function Funcionarios() {
  const router = useRouter();
  const { theme } = useTheme();

  const {
    usuario,
    listarFuncionarios,
  } = useAuth();

  const [funcionarios, setFuncionarios] =
    useState<Funcionario[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  async function carregarFuncionarios() {
    try {
      setCarregando(true);
      setErro("");

      const dados =
        await listarFuncionarios();

      setFuncionarios(dados);
    } catch (error) {
      console.error(
        "Erro ao carregar funcionários:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os funcionários."
      );
    } finally {
      setCarregando(false);
    }
  }

  if (usuario?.perfil !== "ASSESSOR") {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <BackButton />

        <View style={styles.restricted}>
          <Text weight="Bold" style={styles.restrictedTitle}>
            Acesso restrito
          </Text>

          <Text style={styles.restrictedText}>
            Apenas assessores podem gerenciar funcionários.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header title="Funcionários" />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text
          weight="SemiBold"
          style={styles.subtitle}
        >
          Funcionários da sua assessoria
        </Text>

        {carregando ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={theme.primaria}
            />
          </View>
        ) : erro ? (
          <Text
            weight="Medium"
            style={[
              styles.error,
              { color: "#EF4444" },
            ]}
          >
            {erro}
          </Text>
        ) : funcionarios.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={styles.emptyTitle}
            >
              Nenhum funcionário
            </Text>

            <Text style={styles.emptyText}>
              Crie um convite para adicionar um
              funcionário à sua assessoria.
            </Text>
          </View>
        ) : (
          funcionarios.map((funcionario) => (
            <TouchableOpacity
              key={funcionario.id}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                    pathname: "/funcionarios/[id]",
                    params: {
                    id: funcionario.id.toString(),
                    },
                })
                }
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
                    fontSize: 18,
                  }}
                >
                  {funcionario.nome
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.cardContent}>
                <Text
                  weight="SemiBold"
                  style={styles.name}
                >
                  {funcionario.nome}
                </Text>

                <Text style={styles.email}>
                  {funcionario.email}
                </Text>

                <Text
                  weight="Medium"
                  style={[
                    styles.status,
                    {
                      color: funcionario.ativo
                        ? theme.terciaria
                        : "#EF4444",
                    },
                  ]}
                >
                  {funcionario.ativo
                    ? "Ativo"
                    : "Inativo"}
                </Text>
              </View>

              <Text
                weight="Regular"
                style={styles.arrow}
              >
                ›
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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

  subtitle: {
    fontSize: 16,
    marginBottom: 18,
  },

  loading: {
    paddingVertical: 40,
    alignItems: "center",
  },

  card: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 12,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },

  cardContent: {
    flex: 1,
    marginLeft: 12,
  },

  name: {
    fontSize: 17,
  },

  email: {
    fontSize: 13,
    marginTop: 3,
    color: "#808080",
  },

  status: {
    fontSize: 12,
    marginTop: 5,
  },

  arrow: {
    fontSize: 30,
    color: "#808080",
    marginLeft: 8,
  },

  emptyCard: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 25,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 19,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: "center",
    color: "#808080",
    lineHeight: 20,
  },

  error: {
    textAlign: "center",
    lineHeight: 20,
  },

  restricted: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  restrictedTitle: {
    fontSize: 24,
    marginBottom: 8,
  },

  restrictedText: {
    textAlign: "center",
    color: "#808080",
  },
});