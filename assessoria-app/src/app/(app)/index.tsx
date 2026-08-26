import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import Header from "../../components/layout/Header";
import { useAuth } from "../../contexts/AuthContext";
import { Colors } from "@/constants/colors";

export default function Dashboard() {
  const router = useRouter();

  const { usuario, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionTitle}>
          Visão geral
        </Text>

        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardNumber}>
              0
            </Text>

            <Text style={styles.cardLabel}>
              Releases
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardNumber}>
              0
            </Text>

            <Text style={styles.cardLabel}>
              Clippings
            </Text>
          </View>
        </View>

        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardNumber}>
              0
            </Text>

            <Text style={styles.cardLabel}>
              Jornalistas
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardNumber}>
              0
            </Text>

            <Text style={styles.cardLabel}>
              Clientes
            </Text>
          </View>
        </View>

        {usuario?.perfil === "ASSESSOR" && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push("/(app)/convites")
            }
          >
            <Text style={styles.secondaryButtonText}>
              GERENCIAR CONVITES
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
        >
          <Text style={styles.logoutText}>
            SAIR
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },

  content: {
    padding: 20,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
    color: "#222",
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
    backgroundColor: "#FFF",
    borderRadius: 16,
    justifyContent: "center",
  },

  cardNumber: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.corSecundaria,
  },

  cardLabel: {
    fontSize: 14,
    color: Colors.cinzaClaro,
    marginTop: 5,
  },

  secondaryButton: {
    marginTop: 20,
    height: 50,
    borderWidth: 1.5,
    borderColor: Colors.corTerciaria,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryButtonText: {
    color: Colors.corTerciaria,
    fontWeight: "700",
  },

  logoutButton: {
    marginTop: 30,
    height: 50,

    borderRadius: 25,
    backgroundColor: "#E74C3C",

    justifyContent: "center",
    alignItems: "center",
  },

  logoutText: {
    color: "#FFF",
    fontWeight: "700",
  },
});