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

import Header from "@/components/layout/Header";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

import {
  Funcionario,
  Permissao,
} from "@/services/auth";

export default function GerenciarPermissoes() {
  const router = useRouter();
  const { theme } = useTheme();

  const { id } =
    useLocalSearchParams<{ id: string }>();

  const {
    usuario,
    listarFuncionarios,
    listarTodasPermissoes,
    listarPermissoesFuncionario,
    atualizarPermissoesFuncionario,
  } = useAuth();

  const [
    funcionario,
    setFuncionario,
  ] = useState<Funcionario | null>(null);

  const [
    permissoes,
    setPermissoes,
  ] = useState<Permissao[]>([]);

  const [
    selecionadas,
    setSelecionadas,
  ] = useState<number[]>([]);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [erro, setErro] = useState("");

  useEffect(() => {
    carregar();
  }, [id]);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");

      const [
        funcionarios,
        todasPermissoes,
        permissoesAtuais,
      ] = await Promise.all([
        listarFuncionarios(),
        listarTodasPermissoes(),
        listarPermissoesFuncionario(
          Number(id)
        ),
      ]);

      const funcionarioEncontrado =
        funcionarios.find(
          (item) =>
            item.id === Number(id)
        );

      if (!funcionarioEncontrado) {
        throw new Error(
          "Funcionário não encontrado."
        );
      }

      setFuncionario(
        funcionarioEncontrado
      );

      setPermissoes(
        todasPermissoes
      );

      setSelecionadas(
        permissoesAtuais.map(
          (item) => item.id
        )
      );

    } catch (error) {
      console.error(
        "Erro ao carregar permissões:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as permissões."
      );
    } finally {
      setCarregando(false);
    }
  }

  function alternarPermissao(
    permissaoId: number
  ) {
    setSelecionadas((atual) =>
      atual.includes(permissaoId)
        ? atual.filter(
            (id) =>
              id !== permissaoId
          )
        : [...atual, permissaoId]
    );
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro("");

      await atualizarPermissoesFuncionario(
        Number(id),
        selecionadas
      );

      router.back();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as permissões."
      );
    } finally {
      setSalvando(false);
    }
  }

  const grupos =
    permissoes.reduce<
      Record<string, Permissao[]>
    >((resultado, permissao) => {
      if (!resultado[permissao.modulo]) {
        resultado[permissao.modulo] = [];
      }

      resultado[permissao.modulo].push(
        permissao
      );

      return resultado;
    }, {});

  if (usuario?.perfil !== "ASSESSOR") {
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
        <BackButton />

        <View style={styles.restricted}>
          <Text weight="Bold">
            Acesso restrito
          </Text>
        </View>
      </View>
    );
  }

  if (carregando) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              theme.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={theme.primaria}
        />
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
      <Header title="Permissões" showBackButton />
      <ScrollView
        contentContainerStyle={styles.content}
      >

        <Text
          weight="Bold"
          style={styles.employeeName}
        >
          {funcionario?.nome}
        </Text>

        <Text style={styles.employeeEmail}>
          {funcionario?.email}
        </Text>

        {erro ? (
          <Text
            weight="Medium"
            style={styles.error}
          >
            {erro}
          </Text>
        ) : null}

        {Object.entries(grupos).map(
          ([modulo, lista]) => (
            <View
              key={modulo}
              style={[
                styles.group,
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
                  styles.module,
                  {
                    color:
                      theme.textoTerciaria,
                  },
                ]}
              >
                {modulo}
              </Text>

              {lista.map((permissao) => {
                const marcada =
                  selecionadas.includes(
                    permissao.id
                  );

                return (
                  <TouchableOpacity
                    key={permissao.id}
                    activeOpacity={0.8}
                    onPress={() =>
                      alternarPermissao(
                        permissao.id
                      )
                    }
                    style={styles.permission}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor:
                            marcada
                              ? theme.primaria
                              : theme.borda,
                          backgroundColor:
                            marcada
                              ? theme.backgroundContainer
                              : "transparent",
                        },
                      ]}
                    >
                      {marcada ? (
                        <Text
                          weight="Bold"
                          style={{
                            color:
                              theme.textoContainer,
                            fontSize: 14,
                          }}
                        >
                          ✓
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={
                        styles.permissionText
                      }
                    >
                      <Text weight="SemiBold">
                        {permissao.acao}
                      </Text>

                      <Text
                        style={
                          styles.description
                        }
                      >
                        {
                          permissao.descricao
                        }
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}

        <Button
          title={
            salvando
              ? "SALVANDO..."
              : "SALVAR PERMISSÕES"
          }
          onPress={salvar}
          loading={salvando}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  content: {
    padding: 20,
    paddingBottom: 35,
  },

  employeeName: {
    fontSize: 23,
  },

  employeeEmail: {
    marginTop: 3,
    marginBottom: 20,
  },

  group: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 18,
    marginBottom: 15,
  },

  module: {
    fontSize: 18,
    marginBottom: 10,
  },

  permission: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  permissionText: {
    flex: 1,
    marginLeft: 12,
  },

  description: {
    marginTop: 2,
    color: "#808080",
    fontSize: 13,
  },

  error: {
    color: "#EF4444",
    marginBottom: 15,
  },

  restricted: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});