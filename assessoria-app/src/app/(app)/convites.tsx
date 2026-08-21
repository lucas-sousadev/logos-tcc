import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";

import BackButton from "../../components/ui/BackButton";
import { useAuth } from "../../contexts/AuthContext";
import {
  ConviteHistorico,
} from "../../services/auth";
export default function Convites() {
  const router = useRouter();
  const { usuario, criarConvite, listarConvites } = useAuth();
    const [historico, setHistorico] = useState<ConviteHistorico[]>([]);
    const [erro, setErro] = useState("");
    const [pagina, setPagina] = useState(1);
    const [temMais, setTemMais] = useState(false);
    const [carregandoMais, setCarregandoMais] =useState(false);
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [convite, setConvite] = useState<{
    codigo: string;
    email_destino: string | null;
    expira_em: string;
  } | null>(null);

  useEffect(() => {
  carregarHistorico();
}, []);

async function carregarHistorico() {
  try {
    const resposta = await listarConvites(
      1,
      20
    );

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
      ...(resposta.convites || [])
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

  try {
    setCarregando(true);
    setConvite(null);

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
        ? "Limite de 3 convites atingido. Aguarde 5 minutos para criar outro."
        : "Não foi possível criar o convite."
    );
  } finally {
    setCarregando(false);
  }
}

  if (usuario?.perfil !== "ASSESSOR") {
    return (
      <View style={styles.container}>
        <BackButton />    

        <Text style={styles.title}>
          Acesso restrito
        </Text>

        <Text style={styles.message}>
          Apenas assessores podem criar convites.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>
            VOLTAR
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
        <BackButton />

        <Text style={styles.title}>
        Convites
        </Text>

        <Text style={styles.subtitle}>
        Crie um convite para adicionar um funcionário
        à sua assessoria.
        </Text>

        <TouchableOpacity
        style={styles.button}
        onPress={handleCriarConvite}
        disabled={carregando}
        >
        <Text style={styles.buttonText}>
            {carregando
            ? "CRIANDO..."
            : "GERAR CONVITE"}
        </Text>
        </TouchableOpacity>

        {erro ? (
        <Text style={styles.errorText}>
            {erro}
        </Text>
        ) : null}        

        {convite && (
        <View style={styles.result}>
            <Text style={styles.resultTitle}>
            Convite criado
            </Text>

            <Text style={styles.code}>
            {convite.codigo}
            </Text>

            <Text style={styles.expiration}>
            Válido até:{" "}
            {formatarData(convite.expira_em)}
            </Text>

            <Text style={styles.info}>
            Envie este código para o funcionário.
            </Text>
        </View>
        )}
        
        <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>
            Histórico de convites
        </Text>

        {historico.length === 0 ? (
            <Text style={styles.emptyText}>
            Nenhum convite criado.
            </Text>
        ) : (
            historico.map((item) => (
            <View
                key={item.id}
                style={styles.historyItem}
            >
                <View style={styles.historyTop}>
                <Text style={styles.historyCode}>
                    {item.codigo}
                </Text>

                <Text
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

                <Text style={styles.historyInfo}>
                Criado por: {item.criado_por}
                </Text>

                <Text style={styles.historyInfo}>
                Criado em: {formatarData(item.created_at)}
                </Text>

                <Text style={styles.historyInfo}>
                Expira em: {formatarData(item.expira_em)}
                </Text>

                {item.utilizado_por && (
                <Text style={styles.historyInfo}>
                    Utilizado por: {item.utilizado_por}
                </Text>
                )}

                {item.utilizado_em && (
                <Text style={styles.historyInfo}>
                    Utilizado em:{" "}
                    {formatarData(item.utilizado_em)}
                </Text>
                )}
            </View>
            ))
        )}
        {temMais && (
            <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={carregarMais}
                disabled={carregandoMais}
            >
                <Text style={styles.loadMoreText}>
                {carregandoMais
                    ? "CARREGANDO..."
                    : "CARREGAR MAIS"}
                </Text>
            </TouchableOpacity>
            )}

            {!temMais && historico.length > 0 && (
            <Text style={styles.endText}>
                Todos os convites foram carregados.
            </Text>
            )}
        </View>
    </ScrollView>
    );
}

function formatarData(data: string): string {
  const dataObj = new Date(
    data.replace(" ", "T")
  );

  return dataObj.toLocaleString("pt-BR");
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 25,
    paddingTop: 90,
    backgroundColor: "#F4F4F4",
},

  title: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
},

  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 35,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    height: 50,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
  },

  button: {
    height: 52,
    backgroundColor: "#4D86FF",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "bold",
  },

  result: {
    marginTop: 30,
    padding: 20,
    borderRadius: 15,
    backgroundColor: "#EAF4EA",
    alignItems: "center",
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },

  code: {
    fontSize: 23,
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 15,
  },

  expiration: {
    color: "#555",
    marginBottom: 10,
  },

  info: {
    textAlign: "center",
    color: "#555",
  },

  message: {
    textAlign: "center",
    color: "#666",
    marginBottom: 25,
  },
  
historyContainer: {
  marginTop: 35,
},

historyTitle: {
  fontSize: 22,
  fontWeight: "bold",
  marginBottom: 15,
},

emptyText: {
  color: "#666",
},

historyItem: {
  backgroundColor: "#FFF",
  borderRadius: 12,
  padding: 15,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#DDD",
},

historyTop: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
},

historyCode: {
  fontSize: 16,
  fontWeight: "bold",
},

status: {
  fontSize: 12,
  fontWeight: "bold",
},

statusAtivo: {
  color: "#2E8B57",
},

statusUtilizado: {
  color: "#666",
},

statusExpirado: {
  color: "#D32F2F",
},

historyInfo: {
  color: "#555",
  marginBottom: 4,
},
errorText: {
  color: "#D32F2F",
  textAlign: "center",
  fontWeight: "600",
  marginTop: 15,
},
loadMoreButton: {
  height: 48,
  borderWidth: 1,
  borderColor: "#4D86FF",
  borderRadius: 24,
  justifyContent: "center",
  alignItems: "center",
  marginTop: 5,
  marginBottom: 20,
},

loadMoreText: {
  color: "#4D86FF",
  fontWeight: "bold",
},

endText: {
  textAlign: "center",
  color: "#777",
  marginBottom: 20,
},
});