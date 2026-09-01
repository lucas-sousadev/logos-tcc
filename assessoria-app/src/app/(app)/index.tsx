import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

import { Funcionario, getToken } from "@/services/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function Dashboard() {
  const router = useRouter();

  const { theme } = useTheme();
  
  const {
    usuario,
    listarFuncionarios,
  } = useAuth();

  const [funcionarios, setFuncionarios] =
    useState<Funcionario[]>([]);

  useEffect(() => {
    async function carregarFuncionarios() {
      if (usuario?.perfil !== "ASSESSOR") {
        return;
      }

      try {
        const dados = await listarFuncionarios();
        setFuncionarios(dados);
      } catch (error) {
        console.error(
          "Erro ao carregar funcionários:",
          error
        );
      }
    }

    carregarFuncionarios();
  }, [usuario]);

  
  useEffect(() => {
    async function mostrarToken() {
      const token = await getToken();
      console.log("ACCESS TOKEN ATUAL:", token);
      localStorage.getItem("logos_token")
    }

    mostrarToken();
  }, []);
 
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text
          weight="SemiBold"
          style={styles.sectionTitle}
        >
          Visão geral
        </Text>

        <View style={styles.cardsRow}>
          <DashboardCard
            value="0"
            label="Releases"
            icon="newspaper-outline"
          />

          <DashboardCard
            value="0"
            label="Clippings"
            icon="document-outline"
          />
        </View>

        <View style={styles.cardsRow}>
          <DashboardCard
            value="0"
            label="Mailing"
            icon="people-outline"
          />

          <DashboardCard
            value="0"
            label="Clientes"
            icon="business-outline"
          />
        </View>

        {usuario?.perfil === "ASSESSOR" && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              router.push("/funcionarios")
            }
            style={[
              styles.options,
              {
                backgroundColor:
                  theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <View style={styles.optionsContent}>
              <View style={styles.optionInfo}>
                <View
                  style={[
                    styles.optionIcon,
                    {
                      backgroundColor:
                        theme.backgroundContainer,
                    },
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={21}
                    color={theme.textoContainer}
                  />
                </View>

                <View>
                  <Text
                    weight="Bold"
                    style={[
                      styles.optionNumber,
                      {
                        color:
                          theme.textoTerciaria,
                      },
                    ]}
                  >
                    {funcionarios.length}
                  </Text>

                  <Text
                    weight="Medium"
                    style={[
                      styles.optionLabel,
                      {
                        color: theme.texto,
                      },
                    ]}
                  >
                    Funcionários
                  </Text>
                </View>
              </View>

              <Ionicons
                name="arrow-forward-outline"
                size={22}
                color={theme.texto}
              />
            </View>
          </TouchableOpacity>
        )}

        {usuario?.perfil === "ASSESSOR" && (
          <Button
            title="GERENCIAR CONVITES"
            variant="primary"
            onPress={() =>
              router.push("/(app)/convites")
            }
            style={styles.invitesButton}
          />
        )}
      </ScrollView>
    </View>
  );
}

interface DashboardCardProps {
  value: string;
  label: string;
  icon: React.ComponentProps<
    typeof Ionicons
  >["name"];
}

function DashboardCard({
  value,
  label,
  icon,
}: DashboardCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background,
          borderColor: theme.borda,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View
          style={[
            styles.cardIcon,
            {
              backgroundColor:
                theme.backgroundContainer,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={21}
            color={theme.textoContainer}
          />
        </View>
      </View>

      <Text
        weight="Bold"
        style={[
          styles.cardNumber,
          {
            color: theme.textoTerciaria,
          },
        ]}
      >
        {value}
      </Text>

      <Text
        weight="Medium"
        style={styles.cardLabel}
      >
        {label}
      </Text>
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

  sectionTitle: {
    fontSize: 22,
    marginBottom: 18,
  },

  cardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  card: {
    flex: 1,
    minHeight: 135,
    padding: 18,

    borderWidth: 2,
    borderRadius: 16,
  },

  cardTop: {
    marginBottom: 8,
  },

  cardIcon: {
    width: 38,
    height: 38,

    borderRadius: 11,

    justifyContent: "center",
    alignItems: "center",
  },

  cardNumber: {
    fontSize: 30,
    lineHeight: 34,
  },

  cardLabel: {
    fontSize: 14,
    marginTop: 3,
  },

  options: {
    minHeight: 105,

    borderRadius: 16,
    borderWidth: 2,

    padding: 18,
  },

  optionsContent: {
    flex: 1,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  optionInfo: {
    flexDirection: "row",
    alignItems: "center",
  },

  optionIcon: {
    width: 42,
    height: 42,

    borderRadius: 12,

    justifyContent: "center",
    alignItems: "center",

    marginRight: 12,
  },

  optionNumber: {
    fontSize: 27,
    lineHeight: 31,
  },

  optionLabel: {
    fontSize: 14,
    marginTop: 2,
  },

  invitesButton: {
    marginTop: 18,
  },
});