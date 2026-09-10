import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  Image
} from "react-native";
import { useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import Text from "@/components/ui/Text";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";
import { validarSenha } from "@/utils/validarSenha";
import { cnpjValido } from "@/utils/validarCliente";

type CampoCadastroAssessoria =
  | "assessoriaNome"
  | "assessoriaEmail"
  | "cnpj"
  | "telefone"
  | "assessorNome"
  | "assessorEmail"
  | "assessorTelefone"
  | "senha";

type ErrosCadastroAssessoria = Partial<
  Record<CampoCadastroAssessoria, string>
>;

export default function Cadastro() {
  const {theme, mode} = useTheme();
  const { registerAssessoria } = useAuth();
  const [assessoriaNome, setAssessoriaNome] = useState("");
  const [assessoriaEmail, setAssessoriaEmail] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");

  const [assessorNome, setAssessorNome] = useState("");
  const [assessorEmail, setAssessorEmail] = useState("");
  const [assessorTelefone, setAssessorTelefone] = useState("");

  const [senha, setSenha] = useState("");

  const [erros, setErros] = useState<ErrosCadastroAssessoria>({});
  const [erroGeral, setErroGeral] = useState("");

  const [carregando, setCarregando] = useState(false);

  function limparErro(
    campo: CampoCadastroAssessoria
  ) {
    setErros((atuais) => ({
      ...atuais,
      [campo]: undefined,
    }));
  }

  function validarTelefone(
    valor: string
  ): string | null {
    if (!valor.trim()) {
      return null;
    }

    const telefoneNumerico =
      valor.replace(/\D/g, "");

    if (!/^\d{10,11}$/.test(telefoneNumerico)) {
      return "O telefone deve possuir 10 ou 11 dígitos.";
    }

    return null;
  }

  function mostrarErroApi(mensagem: string) {
    const texto = mensagem.toLowerCase();

    let campo: CampoCadastroAssessoria | null = null;

    if (texto.includes("cnpj")) {
      campo = "cnpj";
    } else if (texto.includes("telefone do assessor")) {
      campo = "assessorTelefone";
    } else if (texto.includes("telefone")) {
      campo = "telefone";
    } else if (texto.includes("e-mail do assessor")) {
      campo = "assessorEmail";
    } else if (texto.includes("e-mail da assessoria")) {
      campo = "assessoriaEmail";
    } else if (texto.includes("e-mail") && texto.includes("cadastrado")) {
      campo = "assessorEmail";
    } else if (texto.includes("senha")) {
      campo = "senha";
    }

    if (campo) {
      setErros({
        [campo]: mensagem,
      });
    } else {
      setErroGeral(mensagem);
    }
  }

  async function handleCadastro() {
    setErroGeral("");

    const novosErros: ErrosCadastroAssessoria = {};

    if (!assessoriaNome.trim()) {
      novosErros.assessoriaNome =
        "Informe o nome da assessoria.";
    }

    const emailAssessoria = assessoriaEmail.trim();

    if (
      emailAssessoria &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailAssessoria
      )
    ) {
      novosErros.assessoriaEmail =
        "Informe um e-mail válido.";
    }

    if (cnpj.trim() && !cnpjValido(cnpj)) {
      novosErros.cnpj =
        "Informe um CNPJ válido.";
    }

    const erroTelefoneAssessoria =
      validarTelefone(telefone);

    if (erroTelefoneAssessoria) {
      novosErros.telefone =
        erroTelefoneAssessoria;
    }

    if (!assessorNome.trim()) {
      novosErros.assessorNome =
        "Informe o nome do assessor.";
    }

    const emailAssessor = assessorEmail.trim();

    if (!emailAssessor) {
      novosErros.assessorEmail =
        "Informe o e-mail do assessor.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailAssessor
      )
    ) {
      novosErros.assessorEmail =
        "Informe um e-mail válido.";
    }

    const erroTelefoneAssessor =
      validarTelefone(assessorTelefone);

    if (erroTelefoneAssessor) {
      novosErros.assessorTelefone =
        erroTelefoneAssessor;
    }

    if (!senha) {
      novosErros.senha = "Informe uma senha.";
    } else {
      const erroSenha = validarSenha(senha);

      if (erroSenha) {
        novosErros.senha = erroSenha;
      }
    }

    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
      return;
    }

    try {
      setCarregando(true);

      const data = await registerAssessoria({
        assessoria_nome: assessoriaNome.trim(),
        assessoria_email: emailAssessoria,
        cnpj: cnpj.trim(),
        telefone: telefone.trim(),
        assessor_nome: assessorNome.trim(),
        assessor_email: emailAssessor,
        assessor_telefone: assessorTelefone.trim(),
        senha,
      });

      console.log("Assessoria criada:", data);
      console.log("JWT salvo:", data.token);
      console.log("Usuário:", data.usuario);

      Alert.alert(
        "Cadastro realizado com sucesso!",
        "Entre como assessor para se conectar à sua assessoria."
      );
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível criar a assessoria.";

      mostrarErroApi(mensagem);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
       <Image
          source={
            mode === "light"
            ? require("@/assets/images/background-logos-white.png")
            : require("@/assets/images/background-logos-dark.png")
          }
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      <BackButton />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          weight="SemiBold"
          style={styles.title}
        >
          Criar assessoria
        </Text>

        <View style={styles.sectionContainer}>
            <Text
              weight="SemiBold"
              style={[
                styles.section,
                {
                  color: theme.texto,
                  borderBottomColor: theme.backgroundContainer,
                },
              ]}
            >
              Dados da assessoria
            </Text>
        </View>

        <Input
          label="Nome da assessoria *"
          placeholder="Digite o nome da assessoria"
          value={assessoriaNome}
          onChangeText={(texto) => {
            setAssessoriaNome(texto);
            limparErro("assessoriaNome");
          }}
          error={erros.assessoriaNome}
          clearable
        />

        <Input
          label="E-mail da assessoria"
          placeholder="Digite o e-mail da assessoria"
          keyboardType="email-address"
          autoCorrect={false}
          autoCapitalize="none"
          value={assessoriaEmail}
          onChangeText={(texto) => {
            setAssessoriaEmail(texto);
            limparErro("assessoriaEmail");
          }}
          error={erros.assessoriaEmail}
          clearable
        />

        <Input
          label="CNPJ"
          placeholder="Digite o CNPJ"
          keyboardType="numeric"
          value={cnpj}
          onChangeText={(texto) => {
            setCnpj(texto);
            limparErro("cnpj");
          }}
          error={erros.cnpj}
          clearable
        />

        <Input
          label="Telefone"
          placeholder="Digite o telefone"
          keyboardType="phone-pad"
          value={telefone}
          onChangeText={(texto) => {
            setTelefone(texto);
            limparErro("telefone");
          }}
          error={erros.telefone}
          clearable
        />

         <View style={styles.sectionContainer}>
            <Text
              weight="SemiBold"
              style={[
                styles.section,
                {
                  color: theme.texto,
                  borderBottomColor: theme.backgroundContainer,
                }, 
              ]}
            >
              Dados do assessor
            </Text>
        </View>

        <Input
          label="Nome do assessor *"
          placeholder="Digite o nome do assessor"
          value={assessorNome}
          onChangeText={(texto) => {
            setAssessorNome(texto);
            limparErro("assessorNome");
          }}
          error={erros.assessorNome}
          clearable
        />

        <Input
          label="E-mail do assessor *"
          placeholder="Digite o e-mail do assessor"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={assessorEmail}
          onChangeText={(texto) => {
            setAssessorEmail(texto);
            limparErro("assessorEmail");
          }}
          error={erros.assessorEmail}
          clearable
        />

        <Input
          label="Senha *"
          placeholder="Digite uma senha"
          secureTextEntry
          value={senha}
          onChangeText={(texto) => {
            setSenha(texto);
            limparErro("senha");
          }}
          error={erros.senha}
          clearable
          showPasswordToggle
        />

        <Input
          label="Telefone do assessor"
          placeholder="Digite o telefone do assessor"
          keyboardType="phone-pad"
          value={assessorTelefone}
          onChangeText={(texto) => {
            setAssessorTelefone(texto);
            limparErro("assessorTelefone");
          }}
          error={erros.assessorTelefone}
          clearable
        />

        {erroGeral ? (
          <Text
            weight="Medium"
            style={styles.erro}
          >
            {erroGeral}
          </Text>
        ) : null}

        <Button
          title="CRIAR ASSESSORIA"
          loading={carregando}
          onPress={handleCadastro}
          style={styles.button}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
   screen: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    
    paddingHorizontal: 25,
    paddingTop: 100,
    paddingBottom: 30,
  },
  backgroundImage: {
  ...StyleSheet.absoluteFill,
  width: "100%",
  height: "100%",
},
  title: {
    fontSize: 30,
    marginBottom: 30,
    justifyContent: "center",
    textAlign: "center",
  },

  sectionContainer: {
  alignSelf: "flex-start",
  },

  section: {
    fontSize: 20,
    marginTop: 15,
    marginBottom: 15,
    paddingBottom: 5,
    borderBottomWidth: 1.5,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,

    paddingHorizontal: 15,
    marginBottom: 15,
  },
  erro:{
    textAlign: "center",
    color: "red",
  },
  button: {
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
  },

  buttonText: {
    fontSize: 17,
  },
});