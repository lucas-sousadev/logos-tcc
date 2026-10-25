import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ClippingImagemPreview from "@/components/clipping/ClippingImagePreview";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AnexoClipping,
  atualizarAnexo,
  enviarAnexo,
  excluirAnexo,
  listarAnexos,
} from "@/services/api/clipping";

const MAX_BYTES = 30 * 1024 * 1024;

interface ClippingAnexosProps {
  clippingId: number;
  disabled?: boolean;
  onOcupadoChange?: (ocupado: boolean) => void;
}

interface Feedback {
  titulo: string;
  mensagem: string;
  aviso?: boolean;
}

function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function tipoArquivo(anexo: AnexoClipping): string {
  switch (anexo.tipo) {
    case "IMAGEM":
      return "IMAGEM";
    case "VIDEO":
      return "VÍDEO";
    case "AUDIO":
      return "ÁUDIO";
    default:
      return "DOCUMENTO";
  }
}

export default function ClippingAnexos({
  clippingId,
  disabled = false,
  onOcupadoChange,
}: ClippingAnexosProps) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const tela = useWindowDimensions();

  const travaAcao = useRef(false);

  const [anexos, setAnexos] = useState<AnexoClipping[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const [anexoAberto, setAnexoAberto] = useState<AnexoClipping | null>(null);
  const [zoom, setZoom] = useState(1);

  const [anexoParaExcluir, setAnexoParaExcluir] =
    useState<AnexoClipping | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const podeAnexar = temPermissao("CLIPPING", "ANEXAR");
  const podeEditar = temPermissao("CLIPPING", "EDITAR");
  const podeExcluir = temPermissao("CLIPPING", "EXCLUIR");

  const ocupado =
    disabled ||
    carregando ||
    enviando ||
    processandoId !== null;

  useEffect(() => {
    onOcupadoChange?.(enviando || processandoId !== null);
  }, [enviando, processandoId, onOcupadoChange]);

  const carregarAnexos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await listarAnexos(clippingId, {
        page: 1,
        limit: 50,
      });

      setAnexos(resposta.anexos);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
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

      return () => clearTimeout(timer);
    }, [carregarAnexos])
  );

  function informarFalha(
    titulo: string,
    falha: unknown,
    mensagemPadrao: string
  ) {
    setFeedback({
      titulo,
      mensagem:
        falha instanceof Error ? falha.message : mensagemPadrao,
    });
  }

  async function selecionarArquivo() {
    if (ocupado || travaAcao.current || !podeAnexar) return;

    travaAcao.current = true;
    setEnviando(true);

    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "audio/mpeg",
          "audio/wav",
          "audio/x-wav",
          "audio/vnd.wave",
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (resultado.canceled) return;

      const arquivo = resultado.assets[0];

      if (!arquivo) {
        throw new Error("Nenhum arquivo foi selecionado.");
      }

      if (
        arquivo.size !== undefined &&
        (arquivo.size <= 0 || arquivo.size > MAX_BYTES)
      ) {
        throw new Error(
          `"${arquivo.name}" está vazio ou ultrapassa 30 MB.`
        );
      }

      const criado = await enviarAnexo(clippingId, {
        uri: arquivo.uri,
        nome: arquivo.name,
        mimeType: arquivo.mimeType || "application/octet-stream",
        file: arquivo.file,
      });

      // Mantém o anexo visível mesmo se a atualização da lista falhar.
      setAnexos((atuais) => [
        ...atuais.filter((anexo) => anexo.id !== criado.id),
        criado,
      ]);

      await carregarAnexos();
    } catch (falha) {
      informarFalha(
        "Não foi possível enviar",
        falha,
        "Verifique o arquivo selecionado."
      );
    } finally {
      travaAcao.current = false;
      setEnviando(false);
    }
  }

  async function alternarUsoRelatorio(anexo: AnexoClipping) {
    if (
      ocupado ||
      travaAcao.current ||
      !podeEditar ||
      anexo.tipo !== "IMAGEM"
    ) {
      return;
    }

    travaAcao.current = true;
    setProcessandoId(anexo.id);

    try {
      const atualizado = await atualizarAnexo(clippingId, anexo.id, {
        imagem_relatorio:
          anexo.imagem_relatorio === 1 ? null : true,
      });

      setAnexos((atuais) =>
        atuais.map((item) => {
          if (item.id === atualizado.id) return atualizado;

          if (atualizado.imagem_relatorio === 1) {
            return { ...item, imagem_relatorio: null };
          }

          return item;
        })
      );

      await carregarAnexos();
    } catch (falha) {
      informarFalha(
        "Não foi possível atualizar",
        falha,
        "Tente novamente."
      );
    } finally {
      travaAcao.current = false;
      setProcessandoId(null);
    }
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
      const resultado = await excluirAnexo(clippingId, anexo.id);

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
    } catch (falha) {
      setAnexoParaExcluir(null);
      informarFalha(
        "Não foi possível excluir",
        falha,
        "Tente novamente."
      );
    } finally {
      travaAcao.current = false;
      setProcessandoId(null);
    }
  }

  function abrirImagem(anexo: AnexoClipping) {
    if (anexo.tipo !== "IMAGEM") return;
    setZoom(1);
    setAnexoAberto(anexo);
  }

  function fecharImagem() {
    setAnexoAberto(null);
    setZoom(1);
  }

  const larguraBase = Math.max(100, tela.width - 32);
  const alturaBase = Math.max(120, tela.height - 210);
  const larguraImagem = larguraBase * zoom;
  const alturaImagem = alturaBase * zoom;

  return (
    <View style={styles.container}>
      <View style={styles.cabecalho}>
        <View style={styles.tituloGrupo}>
          <Text weight="Bold" style={styles.titulo}>
            ANEXOS
          </Text>

          {anexos.length > 0 ? (
            <View
              style={[
                styles.contador,
                { backgroundColor: theme.primaria },
              ]}
            >
              <Text
                weight="Bold"
                style={[styles.contadorTexto, { color: theme.branco }]}
              >
                {anexos.length}
              </Text>
            </View>
          ) : null}
        </View>

        {podeAnexar ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Adicionar anexo ao clipping"
            disabled={ocupado}
            onPress={() => void selecionarArquivo()}
            style={[
              styles.botaoAdicionar,
              {
                borderColor: theme.borda,
                opacity: ocupado ? 0.5 : 1,
              },
            ]}
          >
            {enviando ? (
              <ActivityIndicator
                size="small"
                color={theme.textoTerciaria}
              />
            ) : (
              <Ionicons
                name="add-outline"
                size={17}
                color={theme.textoTerciaria}
              />
            )}

            <Text
              weight="Bold"
              style={[
                styles.botaoAdicionarTexto,
                { color: theme.textoTerciaria },
              ]}
            >
              {enviando ? "ENVIANDO..." : "ADICIONAR"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {carregando ? (
        <ActivityIndicator
          color={theme.primaria}
          style={styles.carregando}
        />
      ) : null}

      {erro ? (
        <Text style={[styles.erro, { color: theme.erro }]}>
          {erro}
        </Text>
      ) : null}

      {!carregando && !erro && anexos.length === 0 ? (
        <View
          style={[
            styles.vazio,
            {
              borderColor: theme.borda,
              backgroundColor: theme.backgroundSecundario,
            },
          ]}
        >
          <Ionicons
            name="images-outline"
            size={20}
            color={theme.textoSub}
          />
          <Text style={[styles.vazioTexto, { color: theme.textoSub }]}>
            Nenhum anexo adicionado
          </Text>
        </View>
      ) : null}

      <View style={styles.lista}>
        {anexos.map((anexo) => {
          const imagem = anexo.tipo === "IMAGEM";
          const processando = processandoId === anexo.id;

          const conteudoArquivo = (
            <>
              {imagem ? (
                <ClippingImagemPreview
                  endpoint={anexo.arquivo_endpoint}
                  nome={anexo.nome_original}
                  style={styles.miniatura}
                />
              ) : (
                <View
                  style={[
                    styles.iconeArquivo,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Ionicons
                    name={
                      anexo.tipo === "VIDEO"
                        ? "videocam-outline"
                        : anexo.tipo === "AUDIO"
                          ? "musical-notes-outline"
                          : "document-text-outline"
                    }
                    size={25}
                    color={theme.textoTerciaria}
                  />
                </View>
              )}

              <View style={styles.dadosArquivo}>
                <Text
                  weight="SemiBold"
                  numberOfLines={2}
                  style={styles.nomeArquivo}
                >
                  {anexo.nome_original}
                </Text>

                <Text
                  style={[
                    styles.detalhesArquivo,
                    { color: theme.textoSub },
                  ]}
                >
                  {tipoArquivo(anexo)} ·{" "}
                  {tamanhoArquivo(anexo.tamanho_bytes)}
                </Text>

                {imagem ? (
                  <Text
                    weight="SemiBold"
                    style={[
                      styles.ampliarTexto,
                      { color: theme.textoTerciaria },
                    ]}
                  >
                    TOQUE PARA AMPLIAR
                  </Text>
                ) : null}
              </View>

              {imagem ? (
                <Ionicons
                  name="expand-outline"
                  size={18}
                  color={theme.textoTerciaria}
                />
              ) : null}
            </>
          );

          return (
            <View
              key={anexo.id}
              style={[
                styles.cartao,
                {
                  borderColor: theme.borda,
                  backgroundColor: theme.backgroundSecundario,
                },
              ]}
            >
              <View style={styles.linhaArquivo}>
                {imagem ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Ampliar imagem ${anexo.nome_original}`}
                    onPress={() => abrirImagem(anexo)}
                    style={styles.arquivoPrincipal}
                  >
                    {conteudoArquivo}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.arquivoPrincipal}>
                    {conteudoArquivo}
                  </View>
                )}

                {podeExcluir ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${anexo.nome_original}`}
                    disabled={ocupado}
                    onPress={() => confirmarExclusao(anexo)}
                    style={[
                      styles.botaoExcluir,
                      { opacity: ocupado ? 0.5 : 1 },
                    ]}
                  >
                    {processando ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.erro}
                      />
                    ) : (
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={theme.erro}
                      />
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              {imagem && podeEditar ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    anexo.imagem_relatorio === 1
                      ? "Remover imagem dos relatórios"
                      : "Usar imagem nos relatórios"
                  }
                  disabled={ocupado}
                  onPress={() => void alternarUsoRelatorio(anexo)}
                  style={[
                    styles.acaoRelatorio,
                    {
                      borderColor:
                        anexo.imagem_relatorio === 1
                          ? theme.alteracao
                          : theme.borda,
                      opacity: ocupado ? 0.5 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      anexo.imagem_relatorio === 1
                        ? "checkmark-circle-outline"
                        : "image-outline"
                    }
                    size={15}
                    color={
                      anexo.imagem_relatorio === 1
                        ? theme.alteracao
                        : theme.textoTerciaria
                    }
                  />

                  <Text
                    weight="SemiBold"
                    style={[
                      styles.acaoRelatorioTexto,
                      {
                        color:
                          anexo.imagem_relatorio === 1
                            ? theme.alteracao
                            : theme.textoTerciaria,
                      },
                    ]}
                  >
                    {anexo.imagem_relatorio === 1
                      ? "REMOVER DOS RELATÓRIOS"
                      : "USAR NOS RELATÓRIOS"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {imagem &&
              !podeEditar &&
              anexo.imagem_relatorio === 1 ? (
                <View style={styles.indicadorRelatorio}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={15}
                    color={theme.alteracao}
                  />
                  <Text
                    weight="SemiBold"
                    style={[
                      styles.indicadorRelatorioTexto,
                      { color: theme.alteracao },
                    ]}
                  >
                    USADA NOS RELATÓRIOS
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Modal
        visible={anexoAberto !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={fecharImagem}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalCabecalho}>
            <View style={styles.modalTituloGrupo}>
              <Text
                weight="SemiBold"
                numberOfLines={1}
                style={styles.modalNome}
              >
                {anexoAberto?.nome_original}
              </Text>

              {anexoAberto ? (
                <Text style={styles.modalDetalhe}>
                  IMAGEM ·{" "}
                  {tamanhoArquivo(anexoAberto.tamanho_bytes)}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar imagem ampliada"
              onPress={fecharImagem}
              style={styles.modalFechar}
            >
              <Ionicons name="close" size={27} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.visualizador}>
            {anexoAberto ? (
              <ScrollView
                horizontal
                bounces={false}
                showsHorizontalScrollIndicator={zoom > 1}
                contentContainerStyle={styles.rolagemHorizontal}
              >
                <ScrollView
                  nestedScrollEnabled
                  bounces={false}
                  showsVerticalScrollIndicator={zoom > 1}
                  style={{
                    width: larguraImagem,
                    maxHeight: alturaBase,
                  }}
                  contentContainerStyle={styles.rolagemVertical}
                >
                  <ClippingImagemPreview
                    endpoint={anexoAberto.arquivo_endpoint}
                    nome={anexoAberto.nome_original}
                    resizeMode="contain"
                    style={{
                      width: larguraImagem,
                      height: alturaImagem,
                    }}
                  />
                </ScrollView>
              </ScrollView>
            ) : null}
          </View>

          <View style={styles.controlesZoom}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Diminuir zoom"
              disabled={zoom <= 1}
              onPress={() =>
                setZoom((atual) => Math.max(1, atual - 0.5))
              }
              style={[
                styles.botaoZoom,
                { opacity: zoom <= 1 ? 0.4 : 1 },
              ]}
            >
              <Ionicons name="remove" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text weight="SemiBold" style={styles.valorZoom}>
              {Math.round(zoom * 100)}%
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Aumentar zoom"
              disabled={zoom >= 3}
              onPress={() =>
                setZoom((atual) => Math.min(3, atual + 0.5))
              }
              style={[
                styles.botaoZoom,
                { opacity: zoom >= 3 ? 0.4 : 1 },
              ]}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

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
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  tituloGrupo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  titulo: {
    fontSize: 12,
  },
  contador: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  contadorTexto: {
    fontSize: 10,
  },
  botaoAdicionar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
  },
  botaoAdicionarTexto: {
    fontSize: 11,
  },
  carregando: {
    marginVertical: 16,
  },
  erro: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  vazio: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  vazioTexto: {
    fontSize: 12,
  },
  lista: {
    gap: 8,
  },
  cartao: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  linhaArquivo: {
    flexDirection: "row",
    alignItems: "center",
  },
  arquivoPrincipal: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 2,
  },
  miniatura: {
    width: 56,
    height: 56,
    borderRadius: 7,
  },
  iconeArquivo: {
    width: 56,
    height: 56,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  dadosArquivo: {
    flex: 1,
    minWidth: 0,
  },
  nomeArquivo: {
    fontSize: 12,
    lineHeight: 16,
  },
  detalhesArquivo: {
    fontSize: 10,
    marginTop: 3,
  },
  ampliarTexto: {
    fontSize: 9,
    marginTop: 4,
  },
  botaoExcluir: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  acaoRelatorio: {
    alignSelf: "flex-start",
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  acaoRelatorioTexto: {
    fontSize: 10,
  },
  indicadorRelatorio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  indicadorRelatorioTexto: {
    fontSize: 10,
  },
  modal: {
    flex: 1,
    backgroundColor: "#080B13",
    paddingHorizontal: 16,
  },
  modalCabecalho: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalTituloGrupo: {
    flex: 1,
    minWidth: 0,
  },
  modalNome: {
    color: "#FFFFFF",
    fontSize: 13,
  },
  modalDetalhe: {
    color: "#AAB2C0",
    fontSize: 10,
    marginTop: 3,
  },
  modalFechar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  visualizador: {
    flex: 1,
    justifyContent: "center",
  },
  rolagemHorizontal: {
    alignItems: "center",
  },
  rolagemVertical: {
    justifyContent: "center",
  },
  controlesZoom: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },
  botaoZoom: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  valorZoom: {
    minWidth: 48,
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
  },
});