import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

import { useAuth } from "../contexts/AuthContext";
import { Convite } from "../services/auth";
import BackButton from "@/components/ui/BackButton";

export default function CadastroFuncionario() {
    const router = useRouter();

    const {
        validarConvite,
        registerFuncionario,
    } = useAuth();

    const [etapa, setEtapa] = useState<1 | 2>(1);

    const [codigo, setCodigo] = useState("");
    const [convite, setConvite] =
        useState<Convite | null>(null);
    const [erro, setErro] = useState("");

    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [telefone, setTelefone] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] =
        useState("");

    const [carregando, setCarregando] =
        useState(false);

    async function handleValidarConvite() {
        setErro("");

        if (!codigo.trim()) {
            setErro("Digite o código do convite.");
            return;
        }

        try {
            setCarregando(true);

            const conviteValidado =
            await validarConvite(codigo);

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
        if (
        !nome.trim() ||
        !email.trim() ||
        !senha ||
        !confirmarSenha
        ) {
        Alert.alert(
            "Atenção",
            "Preencha todos os campos."
        );
        return;
        }

        if (senha !== confirmarSenha) {
        Alert.alert(
            "Atenção",
            "As senhas não coincidem."
        );
        return;
        }

        try {
        setCarregando(true);

        await registerFuncionario({
            codigo,
            nome: nome.trim(),
            email: email.trim(),
            telefone: telefone.trim(),
            senha,
        });

        router.replace("/(app)");
        } catch (error) {
        Alert.alert(
            "Erro",
            error instanceof Error
            ? error.message
            : "Não foi possível criar a conta."
        );
        } finally {
        setCarregando(false);
        }
    }

  return (
    <View style={styles.container}>
      <BackButton />
      {etapa === 1 ? (
        <>
          <Text style={styles.title}>
            ENTRAR COM CONVITE
          </Text>

          <Text style={styles.subtitle}>
            Informe o código recebido pela sua assessoria.
          </Text>
            {erro ? (
            <Text style={styles.errorText}>
                {erro}
            </Text>
            ) : null}
          <TextInput
            style={styles.input}
            placeholder="LOGOS-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            value={codigo}
            onChangeText={setCodigo}
          />
            
          <TouchableOpacity
            style={styles.button}
            onPress={handleValidarConvite}
            disabled={carregando}
          >
            <Text style={styles.buttonText}>
              {carregando
                ? "VALIDANDO..."
                : "VALIDAR CONVITE"}
            </Text>
          </TouchableOpacity>
                
          <TouchableOpacity
            onPress={() =>
              router.push("/login-funcionario")
            }
          >
            <Text style={styles.link}>
              Já possuo uma conta
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
        <Text style={styles.title}>
            CRIAR CONTA
        </Text>

        <Text style={styles.successText}>
            Convite válido
        </Text>

        <Text style={styles.infoText}>
            Assessoria: {convite?.assessoria_id}
        </Text>

        <Text style={styles.label}>
            Nome
        </Text>

        <TextInput
            style={styles.input}
            placeholder="Seu nome"
            value={nome}
            onChangeText={setNome}
        />

        <Text style={styles.label}>
            E-mail
        </Text>

        <TextInput
            style={styles.input}
            placeholder="Seu e-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>
            Telefone
        </Text>

        <TextInput
            style={styles.input}
            placeholder="Seu telefone"
            keyboardType="phone-pad"
            value={telefone}
            onChangeText={setTelefone}
          />
        <Text style={styles.label}>
            Senha
        </Text>

        <TextInput
            style={styles.input}
            placeholder="Sua senha"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
        />

        <Text style={styles.label}>
            Confirmar senha
        </Text>

        <TextInput
         style={styles.input}
            placeholder="Digite novamente"
            secureTextEntry
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
          />

        <TouchableOpacity
           style={styles.button}
            onPress={handleCadastro}
            disabled={carregando}
          >
        <Text style={styles.buttonText}>
              {carregando
                ? "CRIANDO..."
                : "CRIAR CONTA"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setEtapa(1)}
          >
            <Text style={styles.link}>
              Alterar convite
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#F4F4F4",
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },

  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    height: 50,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
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
    fontSize: 17,
    fontWeight: "bold",
  },

  successText: {
    textAlign: "center",
    color: "#2E8B57",
    fontWeight: "bold",
    marginBottom: 10,
  },

  infoText: {
    textAlign: "center",
    color: "#666",
    marginBottom: 25,
  },

  link: {
    textAlign: "center",
    color: "#4D86FF",
    marginTop: 25,
  },
  errorText: {
    textAlign: "center",
    color: "#FF0000",
    marginBottom: 10,
  },
});