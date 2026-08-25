import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import Header from "@/components/layout/Header";
import { Colors } from "@/constants/colors";

export default function Relatorios() {
  return (
    <View style={styles.container}>
      <Header title="Relatórios" />

      <View style={styles.content}>
        <Text style={styles.title}>
          Relatórios
        </Text>

        <Text style={styles.text}>
          Geração e gerenciamento de relatórios.
        </Text>
      </View>
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

  title: {
    fontSize: 24,
    fontWeight: "700",
  },

  text: {
    color: Colors.cinzaClaro,
    marginTop: 8,
  },
});