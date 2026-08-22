import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import Header from "@/components/layout/Header";

export default function Clientes() {
  return (
    <View style={styles.container}>
      <Header title="Clientes" />

      <View style={styles.content}>
        <Text style={styles.title}>
          Clientes
        </Text>

        <Text style={styles.text}>
          Gerenciamento de clientes.
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
    color: "#666",
    marginTop: 8,
  },
});