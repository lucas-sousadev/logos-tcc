import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";

import { useEffect, useState } from "react";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import UnsavedChanges from "@/components/forms/UnsavedChanges";
import VeiculoSelector, {
  SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import {
  Jornalista,
  atualizarJornalista,
  buscarJornalista,
  excluirJornalista,
} from "@/services/api/jornalista";

interface Formulario {
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  estado: string;
  cidade: string;
  observacoes: string;
  ativo: boolean;
  veiculo_id: number | null;
  veiculo_nome: string;
}

export default function JornalistaDetalhes() {
    const router = useRouter();
    const { theme } = useTheme();
    const { temPermissao } = useAuth();

    const params = useLocalSearchParams<{
        id: string;
    }>();

    const id = Number(params.id);

    const [jornalista, setJornalista] =
        useState<Jornalista | null>(null);

    const [formulario, setFormulario] =
        useState<Formulario>({
        nome: "",
        email: "",
        telefone: "",
        cargo: "",
        estado: "",
        cidade: "",
        observacoes: "",
        ativo: true,
        veiculo_id: null,
        veiculo_nome: "",
        });

    const [formularioOriginal, setFormularioOriginal] =
        useState<Formulario | null>(null);

    const [modoEdicao, setModoEdicao] =
        useState(false);

    const [carregando, setCarregando] =
        useState(true);

    const [salvando, setSalvando] =
        useState(false);

    const [excluindo, setExcluindo] =
        useState(false);

    useEffect(() => {
        carregarJornalista();
    }, [id]);

    async function carregarJornalista() {
        if (!id || Number.isNaN(id)) {
        Alert.alert(
            "Erro",
            "Jornalista inválido."
        );

        router.back();
        return;
        }

        try {
        setCarregando(true);

        const dados =
            await buscarJornalista(id);

        setJornalista(dados);

        const dadosFormulario: Formulario = {
            nome: dados.nome ?? "",
            email: dados.email ?? "",
            telefone: dados.telefone ?? "",
            cargo: dados.cargo ?? "",
            estado: dados.estado ?? "",
            cidade: dados.cidade ?? "",
            observacoes: dados.observacoes ?? "",
            ativo: dados.ativo === 1,
            veiculo_id: dados.veiculo_id,
            veiculo_nome: dados.veiculo_nome ?? "",
        };

            setFormulario(dadosFormulario);
            setFormularioOriginal(dadosFormulario);
        } catch (error) {
        console.error(
            "Erro ao carregar jornalista:",
            error
        );

        Alert.alert(
            "Erro",
            "Não foi possível carregar os dados do jornalista."
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
        setFormulario((atual) => ({
        ...atual,
        [campo]: valor,
        }));
    }

    function cancelarEdicao() {
        if (!jornalista) return;

        const dadosFormulario: Formulario = {
            nome: jornalista.nome ?? "",
            email: jornalista.email ?? "",
            telefone: jornalista.telefone ?? "",
            cargo: jornalista.cargo ?? "",
            estado: jornalista.estado ?? "",
            cidade: jornalista.cidade ?? "",
            observacoes:
            jornalista.observacoes ?? "",
            ativo: jornalista.ativo === 1,
            veiculo_id: jornalista.veiculo_id,
            veiculo_nome: jornalista.veiculo_nome ?? "",
        };

        setFormulario(dadosFormulario);
        setFormularioOriginal(dadosFormulario);

        setModoEdicao(false);
    }

    function atualizarVeiculo(
      selecao: SelecaoVeiculo
    ) {
      setFormulario((atual) => ({
        ...atual,
        veiculo_id: selecao.id,
        veiculo_nome: selecao.nome,
      }));
    }

    function camposAlterados(): (keyof Formulario)[] {
      if (!formularioOriginal) return [];

      return (Object.keys(formulario) as (keyof Formulario)[]).filter(
        (campo) => formulario[campo] !== formularioOriginal[campo]
      );
    }

    function veiculoAlterado(): boolean {
      return (
        campoAlterado("veiculo_id") ||
        campoAlterado("veiculo_nome")
      );
    }

    function quantidadeAlteracoes(): number {
      const alteracoesSemVeiculo = camposAlterados().filter(
        (campo) =>
          campo !== "veiculo_id" &&
          campo !== "veiculo_nome"
      ).length;

      return alteracoesSemVeiculo + (veiculoAlterado() ? 1 : 0);
    }

    function handleBack() {
      if (!modoEdicao) {
        router.back();
        return;
      }

      if (camposAlterados().length > 0) return;
      cancelarEdicao();
    }

  async function salvarAlteracoes() {
  if (!jornalista) return;

  if (!formulario.nome.trim()) {
    Alert.alert(
      "Atenção",
      "Informe o nome do jornalista."
    );
    return;
  }

  if (!formulario.email.trim()) {
    Alert.alert(
      "Atenção",
      "Informe o e-mail do jornalista."
    );
    return;
  }

  try {
    setSalvando(true);

    await atualizarJornalista(
      jornalista.id,
      {
        nome: formulario.nome.trim(),
        email: formulario.email.trim(),
        telefone:
          formulario.telefone.trim() || null,
        cargo:
          formulario.cargo.trim() || null,
        estado:
          formulario.estado.trim() || null,
        cidade:
          formulario.cidade.trim() || null,
        observacoes:
          formulario.observacoes.trim() || null,
        ativo: formulario.ativo ? 1 : 0,
        veiculo_id: formulario.veiculo_id,
        veiculo_nome:
          formulario.veiculo_id === null
            ? formulario.veiculo_nome.trim() || null
            : null,
      }
    );

    const atualizado = await buscarJornalista(jornalista.id);

    const novoFormularioOriginal: Formulario = {
        nome: atualizado.nome ?? "",
        email: atualizado.email ?? "",
        telefone: atualizado.telefone ?? "",
        cargo: atualizado.cargo ?? "",
        estado: atualizado.estado ?? "",
        cidade: atualizado.cidade ?? "",
        observacoes:
            atualizado.observacoes ?? "",
        ativo: atualizado.ativo === 1,
        veiculo_id: atualizado.veiculo_id,
        veiculo_nome: atualizado.veiculo_nome ?? "",
        };

        setFormulario(novoFormularioOriginal);
        setFormularioOriginal(
        novoFormularioOriginal
    );

    setJornalista(atualizado);

    setModoEdicao(false);

    Alert.alert(
      "Sucesso",
      "Jornalista atualizado com sucesso."
    );
  } catch (error) {
    console.error(
      "Erro ao atualizar jornalista:",
      error
    );

    Alert.alert(
      "Erro",
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar o jornalista."
    );
  } finally {
    setSalvando(false);
  }
}

  function confirmarExclusao() {
    if (!jornalista) return;

    if (Platform.OS === "web") {
        const confirmar = window.confirm(
        `Deseja realmente excluir ${jornalista.nome}?`
        );

        if (confirmar) {
        excluir();
        }

        return;
    }

    Alert.alert(
        "Excluir jornalista",
        `Deseja realmente excluir ${jornalista.nome}?`,
        [
        {
            text: "Cancelar",
            style: "cancel",
        },
        {
            text: "Excluir",
            style: "destructive",
            onPress: excluir,
        },
        ]
    );
}

  async function excluir() {
  if (!jornalista) return;

  try {
    setExcluindo(true);

    await excluirJornalista(jornalista.id);

    if (Platform.OS === "web") {
      window.alert(
        "Jornalista excluído com sucesso."
      );
      router.back();
      return;
    }

    Alert.alert(
      "Sucesso",
      "Jornalista excluído com sucesso.",
      [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]
    );
  } catch (error) {
    console.error(
      "Erro ao excluir jornalista:",
      error
    );

    const mensagem =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o jornalista.";

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
          title="Jornalista"
          showBackButton
          onBackPress={() =>
            router.back()
          }
        />

        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      </View>
    );
  }

    if (!jornalista) {
        return null;
    }

    function campoAlterado(
        campo: keyof Formulario
        ) {
        if (!formularioOriginal) {
            return false;
        }

        return (
            formulario[campo] !==
            formularioOriginal[campo]
        );
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
        title={
          modoEdicao
            ? "Editar jornalista"
            : "Jornalista"
        }
        showBackButton
        onBackPress={handleBack}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.content
        }
      >

        <View
          style={[
            styles.profile,
            {
              borderColor: theme.borda,
            },
          ]}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor:
                  theme.backgroundContainer,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={{
                color:
                  theme.textoContainer,
                fontSize: 26,
              }}
            >
              {jornalista.nome
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text
              weight="Bold"
              style={styles.profileName}
            >
              {jornalista.nome}
            </Text>

            <Text
              style={[
                styles.profileEmail,
                {
                  color:
                    theme.textoSub,
                },
              ]}
            >
              {jornalista.email}
            </Text>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    jornalista.ativo === 1
                      ? theme.backgroundContainer
                      : theme.surface,
                },
              ]}
            >
              <Text
                weight="SemiBold"
                style={{
                  color:
                    jornalista.ativo === 1
                      ? theme.textoContainer
                      : theme.textoSub,
                  fontSize: 11,
                }}
              >
                {jornalista.ativo === 1
                  ? "ATIVO"
                  : "INATIVO"}
              </Text>
            </View>
          </View>
        </View>

        {modoEdicao ? (
          <>
            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              DADOS DO JORNALISTA
            </Text>

            <Input
                label="NOME"
                value={formulario.nome}
                onChangeText={(texto) =>
                    atualizarCampo("nome", texto)
                }
                placeholder="Nome completo"
                showChanged={campoAlterado("nome")}
            />

            <Input
                label="E-MAIL"
                value={formulario.email}
                onChangeText={(texto) =>
                    atualizarCampo("email", texto)
                }
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="E-mail"
                showChanged={campoAlterado("email")}
            />

            <Input
                label="TELEFONE"
                value={formulario.telefone}
                onChangeText={(texto) =>
                    atualizarCampo("telefone", texto)
                }
                keyboardType="phone-pad"
                placeholder="Telefone"
                showChanged={campoAlterado("telefone")}
            />

            <Input
                label="CARGO"
                value={formulario.cargo}
                onChangeText={(texto) =>
                    atualizarCampo("cargo", texto)
                }
                placeholder="Ex.: Repórter"
                showChanged={campoAlterado("cargo")}
            />

           <Input
                label="ESTADO"
                value={formulario.estado}
                onChangeText={(texto) =>
                    atualizarCampo("estado", texto)
                }
                placeholder="Ex.: São Paulo"
                showChanged={campoAlterado("estado")}
                />

            <Input
                label="CIDADE"
                value={formulario.cidade}
                onChangeText={(texto) =>
                    atualizarCampo("cidade", texto)
                }
                placeholder="Ex.: Campinas"
                showChanged={campoAlterado("cidade")}
            />

            <Input
                label="OBSERVAÇÕES"
                value={formulario.observacoes}
                onChangeText={(texto) =>
                    atualizarCampo("observacoes", texto)
                }
                placeholder="Observações"
                multiline
                textAlignVertical="top"
                style={styles.textArea}
                showChanged={campoAlterado("observacoes")}
            />


            <View
              style={[
                styles.statusRow,
                {
                  borderColor:
                    theme.borda,
                },
              ]}
            >
              <View
                style={styles.statusInfo}
              >
                <View style={styles.statusTitleRow}>
                    <Text
                        weight="SemiBold"
                        style={styles.statusTitle}
                    >
                        STATUS
                    </Text>

                    {campoAlterado("ativo") && (
                        <Ionicons
                        name="create-outline"
                        size={15}
                        color={theme.primaria}
                        />
                    )}
                </View>

                <Text
                  style={[
                    styles.statusDescription,
                    {
                      color:
                        theme.textoSub,
                    },
                  ]}
                >
                  Jornalista disponível no mailing
                </Text>
              </View>

              <Switch
                value={formulario.ativo}
                onValueChange={(valor) =>
                  atualizarCampo(
                    "ativo",
                    valor
                  )
                }
                trackColor={{
                  false: theme.surface,
                  true: theme.primaria,
                }}
                thumbColor={
                  theme.branco
                }
              />
            </View>

            <VeiculoSelector
              value={{
                id: formulario.veiculo_id,
                nome: formulario.veiculo_nome,
              }}
              onChange={atualizarVeiculo}
              showChanged={
                campoAlterado("veiculo_id") ||
                campoAlterado("veiculo_nome")
              }
            />

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
              alterations={quantidadeAlteracoes()}
              onSave={salvarAlteracoes}
              onDiscard={cancelarEdicao}
            />
          </>
        ) : (
          <>
            {/* DETALHES */}

            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              INFORMAÇÕES
            </Text>

            <InfoRow
              icon="mail-outline"
              label="E-MAIL"
              value={jornalista.email}
              theme={theme}
            />

            <InfoRow
              icon="call-outline"
              label="TELEFONE"
              value={
                jornalista.telefone ||
                "Não informado"
              }
              theme={theme}
            />

            <InfoRow
              icon="briefcase-outline"
              label="CARGO"
              value={
                jornalista.cargo ||
                "Não informado"
              }
              theme={theme}
            />

            <InfoRow
              icon="location-outline"
              label="LOCALIZAÇÃO"
              value={
                jornalista.cidade &&
                jornalista.estado
                  ? `${jornalista.cidade} - ${jornalista.estado}`
                  : jornalista.cidade ||
                    jornalista.estado ||
                    "Não informado"
              }
              theme={theme}
            />

            <InfoRow
              icon="newspaper-outline"
              label="VEÍCULO"
              value={
                jornalista.veiculo_nome ||
                "Nenhum veículo vinculado"
              }
              theme={theme}
            />

            {jornalista.observacoes ? (
              <InfoRow
                icon="document-text-outline"
                label="OBSERVAÇÕES"
                value={
                  jornalista.observacoes
                }
                theme={theme}
              />
            ) : null}

            <View style={styles.actions}>
             {temPermissao("MAILING", "EDITAR") && (
              <Button
                title="EDITAR"
                onPress={() =>
                  setModoEdicao(true)
                }
                style={styles.primaryAction}
              />
             )}
             
            {temPermissao("MAILING", "EXCLUIR") && (
              <Button
                title="EXCLUIR"
                variant="outline"
                loading={excluindo}
                onPress={confirmarExclusao}
                style={styles.deleteButton}
              />
            )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: any;
}

function InfoRow({
  icon,
  label,
  value,
  theme,
}: InfoRowProps) {
  return (
    <View
      style={[
        styles.infoRow,
        {
          borderColor: theme.borda,
        },
      ]}
    >
      <View
        style={[
          styles.infoIcon,
          {
            backgroundColor:
              theme.backgroundContainer,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={theme.textoContainer}
        />
      </View>

      <View style={styles.infoContent}>
        <Text
          weight="SemiBold"
          style={styles.infoLabel}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.infoValue,
            {
              color: theme.texto,
            },
          ]}
        >
          {value}
        </Text>
      </View>
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

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    marginLeft: 14,
  },

  profileName: {
    fontSize: 19,
  },

  profileEmail: {
    fontSize: 12,
    marginTop: 3,
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
    marginTop: 4,
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
    marginLeft: 12,
  },

  infoLabel: {
    fontSize: 10,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 14,
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
  statusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
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

  infoBox: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  infoBoxText: {
    marginLeft: 10,
    fontSize: 14,
  },

  helperText: {
    fontSize: 11,
    marginTop: 6,
    marginBottom: 20,
  },

  textArea: {
    height: 100,
    paddingTop: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  actionButton: {
    flex: 1,
  },

  primaryAction: {
    flex: 1,
  },

  deleteButton: {
    flex: 1,
  },
});
