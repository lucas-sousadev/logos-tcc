import { useState, useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  Image,
  ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { File as ExpoFile } from "expo-file-system";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import RelatorioSlideVisual from "@/components/relatorios/RelatorioSlideVisual";
import CapturaPaginaModal from "@/components/captura/CapturaPaginaModal";
import ClippingImagePreview from "@/components/clipping/ClippingImagePreview";

import { useTheme } from "@/contexts/ThemeContext";
import { criarEnvioMidiaSlide } from "@/services/api/envioMidiaSlide";
import RelatorioSlideCampoMidia, {
  type EstadoMidia,
} from "@/components/relatorios/RelatorioSlideCampoMidia";
import {
  atualizarSlideRelatorio,
  enviarMidiaSlideRelatorio,
  type ArquivoMidiaSlide,
  type DadosEdicaoSlide,
  type SlideRelatorio,
} from "@/services/api/relatorio";
import { obterUrlLogoVeiculo } from "@/services/api/veiculo";
import {
  dataBRParaISO,
  dataISOParaBR,
  mascararData,
} from "@/utils/clippingFormatacao";

interface Props {
  slide: SlideRelatorio;
  onClose: () => void;
  onSaved: () => void;
}


type ArquivoImagemRascunho = ArquivoMidiaSlide & {
  geradoPelaCaptura?: boolean;
};

function valor(texto: string): string | null {
  return texto.trim() || null;
}

export default function RelatorioSlideEdicaoModal({
  slide,
  onClose,
  onSaved,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const clipping = slide.dados_json?.clipping;
  const veiculo = slide.dados_json?.veiculo;
  const imagemAtual = Boolean(slide.imagem_midia_id || slide.imagem_anexo_id);
  const logoAtual = Boolean(slide.logo_midia_id || veiculo?.logo_path);

  const [pauta, setPauta] = useState(clipping?.pauta ?? "");
  const [data, setData] = useState(dataISOParaBR(clipping?.data_publicacao ?? null));
  const [link, setLink] = useState(slide.link ?? "");
  const [nomeVeiculo, setNomeVeiculo] = useState(veiculo?.nome ?? "");
  const [descricao, setDescricao] = useState(veiculo?.descricao ?? "");
  const [alcance, setAlcance] = useState(veiculo?.alcance ?? "");

  const [estadoImagem, setEstadoImagem] = useState<EstadoMidia>("manter");
  const [estadoLogo, setEstadoLogo] = useState<EstadoMidia>("manter");
  const [arquivoImagem, setArquivoImagem] = useState<ArquivoImagemRascunho | null>(null);
  const [arquivoLogo, setArquivoLogo] = useState<ArquivoMidiaSlide | null>(null);
  const enviarMidia = useMemo(
    () =>
      criarEnvioMidiaSlide((tipo, arquivo) =>
        enviarMidiaSlideRelatorio(
          slide.relatorio_id,
          slide.id,
          tipo,
          arquivo
        )
      ),
    [slide.relatorio_id, slide.id]
  );
  type MidiaAmpliada = { titulo: string } & (
    { uri: string } | { endpoint: string }
  );
  const [midiaAmpliada, setMidiaAmpliada] = useState<MidiaAmpliada | null>(null);
  const [capturaAberta, setCapturaAberta] = useState(false);
  const podeCapturarPagina =
    /^https?:\/\/\S+$/i.test(link.trim());

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errosCampos, setErrosCampos] = useState<{
    data?: string;
    link?: string;
  }>({});

  useEffect(() => {
    return () => {
      if (!arquivoImagem?.geradoPelaCaptura) return;

      if (Platform.OS === "web") {
        if (arquivoImagem.uri.startsWith("blob:")) {
          URL.revokeObjectURL(arquivoImagem.uri);
        }
        return;
      }

      try {
        const arquivo = new ExpoFile(arquivoImagem.uri);
        if (arquivo.exists) arquivo.delete();
      } catch {
        // o sistema também pode limpar os arquivos de cache
      }
    };
  }, [arquivoImagem]);

  function limparErroCampo(campo: "data" | "link") {
    setErrosCampos((atuais) => ({ ...atuais, [campo]: undefined }));
    setErro("");
  }

  const dataISO = data.trim() ? dataBRParaISO(data) : null;

  const previa: SlideRelatorio = {
    ...slide,
    titulo: valor(pauta)?.slice(0, 255) ?? null,
    link: valor(link),
    imagem_midia_id: estadoImagem === "manter" ? slide.imagem_midia_id : null,
    imagem_anexo_id: estadoImagem === "manter" ? slide.imagem_anexo_id : null,
    logo_midia_id: estadoLogo === "manter" ? slide.logo_midia_id : null,
    dados_json: {
      ...slide.dados_json,
      clipping: {
        ...clipping,
        pauta: valor(pauta),
        data_publicacao: dataISO,
        link: valor(link),
      },
      veiculo: {
        ...veiculo,
        nome: valor(nomeVeiculo),
        descricao: valor(descricao),
        alcance: valor(alcance),
        logo_path: estadoLogo === "manter" ? veiculo?.logo_path : null,
      },
      imagem: {
        ...slide.dados_json?.imagem,
        anexo_id: estadoImagem === "manter" ? slide.imagem_anexo_id : null,
        arquivo_path:
          estadoImagem === "manter"
            ? slide.dados_json?.imagem?.arquivo_path
            : null,
      },
    },
  };

  function ampliarMidia(tipo: "imagem" | "logo") {
    const imagem = tipo === "imagem";
    const estado = imagem ? estadoImagem : estadoLogo;
    const arquivo = imagem ? arquivoImagem : arquivoLogo;
    const titulo = imagem ? "Imagem do slide" : "Logo do veículo";

    if (estado === "trocar" && arquivo) {
      setMidiaAmpliada({ titulo: arquivo.nome, uri: arquivo.uri });
      return;
    }

    if (estado !== "manter") return;

    const id = imagem ? slide.imagem_midia_id : slide.logo_midia_id;

    if (id) {
      setMidiaAmpliada({
        titulo,
        endpoint: `/relatorios/${slide.relatorio_id}/midias/${id}`,
      });
      return;
    }

    if (imagem && slide.clipping_id && slide.imagem_anexo_id) {
      setMidiaAmpliada({
        titulo,
        endpoint: `/clippings/${slide.clipping_id}/anexos/${slide.imagem_anexo_id}/arquivo`,
      });
    }

    if (!imagem) {
      const uri = obterUrlLogoVeiculo(veiculo?.logo_path);
      if (uri) setMidiaAmpliada({ titulo, uri });
    }
  }

  async function escolherMidia(tipo: "imagem" | "logo") {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (resultado.canceled) return;

      const escolhido = resultado.assets[0];

      if (!escolhido || (escolhido.size ?? 0) > 10 * 1024 * 1024) {
        setErro("Selecione uma imagem JPG, PNG ou WEBP de até 10 MB.");
        return;
      }

      const arquivo: ArquivoMidiaSlide = {
        uri: escolhido.uri,
        nome: escolhido.name,
        mimeType: escolhido.mimeType ?? "application/octet-stream",
        file: escolhido.file,
      };

      if (tipo === "imagem") {
        setArquivoImagem(arquivo);
        setEstadoImagem("trocar");
      } else {
        setArquivoLogo(arquivo);
        setEstadoLogo("trocar");
      }

      setErro("");
    } catch {
      setErro("Não foi possível selecionar a imagem.");
    }
  }

  async function salvar() {
    if (salvando) return;

    const novosErros: { data?: string; link?: string } = {};

    if (data.trim() && !dataISO) {
      novosErros.data = "Informe uma data válida em DD/MM/AAAA.";
    }

    if (valor(link) && !/^https?:\/\/\S+$/i.test(link.trim())) {
      novosErros.link = "Informe um link HTTP ou HTTPS válido.";
    }

    setErrosCampos(novosErros);

    if (Object.keys(novosErros).length > 0) {
      setErro("");
      return;
    }

    if (estadoImagem === "trocar" && !arquivoImagem) return;
    if (estadoLogo === "trocar" && !arquivoLogo) return;

    const dados: DadosEdicaoSlide = {};

    if (valor(pauta) !== (clipping?.pauta ?? null)) dados.pauta = valor(pauta);
    if (dataISO !== (clipping?.data_publicacao ?? null)) dados.data_publicacao = dataISO;
    if (valor(link) !== (slide.link ?? null)) dados.link = valor(link);
    if (valor(nomeVeiculo) !== (veiculo?.nome ?? null)) dados.veiculo_nome = valor(nomeVeiculo);
    if (valor(descricao) !== (veiculo?.descricao ?? null)) dados.veiculo_descricao = valor(descricao);
    if (valor(alcance) !== (veiculo?.alcance ?? null)) dados.veiculo_alcance = valor(alcance);
    if (estadoImagem === "remover") dados.imagem_midia_id = null;
    if (estadoLogo === "remover") dados.logo_midia_id = null;

    if (
      Object.keys(dados).length === 0 &&
      estadoImagem !== "trocar" &&
      estadoLogo !== "trocar"
    ) {
      onClose();
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      if (estadoImagem === "trocar" && arquivoImagem) {
        dados.imagem_midia_id = await enviarMidia(
          "imagem",
          arquivoImagem
        );
      }

      if (estadoLogo === "trocar" && arquivoLogo) {
        dados.logo_midia_id = await enviarMidia(
          "logo",
          arquivoLogo
        );
      }

      await atualizarSlideRelatorio(slide.relatorio_id, slide.id, dados);
      onSaved();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o slide.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (midiaAmpliada) setMidiaAmpliada(null);
        else if (capturaAberta) setCapturaAberta(false);
        else if (!salvando) onClose();
      }}
    >
      {capturaAberta ? (
        <CapturaPaginaModal
          embutido
          visivel
          link={link.trim()}
          origem="relatorio"
          onFechar={() => setCapturaAberta(false)}
          onConfirmar={(imagem) => {
            setArquivoImagem({
              uri: imagem.uri,
              nome: imagem.nome,
              mimeType: imagem.mimeType,
              file: imagem.file,
              geradoPelaCaptura: true,
            });
            setEstadoImagem("trocar");
            setErro("");
            setCapturaAberta(false);
          }}
        />
      ) : (
        <View style={styles.overlay}>
          <View
            style={[
              styles.container,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
            pointerEvents={midiaAmpliada ? "none" : "auto"}
            accessibilityElementsHidden={midiaAmpliada !== null}
            importantForAccessibility={midiaAmpliada ? "no-hide-descendants" : "auto"}
          >
            <View style={[styles.cabecalho, { borderBottomColor: theme.borda }]}>
              <View>
                <Text weight="Bold" style={styles.titulo}>Editar slide {slide.ordem}</Text>
                <Text style={{ color: theme.textoSub, fontSize: 12 }}>
                  As mudanças ficam somente neste relatório
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar edição"
                disabled={salvando}
                onPress={onClose}
                style={styles.fechar}
              >
                <Ionicons name="close" size={24} color={theme.texto} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.conteudo}>
              <Text weight="SemiBold" style={[styles.rotulo, { color: theme.textoSub }]}>
                PRÉVIA
              </Text>
              <RelatorioSlideVisual
                slide={previa}
                imagemUri={estadoImagem === "trocar" ? arquivoImagem?.uri : null}
                logoUri={estadoLogo === "trocar" ? arquivoLogo?.uri : null}
              />

              <View style={[styles.secao, { borderTopColor: theme.borda }]}>
                <Text weight="Bold">MATÉRIA</Text>
                <Input
                  label="PAUTA"
                  value={pauta}
                  onChangeText={setPauta}
                  maxLength={250}
                  editable={!salvando}
                  showChanged={pauta !== (clipping?.pauta ?? "")}
                  onUndo={() => setPauta(clipping?.pauta ?? "")}
                  containerStyle={styles.campo}
                  clearable
                />
                {pauta.length >= 75 ? (
                  <Text style={{ color: theme.aviso, fontSize: 12 }}>
                    {Math.max(0, 250 - pauta.length)} caracteres restantes
                  </Text>
                ) : null}
                <RelatorioSlideCampoMidia
                  tipo="imagem"
                  estado={estadoImagem}
                  temOriginal={imagemAtual}
                  arquivo={arquivoImagem}
                  disabled={salvando}
                  onEscolher={() => void escolherMidia("imagem")}
                  onAmpliar={() => ampliarMidia("imagem")}
                  onRemover={() => {
                    setEstadoImagem(imagemAtual ? "remover" : "manter");
                    setArquivoImagem(null);
                  }}
                  onDesfazer={() => {
                    setEstadoImagem("manter");
                    setArquivoImagem(null);
                  }}
                  onCapturar={() => setCapturaAberta(true)}
                  capturaDisponivel={podeCapturarPagina}
                />
                <Input
                  label="DATA DE PUBLICAÇÃO"
                  value={data}
                  onChangeText={(texto) => {
                    setData(mascararData(texto));
                    limparErroCampo("data");
                  }}
                  placeholder="DD/MM/AAAA"
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!salvando}
                  showChanged={data !== dataISOParaBR(clipping?.data_publicacao ?? null)}
                  onUndo={() => {
                    setData(dataISOParaBR(clipping?.data_publicacao ?? null));
                    limparErroCampo("data");
                  }}                
                  containerStyle={styles.campo}
                  error={errosCampos.data}
                  clearable
                />
                <Input 
                  label="LINK" 
                  value={link} 
                  onChangeText={(texto) => {
                    setLink(texto);
                    limparErroCampo("link");
                  }}
                  autoCapitalize="none" 
                  keyboardType="url" 
                  maxLength={2048} 
                  editable={!salvando} 
                  showChanged={link !== (slide.link ?? "")}
                  onUndo={() => {
                    setLink(slide.link ?? "");
                    limparErroCampo("link");
                  }}
                  containerStyle={styles.campo}
                  error={errosCampos.link}
                  clearable
                />
              </View>
              <View style={[styles.secao, { borderTopColor: theme.borda }]}>
                <Text weight="Bold">VEÍCULO NO SLIDE</Text>
                <Input 
                  label="NOME EXIBIDO" 
                  value={nomeVeiculo} 
                  onChangeText={setNomeVeiculo} 
                  maxLength={255} 
                  editable={!salvando} 
                  showChanged={nomeVeiculo !== (veiculo?.nome ?? "")}
                  onUndo={() => setNomeVeiculo(veiculo?.nome ?? "")}
                  containerStyle={styles.campo}
                  clearable
                />
                  <RelatorioSlideCampoMidia
                    tipo="logo"
                    estado={estadoLogo}
                    temOriginal={logoAtual}
                    arquivo={arquivoLogo}
                    disabled={salvando}
                    onEscolher={() => void escolherMidia("logo")}
                    onAmpliar={() => ampliarMidia("logo")}
                    onRemover={() => {
                      setEstadoLogo(logoAtual ? "remover" : "manter");
                      setArquivoLogo(null);
                    }}
                    onDesfazer={() => {
                      setEstadoLogo("manter");
                      setArquivoLogo(null);
                    }}
                  />

                <Input 
                  label="DESCRIÇÃO" 
                  value={descricao} 
                  onChangeText={setDescricao} 
                  multiline maxLength={3000} 
                  style={styles.multilinha} 
                  editable={!salvando} 
                  showChanged={descricao !== (veiculo?.descricao ?? "")}
                  onUndo={() => setDescricao(veiculo?.descricao ?? "")}
                  containerStyle={styles.campo}
                  clearable
                />
                <Input 
                  label="ALCANCE" 
                  value={alcance} 
                  onChangeText={setAlcance} 
                  multiline maxLength={1000} 
                  style={styles.multilinha} 
                  editable={!salvando} 
                  showChanged={alcance !== (veiculo?.alcance ?? "")}
                  onUndo={() => setAlcance(veiculo?.alcance ?? "")}
                  containerStyle={styles.campo}
                  clearable
                />
              
              </View>

              {erro ? <Text accessibilityRole="alert" style={{ color: theme.erro }}>{erro}</Text> : null}
              <View style={styles.acoes}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar edição do slide"
                  disabled={salvando}
                  activeOpacity={0.8}
                  onPress={onClose}
                  style={[
                    styles.botaoMidia,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.borda,
                      opacity: salvando ? 0.5 : 1,
                      padding: 12,
                    },
                  ]}
                >
                  <Ionicons name="close-outline" size={16} color={theme.textoSub} />
                  <Text weight="SemiBold" style={[styles.textoBotaoMidia, { color: theme.textoSub }]}>
                    CANCELAR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Salvar slide"
                  disabled={salvando}
                  activeOpacity={0.8}
                  onPress={() => void salvar()}
                  style={[
                    styles.botaoMidia,
                    {
                      backgroundColor: theme.primaria,
                      borderColor: theme.primaria,
                      opacity: salvando ? 0.5 : 1,
                      padding: 12,
                    },
                  ]}
                >
                  {salvando ? (
                    <ActivityIndicator size="small" color={theme.branco} />
                  ) : (
                    <Ionicons name="checkmark-outline" size={16} color={theme.branco} />
                  )}
                  <Text weight="Bold" style={[styles.textoBotaoMidia, { color: theme.branco }]}>
                    SALVAR SLIDE
                  </Text>
                </TouchableOpacity>
              </View>
              <Text weight="Medium" style={[styles.textoBotaoMidia, { color: theme.textoSub }]}>
                  Você pode conferir as alterações na prévia acima!
              </Text>
            </ScrollView>
          </View>
          {midiaAmpliada ? (
            <View
              accessibilityViewIsModal
              style={[
                styles.painelMidia,
                {
                  backgroundColor: theme.background,
                  paddingTop: insets.top,
                  paddingBottom: Math.max(insets.bottom, 12),
                },
              ]}
            >
              <View style={[styles.cabecalho, { borderBottomColor: theme.borda }]}>
                <Text
                  weight="Bold"
                  numberOfLines={1}
                  style={[styles.titulo, styles.nomeMidia]}
                >
                  {midiaAmpliada.titulo}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Fechar visualização"
                  onPress={() => setMidiaAmpliada(null)}
                  style={styles.fechar}
                >
                  <Ionicons name="close" size={24} color={theme.texto} />
                </TouchableOpacity>
              </View>

              <View style={styles.conteudoMidia}>
                {"endpoint" in midiaAmpliada ? (
                  <ClippingImagePreview
                    endpoint={midiaAmpliada.endpoint}
                    nome={midiaAmpliada.titulo}
                    resizeMode="contain"
                    style={styles.imagemAmpliada}
                  />
                ) : (
                  <Image
                    source={{ uri: midiaAmpliada.uri }}
                    accessibilityLabel={midiaAmpliada.titulo}
                    resizeMode="contain"
                    style={styles.imagemAmpliada}
                  />
                )}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    justifyContent: "flex-end", 
    backgroundColor: "rgba(0, 0, 0, 0.48)" 
  },
  painelMidia: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  nomeMidia: { 
    flex: 1, 
    marginRight: 12 
  },
  conteudoMidia: { 
    flex: 1,
    padding: 16 
  },
  imagemAmpliada: { 
    width: "100%", 
    height: "100%", 
    borderRadius: 0 
  },
  container: { 
    maxHeight: "94%", 
    borderWidth: 1.5, 
    borderTopLeftRadius: 22, 
    borderTopRightRadius: 22, 
    overflow: "hidden" 
  },
  cabecalho: { 
    padding: 16,
    borderBottomWidth: 1, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between" 
  },
  titulo: { 
    fontSize: 19 
  },
  fechar: { 
    padding: 6 
  },
  conteudo: { 
    padding: 16, 
    gap: 12 
  },
  secao: { 
    borderTopWidth: 1, 
    paddingTop: 14, 
    gap: 10 
  },
  campo: { 
    marginBottom: 0 
  },
  rotulo: { 
    fontSize: 11 
  },
  multilinha: {
    height: 92,
    minHeight: 92,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  botaoMidia: {
    flex: 1,
    minHeight: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
  },
  textoBotaoMidia: { 
    fontSize: 11, 
    textAlign: "center" 
  },
  acoes: {
  flexDirection: "row",
    gap: 7,
    marginTop: 4,
  },
});
