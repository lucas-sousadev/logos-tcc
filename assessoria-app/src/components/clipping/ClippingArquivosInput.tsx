import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { ArquivoClippingSelecionado } from "@/services/api/clipping";

const MAX_BYTES = 30 * 1024 * 1024;

export interface ArquivoRascunho extends ArquivoClippingSelecionado {
  chave: string;
  tamanhoBytes: number | null;
  previewUri?: string;
}

interface ClippingArquivosInputProps {
  arquivos: ArquivoRascunho[];
  disabled?: boolean;
  podeSelecionar: boolean;
  onChange: (arquivos: ArquivoRascunho[]) => void;
  onOcupadoChange: (ocupado: boolean) => void;
}

interface ImagemAberta {
  uri: string;
  nome: string;
}

function ehImagem(arquivo: ArquivoRascunho): boolean {
  return (
    arquivo.mimeType.startsWith("image/") ||
    /\.(jpe?g|png|webp)$/i.test(arquivo.nome)
  );
}

function tipoArquivo(arquivo: ArquivoRascunho): string {
  if (ehImagem(arquivo)) return "IMAGEM";
  if (arquivo.mimeType === "application/pdf") return "PDF";
  if (arquivo.mimeType.startsWith("video/")) return "VÍDEO";
  if (arquivo.mimeType.startsWith("audio/")) return "ÁUDIO";
  return "ARQUIVO";
}

