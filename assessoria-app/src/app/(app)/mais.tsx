import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import { useAuth } from "../../contexts/AuthContext";

export default function Mais() {
  const router = useRouter();

  const { usuario } = useAuth();

  return (
    <View style={styles.container}>
      <Header title="Mais" />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            router.push("/clientes")
          }
        >
          <Text style={styles.itemTitle}>
            Clientes
          </Text>

          <Text style={styles.itemDescription}>
            Gerencie os clientes da assessoria.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            router.push("/relatorios")
          }
        >
          <Text style={styles.itemTitle}>
            Relatórios
          </Text>

          <Text style={styles.itemDescription}>
            Gere e consulte relatórios.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            router.push("/veiculos")
          }
        >
          <Text style={styles.itemTitle}>
            Veículos
          </Text>

          <Text style={styles.itemDescription}>
            Gere e consulte informações sobre veículos de comunicação cadastrados.
          </Text>
        </TouchableOpacity>

        {usuario?.perfil === "ASSESSOR" && (
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              router.push("/(app)/convites")
            }
          >
            <Text style={styles.itemTitle}>
              Convites
            </Text>

            <Text style={styles.itemDescription}>
              Convide funcionários para a assessoria.
            </Text>
          </TouchableOpacity>
        )}
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
    gap: 12,
  },

  item: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  itemTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },

  itemDescription: {
    marginTop: 5,
    color: "#666",
  },
});