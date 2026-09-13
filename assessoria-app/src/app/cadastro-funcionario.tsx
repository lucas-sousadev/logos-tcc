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
import { useTheme } from "@/contexts/ThemeContext";
import BackButton from "@/components/ui/BackButton";
import Text from "@/components/ui/Text";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { validarSenha } from "@/utils/validarSenha";

type CampoCadastro =
  | "codigo"
  | "nome"
  | "email"
  | "telefone"
  | "senha"
  | "confirmarSenha";

type ErrosCadastro = Partial<
  Record<CampoCadastro, string>
>;

export default function CadastroFuncionario() {
  const router = useRouter();

  const {
    validarConvite,
    registerFuncionario,
  } = useAuth();

  const { theme, mode } = useTheme();

  const [etapa, setEtapa] = useState<1 | 2>(1);

  const [codigo, setCodigo] = useState("");
  const [erros, setErros] =
  useState<ErrosCadastro>({});
  const [erroGeral, setErroGeral] = useState("");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [carregando, setCarregando] = useState(false);

  function limparErro(campo: CampoCadastro) {
    setErros((atuais) => ({
      ...atuais,
      [campo]: undefined,
    }));
  }

  async function handleValidarConvite() {
  setErroGeral("");
  setErros({});

  if (!codigo.trim()) {
    setErros({
      codigo: "Digite o código do convite.",
    });

    return;
  }

  try {
    setCarregando(true);

    await validarConvite(codigo.trim());

    setEtapa(2);
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Não foi possível validar o convite.";

    if (mensagem.includes("Muitas tentativas")) {
      setErroGeral(mensagem);
    } else {
      setErros({
        codigo: mensagem,
      });
    }
  } finally {
    setCarregando(false);
  }
}

  async function handleCadastro() {
    setErroGeral("");

    const novosErros: ErrosCadastro = {};

    if (!nome.trim()) {
      novosErros.nome = "Informe seu nome.";
    }

    const emailFormatado = email.trim();

    if (!emailFormatado) {
      novosErros.email = "Informe seu e-mail.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailFormatado
      )
    ) {
      novosErros.email = "Informe um e-mail válido.";
    }

    const telefoneFormatado = telefone.trim();

    if (telefoneFormatado) {
      const telefoneNumerico =
        telefoneFormatado.replace(/\D/g, "");

      if (!/^\d{10,11}$/.test(telefoneNumerico)) {
        novosErros.telefone =
          "O telefone deve possuir 10 ou 11 dígitos.";
      }
    }

    if (!senha) {
      novosErros.senha = "Informe uma senha.";
    } else {
      const erroSenha = validarSenha(senha);

      if (erroSenha) {
        novosErros.senha = erroSenha;
      }
    }

    if (!confirmarSenha) {
      novosErros.confirmarSenha =
        "Confirme sua senha.";
    } else if (senha !== confirmarSenha) {
      novosErros.confirmarSenha =
        "As senhas não coincidem.";
    }

    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
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

      setErroGeral(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a conta."
      );
    } finally {
      setCarregando(false);
    }
  }

  function voltar() {
    setErroGeral("");

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
        color={theme.texto}
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
              onChangeText={(texto) => {
                setCodigo(texto);
                limparErro("codigo");
              }}
              error={erros.codigo}
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
              Agora informe seus dados para criar a conta.
            </Text>

            <Input
              label="Nome *"
              placeholder="Seu nome *"
              value={nome}
              onChangeText={(texto) => {
                setNome(texto);
                limparErro("nome");
              }}
              error={erros.nome}
            />

            <Input
              label="E-mail *"
              placeholder="Seu e-mail *"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(texto) => {
                setEmail(texto);
                limparErro("email");
              }}
              error={erros.email}
            />

            <Input
              label="Telefone"
              placeholder="Ex.: (11) 99999-9999"
              keyboardType="phone-pad"
              value={telefone}
              onChangeText={(texto) => {
                setTelefone(texto);
                limparErro("telefone");
              }}
              error={erros.telefone}
            />

            <Input
              label="Senha *"
              placeholder="Sua senha *"
              secureTextEntry
              clearable
              showPasswordToggle
              value={senha}
              onChangeText={(texto) => {
                setSenha(texto);
                limparErro("senha");
              }}
              error={erros.senha}
            />

            <Input
              label="Confirmar senha *"
              placeholder="Confirme sua senha *"
              secureTextEntry
              clearable
              showPasswordToggle
              value={confirmarSenha}
              onChangeText={(texto) => {
                setConfirmarSenha(texto);
                limparErro("confirmarSenha");
              }}
              error={erros.confirmarSenha}
            />
            
            {erroGeral ? (
              <Text
                weight="Medium"
                style={styles.erroGeral}
              >
                {erroGeral}
              </Text> 
            ) : null}

            <Button
              title="CRIAR CONTA"
              loading={carregando}
              onPress={handleCadastro}
              style={styles.button}
            />

            <TouchableOpacity
              onPress={() => {
                setErroGeral("");
                setErros({});
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
  erroGeral: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },
});