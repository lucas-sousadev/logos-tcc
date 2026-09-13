import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  Linking,
  Platform,
  TouchableOpacity,
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

import {
  ErrosJornalista,
  validarFormularioJornalista,
} from "@/utils/validarMailing";

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

   const [erros, setErros] = useState<ErrosJornalista>({});

    const [erroGeral, setErroGeral] = useState("");

    const params = useLocalSearchParams<{
      id: string;
      origem?: string;
      veiculo_id?: string;
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
            "Contato inválido."
        );

        voltarParaOrigem();
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
            "Erro ao carregar contato:",
            error
        );

        Alert.alert(
            "Erro",
            "Não foi possível carregar os dados do contato."
        );

        voltarParaOrigem();
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

        if (campo === "email" || campo === "telefone") {
          limparErrosDeContato();
        } else if (
          campo === "nome" ||
          campo === "cargo" ||
          campo === "estado" ||
          campo === "cidade" ||
          campo === "observacoes"
        ) {
          limparErro(campo);
        }
    }

    function limparErro(
      campo: keyof ErrosJornalista
    ) {
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

    function exibirErroDaApi(
      mensagemOriginal: string
    ) {
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
        setErros({});
        setErroGeral("");

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

      limparErro("veiculo");
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
        voltarParaOrigem();
        return;
      }

      if (camposAlterados().length > 0) return;
      cancelarEdicao();
    }

  async function salvarAlteracoes() {
    if (!jornalista) return;

    const errosValidacao =
      validarFormularioJornalista({
        nome: formulario.nome,
        email: formulario.email,
        telefone: formulario.telefone,
        cargo: formulario.cargo,
        estado: formulario.estado,
        cidade: formulario.cidade,
        observacoes: formulario.observacoes,
        veiculoId: formulario.veiculo_id,
        veiculoNome: formulario.veiculo_nome,
      });

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

  try {
    setSalvando(true);

    await atualizarJornalista(
      jornalista.id,
      {
        nome: formulario.nome.trim(),
        email: formulario.email.trim() || null,
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
      "Contato atualizado com sucesso."
    );
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar o contato.";

    exibirErroDaApi(mensagem);
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
        "Excluir contato",
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
        "Contato excluído com sucesso."
      );
      voltarParaOrigem();
      return;
    }

    Alert.alert(
      "Sucesso",
      "Contato excluído com sucesso.",
      [
        {
          text: "OK",
          onPress: () => voltarParaOrigem(),
        },
      ]
    );
  } catch (error) {
    console.error(
      "Erro ao excluir contato:",
      error
    );

    const mensagem =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o contato.";

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
          title="Contato"
          showBackButton
          onBackPress={voltarParaOrigem}
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

    async function abrirWhatsApp() {
    if (!jornalista?.telefone) {
      return;
    }

    const numeroLimpo = jornalista.telefone.replace(
      /\D/g,
      ""
    );

    if (numeroLimpo.length < 10) {
      Alert.alert(
        "Telefone inválido",
        "Não foi possível abrir o WhatsApp para este contato."
      );

      return;
    }

    const numeroWhatsApp =
      numeroLimpo.startsWith("55") &&
      (
        numeroLimpo.length === 12 ||
        numeroLimpo.length === 13
      )
        ? numeroLimpo
        : `55${numeroLimpo}`;

    try {
      await Linking.openURL(
        `https://wa.me/${numeroWhatsApp}`
      );
    } catch {
      Alert.alert(
        "WhatsApp indisponível",
        "Não foi possível abrir o WhatsApp."
      );
    }
  }

  async function abrirEmail() {
    const email = jornalista?.email?.trim();

    if (!email) {
      return;
    }

    try {
      await Linking.openURL(
        `mailto:${encodeURIComponent(email)}`
      );
    } catch {
      Alert.alert(
        "E-mail indisponível",
        "Não foi possível abrir o aplicativo de e-mail."
      );
    }
  }

  const veiculoOrigemId = Number(
    params.veiculo_id
  );

  const veioDaTelaVeiculo =
    params.origem === "veiculo" &&
    Number.isInteger(veiculoOrigemId) &&
    veiculoOrigemId > 0;

  function voltarParaOrigem() {
    if (veioDaTelaVeiculo) {
      router.replace({
        pathname: "/veiculos/[id]",
        params: {
          id: veiculoOrigemId.toString(),
        },
      });

      return;
    }

    router.back();
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
            ? "Editar contato"
            : "Contato"
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
              {jornalista.email ||
                jornalista.telefone ||
                "Sem meio de contato"}
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
              DADOS DO CONTATO
            </Text>

            <Input
                label="NOME"
                value={formulario.nome}
                onChangeText={(texto) =>
                    atualizarCampo("nome", texto)
                }
                placeholder="Nome completo"
                showChanged={campoAlterado("nome")}
                error={erros.nome}
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
                error={erros.email}
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
                error={erros.telefone}
            />

            <Input
                label="CARGO"
                value={formulario.cargo}
                onChangeText={(texto) =>
                    atualizarCampo("cargo", texto)
                }
                placeholder="Ex.: Repórter"
                showChanged={campoAlterado("cargo")}
                error={erros.cargo}
            />

           <Input
                label="ESTADO"
                value={formulario.estado}
                onChangeText={(texto) =>
                    atualizarCampo("estado", texto)
                }
                placeholder="Ex.: São Paulo"
                showChanged={campoAlterado("estado")}
                error={erros.estado}
              />

            <Input
                label="CIDADE"
                value={formulario.cidade}
                onChangeText={(texto) =>
                    atualizarCampo("cidade", texto)
                }
                placeholder="Ex.: Campinas"
                showChanged={campoAlterado("cidade")}
                error={erros.cidade}
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
                error={erros.observacoes}
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
                  Contato disponível no mailing
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
              error={erros.veiculo}
            />
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
              alterations={quantidadeAlteracoes()}
              onSave={salvarAlteracoes}
              onDiscard={cancelarEdicao}
            />
          </>
        ) : (
          <>

            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              INFORMAÇÕES
            </Text>

            <InfoRow
              icon="mail-outline"
              label="E-MAIL"
              value={jornalista.email || "Não informado"}
              theme={theme}
              actionIcon={
                jornalista.email
                  ? "mail-outline"
                  : undefined
              }
              actionLabel={
                jornalista.email
                  ? "Enviar e-mail para o contato"
                  : undefined
              }
              onActionPress={
                jornalista.email
                  ? abrirEmail
                  : undefined
              }
            />

            <InfoRow
              icon="call-outline"
              label="TELEFONE"
              value={
                jornalista.telefone ||
                "Não informado"
              }
              theme={theme}
              actionIcon={
                jornalista.telefone
                  ? "logo-whatsapp"
                  : undefined
              }
              actionLabel="Abrir conversa no WhatsApp"
              onActionPress={
                jornalista.telefone
                  ? abrirWhatsApp
                  : undefined
              }
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
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onActionPress?: () => void;
}

function InfoRow({
  icon,
  label,
  value,
  theme,
  actionIcon,
  actionLabel,
  onActionPress,
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
          style={[styles.infoLabel, {color: theme.textoTerciaria}]}
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
      {actionIcon && onActionPress ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onActionPress}
          accessibilityLabel={actionLabel}
          style={[
            styles.infoActionButton,
            {
              backgroundColor: 
                theme.textoTerciaria,
            },
          ]}
        >
          <Ionicons
            name={actionIcon}
            size={18}
            color={theme.textoContainer}
          />
        </TouchableOpacity>
      ) : null}
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

  infoActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
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

  errorGeral: {
  color: "#EF4444",
  fontSize: 13,
  textAlign: "center",
  marginBottom: 10,
},
});
