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
import UnsavedChanges from "@/components/forms/UnsavedChanges";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

import {
  Funcionario,
  Permissao,
} from "@/services/api/auth";

export default function Permissoes() {
   const { theme } = useTheme();
   const router  = useRouter();
   const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const {
    carregando: carregandoAuth,
    buscarFuncionario,
    listarTodasPermissoes,
    listarPermissoesFuncionario,
    atualizarPermissoesFuncionario,
    temPermissao,
  } = useAuth();

  
    const [funcionario, setFuncionario] =
    useState<Funcionario | null>(null);

    const [permissoes, setPermissoes] =
    useState<Permissao[]>([]);

    const [selecionadas, setSelecionadas] =
    useState<number[]>([]);

    const [permissoesOriginais, setPermissoesOriginais] =
    useState<number[]>([]);

    const adicionadas =
    selecionadas.filter(
        (id) =>
        !permissoesOriginais.includes(id)
    ).length;

    const removidas =
    permissoesOriginais.filter(
        (id) =>
        !selecionadas.includes(id)
    ).length;

    const quantidadeAlteracoes =
    adicionadas + removidas;

    const possuiAlteracoes =
  !mesmasPermissoes(
    permissoesOriginais,
    selecionadas
  );
  const [carregando, setCarregando] =
    useState(true);

  const [salvando, setSalvando] =
    useState(false);

  const [erro, setErro] = useState("");

  useEffect(() => {
    if (
      carregandoAuth ||
      !temPermissao(
        "USUARIOS",
        "GERENCIAR_PERMISSOES"
      )
    ) {
      return;
    }

    carregarDados();
  }, [
    id,
    carregandoAuth,
  ]);

  async function carregarDados() {
    try {
      setCarregando(true);
      setErro("");

      const [
        funcionarioEncontrado,
        todasPermissoes,
        permissoesAtuais,
      ] = await Promise.all([
        buscarFuncionario(Number(id)),
        listarTodasPermissoes(),
        listarPermissoesFuncionario(Number(id)),
      ]);

      const idsAtuais = permissoesAtuais.map(
        (item) => item.id
      );

      setFuncionario(funcionarioEncontrado);
      setPermissoes(todasPermissoes);
      setSelecionadas(idsAtuais);
      setPermissoesOriginais(idsAtuais);
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

  function mesmasPermissoes(
  a: number[],
  b: number[]
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const primeira = [...a].sort(
    (x, y) => x - y
  );

  const segunda = [...b].sort(
    (x, y) => x - y
  );

  return primeira.every(
    (valor, indice) =>
      valor === segunda[indice]
  );
}

  function alternarPermissao(
    permissao: Permissao
  ) {
    if (
      permissao.acao !== "VISUALIZAR" &&
      permissaoBloqueada(permissao)
    ) {
      return;
    }

    setSelecionadas((atuais) => {
      const selecionada =
        atuais.includes(permissao.id);

      if (selecionada) {
        const novas =
          atuais.filter(
            (id) =>
              id !== permissao.id
          );
          
        if (
          permissao.acao === "VISUALIZAR"
        ) {
          return novas.filter((id) => {
            const outra = permissoes.find(
              (p) => p.id === id
            );

            return (
              !outra ||
              outra.modulo !==
                permissao.modulo
            );
          });
        }

        return novas;
      }

      return [
        ...atuais,
        permissao.id,
      ];
    });
    
  }

  function handleBack() {
  if (possuiAlteracoes) {
    return;
  }

  router.back();
}

  function possuiVisualizar(
    modulo: string
  ): boolean {
    const permissaoVisualizar = permissoes.find(
      (permissao) =>
        permissao.modulo === modulo &&
        permissao.acao === "VISUALIZAR"
    );

    if (!permissaoVisualizar) {
      return false;
    }

    return selecionadas.includes(
      permissaoVisualizar.id
    );
  }

  function permissaoBloqueada(
    permissao: Permissao
  ): boolean {
    if (permissao.acao === "VISUALIZAR") {
      return false;
    }

    return !possuiVisualizar(
      permissao.modulo
    );
  }
  
  function descartarAlteracoes() {
    setSelecionadas(
        [...permissoesOriginais]
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

    setPermissoesOriginais(
      [...selecionadas]
    );

  } catch (error) {
    console.error(
      "Erro ao salvar permissões:",
      error
    );

    setErro(
      error instanceof Error
        ? error.message
        : "Não foi possível salvar as permissões."
    );
  } finally {
    setSalvando(false);
  }
}

  if (!temPermissao("USUARIOS","GERENCIAR_PERMISSOES"))  {
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
          title="Permissões"
          showBackButton
          showSettings={false}
          onBackPress={handleBack}
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
            Você não possui permissão para gerenciar permissões.
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
        title="Permissões"
        showBackButton
        showSettings={false}
        onBackPress={handleBack}
      />

      {carregando ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.employeeCard,
              {
                backgroundColor:
                  theme.background,
                borderColor:
                  theme.borda,
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
                style={[
                  styles.avatarText,
                  {
                    color:
                      theme.textoContainer,
                  },
                ]}
              >
                {funcionario?.nome
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={styles.employeeInfo}
            >
              <Text
                weight="Bold"
                style={styles.employeeName}
              >
                {funcionario?.nome}
              </Text>

              <Text
                style={[
                  styles.employeeEmail,
                  {
                    color:
                      theme.textoSub,
                  },
                ]}
              >
                {funcionario?.email}
              </Text>
            </View>
          </View>

          <Text
            weight="SemiBold"
            style={styles.sectionTitle}
          >
            Permissões de acesso
          </Text>

          <Text
            style={[
              styles.sectionDescription,
              {
                color: theme.textoSub,
              },
            ]}
          >
            Defina quais ações este funcionário poderá
            realizar no sistema. 
            Ativar "visualizar" permite que outras ações sejam ativadas.
          </Text>

          {Object.entries(
            permissoes.reduce<
              Record<string, Permissao[]>
            >((grupos, permissao) => {
              if (!grupos[permissao.modulo]) {
                grupos[permissao.modulo] = [];
              }

              grupos[
                permissao.modulo
              ].push(permissao);

              return grupos;
            }, {})
          ).map(
            ([modulo, lista]) => (
              <View
                key={modulo}
                style={[
                  styles.moduleCard,
                  {
                    backgroundColor:
                      theme.background,
                    borderColor:
                      theme.borda,
                  },
                ]}
              >
                <View
                  style={styles.moduleHeader}
                >
                  <View
                    style={[
                      styles.moduleIcon,
                      {
                        backgroundColor:
                          theme.backgroundContainer,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        obterIconeModulo(
                          modulo
                        ) as any
                      }
                      size={20}
                      color={
                        theme.textoContainer
                      }
                    />
                  </View>

                  <Text
                    weight="Bold"
                    style={[
                      styles.moduleTitle,
                      {
                        color:
                          theme.textoTerciaria,
                      },
                    ]}
                  >
                    {modulo}
                  </Text>
                </View>

                {lista.map(
                  (permissao) => {
                    const eraSelecionada = permissoesOriginais.includes( permissao.id);
                        const estaSelecionada = selecionadas.includes(permissao.id);
                        const foiAdicionada = !eraSelecionada && estaSelecionada;
                        const foiRemovida = eraSelecionada && !estaSelecionada;
                    const marcada =
                      selecionadas.includes(
                        permissao.id
                      );
                        const bloqueada = permissaoBloqueada(permissao);


                    return (
                      <TouchableOpacity
                        key={permissao.id}
                        disabled={bloqueada}
                        activeOpacity={bloqueada ? 1 : 0.8}
                        onPress={() => {
                          if (!bloqueada) {
                            alternarPermissao(permissao);
                          }
                        }}
                        style={[
                          styles.permissionRow,
                          {
                            borderTopColor: theme.borda,
                            opacity: bloqueada ? 0.55 : 1,
                          },
                        ]}
                      >
                        <View
                          style={
                            styles.permissionInfo
                          }
                        >
                          <View style={styles.actionRow}>
                            <Text
                              weight="SemiBold"
                              style={[
                                styles.permissionAction,
                                {
                                  color: bloqueada
                                    ? theme.textoSub
                                    : theme.texto,
                                },
                              ]}
                            >
                              {formatarAcao(permissao.acao)}
                            </Text>

                            {bloqueada && (
                              <Ionicons
                                name="lock-closed-outline"
                                size={13}
                                color={theme.textoSub}
                              />
                            )}

                            {foiAdicionada && (
                              <View
                                style={[
                                  styles.changeBadge,
                                  {
                                    backgroundColor:
                                      theme.backgroundContainer,
                                  },
                                ]}
                              >
                                <Text
                                  weight="SemiBold"
                                  style={[
                                    styles.changeBadgeText,
                                    {
                                      color:
                                        theme.textoContainer,
                                    },
                                  ]}
                                >
                                  NOVA
                                </Text>
                              </View>
                            )}

                            {foiRemovida && (
                              <View
                                style={[
                                  styles.changeBadge,
                                  styles.removedBadge,
                                ]}
                              >
                                <Text
                                  weight="SemiBold"
                                  style={styles.removedBadgeText}
                                >
                                  REMOVIDA
                                </Text>
                              </View>
                            )}
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
                            {
                              permissao.descricao
                            }
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: bloqueada
                                ? theme.textoSub
                                : marcada
                                  ? theme.primaria
                                  : theme.borda,

                              backgroundColor: bloqueada
                                ? "transparent"
                                : marcada
                                  ? theme.backgroundContainer
                                  : "transparent",
                            },
                          ]}
                        >
                          {marcada && (
                            <Ionicons
                              name="checkmark"
                              size={17}
                              color={
                                theme.textoContainer
                              }
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            )
          )}

          {erro ? (
            <View
              style={[
                styles.errorContainer,
                {
                  borderColor:
                    theme.borda,
                  backgroundColor:
                    theme.background,
                },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color="#EF4444"
              />

              <Text
                weight="Medium"
                style={styles.errorText}
              >
                {erro}
              </Text>
            </View>
          ) : null}
          <Button
            title="SALVAR PERMISSÕES"
            onPress={salvar}
            loading={salvando}
            style={styles.saveButton}
          />
          <UnsavedChanges
            visible={possuiAlteracoes}
            saving={salvando}
            alterations={quantidadeAlteracoes}
            onSave={salvar}
            onDiscard={descartarAlteracoes}
          />
        </ScrollView>
      )}
    </View>
  );
}

function formatarAcao(acao: string): string {
  return acao
    .toLowerCase()
    .replace(/^./, (letra) =>
      letra.toUpperCase()
    );
}

function obterIconeModulo(modulo: string) {
  switch (modulo) {
    case "MAILING":
      return "people-outline";

    case "CLIENTES":
      return "business-outline";

    case "VEICULOS":
      return "radio-outline";

    case "RELEASES":
      return "newspaper-outline";

    case "TEMPLATES":
      return "layers-outline";

    case "CLIPPING":
      return "document-outline";

    case "RELATORIOS":
      return "bar-chart-outline";

    case "AUDITORIA":
      return "shield-checkmark-outline";

    case "USUARIOS":
      return "people-outline";

    case "CONVITES":
      return "mail-outline";

    default:
      return "apps-outline";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 35,
  },

  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 25,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 19,
  },

  employeeInfo: {
    flex: 1,
    marginLeft: 12,
  },

  employeeName: {
    fontSize: 18,
  },

  employeeEmail: {
    fontSize: 13,
    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 21,
  },

  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
    marginBottom: 20,
  },

  moduleCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 15,
    overflow: "hidden",
  },

  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },

  moduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  moduleTitle: {
    fontSize: 17,
  },

  permissionRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  permissionInfo: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
  },

  permissionAction: {
    fontSize: 14,
  },
  actionRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
},

changeBadge: {
  paddingHorizontal: 7,
  paddingVertical: 3,
  borderRadius: 8,
},

changeBadgeText: {
  fontSize: 9,
},

removedBadge: {
  backgroundColor: "#FDECEC",
},

removedBadgeText: {
  color: "#EF4444",
  fontSize: 9,
},
  permissionDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },

  errorText: {
    flex: 1,
    color: "#EF4444",
    fontSize: 13,
    marginLeft: 8,
  },

  saveButton: {
    marginTop: 5,
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
});