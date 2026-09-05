import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Funcionario } from "@/services/api/auth";

export default function FuncionarioDetalhes() {
  const router = useRouter();
  const { theme } = useTheme();

  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const {
    buscarFuncionario,
    temPermissao
  } = useAuth();
  
  const [funcionario, setFuncionario] =
    useState<Funcionario | null>(null);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  useEffect(() => {
    carregarFuncionario();
  }, [id]);

  async function carregarFuncionario() {
    try {
      setCarregando(true);
      setErro("");

      const dados = await buscarFuncionario(Number(id));

      setFuncionario(dados);
    } catch (error) {
      console.error(
        "Erro ao carregar funcionário:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o funcionário."
      );
    } finally {
      setCarregando(false);
    }
  }

  if (!temPermissao("USUARIOS", "VISUALIZAR")) {
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
          title="Funcionário"
          showBackButton
        />

        <View style={styles.center}>
          <Text weight="Bold">
            Acesso restrito
          </Text>

          <Text
            style={[
              styles.centerText,
              {
                color: theme.textoSub,
              },
            ]}
          >
            Você não tem permissão para visualizar funcionários.
          </Text>
        </View>
      </View>
    );
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
          title="Funcionário"
          showBackButton
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

  if (!funcionario) {
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
          title="Funcionário"
          showBackButton
        />

        <View style={styles.center}>
          <Text
            weight="Medium"
            style={{
              color: "#EF4444",
            }}
          >
            {erro || "Funcionário não encontrado."}
          </Text>
        </View>
      </View>
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
        title="Funcionário"
        showBackButton
      />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        {erro ? (
          <Text
            weight="Medium"
            style={styles.error}
          >
            {erro}
          </Text>
        ) : null}


        <View
          style={[
            styles.card,
            {
              backgroundColor:
                theme.background,
              borderColor:
                theme.borda,
            },
          ]}
        >
          <Text
            weight="Bold"
            style={[
              styles.sectionTitle,
              {
                color:
                  theme.textoTerciaria,
              },
            ]}
          >
            Dados básicos
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="person-outline"
                size={21}
                color={theme.textoTerciaria}
              />
            </View>

            <View style={styles.infoContent}>
              <Text
                weight="Medium"
                style={styles.label}
              >
                Nome
              </Text>

              <Text weight="SemiBold">
                {funcionario.nome}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="mail-outline"
                size={21}
                color={theme.textoTerciaria}
              />
            </View>

            <View style={styles.infoContent}>
              <Text
                weight="Medium"
                style={styles.label}
              >
                E-mail
              </Text>

              <Text weight="SemiBold">
                {funcionario.email}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="call-outline"
                size={21}
                color={theme.textoTerciaria}
              />
            </View>

            <View style={styles.infoContent}>
              <Text
                weight="Medium"
                style={styles.label}
              >
                Telefone
              </Text>

              <Text weight="SemiBold">
                {funcionario.telefone ||
                  "Não informado"}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="shield-checkmark-outline"
                size={21}
                color={theme.textoTerciaria}
              />
            </View>

            <View style={styles.infoContent}>
              <Text
                weight="Medium"
                style={styles.label}
              >
                Perfil
              </Text>

              <Text weight="SemiBold">
                Funcionário
              </Text>
            </View>
          </View>
        </View>


        <View
          style={[
            styles.card,
            {
              backgroundColor:
                theme.background,
              borderColor:
                theme.borda,
            },
          ]}
        >
          <View style={styles.statusHeader}>
            <View>
              <Text
                weight="Bold"
                style={[
                  styles.sectionTitle,
                  {
                    color:
                      theme.textoTerciaria,
                  },
                ]}
              >
                Status
              </Text>

              <Text
                style={[
                  styles.statusDescription,
                  {
                    color:
                      theme.textoSub,
                  },
                ]}
              >
                Situação atual da conta
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    funcionario.ativo === 1
                      ? theme.terciaria
                      : "#EF4444",
                },
              ]}
            >
              <Text
                weight="SemiBold"
                style={{
                  color: theme.branco,
                  fontSize: 12,
                }}
              >
                {funcionario.ativo === 1
                ? "ATIVO"
                : "INATIVO"}
              </Text>
            </View>
          </View>
        </View>
        
      {temPermissao("USUARIOS", "GERENCIAR_PERMISSOES") ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor:
                theme.background,
              borderColor:
                theme.borda,
            },
          ]}
        >
          <View style={styles.permissionHeader}>
            <View style={styles.permissionTitle}>
              <Ionicons
                name="key-outline"
                size={23}
                color={theme.textoTerciaria}
              />

              <Text
                weight="Bold"
                style={styles.sectionTitle}
              >
                Permissões
              </Text>
            </View>

            <Text
              style={[
                styles.permissionDescription,
                {
                  color:
                    theme.textoSub,
                },
              ]}
            >
              Controle o que este funcionário
              pode fazer no sistema.
            </Text>
          </View>
          
          <Button
            title="GERENCIAR PERMISSÕES"
            onPress={() =>
              router.push({
                pathname:
                  "/funcionarios/[id]/permissoes",
                params: {
                  id: funcionario.id.toString(),
                },
              })
            }
          />
        </View>
      ) : null }
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
    paddingBottom: 35,
  },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 19,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 19,
  },

  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 8,
  },

  label: {
    fontSize: 12,
    marginBottom: 3,
    color: "#808080",
  },

  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusDescription: {
    fontSize: 13,
    marginTop: 4,
  },

  statusBadge: {
    minWidth: 70,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },

  permissionHeader: {
    marginBottom: 18,
  },

  permissionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  permissionDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  centerText: {
    textAlign: "center",
    marginTop: 8,
  },

  error: {
    color: "#EF4444",
    marginBottom: 15,
  },
});