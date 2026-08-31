import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";

import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function Mais() {
  const router = useRouter();
  const { theme, mode } = useTheme();
  const { usuario } = useAuth();

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <Header title="Mais" />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity
          style={[styles.item, {borderColor: theme.borda}]}
          onPress={() =>
            router.push("/clientes")
          }
        >
          <Text style={[styles.itemTitle, {color: theme.textoTerciaria}]}>
            Clientes
          </Text>

            <Text style={[styles.itemDescription, {color: theme.texto}]}>
            Gerencie os clientes da assessoria.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.item, {borderColor: theme.borda}]}
          onPress={() =>
            router.push("/relatorios")
          }
        >
          <Text style={[styles.itemTitle, {color: theme.textoTerciaria}]}>
            Relatórios
          </Text>

            <Text style={[styles.itemDescription, {color: theme.texto}]}>
            Gere e consulte relatórios.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.item, {borderColor: theme.borda}]}
          onPress={() =>
            router.push("/veiculos")
          }
        >
          <Text style={[styles.itemTitle, {color: theme.textoTerciaria}]}>
            Veículos
          </Text>

            <Text style={[styles.itemDescription, {color: theme.texto}]}>
            Gere e consulte informações sobre veículos de comunicação cadastrados.
          </Text>
        </TouchableOpacity>

        {usuario?.perfil === "ASSESSOR" && (
          <TouchableOpacity
          style={[styles.item, {borderColor: theme.borda}]}
            onPress={() =>
              router.push("/(app)/convites")
            }
          >
            <Text style={[styles.itemTitle, {color: theme.textoTerciaria}]}>
              Convites
            </Text>

            <Text style={[styles.itemDescription, {color: theme.texto}]}>
              Convide funcionários para a assessoria.
            </Text>
          </TouchableOpacity>
        )}

        {usuario?.perfil === "ASSESSOR" && (
          <TouchableOpacity
          style={[styles.item, {borderColor: theme.borda}]}
            onPress={() =>
              router.push("/funcionarios")
            }
          >
            <Text
              weight="SemiBold"
              style={[styles.itemTitle, {color: theme.textoTerciaria}]}
            >
              Funcionários
            </Text>

            <Text style={[styles.itemDescription, {color: theme.texto}]}>
              Gerencie funcionários e permissões.
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
  },

  content: {
    padding: 20,
    gap: 12,
  },

  item: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
  },

  itemTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  itemDescription: {
    marginTop: 5,
  },
});