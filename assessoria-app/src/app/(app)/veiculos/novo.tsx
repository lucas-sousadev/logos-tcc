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
import EnderecosVeiculoCadastro, {
  prepararEnderecosCadastro,
} from "@/components/veiculos/EnderecosVeiculoCadastro";
import Header from "@/components/layout/Header";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import LogoPicker from "@/components/forms/LogoPicker";
import TierSelector from "@/components/forms/TierSelector";

import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";

import { useTheme } from "@/contexts/ThemeContext";

import type { Tier } from "@/constants/tier";

import {
  ArquivoLogoVeiculo,
  criarVeiculo,
  NovoEnderecoVeiculo,
} from "@/services/api/veiculo";

export default function NovoVeiculo() {
  const insets = useSafeAreaInsets();

  const { theme } = useTheme();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [alcance, setAlcance] = useState("");
  const [tier, setTier] = useState<Tier | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [erroNome, setErroNome] = useState("");
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const envioEmCurso = useRef(false);
  const [logo, setLogo] = useState<ArquivoLogoVeiculo | null>(null);
  const [enderecos, setEnderecos] = useState<NovoEnderecoVeiculo[]>([
    {
      host: "",
      caminho_prefixo: "",
      incluir_subdominios: false,
    },
  ]);

  const retornar = useRetornoSeguro("/veiculos");
  const saida = useSaidaFormulario(
    Boolean(
      nome ||
      descricao ||
      alcance ||
      tier !== null ||
      !ativo ||
      logo ||
      enderecos.some(
        (e) => e.host || e.caminho_prefixo || e.incluir_subdominios
      )
    ),
    salvando
  );

  async function cadastrar() {
    if (envioEmCurso.current) {
      return;
    }

    const nomeFormatado = nome.trim();
    setErroNome("");
    setErroGeral("");

    if (!nomeFormatado) {
      setErroNome("Informe o nome do veículo.");
      return;
    }

    try {
      envioEmCurso.current = true;
      setSalvando(true);
      await criarVeiculo(
        {
          nome: nomeFormatado,
          descricao: descricao.trim() || undefined,
          alcance: alcance.trim() || undefined,
          tier,
          ativo,
          enderecos: prepararEnderecosCadastro(enderecos),
        },
        logo ?? undefined
      );
      saida.concluirSaida(retornar);
    } catch (error) {
      setErroGeral(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o veículo."
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
        <Header title="Novo veículo" showBackButton backFallback="/veiculos" />

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
            Cadastre um veículo para vincular aos contatos e clippings. Campos
            com * são obrigatórios.
          </Text>
          <SecaoEdicao titulo="Dados do veículo">
            <Input
              label="Nome *"
              value={nome}
              onChangeText={(texto) => {
                setNome(texto);
                if (erroNome) {
                  setErroNome("");
                }
              }}
              placeholder="Ex.: Jornal LOGOS"
              autoCapitalize="words"
              error={erroNome}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Descrição"
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Ex.: Portal de notícias regional"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <Input
              label="Alcance"
              value={alcance}
              onChangeText={setAlcance}
              placeholder="Ex.: Nacional, 250 mil leitores/mês"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              containerStyle={{ marginBottom: 0 }}
              editable={!salvando}
            />
            <TierSelector value={tier} onChange={setTier} disabled={salvando} />
          </SecaoEdicao>
          <SecaoEdicao titulo="Identidade visual">
            <LogoPicker
              permitirCapturaSite
              linkCaptura={
                enderecos.find((endereco) => endereco.host.trim())?.host
              }
              logoSelecionado={logo}
              onSelect={setLogo}
              onRemove={() => setLogo(null)}
              disabled={salvando}
            />
          </SecaoEdicao>
          <EnderecosVeiculoCadastro
            value={enderecos}
            onChange={setEnderecos}
            disabled={salvando}
          />
          <SecaoEdicao titulo="Disponibilidade">
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text weight="SemiBold" style={styles.statusTitle}>
                  STATUS
                </Text>
                <Text
                  style={[styles.statusDescription, { color: theme.textoSub }]}
                >
                  Veículo disponível para vinculação no mailing
                </Text>
              </View>
              <Switch
                value={ativo}
                onValueChange={setAtivo}
                trackColor={{ false: theme.surface, true: theme.primaria }}
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