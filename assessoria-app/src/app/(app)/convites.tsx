import {
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
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ConviteHistorico, 
} from "@/services/api/auth";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

export default function Convites() {
  const router = useRouter();
  
  const { origem } = useLocalSearchParams<{
    origem?: string;
  }>();

  function voltar() {
    if (origem === "funcionarios") {
      router.replace("/funcionarios");
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  }

  const { theme } = useTheme();

  const {
    criarConvite,
    listarConvites,
    temPermissao
  } = useAuth();

  const podeVisualizarConvites = temPermissao(
    "CONVITES",
    "VISUALIZAR"
  );

  const podeCriarConvites = temPermissao(
    "CONVITES",
    "CRIAR"
  );
  const [historico, setHistorico] = useState<
    ConviteHistorico[]
  >([]);

  const [erro, setErro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] =
    useState(false);

  const [carregando, setCarregando] = useState(false);

  const [convite, setConvite] = useState<{
    codigo: string;
    email_destino: string | null;
    expira_em: string;
  } | null>(null);

  useEffect(() => {
    if (!podeVisualizarConvites) {
      return;
    }

    carregarHistorico();
  }, [podeVisualizarConvites]);

  async function carregarHistorico() {
    try {
      const resposta = await listarConvites(1, 20);

      setHistorico(resposta.convites || []);
      setPagina(1);
      setTemMais(
        resposta.pagination?.has_next ?? false
      );
    } catch (error) {
      console.error(
        "Erro ao carregar histórico de convites:",
        error
      );
    }
  }

  async function carregarMais() {
    if (!temMais || carregandoMais) {
      return;
    }

    try {
      setCarregandoMais(true);

      const proximaPagina = pagina + 1;

      const resposta = await listarConvites(
        proximaPagina,
        20
      );

      setHistorico((atual) => [
        ...atual,
        ...(resposta.convites || []),
      ]);

      setPagina(proximaPagina);

      setTemMais(
        resposta.pagination?.has_next ?? false
      );
    } catch (error) {
      console.error(
        "Erro ao carregar mais convites:",
        error
      );
    } finally {
      setCarregandoMais(false);
    }
  }

  async function handleCriarConvite() {
    setErro("");
    setConvite(null);

    try {
      setCarregando(true);

      const resultado = await criarConvite();

      if (!resultado.convite) {
        throw new Error(
          "A API não retornou os dados do convite."
        );
      }

      setConvite(resultado.convite);

      await carregarHistorico();
    } catch (error) {
      console.error(
        "Erro ao criar convite:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o convite."
      );
    } finally {
      setCarregando(false);
    }
  }

  if (!podeVisualizarConvites) {
  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header
        title="Convites"
        showBackButton
        onBackPress={voltar}
      />

      <View style={styles.restrictedContainer}>
        <Text
          weight="SemiBold"
          style={styles.title}
        >
          Acesso restrito
        </Text>

        <Text
          style={[
            styles.message,
            {
              color: theme.textoSub,
            },
          ]}
        >
          Você não tem permissão para gerenciar convites.
        </Text>

        <Button
          title="VOLTAR"
          variant="outline"
          onPress={voltar}
        />
      </View>
    </View>
  );
}

  return (
    <View
    style={[
      styles.screen,
      {
        backgroundColor: theme.background,
      },
    ]}
  >
    <Header
      title="Convites"
      showBackButton
      onBackPress={voltar}
    />

    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >

      <Text
        style={[
          styles.subtitle,
          {
            color: theme.textoTerciaria,
          },
        ]}
      >
        Crie e compartilhe um convite para adicionar um funcionário
        à sua assessoria.
      </Text>

      {podeCriarConvites ? (
        <Button
          title="GERAR CONVITE"
          loading={carregando}
          onPress={handleCriarConvite}
          style={styles.generateButton}
        />
      ) : null}

      {erro ? (
        <Text
          weight="Medium"
          style={styles.errorText}
        >
          {erro}
        </Text>
      ) : null}

      {convite && (
        <View
          style={[
            styles.result,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
            },
          ]}
        >
          <Text
            weight="SemiBold"
            style={styles.resultTitle}
          >
            Convite criado
          </Text>

          <Text
            weight="ExtraBold"
            style={[
              styles.code,
              {
                color: theme.textoTerciaria,
              },
            ]}
          >
            {convite.codigo}
          </Text>

          <Text
            style={[
              styles.expiration,
              {
                color: theme.texto,
              },
            ]}
          >
            Válido até:{" "}
            {formatarData(convite.expira_em)}
          </Text>

          <Text
            style={[
              styles.info,
              {
                color: theme.texto,
              },
            ]}
          >
            Envie este código para o <Text style={{color:theme.textoTerciaria}}>funcionário. </Text>
          </Text>
        </View>
      )}

      <View style={styles.historyContainer}>
        <Text
          weight="SemiBold"
          style={styles.historyTitle}
        >
          Histórico de convites
        </Text>

        {historico.length === 0 ? (
          <Text
            style={[
              styles.emptyText,
              {
                color: theme.textoSub,
              },
            ]}
          >
            Nenhum convite criado.
          </Text>
        ) : (
          historico.map((item) => (
            <View
              key={item.id}
              style={[
                styles.historyItem,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.borda,
                },
              ]}
            >
              <View style={styles.historyTop}>
                <Text
                  weight="SemiBold"
                  style={styles.historyCode}
                >
                  {item.codigo}
                </Text>

                <Text
                  weight="SemiBold"
                  style={[
                    styles.status,
                    item.status === "ATIVO" &&
                      styles.statusAtivo,
                    item.status === "UTILIZADO" &&
                      styles.statusUtilizado,
                    item.status === "EXPIRADO" &&
                      styles.statusExpirado,
                  ]}
                >
                  {item.status}
                </Text>
              </View>

              <Text
                style={[
                  styles.historyInfo,
                  {
                    color: theme.texto,
                  },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoTerciaria,
                  }}
                >
                  Criado por:
                </Text>{" "}
                {item.criado_por}
              </Text>

              <Text
                style={[
                  styles.historyInfo,
                  {
                    color: theme.texto,
                  },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoTerciaria,
                  }}
                >
                  Criado em:
                </Text>{" "}
                {formatarData(item.created_at)}
              </Text>

              <Text
                style={[
                  styles.historyInfo,
                  {
                    color: theme.texto,
                  },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoTerciaria,
                  }}
                >
                  Expira em:
                </Text>{" "}
                {formatarData(item.expira_em)}
              </Text>

              {item.utilizado_por && (
                <Text
                  style={[
                    styles.historyInfo,
                    {
                      color: theme.texto,
                    },
                  ]}
                >
                  <Text
                    weight="SemiBold"
                    style={{
                      color: theme.textoTerciaria,
                    }}
                  >
                    Utilizado por:
                  </Text>{" "}
                  {item.utilizado_por}
                </Text>
              )}

              {item.utilizado_em && (
                <Text
                  style={[
                    styles.historyInfo,
                    {
                      color: theme.texto,
                    },
                  ]}
                >
                  <Text
                    weight="SemiBold"
                    style={{
                      color: theme.textoTerciaria,
                    }}
                  >
                    Utilizado em:
                  </Text>{" "}
                  {formatarData(item.utilizado_em)}
                </Text>
              )}
            </View>
          ))
        )}

        {temMais && (
          <Button
            title="CARREGAR MAIS"
            variant="outline"
            loading={carregandoMais}
            onPress={carregarMais}
            style={styles.loadMoreButton}
          />
        )}

        {!temMais && historico.length > 0 && (
          <Text
            style={[
              styles.endText,
              {
                color: theme.textoTerciaria,
              },
            ]}
          >
            Todos os convites foram carregados.
          </Text>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

function formatarData(data: string): string {
  const dataObj = new Date(
    data.replace(" ", "T")
  );

  return dataObj.toLocaleString("pt-BR");
}

const styles = StyleSheet.create({
  screen: {
  flex: 1,
},

container: {
  flexGrow: 1,
  paddingHorizontal: 25,
  paddingTop: 25,
  paddingBottom: 30,
},
  restrictedContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
  },

  title: {
    fontSize: 30,
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    textAlign: "center",
    marginBottom: 35,
  },

  generateButton: {
    marginTop: 5,
  },

  result: {
    marginTop: 30,

    padding: 20,

    borderRadius: 15,
    borderWidth: 1,

    alignItems: "center",
  },

  resultTitle: {
    fontSize: 18,
    marginBottom: 15,
  },

  code: {
    fontSize: 23,
    letterSpacing: 2,
    marginBottom: 15,
  },

  expiration: {
    marginBottom: 10,
  },

  info: {
    textAlign: "center",
  },

  message: {
    textAlign: "center",
    marginBottom: 25,
  },

  historyContainer: {
    marginTop: 35,
  },

  historyTitle: {
    fontSize: 22,
    marginBottom: 15,
  },

  emptyText: {
    marginBottom: 10,
  },

  historyItem: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,

    borderWidth: 2,
  },

  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    marginBottom: 10,
  },

  historyCode: {
    fontSize: 16,
  },

  status: {
    fontSize: 12,
  },

  statusAtivo: {
    color: "#2E8B57",
  },

  statusUtilizado: {
    color: "#808080",
  },

  statusExpirado: {
    color: "#D32F2F",
  },

  historyInfo: {
    marginBottom: 4,
  },

  errorText: {
    color: "#D32F2F",
    textAlign: "center",
    marginTop: 15,
  },

  loadMoreButton: {
    marginTop: 5,
    marginBottom: 20,
  },

  endText: {
    textAlign: "center",
    marginBottom: 20,
  },
});