import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
} from "expo-router";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ClippingImagemPreview from "@/components/clipping/ClippingImagePreview";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AnexoClipping,
  atualizarAnexo,
  enviarAnexo,
  excluirAnexo,
  listarAnexos,
} from "@/services/api/clipping";

interface ClippingAnexosProps {
  clippingId: number;
  disabled?: boolean;
  onOcupadoChange?: (ocupado: boolean) => void;
}

export default function ClippingAnexos({
  clippingId,
  disabled = false,
  onOcupadoChange,
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

  const travaAcao = useRef(false);

  const [anexoParaExcluir, setAnexoParaExcluir] =
    useState<AnexoClipping | null>(null);

  const [feedback, setFeedback] = useState<{
    titulo: string;
    mensagem: string;
    aviso?: boolean;
  } | null>(null);

  const ocupado =
    disabled ||
    carregando ||
    enviando ||
    processandoId !== null;

  useEffect(() => {
    onOcupadoChange?.(enviando || processandoId !== null);
  }, [enviando, processandoId, onOcupadoChange]);

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

  function informarFalha(
  titulo: string,
  error: unknown,
  mensagemPadrao: string
) {
  setFeedback({
    titulo,
    mensagem:
      error instanceof Error
        ? error.message
        : mensagemPadrao,
  });
}

async function selecionarArquivo() {
  if (ocupado || travaAcao.current || !podeAnexar) return;

  travaAcao.current = true;
  setEnviando(true);

  try {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: [
        "image/*",
        "video/*",
        "audio/*",
        "application/pdf",
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (resultado.canceled) return;

    const arquivo = resultado.assets[0];

    if (!arquivo) {
      throw new Error("Nenhum arquivo foi selecionado.");
    }

    const criado = await enviarAnexo(clippingId, {
      uri: arquivo.uri,
      nome: arquivo.name,
      mimeType:
        arquivo.mimeType || "application/octet-stream",
      file: arquivo.file,
    });

    // Mantém o envio confirmado visível mesmo se a consulta seguinte falhar.
    setAnexos((atuais) => [
      ...atuais.filter((anexo) => anexo.id !== criado.id),
      criado,
    ]);

    await carregarAnexos();
  } catch (error) {
    informarFalha(
      "Não foi possível enviar",
      error,
      "Verifique o arquivo selecionado."
    );
  } finally {
    travaAcao.current = false;
    setEnviando(false);
  }
}

async function alterarMarcador(
  anexo: AnexoClipping,
  campo: "principal" | "imagem_relatorio"
) {
  if (
    ocupado ||
    travaAcao.current ||
    !podeEditar ||
    (campo === "imagem_relatorio" && anexo.tipo !== "IMAGEM")
  ) {
    return;
  }

  travaAcao.current = true;
  setProcessandoId(anexo.id);

  try {
    const atualizado = await atualizarAnexo(
      clippingId,
      anexo.id,
      {
        [campo]: anexo[campo] === 1 ? null : true,
      }
    );

    setAnexos((atuais) =>
      atuais.map((item) => {
        if (item.id === atualizado.id) return atualizado;

        // O servidor permite apenas um principal e uma imagem de relatório.
        if (atualizado[campo] === 1) {
          return {
            ...item,
            [campo]: null,
          };
        }

        return item;
      })
    );

    await carregarAnexos();
  } catch (error) {
    informarFalha(
      "Não foi possível atualizar",
      error,
      "Tente novamente."
    );
  } finally {
    travaAcao.current = false;
    setProcessandoId(null);
  }
}

function marcarPrincipal(anexo: AnexoClipping) {
  return alterarMarcador(anexo, "principal");
}

function marcarImagemRelatorio(anexo: AnexoClipping) {
  return alterarMarcador(anexo, "imagem_relatorio");
}

function confirmarExclusao(anexo: AnexoClipping) {
  if (ocupado || travaAcao.current || !podeExcluir) return;

  setAnexoParaExcluir(anexo);
}

async function removerAnexo() {
  if (
    !anexoParaExcluir ||
    ocupado ||
    travaAcao.current ||
    !podeExcluir
  ) {
    return;
  }

  const anexo = anexoParaExcluir;

  travaAcao.current = true;
  setProcessandoId(anexo.id);

  try {
    const resultado = await excluirAnexo(
      clippingId,
      anexo.id
    );

    setAnexos((atuais) =>
      atuais.filter((item) => item.id !== anexo.id)
    );

    setAnexoParaExcluir(null);

    await carregarAnexos();

    if (resultado.limpeza_pendente) {
      setFeedback({
        titulo: "Anexo removido",
        mensagem: resultado.message,
        aviso: true,
      });
    }
  } catch (error) {
    setAnexoParaExcluir(null);

    informarFalha(
      "Não foi possível excluir",
      error,
      "Tente novamente."
    );
  } finally {
    travaAcao.current = false;
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
            disabled={ocupado}
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

      {!carregando && !erro && anexos.length === 0 ? (
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
        const imagem = anexo.tipo === "IMAGEM";

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
              <ClippingImagemPreview
                endpoint={anexo.arquivo_endpoint}
                nome={anexo.nome_original}
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
                  disabled={ocupado}
                  accessibilityRole="button"
                  accessibilityLabel={
                    anexo.imagem_relatorio === 1
                      ? "Remover seleção para relatório"
                      : "Selecionar imagem para relatório"
                  }
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
                    disabled={ocupado}
                    accessibilityRole="button"
                    accessibilityLabel={
                      anexo.imagem_relatorio === 1
                        ? "Remover seleção para relatório"
                        : "Selecionar imagem para relatório"
                    }
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
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`Excluir ${anexo.nome_original}`}
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
      <FeedbackAlert
        visible={anexoParaExcluir !== null}
        variant="warning"
        title="Excluir anexo?"
        message={
          `O arquivo "${anexoParaExcluir?.nome_original ?? ""}" ` +
          "será removido deste clipping. Esta ação não pode ser desfeita."
        }
        primaryLabel="EXCLUIR"
        secondaryLabel="CANCELAR"
        primaryDanger
        loading={processandoId !== null}
        onPrimary={() => void removerAnexo()}
        onSecondary={() => setAnexoParaExcluir(null)}
        onClose={() => setAnexoParaExcluir(null)}
      />

      <FeedbackAlert
        visible={feedback !== null}
        variant={feedback?.aviso ? "warning" : "error"}
        title={feedback?.titulo ?? ""}
        message={feedback?.mensagem ?? ""}
        onClose={() => setFeedback(null)}
      />
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
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});