import {
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { useState } from "react";
import { useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import LogoPicker from "@/components/forms/LogoPicker";

import { useTheme } from "@/contexts/ThemeContext";

import {
  ArquivoLogoCliente,
  criarCliente,
} from "@/services/api/cliente";

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
  const router = useRouter();
  const { theme } = useTheme();

  const [formulario, setFormulario] = useState(
    formularioInicial
  );

  const [ativo, setAtivo] = useState(true);

  const [logo, setLogo] =
    useState<ArquivoLogoCliente | null>(null);

  const [erros, setErros] = useState<ErrosCliente>({});
  const [erroGeral, setErroGeral] = useState("");

  const [salvando, setSalvando] = useState(false);

  function alterarCampo(
    campo: CampoCliente,
    valor: string
  ) {
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

    const campo: CampoCliente | null =
      texto.includes("cnpj")
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
    const errosValidacao =
      validarFormularioCliente(formulario);

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    try {
      setSalvando(true);

      await criarCliente(
        {
          nome: formulario.nome.trim(),
          email:
            formulario.email.trim() || undefined,
          telefone:
            formulario.telefone.trim() || undefined,
          cnpj:
            formulario.cnpj.trim() || undefined,
          site:
            formulario.site.trim() || undefined,
          cidade:
            formulario.cidade.trim() || undefined,
          estado:
            formulario.estado.trim() || undefined,
          descricao:
            formulario.descricao.trim() || undefined,
          segmento:
            formulario.segmento.trim() || undefined,
          responsavel:
            formulario.responsavel.trim() || undefined,
          ativo,
        },
        logo ?? undefined
      );

      router.replace("/clientes");
    } catch (error) {
      mostrarErroApi(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o cliente."
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
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header
        title="Novo cliente"
        showBackButton
        onBackPress={() =>
          router.replace("/clientes")
        }
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
            CADASTRAR CLIENTE
          </Text>

          <Text
            style={[
              styles.introText,
              {
                color: theme.textoSub,
              },
            ]}
          >
            Adicione um cliente à assessoria. Campos
            marcados com * são obrigatórios.
          </Text>
        </View>

        <Text
          weight="Bold"
          style={styles.sectionTitle}
        >
          DADOS PRINCIPAIS
        </Text>

        <Input
          label="NOME *"
          value={formulario.nome}
          onChangeText={(valor) =>
            alterarCampo("nome", valor)
          }
          placeholder="Nome do cliente"
          autoCapitalize="words"
          error={erros.nome}
        />

        <Input
          label="SEGMENTO"
          value={formulario.segmento}
          onChangeText={(valor) =>
            alterarCampo("segmento", valor)
          }
          placeholder="Ex.: Tecnologia, Saúde, Varejo"
          autoCapitalize="words"
          error={erros.segmento}
        />

        <Input
          label="RESPONSÁVEL"
          value={formulario.responsavel}
          onChangeText={(valor) =>
            alterarCampo("responsavel", valor)
          }
          placeholder="Nome do responsável pelo cliente"
          autoCapitalize="words"
          error={erros.responsavel}
        />

        <Input
          label="CNPJ"
          value={formulario.cnpj}
          onChangeText={(valor) =>
            alterarCampo("cnpj", valor)
          }
          placeholder="Ex.: 12.345.678/0001-95"
          autoCapitalize="characters"
          autoCorrect={false}
          error={erros.cnpj}
        />

        <Input
          label="DESCRIÇÃO"
          value={formulario.descricao}
          onChangeText={(valor) =>
            alterarCampo("descricao", valor)
          }
          placeholder="Informações sobre o cliente"
          multiline
          textAlignVertical="top"
          style={styles.textArea}
          error={erros.descricao}
        />

        <Text
          weight="Bold"
          style={styles.sectionTitle}
        >
          CONTATO
        </Text>

        <Input
          label="E-MAIL"
          value={formulario.email}
          onChangeText={(valor) =>
            alterarCampo("email", valor)
          }
          placeholder="contato@cliente.com.br"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={erros.email}
        />

        <Input
          label="TELEFONE"
          value={formulario.telefone}
          onChangeText={(valor) =>
            alterarCampo("telefone", valor)
          }
          placeholder="Ex.: (11) 99999-9999"
          keyboardType="phone-pad"
          error={erros.telefone}
        />

        <Input
          label="SITE"
          value={formulario.site}
          onChangeText={(valor) =>
            alterarCampo("site", valor)
          }
          placeholder="https://www.exemplo.com.br"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          error={erros.site}
        />

        <Text
          weight="Bold"
          style={styles.sectionTitle}
        >
          LOCALIZAÇÃO
        </Text>

        <Input
          label="CIDADE"
          value={formulario.cidade}
          onChangeText={(valor) =>
            alterarCampo("cidade", valor)
          }
          placeholder="Ex.: São Paulo"
          autoCapitalize="words"
          error={erros.cidade}
        />

        <Input
          label="ESTADO"
          value={formulario.estado}
          onChangeText={(valor) =>
            alterarCampo("estado", valor)
          }
          placeholder="Ex.: São Paulo"
          autoCapitalize="words"
          error={erros.estado}
        />

        <Text
          weight="Bold"
          style={styles.sectionTitle}
        >
          IDENTIDADE VISUAL
        </Text>

        <LogoPicker
          logoSelecionado={logo}
          onSelect={setLogo}
          onRemove={() => setLogo(null)}
          disabled={salvando}
        />

        <View
          style={[
            styles.statusRow,
            {
              borderColor: theme.borda,
            },
          ]}
        >
          <View style={styles.statusInfo}>
            <Text
              weight="SemiBold"
              style={styles.statusTitle}
            >
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
          />
        </View>

        {erroGeral ? (
          <Text
            weight="Medium"
            style={styles.errorGeral}
          >
            {erroGeral}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="CANCELAR"
            variant="outline"
            onPress={() =>
              router.replace("/clientes")
            }
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
    height: 100,
    paddingTop: 14,
  },

  statusRow: {
    minHeight: 68,
    borderWidth: 1.5,
    borderRadius: 15,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  statusInfo: {
    flex: 1,
    marginRight: 10,
  },

  statusTitle: {
    fontSize: 12,
  },

  statusDescription: {
    fontSize: 11,
    marginTop: 3,
  },

  errorGeral: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 5,
  },

  actionButton: {
    flex: 1,
  },
});