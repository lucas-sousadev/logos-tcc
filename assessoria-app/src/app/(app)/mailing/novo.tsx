import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import SecaoEdicao from "@/components/forms/SecaoEdicao";
import Header from "@/components/layout/Header";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import VeiculoSelector, {
  SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";
import Text from "@/components/ui/Text";

import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import { criarJornalista } from "@/services/api/jornalista";

import {
  ErrosJornalista,
  validarFormularioJornalista,
} from "@/utils/validarMailing";

export default function FormularioJornalista() {
  const insets = useSafeAreaInsets();

  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [erros, setErros] = useState<ErrosJornalista>({});
  const [erroGeral, setErroGeral] = useState("");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [veiculo, setVeiculo] = useState<SelecaoVeiculo>({
    id: null,
    nome: "",
  });

  const [salvando, setSalvando] = useState(false);
  const envioEmCurso = useRef(false);

  const retornar = useRetornoSeguro("/mailing");
  const saida = useSaidaFormulario(
    Boolean(
      nome ||
      email ||
      telefone ||
      cargo ||
      estado ||
      cidade ||
      observacoes ||
      veiculo.id ||
      veiculo.nome
    ),
    salvando
  );

  function limparErro(campo: keyof ErrosJornalista) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));

    setErroGeral("");
  }

  function limparErrosDeContato() {
    setErros((atual) => ({
      ...atual,
      email: undefined,
      telefone: undefined,
    }));

    setErroGeral("");
  }

  function exibirErroDaApi(mensagemOriginal: string) {
    const mensagem = mensagemOriginal;

    const texto = mensagem.toLocaleLowerCase();

    let campo: keyof ErrosJornalista | null = null;

    if (
      texto.includes("e-mail ou telefone") ||
      texto.includes("email ou telefone")
    ) {
      setErros({
        email: mensagem,
        telefone: mensagem,
      });

      return;
    }
    if (texto.includes("veículo")) {
      campo = "veiculo";
    } else if (texto.includes("e-mail") || texto.includes("email")) {
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
    if (envioEmCurso.current) {
      return;
    }

    const nomeFormatado = nome.trim();
    const emailFormatado = email.trim();

    const errosValidacao = validarFormularioJornalista({
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

    if (
      !temPermissao("VEICULOS", "CRIAR") &&
      veiculo.id === null &&
      veiculo.nome.trim()
    ) {
      errosValidacao.veiculo =
        "Selecione um veículo existente. Você não possui permissão para criar outro.";
    }

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    try {
      envioEmCurso.current = true;
      setSalvando(true);

      await criarJornalista({
        nome: nomeFormatado,
        email: emailFormatado || undefined,
        telefone: telefone.trim() || undefined,
        cargo: cargo.trim() || undefined,
        estado: estado.trim() || undefined,
        cidade: cidade.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        veiculo_id: veiculo.id ?? undefined,
        veiculo_nome:
          veiculo.id === null ? veiculo.nome.trim() || undefined : undefined,
      });

      saida.concluirSaida(retornar);
    } catch (error) {
      console.error("Erro ao cadastrar contato:", error);

      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o contato.";

      exibirErroDaApi(mensagem);
    } finally {
      envioEmCurso.current = false;
      setSalvando(false);
    }
  }

  return (
    <EdicaoCompacta>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <Header title="Novo contato" showBackButton backFallback="/mailing" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingLeft: 16 + insets.left,
              paddingRight: 16 + insets.right,
              paddingBottom: 28 + insets.bottom,
            },
          ]}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
        >
          <Text style={[styles.introText, { color: theme.textoSub }]}>
            Adicione um contato ao mailing. Informe o nome e pelo menos um
            telefone ou e-mail.
          </Text>
          <SecaoEdicao titulo="Dados do contato">
            <Input
              label="Nome *"
              value={nome}
              onChangeText={(texto) => {
                setNome(texto);
                limparErro("nome");
              }}
              placeholder="Nome do contato"
              autoCapitalize="words"
              error={erros.nome}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="E-mail"
              value={email}
              onChangeText={(texto) => {
                setEmail(texto);
                limparErrosDeContato();
              }}
              placeholder="E-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={erros.email}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Telefone"
              value={telefone}
              onChangeText={(texto) => {
                setTelefone(texto);
                limparErrosDeContato();
              }}
              placeholder="Ex: (11) 00000-0000"
              keyboardType="phone-pad"
              error={erros.telefone}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
          </SecaoEdicao>
          <SecaoEdicao titulo="Perfil profissional">
            <Input
              label="Cargo"
              value={cargo}
              onChangeText={(texto) => {
                setCargo(texto);
                limparErro("cargo");
              }}
              placeholder="Ex.: Repórter"
              autoCapitalize="words"
              error={erros.cargo}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Estado"
              value={estado}
              onChangeText={(texto) => {
                setEstado(texto);
                limparErro("estado");
              }}
              placeholder="Ex.: São Paulo"
              autoCapitalize="words"
              error={erros.estado}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Cidade"
              value={cidade}
              onChangeText={(texto) => {
                setCidade(texto);
                limparErro("cidade");
              }}
              placeholder="Ex.: Campinas"
              autoCapitalize="words"
              error={erros.cidade}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <VeiculoSelector
              value={veiculo}
              onChange={(selecao) => {
                setVeiculo(selecao);
                limparErro("veiculo");
              }}
              criacaoAoSalvar={temPermissao("VEICULOS", "CRIAR")}
              error={erros.veiculo}
              disabled={salvando}
            />
          </SecaoEdicao>
          <SecaoEdicao titulo="Informações adicionais">
            <Input
              label="Observações"
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
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
          </SecaoEdicao>
          {erroGeral ? (
            <Text
              weight="Medium"
              style={[styles.errorGeral, { color: theme.erro }]}
            >
              {erroGeral}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              title="CANCELAR"
              variant="outline"
              onPress={() => {
                retornar();
              }}
              style={styles.actionButton}
              disabled={salvando}
            />

            <Button
              title="CADASTRAR"
              loading={salvando}
              onPress={cadastrar}
              style={styles.actionButton}
            />
          </View>
        </ScrollView>
        <FeedbackAlert {...saida.alertaProps} />
      </KeyboardAvoidingView>
    </EdicaoCompacta>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },

  introText: {
    fontSize: 12,
    lineHeight: 18,
  },

  textArea: {
    height: 100,
    paddingTop: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },

  actionButton: {
    flex: 1,
    minWidth: 0,
    width: "auto",
  },

  errorGeral: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});