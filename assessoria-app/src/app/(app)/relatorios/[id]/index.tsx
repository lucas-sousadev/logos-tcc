import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity
} from "react-native";
import {
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import RelatorioSlidePreview from "@/components/relatorios/RelatorioSlidePreview";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import RelatorioEdicaoModal from "@/components/relatorios/RelatorioEdicaoModal";
import AcoesDetalhes from "@/components/ui/AcoesDetalhes";
import SearchBar from "@/components/ui/SearchBar";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  buscarRelatorio,
  excluirSlidesRelatorio,
  completarDadosVeiculosRelatorio,
  gerarPptxTeste,
  decidirRevisaoSlide,
  type PaginacaoRelatorio,
  type RelatorioDetalhado,
  type SlideRelatorio,
  type OrigemRevisao,
  type DecisaoRevisaoSlide,
} from "@/services/api/relatorio";
import { excluirRelatorio } from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";


const PAGINACAO_INICIAL: PaginacaoRelatorio = {
  page: 1,
  limit: 20,
  total: 0,
  has_next: false,
};

type AcaoSlides = "VALIDAR" | "IGNORAR" | "EXCLUIR";

function nomeTipoSlide(tipo: SlideRelatorio["tipo"]) {
  switch (tipo) {
    case "CAPA":
      return "CAPA";
    case "CLIPPING":
      return "MATÉRIA";
    case "COMPLEMENTAR":
      return "COMPLEMENTAR";
    case "ENCERRAMENTO":
      return "ENCERRAMENTO";
  }
}

function tituloSlide(slide: SlideRelatorio) {
  if (slide.tipo === "CLIPPING") {
    return (
      slide.dados_json?.clipping?.pauta?.trim() ||
      slide.titulo?.trim() ||
      "Matéria sem pauta"
    );
  }

  return slide.titulo?.trim() || nomeTipoSlide(slide.tipo);
}

function avisoSlide(slide: SlideRelatorio): string | null {
  if (slide.revisao_pendente) return "NOVO SLIDE";

  if (
    slide.revisao_veiculo_pendente &&
    slide.revisao_clipping_pendente
  ) {
    return "VEÍCULO E CLIPPING";
  }

  if (slide.revisao_veiculo_pendente) {
    return "VEÍCULO ALTERADO";
  }

  if (slide.revisao_clipping_pendente) {
    return "CLIPPING ALTERADO";
  }

  return null;
}

