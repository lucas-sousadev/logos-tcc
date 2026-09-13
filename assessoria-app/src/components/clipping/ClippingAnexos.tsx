import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
} from "expo-router";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AnexoClipping,
  atualizarAnexo,
  enviarAnexo,
  excluirAnexo,
  listarAnexos,
  obterTokenParaArquivo,
  obterUrlArquivoAnexo,
} from "@/services/api/clipping";

interface ClippingAnexosProps {
  clippingId: number;
}

export default function ClippingAnexos({
  clippingId,
}: ClippingAnexosProps) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [anexos, setAnexos] = useState<
    AnexoClipping[]
  >([]);

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [processandoId, setProcessandoId] =
    useState<number | null>(null);
  const [token, setToken] = useState<string | null>(
    null
  );
  const [erro, setErro] = useState("");

  const podeAnexar = temPermissao(
    "CLIPPING",
    "ANEXAR"
  );

  const podeEditar = temPermissao(
    "CLIPPING",
    "EDITAR"
  );

  const podeExcluir = temPermissao(
    "CLIPPING",
    "EXCLUIR"
  );

  const carregarAnexos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await listarAnexos(
        clippingId,
        {
          page: 1,
          limit: 50,
        }
      );

      setAnexos(resposta.anexos);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os anexos."
      );
    } finally {
      setCarregando(false);
    }
  }, [clippingId]);

  useFocusEffect(
    useCallback(() => {
        const timer = setTimeout(() => {
        void carregarAnexos();
        }, 0);

        return () => {
        clearTimeout(timer);
        };
    }, [carregarAnexos])
    );

    useEffect(() => {
    let ativo = true;

    obterTokenParaArquivo()
        .then((valor) => {
        if (ativo) {
            setToken(valor);
        }
        })
        .catch(() => {
        if (ativo) {
            setToken(null);
        }
        });

    return () => {
        ativo = false;
    };
    }, []);

  async function selecionarArquivo() {
    try {
      const resultado =
        await DocumentPicker.getDocumentAsync({
          type: [
            "image/*",
            "video/*",
            "audio/*",
            "application/pdf",
          ],
          multiple: false,
          copyToCacheDirectory: true,
        });

      if (resultado.canceled) {
        return;
      }

      const arquivo = resultado.assets[0];

      setEnviando(true);

      await enviarAnexo(clippingId, {
        uri: arquivo.uri,
        nome: arquivo.name,
        mimeType:
          arquivo.mimeType ||
          "application/octet-stream",
        file: arquivo.file,
      });

      await carregarAnexos();
    } catch (error) {
      Alert.alert(
        "Não foi possível enviar",
        error instanceof Error
          ? error.message
          : "Verifique o arquivo selecionado."
      );
    } finally {
      setEnviando(false);
    }
  }

  async function marcarPrincipal(
    anexo: AnexoClipping
  ) {
    if (!podeEditar) return;

    try {
      setProcessandoId(anexo.id);

      await atualizarAnexo(
        clippingId,
        anexo.id,
        {
          principal:
            anexo.principal === 1
              ? null
              : true,
        }
      );

      await carregarAnexos();
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o anexo."
      );
    } finally {
      setProcessandoId(null);
    }
  }

  async function marcarImagemRelatorio(
    anexo: AnexoClipping
  ) {
    if (!podeEditar || anexo.tipo !== "IMAGEM") {
      return;
    }

    try {
      setProcessandoId(anexo.id);

      await atualizarAnexo(
        clippingId,
        anexo.id,
        {
          imagem_relatorio:
            anexo.imagem_relatorio === 1
              ? null
              : true,
        }
      );

      await carregarAnexos();
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o anexo."
      );
    } finally {
      setProcessandoId(null);
    }
  }

  function confirmarExclusao(
    anexo: AnexoClipping
  ) {
    if (!podeExcluir) return;

    Alert.alert(
      "Excluir anexo?",
      `O arquivo "${anexo.nome_original}" será removido.`,
      [
        {
          text: "CANCELAR",
          style: "cancel",
        },
        {
          text: "EXCLUIR",
          style: "destructive",
          onPress: () => void removerAnexo(anexo),
        },
      ]
    );
  }

  async function removerAnexo(
    anexo: AnexoClipping
  ) {
    try {
      setProcessandoId(anexo.id);

      await excluirAnexo(
        clippingId,
        anexo.id
      );

      await carregarAnexos();
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o anexo."
      );
    } finally {
      setProcessandoId(null);
    }
  }

  function tamanhoArquivo(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text weight="Bold" style={styles.title}>
            ANEXOS
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: theme.textoSub },
            ]}
          >
            Arquivos disponíveis para a publicação e para o relatório.
          </Text>
        </View>

        {podeAnexar ? (
          <Button
            title="ADICIONAR ANEXO"
            size="small"
            loading={enviando}
            onPress={() => void selecionarArquivo()}
            style={styles.uploadButton}
          />
        ) : null}
      </View>

      {carregando ? (
        <ActivityIndicator
          color={theme.primaria}
          style={styles.loading}
        />
      ) : null}

      {erro ? (
        <Text style={styles.errorText}>
          {erro}
        </Text>
      ) : null}

      {!carregando && anexos.length === 0 ? (
        <View
          style={[
            styles.empty,
            { borderColor: theme.borda },
          ]}
        >
          <Ionicons
            name="attach-outline"
            size={30}
            color={theme.textoSub}
          />

          <Text
            style={[
              styles.emptyText,
              { color: theme.textoSub },
            ]}
          >
            Nenhum arquivo anexado.
          </Text>
        </View>
      ) : null}

      {anexos.map((anexo) => {
        const imagem =
          anexo.tipo === "IMAGEM" &&
          token !== null;

        const processando =
          processandoId === anexo.id;

        return (
          <View
            key={anexo.id}
            style={[
              styles.card,
              {
                borderColor: theme.borda,
                backgroundColor: theme.background,
              },
            ]}
          >
            {imagem ? (
              <Image
                source={{
                  uri: obterUrlArquivoAnexo(
                    anexo.arquivo_endpoint
                  ),
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }}
                style={styles.preview}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.fileIcon,
                  {
                    backgroundColor:
                      theme.backgroundContainer,
                  },
                ]}
              >
                <Ionicons
                  name="document-outline"
                  size={25}
                  color={theme.textoContainer}
                />
              </View>
            )}

            <View style={styles.fileInfo}>
              <Text
                weight="SemiBold"
                style={styles.fileName}
                numberOfLines={2}
              >
                {anexo.nome_original}
              </Text>

              <Text
                style={[
                  styles.fileMeta,
                  { color: theme.textoSub },
                ]}
              >
                {anexo.tipo} •{" "}
                {tamanhoArquivo(anexo.tamanho_bytes)}
              </Text>

              <View style={styles.badges}>
                {anexo.principal === 1 ? (
                  <Text
                    style={[
                      styles.badge,
                      {
                        color: theme.textoContainer,
                        backgroundColor:
                          theme.backgroundContainer,
                      },
                    ]}
                  >
                    PRINCIPAL
                  </Text>
                ) : null}

                {anexo.imagem_relatorio === 1 ? (
                  <Text
                    style={[
                      styles.badge,
                      {
                        color: theme.texto,
                        borderColor: theme.borda,
                      },
                    ]}
                  >
                    RELATÓRIO
                  </Text>
                ) : null}
              </View>
            </View>

            {processando ? (
              <ActivityIndicator
                color={theme.primaria}
              />
            ) : null}

            {!processando && podeEditar ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    void marcarPrincipal(anexo)
                  }
                  style={[
                    styles.actionButton,
                    { borderColor: theme.borda },
                  ]}
                >
                  <Ionicons
                    name={
                      anexo.principal === 1
                        ? "star"
                        : "star-outline"
                    }
                    size={17}
                    color={theme.primaria}
                  />
                </TouchableOpacity>

                {anexo.tipo === "IMAGEM" ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      void marcarImagemRelatorio(anexo)
                    }
                    style={[
                      styles.actionButton,
                      { borderColor: theme.borda },
                    ]}
                  >
                    <Ionicons
                      name={
                        anexo.imagem_relatorio === 1
                          ? "images"
                          : "images-outline"
                      }
                      size={17}
                      color={theme.primaria}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {!processando && podeExcluir ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  confirmarExclusao(anexo)
                }
                style={[
                  styles.deleteButton,
                  { borderColor: "#EF4444" },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  color="#EF4444"
                />
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 25,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 13,
  },

  headerInfo: {
    flex: 1,
  },

  title: {
    fontSize: 13,
  },

  subtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  uploadButton: {
    width: 120,
    padding: 10,
  },

  loading: {
    marginVertical: 18,
  },

  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginBottom: 10,
  },

  empty: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 12,
    marginTop: 7,
  },

  card: {
    minHeight: 82,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 10,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  preview: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },

  fileIcon: {
    width: 58,
    height: 58,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  fileInfo: {
    flex: 1,
  },

  fileName: {
    fontSize: 12,
  },

  fileMeta: {
    fontSize: 10,
    marginTop: 4,
  },

  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6,
  },

  badge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 8,
  },

  actions: {
    gap: 6,
  },

  actionButton: {
    width: 32,
    height: 32,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButton: {
    width: 32,
    height: 32,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});