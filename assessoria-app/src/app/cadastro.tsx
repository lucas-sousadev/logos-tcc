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

  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  
  async function handleCadastro() {
    if (
      !assessoriaNome.trim() ||
      !assessorNome.trim() ||
      !assessorEmail.trim() ||
      !senha
    ) {
      setErro("Preencha todos os campos obrigatórios (*).");
      return;
    }

    try {
      setCarregando(true);

      const data = await registerAssessoria({
        assessoria_nome: assessoriaNome.trim(),
        assessoria_email: assessoriaEmail.trim(),
        cnpj: cnpj.trim(),
        telefone: telefone.trim(),
        assessor_nome: assessorNome.trim(),
        assessor_email: assessorEmail.trim(),
        assessor_telefone: assessorTelefone.trim(),
        senha,
      });

      console.log("Assessoria criada:", data);
      console.log("JWT salvo:", data.token);
      console.log("Usuário:", data.usuario);

      /*
      o AuthContext ainda não está sendo atualizado por essa
      função 
      por isso, nesta etapa vamos apenas voltar para a
      entrada depois de confirmar o cadastro.
       */
      Alert.alert(
        "Cadastro realizado com sucesso!",
        "Entre como assessor para se conectar à sua assessoria.",
      );
    } catch (error) {
      console.error("Erro no cadastro:", error);

      setErro(error instanceof Error
          ? error.message
          : "Não foi possível criar a assessoria."
      );
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
          onChangeText={setAssessoriaNome}
          clearable
        />

        <Input
          label="E-mail da assessoria"
          placeholder="Digite o e-mail da assessoria"
          keyboardType="email-address"
          autoCapitalize="none"
          value={assessoriaEmail}
          onChangeText={setAssessoriaEmail}
          clearable
        />

        <Input
          label="CNPJ"
          placeholder="Digite o CNPJ"
          keyboardType="numeric"
          value={cnpj}
          onChangeText={setCnpj}
          clearable
        />

        <Input
          label="Telefone"
          placeholder="Digite o telefone"
          keyboardType="phone-pad"
          value={telefone}
          onChangeText={setTelefone}
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
          onChangeText={setAssessorNome}
          clearable
        />

        <Input
          label="E-mail do assessor *"
          placeholder="Digite o e-mail do assessor"
          keyboardType="email-address"
          autoCapitalize="none"
          value={assessorEmail}
          onChangeText={setAssessorEmail}
          clearable
        />

        <Input
          label="Senha *"
          placeholder="Digite uma senha"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          clearable
          showPasswordToggle
        />

        <Input
          label="Telefone do assessor"
          placeholder="Digite o telefone do assessor"
          keyboardType="phone-pad"
          value={assessorTelefone}
          onChangeText={setAssessorTelefone}
          clearable
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