function tamanhoArquivo(bytes: number | null): string {
  if (bytes === null) return "Tamanho não informado";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function liberarArquivoTemporario(arquivo: ArquivoRascunho): void {
  if (Platform.OS === "web") {
    if (typeof URL !== "undefined" && arquivo.uri.startsWith("blob:")) {
      URL.revokeObjectURL(arquivo.uri);
    }
    return;
  }

  // Apenas os arquivos gerados pela captura pertencem a este fluxo.
  if (!arquivo.chave.startsWith("captura-")) return;

  try {
    const temporario = new ExpoFile(arquivo.uri);
    if (temporario.exists) temporario.delete();
  } catch {
    // O sistema pode já ter limpado o cache.
  }
}

export default function ClippingArquivosInput({
  arquivos,
  disabled = false,
  podeSelecionar,
  onChange,
  onOcupadoChange,
}: ClippingArquivosInputProps) {
  const { theme } = useTheme();
  const tela = useWindowDimensions();

  const trava = useRef(false);
  const sequencia = useRef(0);
  const arquivosAnteriores = useRef<ArquivoRascunho[]>([]);

  const [selecionando, setSelecionando] = useState(false);
  const [erro, setErro] = useState("");
  const [imagemAberta, setImagemAberta] = useState<ImagemAberta | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const chavesAtuais = new Set(arquivos.map((arquivo) => arquivo.chave));

    for (const arquivo of arquivosAnteriores.current) {
      if (!chavesAtuais.has(arquivo.chave)) {
        liberarArquivoTemporario(arquivo);
      }
    }

    arquivosAnteriores.current = arquivos;
  }, [arquivos]);

  useEffect(() => {
    return () => {
      for (const arquivo of arquivosAnteriores.current) {
        liberarArquivoTemporario(arquivo);
      }
    };
  }, []);

  async function selecionar() {
    if (disabled || !podeSelecionar || trava.current) return;

    trava.current = true;
    setSelecionando(true);
    onOcupadoChange(true);
    setErro("");

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
        multiple: true,
        copyToCacheDirectory: true,
        base64: false,
      });

      if (resultado.canceled) return;

      const selecionados: ArquivoRascunho[] = resultado.assets.map(
        (arquivo) => {
          if (
            arquivo.size !== undefined &&
            (arquivo.size <= 0 || arquivo.size > MAX_BYTES)
          ) {
            throw new Error(
              `"${arquivo.name}" está vazio ou ultrapassa 30 MB.`
            );
          }

          sequencia.current += 1;

          return {
            chave: `${Date.now()}-${sequencia.current}`,
            uri: arquivo.uri,
            nome: arquivo.name,
            mimeType: arquivo.mimeType || "application/octet-stream",
            file: arquivo.file,
            tamanhoBytes: arquivo.size ?? null,
            previewUri:
              arquivo.mimeType?.startsWith("image/") ||
              /\.(jpe?g|png|webp)$/i.test(arquivo.name)
                ? arquivo.uri
                : undefined,
          };
        }
      );

      onChange([...arquivos, ...selecionados]);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível adicionar os arquivos."
      );
    } finally {
      trava.current = false;
      setSelecionando(false);
      onOcupadoChange(false);
    }
  }

  function remover(chave: string) {
    if (disabled || trava.current) return;

    setErro("");
    onChange(arquivos.filter((arquivo) => arquivo.chave !== chave));
  }

  function abrirImagem(arquivo: ArquivoRascunho) {
    setZoom(1);
    setImagemAberta({
      uri: arquivo.previewUri || arquivo.uri,
      nome: arquivo.nome,
    });
  }

  function fecharImagem() {
    setImagemAberta(null);
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

          {arquivos.length > 0 ? (
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
                {arquivos.length}
              </Text>
            </View>
          ) : null}
        </View>

        {podeSelecionar ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Adicionar anexos"
            disabled={disabled || selecionando}
            onPress={() => void selecionar()}
            style={[
              styles.botaoAdicionar,
              {
                borderColor: theme.borda,
                opacity: disabled || selecionando ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons
              name="add-outline"
              size={17}
              color={theme.textoTerciaria}
            />
            <Text
              weight="Bold"
              style={[
                styles.botaoAdicionarTexto,
                { color: theme.textoTerciaria },
              ]}
            >
              {selecionando ? "SELECIONANDO..." : "ADICIONAR"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={[styles.ajuda, { color: theme.textoSub }]}>
        {podeSelecionar
          ? "JPG, PNG, WEBP, PDF, MP4, WEBM, MOV, MP3 ou WAV. Até 30 MB por arquivo. Enviados ao salvar."
          : "Você não possui permissão para adicionar anexos."}
      </Text>

      {arquivos.length === 0 ? (
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
            Nenhum anexo selecionado
          </Text>
        </View>
      ) : (
        <View style={styles.lista}>
          {arquivos.map((arquivo) => {
            const imagem = ehImagem(arquivo);
            const uriPreview = arquivo.previewUri || arquivo.uri;

            const conteudo = (
              <>
                {imagem ? (
                  <Image
                    source={{ uri: uriPreview }}
                    style={styles.miniatura}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.iconeArquivo,
                      { backgroundColor: theme.background },
                    ]}
                  >
                    <Ionicons
                      name="document-attach-outline"
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
                    {arquivo.nome}
                  </Text>

                  <Text
                    style={[
                      styles.detalhesArquivo,
                      { color: theme.textoSub },
                    ]}
                  >
                    {tipoArquivo(arquivo)} ·{" "}
                    {tamanhoArquivo(arquivo.tamanhoBytes)}
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
                key={arquivo.chave}
                style={[
                  styles.item,
                  {
                    borderColor: theme.borda,
                    backgroundColor: theme.backgroundSecundario,
                  },
                ]}
              >
                {imagem ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Ampliar imagem ${arquivo.nome}`}
                    onPress={() => abrirImagem(arquivo)}
                    style={styles.itemPrincipal}
                  >
                    {conteudo}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.itemPrincipal}>{conteudo}</View>
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${arquivo.nome} da seleção`}
                  disabled={disabled}
                  onPress={() => remover(arquivo.chave)}
                  style={[
                    styles.botaoRemover,
                    { opacity: disabled ? 0.5 : 1 },
                  ]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={23}
                    color={theme.erro}
                  />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {erro ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.erro, { color: theme.erro }]}
        >
          {erro}
        </Text>
      ) : null}

      <Modal
        visible={imagemAberta !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={fecharImagem}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalCabecalho}>
            <Text
              weight="SemiBold"
              numberOfLines={1}
              style={styles.modalNome}
            >
              {imagemAberta?.nome}
            </Text>

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
            {imagemAberta ? (
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
                  <Image
                    source={{ uri: imagemAberta.uri }}
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
              disabled={zoom <= 0.25}
              onPress={() =>
                setZoom((atual) => Math.max(0.25, atual - 0.25))
              }
              style={[
                styles.botaoZoom,
                { opacity: zoom <= 0.25 ? 0.4 : 1 },
              ]}
            >
              <Ionicons name="remove" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text
              weight="SemiBold"
              style={styles.valorZoom}
            >
              {Math.round(zoom * 100)}%
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Aumentar zoom"
              disabled={zoom >= 3}
              onPress={() =>
                setZoom((atual) => Math.min(3, atual + 0.25))
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
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
  ajuda: {
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 11,
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
  item: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 11,
    paddingLeft: 9,
    paddingRight: 3,
  },
  itemPrincipal: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 8,
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
  botaoRemover: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  erro: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 9,
  },
  modal: {
    flex: 1,
    backgroundColor: "#080B13",
    paddingHorizontal: 16,
  },
  modalCabecalho: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalNome: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
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
    justifyContent: "center",
    flexGrow: 1
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