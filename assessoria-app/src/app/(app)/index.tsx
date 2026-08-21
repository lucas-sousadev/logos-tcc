import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "expo-router";

export default function Dashboard() {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  
  async function handleLogout() {
    await logout();
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LOGOS</Text>

      <Text style={styles.subtitle}>
        Usuário autenticado
      </Text>

      <Text>Nome: {usuario?.nome}</Text>
      <Text>E-mail: {usuario?.email}</Text>
      <Text>Perfil: {usuario?.perfil}</Text>
      <Text>Assessoria: {usuario?.assessoria_id}</Text>

       <TouchableOpacity
        style={styles.button}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>SAIR</Text>
      </TouchableOpacity>

      {usuario?.perfil === "ASSESSOR" && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/(app)/convites")}
        >
          <Text style={styles.buttonText}>
            CONVITES
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
  },

  subtitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  button: {
    marginTop: 25,
    backgroundColor: "#4D86FF",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },

  buttonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});