import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { useEffect } from "react";
import { getToken } from "../../services/auth";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/layout/Header";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

export default function Dashboard() {
  const router = useRouter();

  const { theme, mode, toggleTheme } = useTheme();
  const { usuario, logout } = useAuth();
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
        contentContainerStyle={styles.content}
      >
        <Text
          weight="SemiBold"
          style={styles.sectionTitle}
        >
          Visão geral
        </Text>

        <View style={styles.cardsRow}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={[
                styles.cardNumber,
                {
                  color: theme.textoTerciaria,
                },
              ]}
            >
              0
            </Text>

            <Text
              weight="Medium"
              style={styles.cardLabel}
            >
              Releases
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={[
                styles.cardNumber,
                {
                  color: theme.textoTerciaria,
                },
              ]}
            >
              0
            </Text>

            <Text
              weight="Medium"
              style={styles.cardLabel}
            >
              Clippings
            </Text>
          </View>
        </View>

        <View style={styles.cardsRow}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={[
                styles.cardNumber,
                {
                  color: theme.textoTerciaria,
                },
              ]}
            >
              0
            </Text>

            <Text
              weight="Medium"
              style={styles.cardLabel}
            >
              Jornalistas
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={[
                styles.cardNumber,
                {
                  color: theme.textoTerciaria,
                },
              ]}
            >
              0
            </Text>

            <Text
              weight="Medium"
              style={styles.cardLabel}
            >
              Clientes
            </Text>
          </View>
        </View>

        {usuario?.perfil === "ASSESSOR" && (
          <Button
            title="GERENCIAR CONVITES"
            variant="primary"
            style={styles.invitesButton}
            onPress={() =>
              router.push("/(app)/convites")
            }
          />
        )}

        <TouchableOpacity
          onPress={toggleTheme}
          activeOpacity={0.7}
          style={styles.themeButton}
        >
          <Text
            weight="Medium"
            style={[
              styles.themeText,
              {
                color: theme.textoTerciaria,
              },
            ]}
          >
            {mode === "light"
              ? "Ir para modo escuro"
              : "Ir para modo claro"}
          </Text>
        </TouchableOpacity>

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
    minHeight: 120,
    padding: 18,

    borderWidth: 2,
    borderRadius: 16,

    justifyContent: "center",
  },

  cardNumber: {
    fontSize: 30,
  },

  cardLabel: {
    fontSize: 14,
    marginTop: 5,
  },

  invitesButton: {
    marginTop: 20,
  },

  themeButton: {
    alignItems: "center",
    marginTop: 25,
  },

  themeText: {
    fontSize: 14,
  },
  
});