function CartaoSlide({
  slide,
  onPress,
  onDecidir,
  onIgnorar,
  onSelecionar,
  decidindo,
  podeEditar,
  erro,
  modoSelecao,
  selecionavel,
  selecionado,
}: {
  slide: SlideRelatorio;
  onPress: () => void;
  onDecidir: () => void;
  onIgnorar: () => void;
  decidindo: boolean;
  podeEditar: boolean;
  erro?: string;
  modoSelecao: boolean;
  selecionavel: boolean;
  selecionado: boolean;
  onSelecionar: () => void;
}) {
  const { theme } = useTheme();
  const ehMateria = slide.tipo === "CLIPPING";
  const aviso = avisoSlide(slide);
  const veiculo =
    slide.dados_json?.veiculo?.nome?.trim() || "Sem veículo";
  const data =
    dataISOParaBR(
      slide.dados_json?.clipping?.data_publicacao ?? null
    ) || "Sem data";
  const imagemDefinida = Boolean(slide.imagem_midia_id || slide.imagem_anexo_id);

  return (
    <View
      style={[
        styles.slideGrupo,
        {
          backgroundColor: theme.backgroundSecundario,
          borderColor: selecionado
            ? theme.primaria
            : aviso
              ? theme.aviso
              : theme.borda,
        },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          modoSelecao && selecionavel
            ? `${selecionado ? "Desmarcar" : "Selecionar"} slide ${slide.ordem}`
            : `Abrir slide ${slide.ordem}`
        }
        accessibilityState={
          modoSelecao && selecionavel
            ? { selected: selecionado }
            : undefined
        }
        onPress={
          modoSelecao && selecionavel
            ? onSelecionar
            : onPress
        }
        activeOpacity={0.8}
        style={styles.slideCard}
      >
        <View style={styles.slideTop}>
          {modoSelecao && selecionavel ? (
            <View
              style={[
                styles.selecaoCheckbox,
                {
                  borderColor: selecionado
                    ? theme.backgroundContainer
                    : theme.borda,
                  backgroundColor: selecionado
                    ? theme.backgroundContainer
                    : theme.background,
                },
              ]}
            >
              {selecionado ? (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={theme.textoContainer}
                />
              ) : null}
            </View>
          ) : null }
          <View
            style={[
              styles.numeroSlide,
              { backgroundColor: `${theme.borda}22` },
            ]}
          >
            <Text
              weight="Bold"
              style={[
                styles.numeroSlideTexto,
                { color: theme.textoTerciaria },
              ]}
            >
              {String(slide.ordem).padStart(2, "0")}
            </Text>
          </View>
          <Text
            weight="SemiBold"
            style={[
              styles.tipoSlide,
              { color: theme.texto },
            ]}
          >
            {nomeTipoSlide(slide.tipo)}
          </Text>
          {aviso ? (
            <View
              style={[
                styles.pendente,
                { backgroundColor: `${theme.aviso}18` },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color={theme.aviso}
              />
              <Text
                weight="SemiBold"
                style={[
                  styles.pendenteTexto,
                  { color: theme.aviso },
                ]}
              >
                {aviso}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          weight="SemiBold"
          numberOfLines={2}
          style={styles.tituloSlide}
        >
          {tituloSlide(slide)}
        </Text>

        {ehMateria ? (
          <>
            <View style={styles.metadadosSlide}>
              <Ionicons
                name="newspaper-outline"
                size={15}
                color={theme.textoTerciaria}
              />
              <Text
                weight="Medium"
                numberOfLines={1}
                style={[
                  styles.veiculoSlide,
                  { color: theme.textoTerciaria },
                ]}
              >
                {veiculo}
              </Text>
              <Text
                style={[
                  styles.dataSlide,
                  { color: theme.textoSub },
                ]}
              >
                {data}
              </Text>
            </View>

            <View style={styles.imagemSlide}>
              <Ionicons
                name="image-outline"
                size={14}
                color={
                  imagemDefinida
                    ? theme.textoSub
                    : theme.aviso
                }
              />
              <Text
                style={[
                  styles.imagemTexto,
                  {
                    color: imagemDefinida
                      ? theme.textoSub
                      : theme.aviso,
                  },
                ]}
              >
                {imagemDefinida
                  ? "Imagem definida"
                  : "Sem imagem para o slide"}
              </Text>
            </View>
          </>
        ) : null}
      </TouchableOpacity>
        {aviso && !modoSelecao ? (
        <View
          style={[
            styles.slideRevisaoRodape,
            { borderTopColor: `${theme.aviso}60` },
          ]}
        >
          <View style={styles.slideRevisaoMensagem}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={theme.aviso}
            />
            <Text style={{ color: theme.textoSub, flex: 1, fontSize: 11 }}>
              {slide.revisao_pendente
                ? "Novo slide aguardando confirmação"
                : "Toque no slide para conferir as alterações"}
            </Text>
          </View>

          {podeEditar ? (
            <View style={styles.slideRevisaoAcoes}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  slide.revisao_pendente
                    ? "Incluir slide no relatório"
                    : "Aplicar alterações ao slide"
                }
                onPress={onDecidir}
                disabled={decidindo}
                style={[
                  styles.slideRevisaoBotao,
                  {
                    borderColor: theme.primaria,
                    backgroundColor: theme.primaria,
                  },
                ]}
              >
                {decidindo ? (
                  <ActivityIndicator size="small" color={theme.branco} />
                ) : (
                  <Ionicons
                    name="checkmark-outline"
                    size={16}
                    color={theme.branco}
                  />
                )}
                <Text weight="Bold" style={{ color: theme.branco, fontSize: 11 }}>
                  {slide.revisao_pendente ? "INCLUIR" : "ATUALIZAR"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Ignorar revisão do slide"
                accessibilityState={{ disabled: decidindo }}
                disabled={decidindo}
                onPress={onIgnorar}
                style={[
                  styles.slideRevisaoBotao,
                  {
                    borderColor: theme.borda,
                    backgroundColor: theme.background,
                    opacity: decidindo ? 0.5 : 1
                  },
                ]}
              >
                <Ionicons name="close-outline" size={16} color={theme.textoSub} />
                <Text weight="SemiBold" style={{ color: theme.textoSub, fontSize: 11 }}>
                  IGNORAR
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {erro ? (
            <Text style={{ color: theme.erro, fontSize: 11 }}>
              {erro}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}


export default function DetalheRelatorio() {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    origem?: string;
  }>();
  const id = Number(params.id);
  const scrollRef = useRef<ScrollView>(null);
  const focado = useIsFocused();
  
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtroRevisao, setFiltroRevisao] = useState<"todas" | "pendentes">("todas");
  const [origensRevisao, setOrigensRevisao] = useState<OrigemRevisao[]>([
    "novo",
    "veiculo",
    "clipping",
  ]); 
    
  const [tentativa, setTentativa] = useState(0);
  const [relatorio, setRelatorio] =
    useState<RelatorioDetalhado | null>(null);
  const [slides, setSlides] = useState<SlideRelatorio[]>([]);
  const [paginacao, setPaginacao] =
    useState<PaginacaoRelatorio>(PAGINACAO_INICIAL);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [slideAberto, setSlideAberto] =useState<SlideRelatorio | null>(null);
  const [slideDecidindoId, setSlideDecidindoId] = useState<number | null>(null);
  const [slideParaIgnorar, setSlideParaIgnorar] = useState<SlideRelatorio | null>(null);
  const [slideParaAtualizar, setSlideParaAtualizar] = useState<SlideRelatorio | null>(null);
  const [erroSlide, setErroSlide] = useState<{
    id: number;
    mensagem: string;
  } | null>(null);
  
  const [modoSelecaoSlides, setModoSelecaoSlides] = useState(false);
  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);
  const [acaoSlides, setAcaoSlides] = useState<{
    tipo: AcaoSlides;
    slides: SlideRelatorio[];
  } | null>(null);
  const [processandoAcaoSlides, setProcessandoAcaoSlides] = useState(false);
  const [mensagemAcaoSlides, setMensagemAcaoSlides] = useState("");

  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] =useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [edicaoSalva, setEdicaoSalva] = useState(false);
  const [confirmarDadosVeiculos, setConfirmarDadosVeiculos] = useState(false);
  const [atualizandoDadosVeiculos, setAtualizandoDadosVeiculos] = useState(false);
  const [resultadoDadosVeiculos, setResultadoDadosVeiculos] = useState("");

  const [exportandoPptx, setExportandoPptx] = useState(false);
  const [mensagemPptx, setMensagemPptx] = useState("");
  const travaPptx = useRef(false);

  const slidesSelecionaveis = slides.filter(
    (slide) =>
      slide.tipo === "CLIPPING" ||
      slide.tipo === "COMPLEMENTAR"
  );

  const slidesSelecionados = slidesSelecionaveis.filter(
    (slide) => idsSelecionados.includes(slide.id)
  );

  const revisoesSelecionadas = slidesSelecionados.filter(
    (slide) => avisoSlide(slide) !== null
  );

  const todosVisiveisSelecionados =
    slidesSelecionaveis.length > 0 &&
    slidesSelecionaveis.every((slide) =>
      idsSelecionados.includes(slide.id)
    );

  useFocusEffect(
    useCallback(() => {
      if (!Number.isSafeInteger(id) || id < 1) {
        setRelatorio(null);
        setSlides([]);
        setCarregando(false);
        setErro("Relatório inválido.");
        return;
      }

      let ativo = true;

      async function carregar() {
        setCarregando(true);
        setErro("");
        setSlides([]);

        try {
          const resposta = await buscarRelatorio(id, pagina, buscaAplicada, filtroRevisao, origensRevisao);

          if (!ativo) return;

          setRelatorio(resposta.relatorio);
          setSlides(resposta.slides);
          setSlideAberto((atual) =>
            atual
              ? resposta.slides.find((slide) => slide.id === atual.id) ?? atual
              : null
          );
          setPaginacao(resposta.pagination);
        } catch (e) {
          if (!ativo) return;

          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível abrir o relatório."
          );
        } finally {
          if (ativo) setCarregando(false);
        }
      }

      void carregar();

      return () => {
        ativo = false;
      };
    }, [id, pagina, tentativa, buscaAplicada, filtroRevisao, origensRevisao])
  );
  useEffect(() => {
    setIdsSelecionados([]);
  }, [pagina, buscaAplicada, filtroRevisao, origensRevisao]);

  function alternarSlideSelecionado(slideId: number) {
    setIdsSelecionados((atuais) =>
      atuais.includes(slideId)
        ? atuais.filter((id) => id !== slideId)
        : [...atuais, slideId]
    );
  }

  function alternarTodosVisiveis() {
    setIdsSelecionados(
      todosVisiveisSelecionados
        ? []
        : slidesSelecionaveis.map((slide) => slide.id)
    );
  }

  function sairSelecaoSlides() {
    setModoSelecaoSlides(false);
    setIdsSelecionados([]);
  }

  function pedirAcaoSlides(
    tipo: AcaoSlides,
    candidatos: SlideRelatorio[]
  ) {
    const alvos =
      tipo === "EXCLUIR"
        ? candidatos.filter(
            (slide) =>
              slide.tipo === "CLIPPING" ||
              slide.tipo === "COMPLEMENTAR"
          )
        : candidatos.filter(
            (slide) => avisoSlide(slide) !== null
          );

    if (alvos.length === 0) return;

    setErroAcao("");
    setMensagemAcaoSlides("");
    setAcaoSlides({ tipo, slides: alvos });
  }

  async function executarAcaoSlides() {
    if (!relatorio || !acaoSlides || processandoAcaoSlides) return;

    const { tipo, slides: alvos } = acaoSlides;
    let concluidos = 0;

    setProcessandoAcaoSlides(true);
    setErroAcao("");
    setMensagemAcaoSlides("");

    try {
      if (tipo === "EXCLUIR") {
        const resultado = await excluirSlidesRelatorio(
          relatorio.id,
          alvos.map((slide) => slide.id)
        );
        concluidos = resultado.slides_excluidos;
      } else {
        for (const slide of alvos) {
          if (!slide.revisao_token) {
            throw new Error(
              `A revisão do slide ${slide.ordem} mudou. Reabra o relatório.`
            );
          }

          const decisao: DecisaoRevisaoSlide =
            tipo === "IGNORAR"
              ? "IGNORAR"
              : slide.revisao_pendente
                ? "INCLUIR"
                : "ALTERAR";

          await decidirRevisaoSlide(
            relatorio.id,
            slide.id,
            decisao,
            slide.revisao_token
          );
          concluidos++;
        }
      }

      setMensagemAcaoSlides(
        `${concluidos} ${
          concluidos === 1 ? "slide processado" : "slides processados"
        } com sucesso.`
      );
    } catch (error) {
      const detalhe =
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação.";

      setErroAcao(
        concluidos > 0
          ? `${concluidos} slide(s) processado(s). A operação parou: ${detalhe}`
          : detalhe
      );
    } finally {
      setAcaoSlides(null);
      sairSelecaoSlides();
      setPagina(1);
      setTentativa((atual) => atual + 1);
      setProcessandoAcaoSlides(false);
    }
  }
  function pesquisarSlides() {
    const termo = busca.trim();

    if (termo === buscaAplicada && pagina === 1) {
      setTentativa((atual) => atual + 1);
      return;
    }

    setPagina(1);
    setBuscaAplicada(termo);
  }

  function limparBuscaSlides() {
    setPagina(1);
    setBusca("");
    setBuscaAplicada("");
  }

  function mudarPagina(proximaPagina: number) {
    setPagina(proximaPagina);
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }

  const totalPaginas = Math.max(
    1,
    Math.ceil(paginacao.total / paginacao.limit)
  );
  const inicioPagina =
    (paginacao.page - 1) * paginacao.limit + 1;
  const fimPagina = Math.min(
    paginacao.page * paginacao.limit,
    paginacao.total
  );  

  async function removerRelatorio() {
    if (!relatorio || excluindo) return;

    setExcluindo(true);
    setErroAcao("");

    try {
      await excluirRelatorio(relatorio.id);
      setConfirmarExclusao(false);
      router.replace("/relatorios");
    } catch (e) {
      setConfirmarExclusao(false);
      setErroAcao(
        e instanceof Error
          ? e.message
          : "Não foi possível excluir o relatório."
      );
    } finally {
      setExcluindo(false);
    }
  }

  function fecharEdicao() {
    setEdicaoAberta(false);

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  async function completarDadosVeiculos() {
    if (!relatorio || atualizandoDadosVeiculos) return;

    setAtualizandoDadosVeiculos(true);
    setErroAcao("");
    setResultadoDadosVeiculos("");

    try {
      const resposta = await completarDadosVeiculosRelatorio(
        relatorio.id
      );

      const quantidade = resposta.slides_atualizados; 

      setResultadoDadosVeiculos(
        quantidade === 0
          ? "Nenhum slide tinha descrição ou alcance ausente para completar."
          : `${quantidade} ${
              quantidade === 1 ? "slide atualizado" : "slides atualizados"
            } com dados dos veículos.`
      );

      setConfirmarDadosVeiculos(false);
      setTentativa((atual) => atual + 1);
    } catch (error) {
      setConfirmarDadosVeiculos(false);
      setErroAcao(
        error instanceof Error
          ? error.message
          : "Não foi possível completar os dados dos veículos."
      );
    } finally {
      setAtualizandoDadosVeiculos(false);
    }
  }

  async function exportarPptx() {
    if (!relatorio || travaPptx.current) return;

    travaPptx.current = true;
    setExportandoPptx(true);
    setMensagemPptx("");
    setErroAcao("");

    try {
      if (
        Platform.OS !== "web" &&
        !(await Sharing.isAvailableAsync())
      ) {
        throw new Error(
          "O compartilhamento de arquivos não está disponível neste dispositivo."
        );
      }

      const conteudo = await gerarPptxTeste(relatorio.id);
      const nomeArquivo = `relatorio-${relatorio.id}-teste.pptx`;
      const tipo =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";

      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([conteudo], { type: tipo })
        );
        const link = document.createElement("a");

        try {
          link.href = url;
          link.download = nomeArquivo;
          document.body.appendChild(link);
          link.click();
        } finally {
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        setMensagemPptx("O download do PPTX foi iniciado.");
      } else {
        const arquivo = new File(Paths.cache, nomeArquivo);
        arquivo.write(new Uint8Array(conteudo));

        await Sharing.shareAsync(arquivo.uri, {
          mimeType: tipo,
          dialogTitle: "Exportar relatório",
        });

        setMensagemPptx(
          "PPTX preparado. Escolha onde salvar ou enviar o arquivo."
        );
      }
    } catch (error) {
      setErroAcao(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PPTX."
      );
    } finally {
      travaPptx.current = false;
      setExportandoPptx(false);
    }
  }

  function recarregarAposRevisao(removido = false) {
    if (
      pagina > 1 &&
      slides.length === 1 &&
      (filtroRevisao === "pendentes" || removido)
    ) {
      setPagina(pagina - 1);
    } else {
      setTentativa((atual) => atual + 1);
    }
  }

  async function decidirSlide(
    slide: SlideRelatorio,
    decisao: DecisaoRevisaoSlide
  ) {
    if (!relatorio || slideDecidindoId !== null) return;

    if (!slide.revisao_token) {
      setSlideParaAtualizar(null);
      setSlideParaIgnorar(null);
      setErroSlide({
        id: slide.id,
        mensagem: "Reabra o relatório para obter a revisão atual.",
      });
      return;
    }

    setSlideDecidindoId(slide.id);
    setErroSlide(null);

    try {
      const resultado = await decidirRevisaoSlide(
        relatorio.id,
        slide.id,
        decisao,
        slide.revisao_token
      );

      setSlideAberto(null);
      setSlideParaAtualizar(null);
      setSlideParaIgnorar(null);
      recarregarAposRevisao(resultado.removido);
    } catch (error) {
      setSlideParaAtualizar(null);
      setSlideParaIgnorar(null);
      setErroSlide({
        id: slide.id,
        mensagem:
          error instanceof Error
            ? error.message
            : "Não foi possível registrar a decisão.",
      });
    } finally {
      setSlideDecidindoId(null);
    }
  }

function pedirParaIgnorar(slide: SlideRelatorio) {
  setErroSlide(null);

  if (slideAberto?.id === slide.id) {
    setSlideAberto(null);
    setTimeout(() => setSlideParaIgnorar(slide), 300);
    return;
  }

  setSlideParaIgnorar(slide);
}

function pedirParaAtualizar(slide: SlideRelatorio) {
  setErroSlide(null);

  if (slideAberto?.id === slide.id) {
    setSlideAberto(null);
    setTimeout(() => setSlideParaAtualizar(slide), 300);
    return;
  }

  setSlideParaAtualizar(slide);
}
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title="Relatório"
        showBackButton
        onBackPress={() => {
          if (params.origem === "dashboard") {
            router.replace("/");
            return;
          }

          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace("/relatorios");
        }}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AcoesDetalhes
          onEditar={
            relatorio && temPermissao("RELATORIOS", "EDITAR")
              ? () => {
                  setErroAcao("");
                  setEdicaoSalva(false);
                  setEdicaoAberta(true);
                }
              : undefined
          }
          onExcluir={
            relatorio && temPermissao("RELATORIOS", "EXCLUIR")
              ? () => {
                  setErroAcao("");
                  setConfirmarExclusao(true);
                }
              : undefined
          }
          excluindo={excluindo}
        />

        {resultadoDadosVeiculos ? (
          <Text
            weight="SemiBold"
            style={[
              styles.mensagemAcao,
              { color: theme.textoTerciaria },
            ]}
          >
            {resultadoDadosVeiculos}
          </Text>
        ) : null}

        {edicaoSalva ? (
          <Text
            weight="SemiBold"
            style={[
              styles.mensagemAcao,
              { color: theme.textoTerciaria },
            ]}
          >
            Relatório atualizado.
          </Text>
        ) : null}

        {erroAcao ? (
          <Text
            style={[
              styles.mensagemAcao,
              { color: theme.erro },
            ]}
          >
            {erroAcao}
          </Text>
        ) : null}
        {relatorio ? (
          <View
            style={[
              styles.resumo,
              {
                backgroundColor: theme.backgroundSecundario,
                borderColor: theme.borda,
              },
            ]}
          >
            <Text
              weight="SemiBold"
              style={[
                styles.rotulo,
                { color: theme.textoSub },
              ]}
            >
              RELATÓRIO DE {relatorio.cliente_nome}
            </Text>

            <Text
              weight="Bold"
              style={styles.tituloRelatorio}
            >
              {relatorio.titulo}
            </Text>

            <View style={styles.linhaPeriodo}>
              <Ionicons
                name="calendar-outline"
                size={17}
                color={theme.textoTerciaria}
              />
              <Text style={styles.periodo}>
                {dataISOParaBR(relatorio.periodo_inicio)} a{" "}
                {dataISOParaBR(relatorio.periodo_fim)}
              </Text>
            </View>

            {temPermissao("RELATORIOS", "EDITAR") ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/relatorios/[id]/periodo",
                    params: { id: String(relatorio.id) },
                  })
                }
                style={[
                  styles.atalhoPeriodo,
                  { borderColor: theme.borda },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.textoTerciaria}
                />
                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoTerciaria,
                    fontSize: 12,
                  }}
                >
                  ALTERAR PERÍODO E MATÉRIAS
                </Text>
              </TouchableOpacity>
              
            ) : null}

          {temPermissao("RELATORIOS", "EDITAR") ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setConfirmarDadosVeiculos(true)}
              style={[
                styles.atalhoPeriodo,
                { borderColor: theme.borda },
              ]}
            >
              <Ionicons
                name="sync-outline"
                size={16}
                color={theme.textoTerciaria}
              />
              <Text
                weight="SemiBold"
                style={{
                  color: theme.textoTerciaria,
                  fontSize: 12,
                }}
              >
                COMPLETAR DADOS DOS VEÍCULOS
              </Text>
            </TouchableOpacity>
          ) : null}

            <View
              style={[
                styles.resumoNumeros,
                { borderTopColor: `${theme.borda}55` },
              ]}
            >
              <View style={styles.numeroResumo}>
                <Text
                  weight="Bold"
                  style={[
                    styles.valorResumo,
                    { color: theme.textoTerciaria },
                  ]}
                >
                  {relatorio.total_materias}
                </Text>
                <Text
                  style={[
                    styles.legendaResumo,
                    { color: theme.textoSub },
                  ]}
                >
                  {relatorio.total_materias === 1
                    ? "matéria"
                    : "matérias"}
                </Text>
              </View>

              <View
                style={[
                  styles.divisorResumo,
                  { backgroundColor: `${theme.borda}55` },
                ]}
              />

              <View style={styles.numeroResumo}>
                <Text
                  weight="Bold"
                  style={[
                    styles.valorResumo,
                    { color: theme.textoTerciaria },
                  ]}
                >
                  {relatorio.total_slides}
                </Text>
                <Text
                  style={[
                    styles.legendaResumo,
                    { color: theme.textoSub },
                  ]}
                >
                  {relatorio.total_slides === 1
                    ? "slide no total"
                    : "slides no total"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.inclusao,
                { borderTopColor: `${theme.borda}55` },
              ]}
            >
              <Ionicons
                name={
                  relatorio.inclusao_automatica
                    ? "sync-outline"
                    : "pause-circle-outline"
                }
                size={17}
                color={theme.textoTerciaria}
              />
              <View style={styles.inclusaoTexto}>
                <Text weight="SemiBold" style={styles.inclusaoTitulo}>
                  Inclusão automática{" "}
                  {relatorio.inclusao_automatica
                    ? "ativa"
                    : "desativada"}
                </Text>
                <Text
                  style={[
                    styles.inclusaoDescricao,
                    { color: theme.textoSub },
                  ]}
                >
                  {relatorio.inclusao_automatica
                    ? "Novas matérias deste cliente no período entram para revisão."
                    : "Novas matérias não entram neste relatório automaticamente."}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {relatorio && temPermissao("RELATORIOS", "GERAR") ? (
          <>
            <Button
              title="EXPORTAR PPTX DE TESTE"
              onPress={() => void exportarPptx()}
              loading={exportandoPptx}
              disabled={excluindo}
              style={{marginTop: 15}}
            />

            {mensagemPptx ? (
              <Text
                style={{
                  color: theme.textoTerciaria,
                  fontSize: 12,
                  marginTop: 6,
                }}
              >
                {mensagemPptx}
              </Text>
            ) : null}
          </>
        ) : null}

        {relatorio?.novos_pendentes ? (
          <View
            style={[
              styles.aviso,
              {
                backgroundColor: `${theme.aviso}12`,
                borderColor: `${theme.aviso}80`,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color={theme.aviso}
            />
            <Text
              weight="SemiBold"
              style={[
                styles.avisoTexto,
                { color: theme.aviso },
              ]}
            >
              {relatorio.novos_pendentes}{" "}
              {relatorio.novos_pendentes === 1
                ? "slide novo para revisar"
                : "slides novos para revisar"}
            </Text>
          </View>
        ) : null}

        {relatorio ? (
          <View style={styles.cabecalhoSlides}>
            <Text
              weight="Bold"
              style={styles.tituloSecao}
            >
              Slides do relatório
            </Text>
            <Text
              style={[
                styles.descricaoSecao,
                { color: theme.textoSub },
              ]}
            >
              Capa, matérias e encerramento na ordem do relatório.
            </Text>
          </View>
        ) : null}
        {relatorio ? (
          <SearchBar
            value={busca}
            onChangeText={setBusca}
            onSearch={pesquisarSlides}
            onClear={limparBuscaSlides}
            placeholder="Buscar pauta, veículo..."
          />
        ) : null}

        {relatorio ? (
          <View style={styles.filtrosRevisao}>
            {(["todas", "pendentes"] as const).map((opcao) => {
              const selecionado = filtroRevisao === opcao;

              return (
                <TouchableOpacity
                  key={opcao}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selecionado }}
                  onPress={() => {
                    setPagina(1);
                    setFiltroRevisao(opcao);
                  }}
                  style={[
                    styles.filtroRevisao,
                    {
                      borderColor: theme.borda,
                      borderWidth: selecionado 
                        ? 2
                        : 1,
                      backgroundColor: selecionado
                        ? theme.background
                        : theme.background
                    },
                  ]}
                >
                  <Text
                    weight="SemiBold"
                    style={{
                      color: selecionado
                        ? theme.texto
                        : theme.textoSub,
                      fontSize: 11,
                    }}
                  >
                    {opcao === "todas"
                      ? "TODOS OS SLIDES"
                      : `A REVISAR · ${relatorio.total_pendentes}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {relatorio && filtroRevisao === "pendentes" ? (
          <View style={styles.opcoesRevisao}>
            {(["novo", "veiculo", "clipping"] as const).map((origem) => {
              const quantidade = relatorio.pendentes_por_origem[origem] ?? 0;
              const marcado = origensRevisao.includes(origem);
              const unicoMarcado = marcado && origensRevisao.length === 1;

              const principal =
                origem === "novo"
                  ? quantidade === 1 ? "NOVO" : "NOVOS"
                  : origem === "veiculo"
                    ? quantidade === 1 ? "VEÍCULO" : "VEÍCULOS"
                    : quantidade === 1 ? "CLIPPING" : "CLIPPINGS";

              const complemento =
                origem === "novo"
                  ? quantidade === 1 ? "SLIDE" : "SLIDES"
                  : quantidade === 1 ? "ALTERADO" : "ALTERADOS";

              return (
                <TouchableOpacity
                  key={origem}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: marcado,
                    disabled: unicoMarcado,
                  }}
                  accessibilityLabel={`${principal} ${complemento}: ${quantidade}`}
                  accessibilityHint={
                    unicoMarcado
                      ? "Mantenha pelo menos um tipo de revisão ativo"
                      : undefined
                  }
                  disabled={unicoMarcado}
                  onPress={() => {
                    setOrigensRevisao((atuais) =>
                      atuais.includes(origem)
                        ? atuais.filter((item) => item !== origem)
                        : [...atuais, origem]
                    );
                    setPagina(1);
                  }}
                  style={[
                    styles.opcaoRevisao,
                    {
                      borderColor: marcado ? theme.primaria : theme.borda,
                      borderWidth: marcado ? 2 : 1,
                      backgroundColor: marcado
                        ? theme.primaria
                        : theme.primaria,
                      opacity: marcado ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text
                    weight="Bold"
                    style={{
                      color: theme.branco,
                      fontSize: 16,
                      lineHeight: 23,
                    }}
                  >
                    {quantidade}
                  </Text>
                  <Text
                    weight="SemiBold"
                    style={{
                      color: marcado ? theme.branco : theme.branco,
                      fontSize: 10,
                      textAlign: "center",
                    }}
                  >
                    {principal}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {relatorio &&
          slidesSelecionaveis.length > 0 &&
          (temPermissao("RELATORIOS", "EDITAR") ||
            temPermissao("RELATORIOS", "EXCLUIR")) ? (
            modoSelecaoSlides ? (
              <>
                <View
                  style={[
                    styles.selecaoToolbar,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.borda,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text weight="SemiBold" style={{ fontSize: 13 }}>
                      {slidesSelecionados.length} selecionado(s)
                    </Text>
                    <Text style={{ color: theme.textoSub, fontSize: 11, marginTop: 1, }}>
                      slides desta página
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      todosVisiveisSelecionados
                        ? "Limpar seleção"
                        : "Selecionar todos desta página"
                    }
                    onPress={alternarTodosVisiveis}
                    style={[
                      styles.selecionarTodosBotao,
                      { borderColor: theme.borda },
                    ]}
                  >
                    <Text weight="SemiBold" style={{ color: theme.texto, fontSize: 11 }}>
                      {todosVisiveisSelecionados ? "LIMPAR" : "TODOS"}
                    </Text>
                  </TouchableOpacity>

                  {temPermissao("RELATORIOS", "EXCLUIR") ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Excluir slides selecionados"
                      disabled={slidesSelecionados.length === 0}
                      onPress={() =>
                        pedirAcaoSlides("EXCLUIR", slidesSelecionados)
                      }
                      style={[
                        styles.selecaoIconeBotao,
                        {
                          backgroundColor: "#EF4444",
                          opacity: slidesSelecionados.length ? 1 : 0.5,
                        },
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={19}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Sair da seleção"
                    onPress={sairSelecaoSlides}
                    style={[
                      styles.selecaoIconeBotao,
                      { backgroundColor: theme.backgroundContainer },
                    ]}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={theme.textoContainer}
                    />
                  </TouchableOpacity>
                </View>

                {temPermissao("RELATORIOS", "EDITAR") ? (
                  <View style={styles.selecaoAcoesBotao}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Atualizar ${revisoesSelecionadas.length} revisões selecionadas`}
                      accessibilityState={{
                        disabled: revisoesSelecionadas.length === 0,
                      }}
                      activeOpacity={0.8}
                      disabled={revisoesSelecionadas.length === 0}
                      onPress={() =>
                        pedirAcaoSlides("VALIDAR", revisoesSelecionadas)
                      }
                      style={[
                        styles.slideRevisaoBotao,
                        {
                          minHeight: 40,
                          borderColor: theme.primaria,
                          backgroundColor: theme.primaria,
                          opacity: revisoesSelecionadas.length === 0 ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-outline"
                        size={16}
                        color={theme.branco}
                      />
                      <Text weight="Bold" style={{ color: theme.branco, fontSize: 11 }}>
                        ATUALIZAR ({revisoesSelecionadas.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Ignorar ${revisoesSelecionadas.length} revisões selecionadas`}
                      accessibilityState={{
                        disabled: revisoesSelecionadas.length === 0,
                      }}
                      activeOpacity={0.8}
                      disabled={revisoesSelecionadas.length === 0}
                      onPress={() =>
                        pedirAcaoSlides("IGNORAR", revisoesSelecionadas)
                      }
                      style={[
                        styles.slideRevisaoBotao,
                        {
                          minHeight: 40,
                          borderColor: theme.borda,
                          backgroundColor: theme.background,
                          opacity: revisoesSelecionadas.length === 0 ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name="close-outline"
                        size={16}
                        color={theme.textoSub}
                      />
                      <Text weight="SemiBold" style={{ color: theme.textoSub, fontSize: 11 }}>
                        IGNORAR ({revisoesSelecionadas.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Selecionar slides"
                activeOpacity={0.8}
                onPress={() => setModoSelecaoSlides(true)}
                style={[
                  styles.selecaoInicioBotao,
                  { borderColor: theme.borda },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={19}
                  color={theme.texto}
                />
                <Text
                  weight="SemiBold"
                  style={{ color: theme.texto, fontSize: 12 }}
                >
                  SELECIONAR SLIDES
                </Text>
              </TouchableOpacity>
            )
          ) : null}

          {mensagemAcaoSlides ? (
            <Text style={{ color: theme.textoTerciaria, fontSize: 12 }}>
              {mensagemAcaoSlides}
            </Text>
          ) : null}
        {carregando ? (
          <ActivityIndicator
            size="small"
            color={theme.textoTerciaria}
            style={styles.carregando}
          />
        ) : null}

        {erro ? (
          <View
            style={[
              styles.estado,
              {
                borderColor: theme.erro,
                backgroundColor: theme.backgroundSecundario,
              },
            ]}
          >
            <Text style={{ color: theme.erro }}>
              {erro}
            </Text>
            <Button
              title="TENTAR NOVAMENTE"
              variant="outline"
              size="small"
              onPress={() =>
                setTentativa((atual) => atual + 1)
              }
            />
          </View>
        ) : null}

        {!carregando && !erro && relatorio ? (
          <>
            {slides.length === 0 ? (
              <View
                style={[
                  styles.estado,
                  {
                    borderColor: theme.borda,
                    backgroundColor:
                      theme.backgroundSecundario,
                  },
                ]}
              >
                <Text style={{ color: theme.textoSub }}>
                  {filtroRevisao === "pendentes"
                    ? buscaAplicada
                      ? `Nenhum slide pendente encontrado para “${buscaAplicada}”.`
                      : "Nenhum slide precisa de revisão."
                    : buscaAplicada
                      ? `Nenhum slide encontrado para “${buscaAplicada}”.`
                      : "Nenhum slide neste relatório."}
                </Text>
              </View>
            ) : (
              <View style={styles.listaSlides}>
                {slides.map((slide) => (
                  <CartaoSlide
                    key={slide.id}
                    slide={slide}
                    onPress={() => setSlideAberto(slide)}
                    onDecidir={() => {
                      if (slide.revisao_pendente) {
                        void decidirSlide(slide, "INCLUIR");
                      } else {
                        pedirParaAtualizar(slide);
                      }
                    }}
                    onIgnorar={() => pedirParaIgnorar(slide)}
                    decidindo={slideDecidindoId === slide.id}
                    podeEditar={temPermissao("RELATORIOS", "EDITAR")}
                    erro={erroSlide?.id === slide.id ? erroSlide.mensagem : undefined}
                    modoSelecao={modoSelecaoSlides}
                    selecionavel={
                      slide.tipo === "CLIPPING" ||
                      slide.tipo === "COMPLEMENTAR"
                    }
                    selecionado={idsSelecionados.includes(slide.id)}
                    onSelecionar={() => alternarSlideSelecionado(slide.id)}
                  />
                ))}
              </View>
            )}

            {paginacao.total > 0 ? (
              <View style={styles.paginacao}>
                <Text
                  style={[
                    styles.paginacaoTexto,
                    { color: theme.textoSub },
                  ]}
                >
                  Exibindo {inicioPagina}–{fimPagina} de{" "}
                  {paginacao.total} slides · Página{" "}
                  {paginacao.page} de {totalPaginas}
                </Text>

                <View style={styles.paginacaoBotoes}>
                  <Button
                    title="ANTERIOR"
                    variant="outline"
                    size="small"
                    disabled={pagina === 1}
                    onPress={() =>
                      mudarPagina(pagina - 1)
                    }
                    style={styles.botaoPagina}
                  />
                  <Button
                    title="PRÓXIMA"
                    variant="outline"
                    size="small"
                    disabled={!paginacao.has_next}
                    onPress={() =>
                      mudarPagina(pagina + 1)
                    }
                    style={styles.botaoPagina}
                  />
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {focado && slideAberto && relatorio ? (
        <RelatorioSlidePreview
          slide={slideAberto}
          relatorio={relatorio}
          onClose={() => setSlideAberto(null)}
          onDecidir={(decisao) => {
            void decidirSlide(slideAberto, decisao);
          }}
                onIgnorar={() => {
            void decidirSlide(slideAberto, "IGNORAR");
          }}
          revisando={slideDecidindoId === slideAberto.id}
          erroRevisao={
            erroSlide?.id === slideAberto.id
              ? erroSlide.mensagem
              : undefined
          }
          onExcluir={
            temPermissao("RELATORIOS", "EXCLUIR")
              ? () => {
                  const alvo = slideAberto;
                  if (!alvo) return;

                  setSlideAberto(null);
                  setTimeout(
                    () => pedirAcaoSlides("EXCLUIR", [alvo]),
                    300
                  );
                }
              : undefined
          } 
        />
      ) : null}
      {edicaoAberta && relatorio ? (
        <RelatorioEdicaoModal
          relatorio={relatorio}
          onClose={fecharEdicao}
          onSaved={(atualizado) => {
            setRelatorio(atualizado);
            fecharEdicao();
            setEdicaoSalva(true);
            setTentativa((atual) => atual + 1);
          }}
        />
      ) : null}
      
      <FeedbackAlert
        visible={slideParaAtualizar !== null}
        variant="warning"
        title="Atualizar este slide?"
        message={
          slideParaAtualizar?.revisao_veiculo_pendente &&
          slideParaAtualizar?.revisao_clipping_pendente
            ? "Os dados atuais do veículo e do clipping substituirão os dados salvos neste slide. As duas alterações serão confirmadas juntas."
            : slideParaAtualizar?.revisao_veiculo_pendente
              ? "Os dados atuais do veículo substituirão os dados salvos neste slide."
              : "Os dados atuais do clipping substituirão os dados salvos neste slide."
        }
        primaryLabel="ATUALIZAR"
        secondaryLabel="CANCELAR"
        loading={slideDecidindoId === slideParaAtualizar?.id}
        onClose={() => {
          if (slideDecidindoId === null) {
            setSlideParaAtualizar(null);
          }
        }}
        onSecondary={() => setSlideParaAtualizar(null)}
        onPrimary={() => {
          if (slideParaAtualizar) {
            void decidirSlide(slideParaAtualizar, "ALTERAR");
          }
        }}
      />

      <FeedbackAlert
        visible={slideParaIgnorar !== null}
        variant="warning"
        title={
          slideParaIgnorar?.revisao_pendente
            ? "Ignorar novo slide?"
            : "Ignorar alterações?"
        }
        message={
          slideParaIgnorar?.revisao_pendente
            ? "Este slide será removido do relatório e a matéria não será incluída novamente de forma automática."
            : "O slide será mantido como está. Todas as alterações pendentes do veículo e do clipping serão desconsideradas."
        }
        primaryLabel="IGNORAR"
        secondaryLabel="CANCELAR"
        primaryDanger={Boolean(slideParaIgnorar?.revisao_pendente)}
        loading={slideDecidindoId !== null}
        onClose={() => {
          if (slideDecidindoId === null) setSlideParaIgnorar(null);
        }}
        onSecondary={() => setSlideParaIgnorar(null)}
        onPrimary={() => {
          if (slideParaIgnorar) {
            void decidirSlide(slideParaIgnorar, "IGNORAR");
          }
        }}
      />

      <FeedbackAlert
        visible={confirmarExclusao}
        variant="warning"
        title="Excluir relatório?"
        message={
          `O relatório e seus ${relatorio?.total_slides ?? 0} slides serão excluídos. ` +
          "Os clippings e seus anexos continuarão cadastrados."
        }
        primaryLabel="EXCLUIR"
        secondaryLabel="CANCELAR"
        primaryDanger
        loading={excluindo}
        onClose={() => setConfirmarExclusao(false)}
        onSecondary={() => setConfirmarExclusao(false)}
        onPrimary={() => void removerRelatorio()}
      />

      <FeedbackAlert
        visible={confirmarDadosVeiculos}
        variant="info"
        title="Atualizar os dados nos relatórios?"
        message={
          "Descrição e alcance ausentes serão atualizados dos veículos vinculados. " +
          "O logo será atualizado para o arquivo atual do veículo. " +
          "Textos já preenchidos no relatório não serão substituídos."
        }
        primaryLabel="COMPLETAR"
        secondaryLabel="CANCELAR"
        loading={atualizandoDadosVeiculos}
        onClose={() => {
          if (!atualizandoDadosVeiculos) {
            setConfirmarDadosVeiculos(false);
          }
        }}
        onSecondary={() => setConfirmarDadosVeiculos(false)}
        onPrimary={() => void completarDadosVeiculos()}
      />

      <FeedbackAlert
        visible={acaoSlides !== null}
        variant="warning"
        title={
          acaoSlides?.tipo === "EXCLUIR"
            ? `Excluir ${acaoSlides.slides.length} slide(s)?`
            : acaoSlides?.tipo === "IGNORAR"
              ? `Ignorar ${acaoSlides?.slides.length ?? 0} revisão(ões)?`
              : `Validar ${acaoSlides?.slides.length ?? 0} revisão(ões)?`
        }
        message={
          acaoSlides?.tipo === "EXCLUIR"
            ? "Os slides serão retirados do relatório. As matérias excluídas não voltarão pela inclusão automática."
            : acaoSlides?.tipo === "IGNORAR"
              ? "Slides novos serão retirados. Nos demais, os dados salvos serão mantidos. Alterações de veículo e clipping serão ignoradas juntas."
              : "Slides novos serão incluídos. Os demais receberão todas as alterações pendentes de veículo e clipping."
        }
        primaryLabel={acaoSlides?.tipo ?? "CONFIRMAR"}
        secondaryLabel="CANCELAR"
        primaryDanger={acaoSlides?.tipo === "EXCLUIR"}
        loading={processandoAcaoSlides}
        onClose={() => {
          if (!processandoAcaoSlides) setAcaoSlides(null);
        }}
        onSecondary={() => setAcaoSlides(null)}
        onPrimary={() => void executarAcaoSlides()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  resumo: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
  },
  rotulo: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  tituloRelatorio: {
    fontSize: 20,
    marginTop: 5,
    marginBottom: 12,
  },
  linhaPeriodo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  atalhoPeriodo: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  periodo: {
    flex: 1,
    fontSize: 13,
  },
  resumoNumeros: {
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
  },
  numeroResumo: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  valorResumo: {
    fontSize: 21,
  },
  legendaResumo: {
    fontSize: 11,
    textAlign: "center",
  },
  divisorResumo: {
    width: 1,
    height: 34,
  },
  inclusao: {
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 14,
    paddingTop: 14,
  },
  inclusaoTexto: {
    flex: 1,
  },
  inclusaoTitulo: {
    fontSize: 12,
  },
  inclusaoDescricao: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  aviso: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 12,
  },
  cabecalhoSlides: {
    marginTop: 16,
    marginBottom: 8,
    gap: 3,
  },
  tituloSecao: {
    fontSize: 16,
  },
  descricaoSecao: {
    fontSize: 12,
    lineHeight: 18,
  },
  filtrosRevisao: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  filtroRevisao: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1.5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  opcoesRevisao: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  opcaoRevisao: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  selecaoInicioBotao: {
    minHeight: 42,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  selecaoToolbar: {
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  selecionarTodosBotao: {
    height: 36,
    borderWidth: 1.5,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 11,
  },
  selecaoIconeBotao: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  selecaoCheckbox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  selecaoAcoesBotao: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  slideGrupo: {
  borderWidth: 1.5,
  borderRadius: 13,
  overflow: "hidden",
},
slideRevisaoRodape: {
  borderTopWidth: 1,
  paddingHorizontal: 12,
  paddingTop: 9,
  paddingBottom: 11,
  gap: 9,
},
slideRevisaoMensagem: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},
slideRevisaoAcoes: {
  flexDirection: "row",
  gap: 7,
},
slideRevisaoBotao: {
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
  listaSlides: {
    gap: 9,
  },
  slideCard: {
  paddingHorizontal: 13,
  paddingVertical: 11,
},
  slideTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  numeroSlide: {
    minWidth: 32,
    height: 25,
    paddingHorizontal: 5,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  numeroSlideTexto: {
    fontSize: 11,
  },
  tipoSlide: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  pendente: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    gap: 4,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  pendenteTexto: {
    fontSize: 10,
  },
  tituloSlide: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 7,
  },
  metadadosSlide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  veiculoSlide: {
    flex: 1,
    fontSize: 11,
  },
  dataSlide: {
    fontSize: 11,
  },
  imagemSlide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  imagemTexto: {
    fontSize: 11,
  },
  estado: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  carregando: {
    marginVertical: 24,
  },
  paginacao: {
    marginTop: 16,
    gap: 10,
  },
  paginacaoTexto: {
    fontSize: 12,
    textAlign: "center",
  },
  paginacaoBotoes: {
    flexDirection: "row",
    gap: 8,
  },
  botaoPagina: {
    flex: 1,
    width: "auto",
    paddingHorizontal: 8,
  },
  acoesRelatorio: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  botaoAcao: {
    flex: 1,
    width: "auto",
    paddingHorizontal: 8,
  },
  mensagemAcao: {
    fontSize: 12,
    marginBottom: 12,
  },
});
