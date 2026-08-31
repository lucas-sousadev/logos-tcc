import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

import { useAuth } from "../contexts/AuthContext";
import { Convite } from "../services/auth";
import { useTheme } from "@/contexts/ThemeContext";

import BackButton from "@/components/ui/BackButton";
import Text from "@/components/ui/Text";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function CadastroFuncionario() {
  const router = useRouter();

  const {
    validarConvite,
    registerFuncionario,
  } = useAuth();

  const { theme, mode } = useTheme();

  const [etapa, setEtapa] = useState<1 | 2>(1);

  const [codigo, setCodigo] = useState("");
  const [convite, setConvite] = useState<Convite | null>(null);
  const [erro, setErro] = useState("");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [carregando, setCarregando] = useState(false);

  async function handleValidarConvite() {
    setErro("");

    if (!codigo.trim()) {
      setErro("Digite o código do convite.");
      return;
    }

    try {
      setCarregando(true);

      const conviteValidado =
        await validarConvite(codigo.trim());

      setConvite(conviteValidado);
      setEtapa(2);
    } catch (error) {
      console.error(
        "Erro ao validar convite:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível validar o convite."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function handleCadastro() {
    setErro("");

    if (
      !nome.trim() ||
      !email.trim() ||
      !senha ||
      !confirmarSenha
    ) {
      setErro(
        "Preencha todos os campos obrigatórios (*)."
      );
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    try {
      setCarregando(true);

      await registerFuncionario({
        codigo: codigo.trim(),
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        senha,
      });

      router.replace("/(app)");
    } catch (error) {
      console.error(
        "Erro ao criar conta:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a conta."
      );
    } finally {
      setCarregando(false);
    }
  }

  function voltar() {
    setErro("");

    if (etapa === 2) {
      setEtapa(1);
      return;
    }

    router.back();
  }

  return (
    <View style={styles.screen}>
      <Image
        source={
          mode === "light"
            ? require("@/assets/images/background-logos-white.png")
            : require("@/assets/images/background-logos-dark.png")
        }
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <BackButton
        onPress={voltar}
        color={theme.textoContainer}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          etapa === 1
            ? styles.containerEtapa1
            : styles.containerEtapa2,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {etapa === 1 ? (
          <View style={styles.formContent}>
            <Text
              weight="SemiBold"
              style={styles.title}
            >
              ENTRAR COM CONVITE
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: theme.textoTerciaria,
                },
              ]}
            >
              Informe o código recebido pela sua
              assessoria.
            </Text>

            <Input
              label="Código do convite"
              placeholder="LOGOS-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              value={codigo}
              onChangeText={setCodigo}
              error={erro}
            />

            <Button
              title="VALIDAR CONVITE"
              loading={carregando}
              onPress={handleValidarConvite}
              style={styles.button}
            />

            <TouchableOpacity
              onPress={() =>
                router.push("/login-funcionario")
              }
              activeOpacity={0.7}
            >
              <Text
                weight="Medium"
                style={[
                  styles.link,
                  {
                    color: theme.textoTerciaria,
                  },
                ]}
              >
                Já possuo uma conta
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContent}>
            <Text
              weight="SemiBold"
              style={styles.title}
            >
              CRIAR CONTA
            </Text>

            <Text
              weight="SemiBold"
              style={[
                styles.successText,
              ]}
            >
              Convite válido
            </Text>

            <Text
              style={[
                styles.infoText,
                {
                  color: theme.textoSub,
                },
              ]}
            >
              Assessoria: {convite?.assessoria_id}
            </Text>

            <Input
              label="Nome *"
              placeholder="Seu nome"
              value={nome}
              onChangeText={setNome}
            />

            <Input
              label="E-mail *"
              placeholder="Seu e-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Input
              label="Telefone"
              placeholder="Seu telefone"
              keyboardType="phone-pad"
              value={telefone}
              onChangeText={setTelefone}
            />

            <Input
              label="Senha *"
              placeholder="Sua senha"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />

            <Input
              label="Confirmar senha *"
              placeholder="Confirme sua senha"
              secureTextEntry
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              error={erro}
            />

            <Button
              title="CRIAR CONTA"
              loading={carregando}
              onPress={handleCadastro}
              style={styles.button}
            />

            <TouchableOpacity
              onPress={() => {
                setErro("");
                setEtapa(1);
              }}
              activeOpacity={0.7}
            >
              <Text
                weight="Medium"
                style={[
                  styles.link,
                  {
                    color: theme.textoTerciaria,
                  },
                ]}
              >
                Alterar convite
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },

  scroll: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 100,
    paddingBottom: 40,
  },
  containerEtapa1: {
    justifyContent: "center",
    paddingTop: 40,
  },

  containerEtapa2: {
    paddingTop: 100,
  },

  formContent: {
    width: "100%",
  },

  title: {
    fontSize: 25,
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    textAlign: "center",
    marginBottom: 30,
  },

  successText: {
    color: "green",
    textAlign: "center",
    marginBottom: 10,
  },

  infoText: {
    textAlign: "center",
    marginBottom: 25,
  },

  button: {
    marginTop: 10,
  },

  link: {
    textAlign: "center",
    marginTop: 25,
  },
});