import {
  StyleSheet,
  TouchableOpacity,
  View,
  Image
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import BackButton from "@/components/ui/BackButton";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginAssessor() {
  const router = useRouter();

  const { theme, mode, toggleTheme } = useTheme();
  const { login, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleLogin() {
    if (!email.trim() || !senha) {
      setErro("Informe o e-mail e a senha.");
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      await login(
        email,
        senha,
        "ASSESSOR"
      );

      router.replace("/(app)");
    } catch (error) {
      console.error(
        "Erro no login do assessor:",
        error
      );

      await logout();

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível realizar o login."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >     
      <BackButton
        />
      
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.backgroundContainer,
          },
        ]}
      />
        <Image
            source={
              mode === "light"
                ? require("@/assets/images/background-logos-white.png")
                : require("@/assets/images/background-logos-dark.png")
            }
            style={styles.backgroundImage}
            resizeMode="cover"
          />
     
        
        <Text
          weight="Medium"
          style={styles.title}
        >
          Login - Assessor
        </Text>

        <Text
          weight="Regular"
          style={[
            styles.subtitle,
            {
              color: theme.textoTerciaria,
            },
          ]}
        >
          Entre na sua conta!
        </Text>

        
        <Input
          label="E-mail"
          placeholder="Digite seu e-mail"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          clearable
        />

        <Input
          label="Senha"
          placeholder="Digite sua senha"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          clearable
          showPasswordToggle
        />

        {erro ? (
          <Text
            weight="Medium"
            style={styles.erro}
          >
            {erro}
          </Text>
        ) : null}

        <Button
          title="ENTRAR"
          loading={carregando}
          onPress={handleLogin}
          style={styles.loginButton}
        />

        <TouchableOpacity
          onPress={() => router.push("/cadastro")}
          activeOpacity={0.7}
        >
          <Text style={styles.link}>
            Não possui login?{" "}
            <Text
              weight="SemiBold"
              style={{
                color: theme.textoTerciaria,
              }}
            >
              Criar uma nova assessoria
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 25,
  },

  header: {
    height: 240,
  },
  backgroundImage: {
  ...StyleSheet.absoluteFill,
  width: "100%",
  height: "100%",
},

  title: {
    fontSize: 28,
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    marginTop: 5,
    marginBottom: 40,
  },

  label: {
    fontSize: 15,
    marginBottom: 8,
  },

  input: {
    height: 50,
    paddingHorizontal: 15,

    borderWidth: 1.5,
    borderRadius: 12,

    marginBottom: 20,
  },

  loginButton: {
    marginTop: 10,
  },

  link: {
    textAlign: "center",
    marginTop: 25,
  },

  erro: {
    color: "#EF4444",
    marginBottom: 10,
    textAlign: "center",
  },
});