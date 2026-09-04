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
import { useTheme } from "@/contexts/ThemeContext";
import { criarVeiculo } from "@/services/api/veiculo";

export default function NovoVeiculo() {
  const router = useRouter();
  const { theme } = useTheme();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [logoPath, setLogoPath] = useState("");
  const [alcance, setAlcance] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [erroNome, setErroNome] = useState("");
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function cadastrar() {
    const nomeFormatado = nome.trim();
    setErroNome("");
    setErroGeral("");

    if (!nomeFormatado) {
      setErroNome("Informe o nome do veículo.");
      return;
    }

    try {
      setSalvando(true);
      await criarVeiculo({
        nome: nomeFormatado,
        descricao: descricao.trim() || undefined,
        logo_path: logoPath.trim() || undefined,
        alcance: alcance.trim() || undefined,
        ativo,
      });
      router.replace("/veiculos");
    } catch (error) {
      setErroGeral(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o veículo."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title="Novo veículo"
        showBackButton
        onBackPress={() => router.replace("/veiculos")}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.intro, { borderColor: theme.borda }]}>
          <Text weight="Bold" style={styles.introTitle}>
            CADASTRAR VEÍCULO
          </Text>
          <Text style={[styles.introText, { color: theme.textoSub }]}>
            Cadastre o veículo que poderá ser vinculado aos jornalistas
            do mailing. Campos marcados com * são obrigatórios.
          </Text>
        </View>

        <Text weight="Bold" style={styles.sectionTitle}>
          DADOS DO VEÍCULO
        </Text>
        <Input
          label="NOME *"
          value={nome}
          onChangeText={(texto) => {
            setNome(texto);
            if (erroNome) setErroNome("");
          }}
          placeholder="Ex.: Jornal LOGOS"
          autoCapitalize="words"
          error={erroNome}
        />
        <Input
          label="DESCRIÇÃO"
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Ex.: Portal de notícias regional"
          multiline
          textAlignVertical="top"
          style={styles.textArea}
        />
        <Input
          label="ALCANCE"
          value={alcance}
          onChangeText={setAlcance}
          placeholder="Ex.: Nacional, 250 mil leitores/mês"
          multiline
          textAlignVertical="top"
          style={styles.textArea}
        />
        <Input
          label="URL OU CAMINHO DO LOGO"
          value={logoPath}
          onChangeText={setLogoPath}
          placeholder="https://exemplo.com/logo.png"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={[styles.statusRow, { borderColor: theme.borda }]}>
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
          />
        </View>

        {erroGeral ? (
          <Text
            weight="Medium"
            style={[styles.errorGeral, { color: "#EF4444" }]}
          >
            {erroGeral}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            title="CANCELAR"
            variant="outline"
            onPress={() => router.replace("/veiculos")}
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
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  intro: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    marginBottom: 25,
  },
  introTitle: { fontSize: 17 },
  introText: { fontSize: 12, marginTop: 5 },
  sectionTitle: { fontSize: 13, marginBottom: 14 },
  textArea: { height: 100, paddingTop: 14 },
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
  statusInfo: { flex: 1, marginRight: 10 },
  statusTitle: { fontSize: 12 },
  statusDescription: { fontSize: 11, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 5 },
  actionButton: { flex: 1 },
  errorGeral: { fontSize: 13, textAlign: "center", marginBottom: 10 },
});
