import {
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useState } from "react";
import { useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import VeiculoSelector, {
  SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";

import Text from "@/components/ui/Text";

import { useTheme } from "@/contexts/ThemeContext";

import { criarJornalista } from "@/services/api/jornalista";

export default function FormularioJornalista() {

        const router = useRouter();
        const { theme } = useTheme();

        const [erroNome, setErroNome] = useState("");
        const [erroEmail, setErroEmail] = useState("");
        const [erroGeral, setErroGeral] = useState("");

        const [nome, setNome] = useState("");
        const [email, setEmail] = useState("");
        const [telefone, setTelefone] = useState("");
        const [cargo, setCargo] = useState("");
        const [estado, setEstado] = useState("");
        const [cidade, setCidade] = useState("");
        const [observacoes, setObservacoes] =
            useState("");
        const [veiculo, setVeiculo] =
            useState<SelecaoVeiculo>({
              id: null,
              nome: "",
            });

  const [salvando, setSalvando] =
    useState(false);

    async function cadastrar() {
        const nomeFormatado = nome.trim();
        const emailFormatado = email.trim();

        setErroNome("");
        setErroEmail("");
        setErroGeral("");

        let possuiErro = false;

        if (!nomeFormatado) {
            setErroNome(
            "Informe o nome do jornalista."
            );
            possuiErro = true;
        }

        if (!emailFormatado) {
            setErroEmail(
            "Informe o e-mail do jornalista."
            );
            possuiErro = true;
        } else {
            const emailValido =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                emailFormatado
            );

            if (!emailValido) {
            setErroEmail(
                "Informe um e-mail válido."
            );
            possuiErro = true;
            }
        }

        if (possuiErro) {
            return;
        }

        try {
            setSalvando(true);

            await criarJornalista({
            nome: nomeFormatado,
            email: emailFormatado,
            telefone:
                telefone.trim() || undefined,
            cargo:
                cargo.trim() || undefined,
            estado:
                estado.trim() || undefined,
            cidade:
                cidade.trim() || undefined,
            observacoes:
                observacoes.trim() || undefined,
            veiculo_id: veiculo.id ?? undefined,
            veiculo_nome:
                veiculo.id === null
                  ? veiculo.nome.trim() || undefined
                  : undefined,
            });

            router.replace("/mailing");
        } catch (error) {
            console.error(
            "Erro ao cadastrar jornalista:",
            error
            );

            setErroGeral(
            error instanceof Error
                ? error.message 
                : "Não foi possível cadastrar o jornalista."
            );
        } finally {
            setSalvando(false);
        }
    }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            theme.background,
        },
      ]}
    >
      <Header
        title="Novo jornalista"
        showBackButton
        onBackPress={() => router.replace("/mailing")}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.intro,
            {
              borderColor: theme.borda,
            },
          ]}
        >
          <Text
            weight="Bold"
            style={styles.introTitle}
          >
            CADASTRAR JORNALISTA
          </Text>

          <Text
            style={[
                styles.introText,
                {
                color: theme.textoSub,
                },
            ]}
            >
            Adicione um novo contato ao mailing
            da assessoria. Campos marcados com * são obrigatórios.
            </Text>
        </View>

        <Text
          weight="Bold"
          style={styles.sectionTitle}
        >
          DADOS DO JORNALISTA
        </Text>

        <Input
            label="NOME *"
            value={nome}
            onChangeText={(texto) => {
                setNome(texto);
                if (erroNome) setErroNome("");
            }}
            placeholder="Nome do jornalista"
            autoCapitalize="words"
            error={erroNome}
        />

        <Input
            label="E-MAIL *"
            value={email}
            onChangeText={(texto) => {
                setEmail(texto);
                if (erroEmail) setErroEmail("");
            }}
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={erroEmail}
        />

        <Input
          label="TELEFONE"
          value={telefone}
          onChangeText={setTelefone}
          placeholder="Ex: (11) 00000-0000"
          keyboardType="phone-pad"
        />

        <Input
          label="CARGO"
          value={cargo}
          onChangeText={setCargo}
          placeholder="Ex.: Repórter"
          autoCapitalize="words"
        />

        <Input
          label="ESTADO"
          value={estado}
          onChangeText={setEstado}
          placeholder="Ex.: São Paulo"
          autoCapitalize="words"
        />

        <Input
          label="CIDADE"
          value={cidade}
          onChangeText={setCidade}
          placeholder="Ex.: Campinas"
          autoCapitalize="words"
        />

        <Input
          label="OBSERVAÇÕES"
          value={observacoes}
          onChangeText={setObservacoes}
          placeholder="Informações adicionais"
          multiline
          textAlignVertical="top"
          style={styles.textArea}
        />

        <VeiculoSelector
          value={veiculo}
          onChange={setVeiculo}
        />

        {erroGeral ? (
        <Text
            weight="Medium"
            style={[
            styles.errorGeral,
            {
                color: "#EF4444",
            },
            ]}
        >
            {erroGeral}
        </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            title="CANCELAR"
            variant="outline"
            onPress={() => router.replace("/mailing")}
            style={styles.actionButton}
          />

          <Button
            title="CADASTRAR"
            loading={salvando}
            onPress={cadastrar}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  intro: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    marginBottom: 25,
  },

  introTitle: {
    fontSize: 17,
  },

  introText: {
    fontSize: 12,
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 14,
  },

  textArea: {
    height: 110,
    paddingTop: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 5,
  },

  actionButton: {
    flex: 1,
  },

  errorGeral: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
    },
});
