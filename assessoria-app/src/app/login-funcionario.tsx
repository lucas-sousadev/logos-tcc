import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import BackButton from "@/components/ui/BackButton";

export default function LoginFuncionario() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !senha) {
      Alert.alert(
        "Atenção",
        "Informe o e-mail e a senha."
      );
      return;
    }

    try {
      setCarregando(true);

      await login(
        email,
        senha,
        "FUNCIONARIO"
      );

      router.replace("/(app)");
    } catch (error) {
      console.error(
        "Erro no login do funcionário:",
        error
      );

      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível realizar o login."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header} />

      <View style={styles.content}>
        <BackButton />

        <Text style={styles.title}>
          Login - Funcionário
        </Text>

        <Text style={styles.subtitle}>
          Entre na sua conta
        </Text>

        <Text style={styles.label}>
          E-mail
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite seu e-mail"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>
          Senha
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite sua senha"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={carregando}
        >
          <Text style={styles.buttonText}>
            {carregando
              ? "ENTRANDO..."
              : "ENTRAR"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push("/cadastro-funcionario")
          }
        >
          <Text style={styles.link}>
            Ainda não tenho uma conta
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },

  header: {
    height: 180,
    backgroundColor: "#1E5CCB",
  },

  content: {
    flex: 1,
    backgroundColor: "#F4F4F4",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -50,
    paddingHorizontal: 25,
    paddingTop: 50,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    color: "#4D86FF",
    marginBottom: 40,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  button: {
    backgroundColor: "#4D86FF",
    height: 52,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },

  link: {
    textAlign: "center",
    color: "#4D86FF",
    marginTop: 25,
  },
});