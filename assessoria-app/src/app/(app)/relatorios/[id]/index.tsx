import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity
} from "react-native";
import {
  useFocusEffect,
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
  completarDadosVeiculosRelatorio,
  gerarPptxTeste,
  type PaginacaoRelatorio,
  type RelatorioDetalhado,
  type SlideRelatorio,
} from "@/services/api/relatorio";
import { excluirRelatorio } from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

const PAGINACAO_INICIAL: PaginacaoRelatorio = {
  page: 1,
  limit: 20,
  total: 0,
  has_next: false,
};

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

function CartaoSlide({
  slide,
  onPress,
}: {
  slide: SlideRelatorio;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const ehMateria = slide.tipo === "CLIPPING";
  const veiculo =
    slide.dados_json?.veiculo?.nome?.trim() || "Sem veículo";
  const data =
    dataISOParaBR(
      slide.dados_json?.clipping?.data_publicacao ?? null
    ) || "Sem data";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Abrir slide ${slide.ordem}`}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.slideCard,
        {
          backgroundColor: theme.backgroundSecundario,
          borderColor: slide.revisao_pendente
            ? theme.aviso
            : theme.borda,
        },
      ]}
    >
      <View style={styles.slideTop}>
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
            { color: theme.textoSub },
          ]}
        >
          {nomeTipoSlide(slide.tipo)}
        </Text>

        {slide.revisao_pendente ? (
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
              REVISAR
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
                slide.imagem_anexo_id
                  ? theme.textoSub
                  : theme.aviso
              }
            />
            <Text
              style={[
                styles.imagemTexto,
                {
                  color: slide.imagem_anexo_id
                    ? theme.textoSub
                    : theme.aviso,
                },
              ]}
            >
              {slide.imagem_anexo_id
                ? "Imagem definida"
                : "Sem imagem para o slide"}
            </Text>
          </View>
        </>
      ) : null}
    </TouchableOpacity>
  );
}

export default function DetalheRelatorio() {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const scrollRef = useRef<ScrollView>(null);

  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtroRevisao, setFiltroRevisao] = useState<"todas" | "pendentes">("todas");

  const [tentativa, setTentativa] = useState(0);
  const [relatorio, setRelatorio] =
    useState<RelatorioDetalhado | null>(null);
  const [slides, setSlides] = useState<SlideRelatorio[]>([]);
  const [paginacao, setPaginacao] =
    useState<PaginacaoRelatorio>(PAGINACAO_INICIAL);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [slideAberto, setSlideAberto] =useState<SlideRelatorio | null>(null);
  
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
          const resposta = await buscarRelatorio(id, pagina, buscaAplicada, filtroRevisao);

          if (!ativo) return;

          setRelatorio(resposta.relatorio);
          setSlides(resposta.slides);
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
    }, [id, pagina, tentativa, buscaAplicada, filtroRevisao])
  );

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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header title="Relatório" showBackButton />

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

            <Text
              style={{
                color: theme.textoSub,
                fontSize: 12,
                marginTop: 6,
              }}
            >
              Esta exportação ainda não cria uma versão salva do relatório.
            </Text>

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
                        ? theme.backgroundSecundario
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
                      : `A REVISAR · ${relatorio.novos_pendentes}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
      {slideAberto && relatorio ? (
        <RelatorioSlidePreview
          slide={slideAberto}
          relatorio={relatorio}
          onClose={() => setSlideAberto(null)}
          onReviewed={() => {
            setSlideAberto(null);

            if (filtroRevisao === "pendentes" && slides.length === 1 && pagina > 1) {
              setPagina(pagina - 1);
            } else {
              setTentativa((atual) => atual + 1);
            }
          }}
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
    marginBottom: 12,
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
  listaSlides: {
    gap: 9,
  },
  slideCard: {
    borderWidth: 1.5,
    borderRadius: 13,
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