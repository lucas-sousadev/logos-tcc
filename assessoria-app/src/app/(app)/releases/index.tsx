import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import Header from "@/components/layout/Header";
import { Colors } from "@/constants/colors";
export default function Releases() {
  return (
    <View style={styles.container}>
      <Header title="Releases" />

      <View style={styles.content}>
        <Text style={styles.title}>
          Releases
        </Text>

        <Text style={styles.text}>
          Gerenciamento e envio de releases.
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