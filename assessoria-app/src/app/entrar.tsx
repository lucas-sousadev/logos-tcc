import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from '@/constants/colors';

export default function Entrar() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image source={require("@/assets/images/LOGOS-logo.png")} style={styles.logo} />

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

        <Text style={styles.createText}>
          Ainda não possui uma assessoria? 
        </Text>
      <TouchableOpacity
        onPress={() => router.push("/cadastro")}
      >
        <Text style={styles.assessoriaText}>Clique aqui para criar uma!</Text>
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
  logo: {
    width: 300,
    height: 90,
    alignSelf: "center",
    marginBottom: 40,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
  },

  button: {
    backgroundColor: Colors.corPrincipal,
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
    borderColor: Colors.corPrincipal,
    padding: 13,
    borderRadius: 30,
    marginBottom: 30,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: Colors.corPrincipal,
    fontSize: 18,
    fontWeight: "bold",
  },

  createText: {
    textAlign: "center",
    color: "#161c29",
    fontSize: 15,
  },

  assessoriaText: {
    textAlign: "center",
    fontWeight: "bold",    
    color: Colors.corPrincipal,
    marginTop: 5,
    fontSize: 15,
  },
});