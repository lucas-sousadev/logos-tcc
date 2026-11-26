import FeedbackAlert from "@/components/forms/FeedbackAlert";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import {
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  Image,
} from "react-native";
import SecaoEdicao from "@/components/forms/SecaoEdicao";
import SalvarAlteracoes from "@/components/forms/SalvarAlteracoes";
import { useState, useEffect, useMemo, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "@/services/seletorArquivos";

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
  const [data, setData] = useState(
    dataISOParaBR(clipping?.data_publicacao ?? null)
  );
  const [link, setLink] = useState(slide.link ?? "");
  const [nomeVeiculo, setNomeVeiculo] = useState(veiculo?.nome ?? "");
  const [descricao, setDescricao] = useState(veiculo?.descricao ?? "");
  const [alcance, setAlcance] = useState(veiculo?.alcance ?? "");

  const [estadoImagem, setEstadoImagem] = useState<EstadoMidia>("manter");
  const [estadoLogo, setEstadoLogo] = useState<EstadoMidia>("manter");
  const [arquivoImagem, setArquivoImagem] =
    useState<ArquivoImagemRascunho | null>(null);
  const [arquivoLogo, setArquivoLogo] = useState<ArquivoMidiaSlide | null>(
    null
  );
  const enviarMidia = useMemo(
    () =>
      criarEnvioMidiaSlide((tipo, arquivo) =>
        enviarMidiaSlideRelatorio(slide.relatorio_id, slide.id, tipo, arquivo)
      ),
    [slide.relatorio_id, slide.id]
  );
  type MidiaAmpliada = { titulo: string } & (
    | { uri: string }
    | { endpoint: string }
  );
  const [midiaAmpliada, setMidiaAmpliada] = useState<MidiaAmpliada | null>(
    null
  );
  const [capturaAberta, setCapturaAberta] = useState(false);
  const podeCapturarPagina = /^https?:\/\/\S+$/i.test(link.trim());

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const selecaoEmCurso = useRef(false);
  const montado = useRef(true);
  const ocupado = salvando || selecionando;
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
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
    if (salvando || selecaoEmCurso.current) return;
    selecaoEmCurso.current = true;
    setSelecionando(true);
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (!montado.current || resultado.canceled) return;

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
      if (montado.current) setErro("Não foi possível selecionar a imagem.");
    } finally {
      selecaoEmCurso.current = false;
      if (montado.current) setSelecionando(false);
    }
  }

  const quantidadeAlteracoes = [
    pauta !== (clipping?.pauta ?? ""),
    data !== dataISOParaBR(clipping?.data_publicacao ?? null),
    link !== (slide.link ?? ""),
    nomeVeiculo !== (veiculo?.nome ?? ""),
    descricao !== (veiculo?.descricao ?? ""),
    alcance !== (veiculo?.alcance ?? ""),
    estadoImagem !== "manter",
    estadoLogo !== "manter",
  ].filter(Boolean).length;
  const saida = useSaidaFormulario(quantidadeAlteracoes > 0, ocupado);
  function fecharEdicao() {
    saida.confirmarSaida(onClose);
  }
  const salvamentoEmCurso = useRef(false);

  async function salvar() {
    if (salvamentoEmCurso.current || selecaoEmCurso.current) return;

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
    if (dataISO !== (clipping?.data_publicacao ?? null))
      dados.data_publicacao = dataISO;
    if (valor(link) !== (slide.link ?? null)) dados.link = valor(link);
    if (valor(nomeVeiculo) !== (veiculo?.nome ?? null))
      dados.veiculo_nome = valor(nomeVeiculo);
    if (valor(descricao) !== (veiculo?.descricao ?? null))
      dados.veiculo_descricao = valor(descricao);
    if (valor(alcance) !== (veiculo?.alcance ?? null))
      dados.veiculo_alcance = valor(alcance);
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

    salvamentoEmCurso.current = true;
    setSalvando(true);
    setErro("");

    try {
      if (estadoImagem === "trocar" && arquivoImagem) {
        dados.imagem_midia_id = await enviarMidia("imagem", arquivoImagem);
      }

      if (estadoLogo === "trocar" && arquivoLogo) {
        dados.logo_midia_id = await enviarMidia("logo", arquivoLogo);
      }

      await atualizarSlideRelatorio(slide.relatorio_id, slide.id, dados);
      onSaved();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o slide."
      );
    } finally {
      salvamentoEmCurso.current = false;
      setSalvando(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (saida.alertaProps.visible) saida.alertaProps.onClose();
        else if (midiaAmpliada) setMidiaAmpliada(null);
        else if (capturaAberta) setCapturaAberta(false);
        else if (!ocupado) fecharEdicao();
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
        <EdicaoCompacta ativa={true}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.overlay}
          >
            <View
              style={[
                styles.container,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.borda + "40",
                  paddingBottom: Math.max(insets.bottom, 12),
                },
              ]}
              pointerEvents={midiaAmpliada ? "none" : "auto"}
              accessibilityElementsHidden={midiaAmpliada !== null}
              importantForAccessibility={
                midiaAmpliada ? "no-hide-descendants" : "auto"
              }
            >
              <View
                style={[styles.cabecalho, { borderBottomColor: theme.borda }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="Bold" style={styles.titulo}>
                    Editar slide {slide.ordem}
                  </Text>
                  <Text style={{ color: theme.textoSub, fontSize: 12 }}>
                    As mudanças ficam somente neste relatório
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Fechar edição"
                  disabled={ocupado}
                  onPress={fecharEdicao}
                  style={styles.fechar}
                >
                  <Ionicons name="close" size={24} color={theme.texto} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1, minHeight: 0 }}
                automaticallyAdjustKeyboardInsets={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.conteudo}
              >
                <Text
                  weight="SemiBold"
                  style={[styles.rotulo, { color: theme.textoSub }]}
                >
                  PRÉVIA
                </Text>
                <RelatorioSlideVisual
                  slide={previa}
                  imagemUri={
                    estadoImagem === "trocar" ? arquivoImagem?.uri : null
                  }
                  logoUri={estadoLogo === "trocar" ? arquivoLogo?.uri : null}
                />

                <SecaoEdicao titulo="Matéria">
                  <Input
                    label="Pauta"
                    value={pauta}
                    onChangeText={setPauta}
                    maxLength={250}
                    editable={!ocupado}
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
                    disabled={ocupado}
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
                    editable={!ocupado}
                    showChanged={
                      data !== dataISOParaBR(clipping?.data_publicacao ?? null)
                    }
                    onUndo={() => {
                      setData(dataISOParaBR(clipping?.data_publicacao ?? null));
                      limparErroCampo("data");
                    }}
                    containerStyle={styles.campo}
                    error={errosCampos.data}
                    clearable
                  />
                  <Input
                    label="Link"
                    value={link}
                    onChangeText={(texto) => {
                      setLink(texto);
                      limparErroCampo("link");
                    }}
                    autoCapitalize="none"
                    keyboardType="url"
                    maxLength={2048}
                    editable={!ocupado}
                    showChanged={link !== (slide.link ?? "")}
                    onUndo={() => {
                      setLink(slide.link ?? "");
                      limparErroCampo("link");
                    }}
                    containerStyle={styles.campo}
                    error={errosCampos.link}
                    clearable
                  />
                </SecaoEdicao>
                <SecaoEdicao titulo="Veículo no slide">
                  <Input
                    label="NOME EXIBIDO"
                    value={nomeVeiculo}
                    onChangeText={setNomeVeiculo}
                    maxLength={255}
                    editable={!ocupado}
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
                    disabled={ocupado}
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
                    label="Descrição"
                    value={descricao}
                    onChangeText={setDescricao}
                    multiline
                    maxLength={3000}
                    style={styles.multilinha}
                    editable={!ocupado}
                    showChanged={descricao !== (veiculo?.descricao ?? "")}
                    onUndo={() => setDescricao(veiculo?.descricao ?? "")}
                    containerStyle={styles.campo}
                    clearable
                  />
                  <Input
                    label="Alcance"
                    value={alcance}
                    onChangeText={setAlcance}
                    multiline
                    maxLength={1000}
                    style={styles.multilinha}
                    editable={!ocupado}
                    showChanged={alcance !== (veiculo?.alcance ?? "")}
                    onUndo={() => setAlcance(veiculo?.alcance ?? "")}
                    containerStyle={styles.campo}
                    clearable
                  />
                </SecaoEdicao>

                {erro ? (
                  <Text accessibilityRole="alert" style={{ color: theme.erro }}>
                    {erro}
                  </Text>
                ) : null}

                <Text
                  weight="Medium"
                  style={[styles.textoBotaoMidia, { color: theme.textoSub }]}
                >
                  Você pode conferir as alterações na prévia acima!
                </Text>
              </ScrollView>
              <SalvarAlteracoes
                alterations={quantidadeAlteracoes}
                saving={salvando}
                busy={selecionando}
                error={erro || errosCampos.data || errosCampos.link}
                onSave={() => void salvar()}
                onDiscard={fecharEdicao}
              />
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
                <View
                  style={[styles.cabecalho, { borderBottomColor: theme.borda }]}
                >
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
          </KeyboardAvoidingView>
        </EdicaoCompacta>
      )}
      <FeedbackAlert {...saida.alertaProps} inline />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  painelMidia: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  nomeMidia: {
    flex: 1,
    marginRight: 12,
  },
  conteudoMidia: {
    flex: 1,
    padding: 16,
  },
  imagemAmpliada: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
  },
  container: {
    height: "94%",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    borderWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  cabecalho: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titulo: {
    fontSize: 19,
  },
  fechar: {
    padding: 6,
  },
  conteudo: {
    padding: 16,
    gap: 12,
  },
  campo: {
    marginBottom: 0,
  },
  rotulo: {
    fontSize: 11,
  },
  multilinha: {
    height: 92,
    minHeight: 92,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  textoBotaoMidia: {
    fontSize: 11,
    textAlign: "center",
  },
});
