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

import {
  ErrosJornalista,
  validarFormularioJornalista,
} from "@/utils/validarMailing";

import VeiculoSelector, {
  SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { criarJornalista } from "@/services/api/jornalista";

export default function FormularioJornalista() {

        const router = useRouter();
        const { theme } = useTheme();

       const [erros, setErros] = useState<ErrosJornalista>({});
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

    function limparErro(
      campo: keyof ErrosJornalista
    ) {
      setErros((atual) => ({
        ...atual,
        [campo]: undefined,
      }));

      setErroGeral("");
    }

    function exibirErroDaApi(mensagemOriginal: string) {
      const mensagem = mensagemOriginal;

      const texto = mensagem.toLocaleLowerCase();

      let campo: keyof ErrosJornalista | null = null;

      if (texto.includes("veículo")) {
        campo = "veiculo";
      } else if (
        texto.includes("e-mail") ||
        texto.includes("email")
      ) {
        campo = "email";
      } else if (texto.includes("telefone")) {
        campo = "telefone";
      } else if (texto.includes("cargo")) {
        campo = "cargo";
      } else if (texto.includes("estado")) {
        campo = "estado";
      } else if (texto.includes("cidade")) {
        campo = "cidade";
      } else if (texto.includes("observações")) {
        campo = "observacoes";
      } else if (texto.includes("nome")) {
        campo = "nome";
      }

      if (campo) {
        setErros({ [campo]: mensagem });
        return;
      }

      setErroGeral(mensagem);
    }

    async function cadastrar() {
        const nomeFormatado = nome.trim();
        const emailFormatado = email.trim();

        const errosValidacao =
          validarFormularioJornalista({
            nome,
            email,
            telefone,
            cargo,
            estado,
            cidade,
            observacoes,
            veiculoId: veiculo.id,
            veiculoNome: veiculo.nome,
          });

        setErros(errosValidacao);
        setErroGeral("");

        if (Object.keys(errosValidacao).length > 0) {
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
            "Erro ao cadastrar contato:",
            error
            );

            const mensagem =
              error instanceof Error
                ? error.message
                : "Não foi possível cadastrar o contato.";

            exibirErroDaApi(mensagem);
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
        title="Novo contato"
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
            CADASTRAR CONTATO
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
          DADOS DO CONTATO
        </Text>

        <Input
            label="NOME *"
            value={nome}
            onChangeText={(texto) => {
                setNome(texto);
                limparErro("nome");
            }}
            placeholder="Nome do contato"
            autoCapitalize="words"
            error={erros.nome}
        />

        <Input
            label="E-MAIL *"
            value={email}
            onChangeText={(texto) => {
                setEmail(texto);
                limparErro("email");
            }}
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={erros.email}
        />

        <Input
          label="TELEFONE"
          value={telefone}
          onChangeText={(texto) => {
            setTelefone(texto);
            limparErro("telefone");
          }}
          placeholder="Ex: (11) 00000-0000"
          keyboardType="phone-pad"
          error={erros.telefone}

        />

        <Input
          label="CARGO"
          value={cargo}
          onChangeText={(texto) => {
            setCargo(texto);
            limparErro("cargo");
          }}
          placeholder="Ex.: Repórter"
          autoCapitalize="words"
          error={erros.cargo}
        />

        <Input
          label="ESTADO"
          value={estado}
          onChangeText={(texto) => {
            setEstado(texto);
            limparErro("estado");
          }}
          placeholder="Ex.: São Paulo"
          autoCapitalize="words"
          error={erros.estado}

        />

        <Input
          label="CIDADE"
          value={cidade}
          onChangeText={(texto) => {
            setCidade(texto);
            limparErro("cidade");
          }}
          placeholder="Ex.: Campinas"
          autoCapitalize="words"
          error={erros.cidade}
        />

        <Input
          label="OBSERVAÇÕES"
          value={observacoes}
          onChangeText={(texto) => {
            setObservacoes(texto);
            limparErro("observacoes");
          }}
          placeholder="Informações adicionais"
          multiline
          textAlignVertical="top"
          style={styles.textArea}
          error={erros.observacoes}
        />

        <VeiculoSelector
          value={veiculo}
          onChange={(selecao) => {
            setVeiculo(selecao);
            limparErro("veiculo");
          }}
          error={erros.veiculo}
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
