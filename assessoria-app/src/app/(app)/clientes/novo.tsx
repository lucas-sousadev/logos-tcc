import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import SecaoEdicao from "@/components/forms/SecaoEdicao";
import Header from "@/components/layout/Header";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import LogoPicker from "@/components/forms/LogoPicker";

import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";

import { useTheme } from "@/contexts/ThemeContext";

import { ArquivoLogoCliente, criarCliente } from "@/services/api/cliente";

import {
  CampoCliente,
  DadosClienteParaValidacao,
  ErrosCliente,
  validarFormularioCliente,
} from "@/utils/validarCliente";

const formularioInicial: DadosClienteParaValidacao = {
  nome: "",
  email: "",
  telefone: "",
  cnpj: "",
  site: "",
  cidade: "",
  estado: "",
  descricao: "",
  segmento: "",
  responsavel: "",
};

export default function NovoCliente() {
  const insets = useSafeAreaInsets();

  const { theme } = useTheme();

  const [formulario, setFormulario] = useState(formularioInicial);

  const [ativo, setAtivo] = useState(true);

  const [logo, setLogo] = useState<ArquivoLogoCliente | null>(null);

  const [erros, setErros] = useState<ErrosCliente>({});
  const [erroGeral, setErroGeral] = useState("");

  const [salvando, setSalvando] = useState(false);
  const envioEmCurso = useRef(false);

  const retornar = useRetornoSeguro("/clientes");
  const saida = useSaidaFormulario(
    JSON.stringify(formulario) !== JSON.stringify(formularioInicial) ||
      !ativo ||
      logo !== null,
    salvando
  );

  function alterarCampo(campo: CampoCliente, valor: string) {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor,
    }));

    if (erros[campo]) {
      setErros((atuais) => {
        const novosErros = { ...atuais };

        delete novosErros[campo];

        return novosErros;
      });
    }

    if (erroGeral) {
      setErroGeral("");
    }
  }

  function mostrarErroApi(mensagem: string) {
    const texto = mensagem.toLocaleLowerCase();

    const campo: CampoCliente | null = texto.includes("cnpj")
      ? "cnpj"
      : texto.includes("e-mail")
        ? "email"
        : texto.includes("telefone")
          ? "telefone"
          : texto.includes("site")
            ? "site"
            : texto.includes("cidade")
              ? "cidade"
              : texto.includes("estado")
                ? "estado"
                : texto.includes("segmento")
                  ? "segmento"
                  : texto.includes("responsável")
                    ? "responsavel"
                    : texto.includes("descrição")
                      ? "descricao"
                      : texto.includes("nome")
                        ? "nome"
                        : null;

    if (campo) {
      setErros({
        [campo]: mensagem,
      });

      return;
    }

    setErroGeral(mensagem);
  }

  async function cadastrar() {
    if (envioEmCurso.current) {
      return;
    }

    const errosValidacao = validarFormularioCliente(formulario);

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    try {
      envioEmCurso.current = true;
      setSalvando(true);

      await criarCliente(
        {
          nome: formulario.nome.trim(),
          email: formulario.email.trim() || undefined,
          telefone: formulario.telefone.trim() || undefined,
          cnpj: formulario.cnpj.trim() || undefined,
          site: formulario.site.trim() || undefined,
          cidade: formulario.cidade.trim() || undefined,
          estado: formulario.estado.trim() || undefined,
          descricao: formulario.descricao.trim() || undefined,
          segmento: formulario.segmento.trim() || undefined,
          responsavel: formulario.responsavel.trim() || undefined,
          ativo,
        },
        logo ?? undefined
      );

      saida.concluirSaida(retornar);
    } catch (error) {
      mostrarErroApi(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o cliente."
      );
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
        <Header title="Novo cliente" showBackButton backFallback="/clientes" />

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
            Adicione um cliente à assessoria. Campos com * são obrigatórios.
          </Text>
          <SecaoEdicao titulo="Dados principais">
            <Input
              label="Nome *"
              value={formulario.nome}
              onChangeText={(valor) => alterarCampo("nome", valor)}
              placeholder="Nome do cliente"
              autoCapitalize="words"
              error={erros.nome}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Segmento"
              value={formulario.segmento}
              onChangeText={(valor) => alterarCampo("segmento", valor)}
              placeholder="Ex.: Tecnologia, Saúde, Varejo"
              autoCapitalize="words"
              error={erros.segmento}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Responsável"
              value={formulario.responsavel}
              onChangeText={(valor) => alterarCampo("responsavel", valor)}
              placeholder="Nome do responsável pelo cliente"
              autoCapitalize="words"
              error={erros.responsavel}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="CNPJ"
              value={formulario.cnpj}
              onChangeText={(valor) => alterarCampo("cnpj", valor)}
              placeholder="Ex.: 12.345.678/0001-95"
              autoCapitalize="characters"
              autoCorrect={false}
              error={erros.cnpj}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Descrição"
              value={formulario.descricao}
              onChangeText={(valor) => alterarCampo("descricao", valor)}
              placeholder="Informações sobre o cliente"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              error={erros.descricao}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
          </SecaoEdicao>
          <SecaoEdicao titulo="Contato">
            <Input
              label="E-mail"
              value={formulario.email}
              onChangeText={(valor) => alterarCampo("email", valor)}
              placeholder="contato@cliente.com.br"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={erros.email}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Telefone"
              value={formulario.telefone}
              onChangeText={(valor) => alterarCampo("telefone", valor)}
              placeholder="Ex.: (11) 99999-9999"
              keyboardType="phone-pad"
              error={erros.telefone}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Site"
              value={formulario.site}
              onChangeText={(valor) => alterarCampo("site", valor)}
              placeholder="https://www.exemplo.com.br"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              error={erros.site}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
          </SecaoEdicao>
          <SecaoEdicao titulo="Localização">
            <Input
              label="Cidade"
              value={formulario.cidade}
              onChangeText={(valor) => alterarCampo("cidade", valor)}
              placeholder="Ex.: São Paulo"
              autoCapitalize="words"
              error={erros.cidade}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Estado"
              value={formulario.estado}
              onChangeText={(valor) => alterarCampo("estado", valor)}
              placeholder="Ex.: São Paulo"
              autoCapitalize="words"
              error={erros.estado}
              clearable
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
          </SecaoEdicao>
          <SecaoEdicao titulo="Identidade visual">
            <LogoPicker
              logoSelecionado={logo}
              onSelect={setLogo}
              onRemove={() => setLogo(null)}
              disabled={salvando}
            />
          </SecaoEdicao>
          <SecaoEdicao titulo="Disponibilidade">
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text weight="SemiBold" style={styles.statusTitle}>
                  STATUS
                </Text>

                <Text
                  style={[
                    styles.statusDescription,
                    {
                      color: theme.textoSub,
                    },
                  ]}
                >
                  Cliente ativo e disponível no sistema.
                </Text>
              </View>

              <Switch
                value={ativo}
                onValueChange={setAtivo}
                trackColor={{
                  false: theme.surface,
                  true: theme.primaria,
                }}
                thumbColor={theme.branco}
                disabled={salvando}
              />
            </View>
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

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  statusInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },

  statusTitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  statusDescription: {
    fontSize: 12,
    lineHeight: 18,
  },

  errorGeral: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
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
});
