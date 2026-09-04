import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import UnsavedChanges from "@/components/forms/UnsavedChanges";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  atualizarVeiculo,
  buscarVeiculo,
  excluirVeiculo,
  Veiculo,
} from "@/services/api/veiculo";
import {
  ErrosVeiculo,
  validarFormularioVeiculo,
} from "@/utils/validarVeiculo";

interface Formulario {
  nome: string;
  descricao: string;
  logo_path: string;
  alcance: string;
  ativo: boolean;
}

export default function VeiculoDetalhes() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);

   const [erros, setErros] = useState<ErrosVeiculo>({});
  const [erroGeral, setErroGeral] = useState("");
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [formulario, setFormulario] = useState<Formulario>({
    nome: "",
    descricao: "",
    logo_path: "",
    alcance: "",
    ativo: true,
  });
  const [formularioOriginal, setFormularioOriginal] =
    useState<Formulario | null>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    carregarVeiculo();
  }, [id]);

  function dadosFormulario(dados: Veiculo): Formulario {
    return {
      nome: dados.nome,
      descricao: dados.descricao ?? "",
      logo_path: dados.logo_path ?? "",
      alcance: dados.alcance ?? "",
      ativo: dados.ativo === 1,
    };
  }

  async function carregarVeiculo() {
    if (!id || Number.isNaN(id)) {
      Alert.alert("Erro", "Veículo inválido.");
      router.back();
      return;
    }

    try {
      setCarregando(true);
      const dados = await buscarVeiculo(id);
      const novoFormulario = dadosFormulario(dados);

      setVeiculo(dados);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o veículo."
      );
      router.back();
    } finally {
      setCarregando(false);
    }
  }

  function atualizarCampo(
    campo: keyof Formulario,
    valor: string | boolean
  ) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  function campoAlterado(campo: keyof Formulario) {
    return formularioOriginal
      ? formulario[campo] !== formularioOriginal[campo]
      : false;
  }

  function cancelarEdicao() {
    if (!veiculo) return;
    const original = dadosFormulario(veiculo);
    setFormulario(original);
    setFormularioOriginal(original);
    setErros({});
    setErroGeral("");
    setModoEdicao(false);
  }

  function camposAlterados(): (keyof Formulario)[] {
    if (!formularioOriginal) return [];

    return (Object.keys(formulario) as (keyof Formulario)[]).filter(
      (campo) => formulario[campo] !== formularioOriginal[campo]
    );
  }

  function handleBack() {
    if (!modoEdicao) {
      router.back();
      return;
    }

    if (camposAlterados().length > 0) return;
    cancelarEdicao();
  }

  function limparErro(campo: keyof ErrosVeiculo) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));

    setErroGeral("");
  }

  function mostrarErroApi(mensagem: string) {
    const texto = mensagem.toLocaleLowerCase();

    let campo: keyof ErrosVeiculo | null = null;

    if (texto.includes("nome")) {
      campo = "nome";
    } else if (texto.includes("descrição")) {
      campo = "descricao";
    } else if (texto.includes("alcance")) {
      campo = "alcance";
    } else if (
      texto.includes("logo") ||
      texto.includes("caminho")
    ) {
      campo = "logo_path";
    }

    if (campo) {
      setErros({ [campo]: mensagem });
      return;
    }

    setErroGeral(mensagem);
  }

  async function salvarAlteracoes() {
    if (!veiculo) return;

    const errosValidacao = validarFormularioVeiculo({
      nome: formulario.nome,
      descricao: formulario.descricao,
      alcance: formulario.alcance,
      logo_path: formulario.logo_path,
    });

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    try {
      setSalvando(true);
      const atualizado = await atualizarVeiculo(veiculo.id, {
        nome: formulario.nome.trim(),
        descricao: formulario.descricao.trim() || undefined,
        logo_path: formulario.logo_path.trim() || undefined,
        alcance: formulario.alcance.trim() || undefined,
        ativo: formulario.ativo,
      });
      const novoFormulario = dadosFormulario(atualizado);

      setVeiculo(atualizado);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);
      setModoEdicao(false);
      Alert.alert("Sucesso", "Veículo atualizado com sucesso.");
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o veículo.";

      mostrarErroApi(mensagem);
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (!veiculo) return;

    const mensagem = `Deseja realmente excluir ${veiculo.nome}?`;

    if (Platform.OS === "web") {
      if (window.confirm(mensagem)) excluir();
      return;
    }

    Alert.alert("Excluir veículo", mensagem, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: excluir },
    ]);
  }

  async function excluir() {
    if (!veiculo) return;

    try {
      setExcluindo(true);
      await excluirVeiculo(veiculo.id);

      if (Platform.OS === "web") {
        window.alert("Veículo excluído com sucesso.");
        router.replace("/veiculos");
        return;
      }

      Alert.alert("Sucesso", "Veículo excluído com sucesso.", [
        { text: "OK", onPress: () => router.replace("/veiculos") },
      ]);
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o veículo.";

      if (Platform.OS === "web") {
        window.alert(mensagem);
      } else {
        Alert.alert("Erro", mensagem);
      }
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Veículo" showBackButton />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primaria} />
        </View>
      </View>
    );
  }

  if (!veiculo) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title={modoEdicao ? "Editar veículo" : "Veículo"}
        showBackButton
        onBackPress={handleBack}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.profile, { borderColor: theme.borda }]}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.backgroundContainer },
            ]}
          >
            <Ionicons
              name="newspaper-outline"
              size={29}
              color={theme.textoContainer}
            />
          </View>

          <View style={styles.profileInfo}>
            <Text weight="Bold" style={styles.profileName}>
              {veiculo.nome}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.profileSubtitle, { color: theme.textoSub }]}
            >
              {veiculo.alcance || "Alcance não informado"}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    veiculo.ativo === 1
                      ? theme.backgroundContainer
                      : theme.surface,
                },
              ]}
            >
              <Text
                weight="SemiBold"
                style={{
                  color:
                    veiculo.ativo === 1
                      ? theme.textoContainer
                      : theme.textoSub,
                  fontSize: 11,
                }}
              >
                {veiculo.ativo === 1 ? "ATIVO" : "INATIVO"}
              </Text>
            </View>
          </View>
        </View>

        {modoEdicao ? (
          <>
            <Text weight="Bold" style={styles.sectionTitle}>
              DADOS DO VEÍCULO
            </Text>
            <Input
              label="NOME"
              value={formulario.nome}
              onChangeText={(texto) => {
                atualizarCampo("nome", texto);
                limparErro("nome");
              }}
              error={erros.nome}
              placeholder="Nome do veículo"
              autoCapitalize="words"
              showChanged={campoAlterado("nome")}
            />

            <Input
              label="DESCRIÇÃO"
              value={formulario.descricao}
              onChangeText={(texto) => {
                atualizarCampo("descricao", texto);
                limparErro("descricao");
              }}
              error={erros.descricao}
              placeholder="Descrição do veículo"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              showChanged={campoAlterado("descricao")}
            />

            <Input
              label="ALCANCE"
              value={formulario.alcance}
              onChangeText={(texto) => {
                atualizarCampo("alcance", texto);
                limparErro("alcance");
              }}
              error={erros.alcance}
              placeholder="Ex.: Nacional, 250 mil leitores/mês"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              showChanged={campoAlterado("alcance")}
            />

            <Input
              label="URL OU CAMINHO DO LOGO"
              value={formulario.logo_path}
              onChangeText={(texto) => {
                atualizarCampo("logo_path", texto);
                limparErro("logo_path");
              }}
              error={erros.logo_path}
              placeholder="https://exemplo.com/logo.png"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              showChanged={campoAlterado("logo_path")}
            />

            <View
              style={[styles.statusRow, { borderColor: theme.borda }]}
            >
              <View style={styles.statusInfo}>
                <Text weight="SemiBold" style={styles.statusTitle}>
                  STATUS
                </Text>
                <Text
                  style={[
                    styles.statusDescription,
                    { color: theme.textoSub },
                  ]}
                >
                  Veículo disponível para vinculação no mailing
                </Text>
              </View>
              <Switch
                value={formulario.ativo}
                onValueChange={(valor) => atualizarCampo("ativo", valor)}
                trackColor={{ false: theme.surface, true: theme.primaria }}
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
                onPress={cancelarEdicao}
                style={styles.actionButton}
              />
              <Button
                title="SALVAR"
                loading={salvando}
                onPress={salvarAlteracoes}
                style={styles.actionButton}
              />
            </View>
            <UnsavedChanges
              visible={camposAlterados().length > 0}
              saving={salvando}
              alterations={camposAlterados().length}
              onSave={salvarAlteracoes}
              onDiscard={cancelarEdicao}
            />
          </>
        ) : (
          <>
            <Text weight="Bold" style={styles.sectionTitle}>
              INFORMAÇÕES
            </Text>
            <InfoRow
              icon="document-text-outline"
              label="DESCRIÇÃO"
              value={veiculo.descricao || "Não informada"}
            />
            <InfoRow
              icon="stats-chart-outline"
              label="ALCANCE"
              value={veiculo.alcance || "Não informado"}
            />
            <InfoRow
              icon="image-outline"
              label="URL OU CAMINHO DO LOGO"
              value={veiculo.logo_path || "Não informado"}
            />
            <View style={styles.actions}>
              {temPermissao("VEICULOS", "EDITAR") && (
                <Button
                  title="EDITAR"
                  onPress={() => setModoEdicao(true)}
                  style={styles.actionButton}
                />
              )}
              {temPermissao("VEICULOS", "EXCLUIR") && (
                <Button
                  title="EXCLUIR"
                  variant="outline"
                  loading={excluindo}
                  onPress={confirmarExclusao}
                  style={styles.actionButton}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.infoRow, { borderColor: theme.borda }]}>
      <View
        style={[
          styles.infoIcon,
          { backgroundColor: theme.backgroundContainer },
        ]}
      >
        <Ionicons name={icon} size={19} color={theme.textoContainer} />
      </View>
      <View style={styles.infoContent}>
        <Text weight="SemiBold" style={styles.infoLabel}>
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: theme.texto }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1 
},
  content: { 
    padding: 20, 
    paddingBottom: 40 
},
  loading: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center" 
},
  profile: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: { 
    flex: 1, 
    marginLeft: 14 
  },
  profileName: { 
    fontSize: 19 
  },
  profileSubtitle: {
    fontSize: 12, 
    marginTop: 3 
},
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 8,
  },
  sectionTitle: { 
    fontSize: 13, 
    marginBottom: 12, 
    marginTop: 4 
  },
  infoRow: {
    minHeight: 68,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: { 
    flex: 1, 
    marginLeft: 12 
},
  infoLabel: { 
    fontSize: 10, 
    marginBottom: 3 
},
  infoValue: { 
    fontSize: 14
  },
  textArea: {
    height: 100,
    paddingTop: 14
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
    marginRight: 10 
  },
  statusTitle: { 
    fontSize: 12
  },

  statusDescription: { 
    fontSize: 11, 
    marginTop: 3 
},
  actions: { 
    flexDirection: "row",
    gap: 10, 
    marginTop: 10 
},
  actionButton: { 
    flex: 1 
},
  errorGeral: {
  color: "#EF4444",
  fontSize: 13,
  textAlign: "center",
  marginBottom: 10,
},
});
