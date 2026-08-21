import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

export default function Entrar() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ENTRAR</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.push("/login-assessor")
        }
      >
        <Text style={styles.buttonText}>
          SOU ASSESSOR
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.push("/login-funcionario")
        }
      >
        <Text style={styles.buttonText}>
          SOU FUNCIONÁRIO
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/cadastro-funcionario")}
      >
        <Text style={styles.secondaryButtonText}>
          TENHO UM CONVITE
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/cadastro")}
      >
        <Text style={styles.createText}>
          Ainda não possui uma assessoria? Criar assessoria
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
  },

  button: {
    backgroundColor: "#4D86FF",
    padding: 15,
    borderRadius: 30,
    marginBottom: 20,
    alignItems: "center",
  },

  buttonText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },

  secondaryButton: {
    borderWidth: 2,
    borderColor: "#4D86FF",
    padding: 13,
    borderRadius: 30,
    marginBottom: 30,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#4D86FF",
    fontSize: 18,
    fontWeight: "bold",
  },

  createText: {
    textAlign: "center",
    color: "#4D86FF",
  },
});