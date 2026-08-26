import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import BackButton from "@/components/ui/BackButton";
import { Colors } from "../constants/colors";

export default function Cadastro() {
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
       * O AuthContext ainda não está sendo atualizado por essa
       * função. Por isso, nesta etapa vamos apenas voltar para a
       * entrada depois de confirmar o cadastro.
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
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton />
      
      <Text style={styles.title}>Criar assessoria</Text>

      <Text style={styles.section}>Dados da assessoria</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome da assessoria *"
        value={assessoriaNome}
        onChangeText={setAssessoriaNome}
      />

      <TextInput
        style={styles.input}
        placeholder="E-mail da assessoria"
        keyboardType="email-address"
        autoCapitalize="none"
        value={assessoriaEmail}
        onChangeText={setAssessoriaEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="CNPJ"
        value={cnpj}
        onChangeText={setCnpj}
      />

      <TextInput
        style={styles.input}
        placeholder="Telefone"
        keyboardType="phone-pad"
        value={telefone}
        onChangeText={setTelefone}
      />

      <Text style={styles.section}>Dados do assessor</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome do assessor *"
        value={assessorNome}
        onChangeText={setAssessorNome}
      />

      <TextInput
        style={styles.input}
        placeholder="E-mail do assessor *"
        keyboardType="email-address"
        autoCapitalize="none"
        value={assessorEmail}
        onChangeText={setAssessorEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Senha *"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />

      <TextInput
        style={styles.input}
        placeholder="Telefone do assessor"
        keyboardType="phone-pad"
        value={assessorTelefone}
        onChangeText={setAssessorTelefone}
      />
      {erro ? (<Text style={styles.erro}>{erro}</Text>) : null}
      <TouchableOpacity
        style={styles.button}
        onPress={handleCadastro}
        disabled={carregando}
      >
        <Text style={styles.buttonText}>
          {carregando ? "CRIANDO..." : "CRIAR ASSESSORIA"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 25,
    justifyContent: "center",
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },

  section: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    marginTop: 15,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    backgroundColor: "#FFF",
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
    backgroundColor: Colors.corPrincipal,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "bold",
  },
});