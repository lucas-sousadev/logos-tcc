import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import RelatorioSlideVisual from "@/components/relatorios/RelatorioSlideVisual";
import FeedbackAlert from "../forms/FeedbackAlert";

import type {
  RelatorioDetalhado,
  SlideRelatorio,
} from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";
import type { NavegacaoSlidesRelatorio } from "@/hooks/useNavegacaoSlidesRelatorio";

interface Props {
  visible?: boolean;
  slide: SlideRelatorio;
  relatorio: RelatorioDetalhado;
  navegacao: NavegacaoSlidesRelatorio;
  onClose: () => void;
  onDecidir: (decisao: "INCLUIR" | "ALTERAR") => void;
  onIgnorar: () => void;
  onEditar?: () => void;
  onExcluir?: () => void;
  revisando: boolean;
  erroRevisao?: string;
}

function BotaoAlteracao({
  cor,
  aberto,
  plural = false,
  onPress,
}: {
  cor: string;
  aberto: boolean;
  plural?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        aberto ? "Ver original" : plural ? "Ver alterações" : "Ver alteração"
      }
      accessibilityState={{ expanded: aberto }}
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.seloAlterado, { backgroundColor: `${cor}18` }]}
    >
      <Ionicons name="sync-outline" size={12} color={cor} />
      <Text weight="SemiBold" style={{ color: cor, fontSize: 10 }}>
        {aberto ? "VER ORIGINAL" : plural ? "VER ALTERAÇÕES" : "VER ALTERAÇÃO"}
      </Text>
    </TouchableOpacity>
  );
}

function textoAlterado(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export default function RelatorioSlidePreview({
  visible = true,
  slide,
  relatorio,
  navegacao,
  onClose,
  onDecidir,
  onIgnorar,
  onEditar,
  onExcluir,
  revisando,
  erroRevisao,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const posicao = useRef(0);
  const restaurando = useRef(true);
  const quadro = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      restaurando.current = true;
    }
    return () => {
      if (quadro.current !== null) {
        cancelAnimationFrame(quadro.current);
      }
    };
  }, [visible]);

  useLayoutEffect(() => {
    posicao.current = 0;
    restaurando.current = true;
    if (quadro.current !== null) {
      cancelAnimationFrame(quadro.current);
    }
    quadro.current = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      restaurando.current = false;
      quadro.current = null;
    });
  }, [slide.id]);

  function restaurarRolagem() {
    if (!visible) {
      return;
    }
    if (quadro.current !== null) {
      cancelAnimationFrame(quadro.current);
    }
    const y = posicao.current;
    quadro.current = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      restaurando.current = false;
      quadro.current = null;
    });
  }
  const { origemClippingId } = useLocalSearchParams<{
    origemClippingId?: string;
  }>();
  const { temPermissao } = useAuth();
  const [erroLink, setErroLink] = useState("");
  const [mostrarMateriaNova, setMostrarMateriaNova] = useState(false);
  const [mostrarVeiculoNovo, setMostrarVeiculoNovo] = useState(false);
  const [confirmacao, setConfirmacao] = useState<
    "INCLUIR" | "ALTERAR" | "IGNORAR" | null
  >(null);
  const acoesBloqueadas = revisando || navegacao.carregando;
  const navegacaoBloqueada =
    acoesBloqueadas || navegacao.bloqueada || confirmacao !== null;

  function navegar(acao?: () => void) {
    if (!acao || navegacaoBloqueada) return;

    setErroLink("");
    setMostrarMateriaNova(false);
    setMostrarVeiculoNovo(false);
    acao();
  }
  const podeVerClipping = temPermissao("CLIPPING", "VISUALIZAR");
  const ehMateria = slide.tipo === "CLIPPING";
  const revisaoAtiva =
    slide.revisao_pendente ||
    slide.revisao_veiculo_pendente ||
    slide.revisao_clipping_pendente;

  const clipping = slide.dados_json?.clipping;
  const veiculo = slide.dados_json?.veiculo;

  const pauta = ehMateria ? clipping?.pauta?.trim() : slide.titulo?.trim();

  const data = dataISOParaBR(clipping?.data_publicacao ?? null) || "Sem data";

  const descricao = veiculo?.descricao?.trim();
  const alcance = veiculo?.alcance?.trim();
  const link = slide.link?.trim();

  const imagemDefinida = Boolean(
    slide.imagem_midia_id || slide.imagem_anexo_id
  );

  const camposVeiculoOrigem = slide.revisao_pendente
    ? []
    : (slide.campos_alterados?.veiculo ?? []);

  const camposClippingOrigem = slide.revisao_pendente
    ? []
    : (slide.campos_alterados?.clipping ?? []);

  const camposVeiculo = camposVeiculoOrigem;
  const camposClipping = camposClippingOrigem;

  const novosVeiculo = slide.novos_valores?.veiculo;
  const novosClipping = slide.novos_valores?.clipping;

  const pautaAlterada = camposClipping.includes("pauta");
  const dataAlterada = camposClipping.includes("data_publicacao");
  const logoAlterada = camposVeiculo.includes("logo_path");
  const imagemAlterada =
    camposClipping.includes("imagem_anexo_id") ||
    camposClipping.includes("imagem_path");

  const veiculoAlterado =
    camposVeiculo.some((campo) => ["id", "nome"].includes(campo)) ||
    camposClipping.includes("veiculo_id") ||
    (!veiculo?.id && camposClipping.includes("veiculo_nome_informado"));

  const descricaoAlterada = camposVeiculo.includes("descricao");
  const alcanceAlterado = camposVeiculo.includes("alcance");
  const linkAlterado = camposClipping.includes("link");

  const materiaAlterada =
    pautaAlterada || dataAlterada || imagemAlterada || linkAlterado;

  const dadosVeiculoAlterados =
    veiculoAlterado || logoAlterada || descricaoAlterada || alcanceAlterado;

  const novoVeiculoId =
    Number(
      camposVeiculo.includes("id")
        ? novosVeiculo?.id
        : camposClipping.includes("veiculo_id")
          ? novosClipping?.veiculo_id
          : veiculo?.id
    ) || 0;

  const novoNomeVeiculo = camposVeiculo.includes("nome")
    ? textoAlterado(novosVeiculo?.nome)
    : !novoVeiculoId && camposClipping.includes("veiculo_nome_informado")
      ? textoAlterado(novosClipping?.veiculo_nome_informado)
      : veiculo?.nome?.trim() || "";

  const pautaExibida =
    mostrarMateriaNova && pautaAlterada
      ? textoAlterado(novosClipping?.pauta)
      : pauta;

  const dataNova = textoAlterado(novosClipping?.data_publicacao);

  const dataExibida =
    mostrarMateriaNova && dataAlterada
      ? dataISOParaBR(dataNova) || "Sem data"
      : data;

  const nomeVeiculoExibido =
    mostrarVeiculoNovo && veiculoAlterado
      ? novoNomeVeiculo
      : veiculo?.nome?.trim() || "";

  const veiculoIdExibido =
    mostrarVeiculoNovo && veiculoAlterado
      ? novoVeiculoId
      : Number(veiculo?.id) || 0;

  const podeAbrirVeiculo =
    Number.isSafeInteger(veiculoIdExibido) &&
    veiculoIdExibido > 0 &&
    temPermissao("VEICULOS", "VISUALIZAR");

  const imagemAnexoAtual = camposClipping.includes("imagem_anexo_id")
    ? Number(novosClipping?.imagem_anexo_id) || null
    : slide.imagem_anexo_id;

  const imagemPathAtual = camposClipping.includes("imagem_path")
    ? textoAlterado(novosClipping?.imagem_path) || null
    : (slide.dados_json?.imagem?.arquivo_path ?? null);

  const imagemNovaDefinida = Boolean(imagemAnexoAtual || imagemPathAtual);

  const imagemExibida =
    mostrarMateriaNova && imagemAlterada ? imagemNovaDefinida : imagemDefinida;

  const corImagem =
    mostrarMateriaNova && imagemAlterada
      ? theme.alteracao
      : imagemExibida
        ? theme.textoSecundaria
        : theme.aviso;

  const logoPathAtual = logoAlterada
    ? textoAlterado(novosVeiculo?.logo_path) || null
    : (veiculo?.logo_path ?? null);

  const slideParaPrevia: SlideRelatorio =
    mostrarMateriaNova || mostrarVeiculoNovo
      ? {
          ...slide,
          link:
            mostrarMateriaNova && linkAlterado
              ? textoAlterado(novosClipping?.link) || null
              : slide.link,
          logo_midia_id:
            mostrarVeiculoNovo && logoAlterada ? null : slide.logo_midia_id,
          imagem_midia_id:
            mostrarMateriaNova && imagemAlterada ? null : slide.imagem_midia_id,
          imagem_anexo_id:
            mostrarMateriaNova && imagemAlterada
              ? imagemAnexoAtual
              : slide.imagem_anexo_id,
          dados_json: {
            ...slide.dados_json,
            clipping: {
              ...clipping,
              pauta:
                mostrarMateriaNova && pautaAlterada
                  ? textoAlterado(novosClipping?.pauta) || null
                  : clipping?.pauta,
              data_publicacao:
                mostrarMateriaNova && dataAlterada
                  ? dataNova || null
                  : clipping?.data_publicacao,
            },
            veiculo: {
              ...veiculo,
              id:
                mostrarVeiculoNovo && veiculoAlterado
                  ? novoVeiculoId || null
                  : veiculo?.id,
              nome:
                mostrarVeiculoNovo && veiculoAlterado
                  ? novoNomeVeiculo || null
                  : veiculo?.nome,
              descricao:
                mostrarVeiculoNovo && descricaoAlterada
                  ? textoAlterado(novosVeiculo?.descricao) || null
                  : veiculo?.descricao,
              alcance:
                mostrarVeiculoNovo && alcanceAlterado
                  ? textoAlterado(novosVeiculo?.alcance) || null
                  : veiculo?.alcance,
              logo_path:
                mostrarVeiculoNovo && logoAlterada
                  ? logoPathAtual
                  : veiculo?.logo_path,
            },
            imagem: {
              ...slide.dados_json?.imagem,
              anexo_id:
                mostrarMateriaNova && imagemAlterada
                  ? imagemAnexoAtual
                  : slide.dados_json?.imagem?.anexo_id,
              arquivo_path:
                mostrarMateriaNova && imagemAlterada
                  ? imagemPathAtual
                  : slide.dados_json?.imagem?.arquivo_path,
            },
          },
        }
      : slide;

  const logoDefinida = Boolean(
    slideParaPrevia.logo_midia_id ||
    slideParaPrevia.dados_json?.veiculo?.logo_path?.trim()
  );

  const logoEmAlteracao = mostrarVeiculoNovo && logoAlterada;

  const corLogo =
    logoEmAlteracao || logoDefinida ? theme.textoSecundaria : theme.aviso;

  const camposDadosAlterados = [
    ...camposVeiculoOrigem
      .filter(
        (campo) =>
          !["id", "nome", "logo_path", "descricao", "alcance"].includes(
            campo
          ) || !camposVeiculo.includes(campo)
      )
      .map((campo) => ({ origem: "veiculo" as const, campo })),

    ...camposClippingOrigem
      .filter((campo) => {
        const usadoNoSlide =
          [
            "pauta",
            "data_publicacao",
            "veiculo_id",
            "link",
            "imagem_anexo_id",
            "imagem_path",
          ].includes(campo) ||
          (campo === "veiculo_nome_informado" && veiculoAlterado);

        return !usadoNoSlide || !camposClipping.includes(campo);
      })
      .map((campo) => ({ origem: "clipping" as const, campo })),
  ];

  function abrirVeiculo() {
    if (!podeAbrirVeiculo) return;

    router.navigate({
      pathname: "/veiculos/[id]",
      params: {
        id: String(veiculoIdExibido),
        origemRelatorioId: String(relatorio.id),
        origemClippingId: undefined,
        origemMailingId: undefined,
        origemMailingVeiculoId: undefined,
        origemMailingInicio: undefined,
        origemTipo: undefined,
        origemId: undefined,
        retornoVinculado: undefined,
        origemNavegacao: undefined,
      },
    });
  }

  const rotulos: Record<string, string> = {
    nome: "Nome do veículo",
    descricao: "Descrição",
    alcance: "Alcance",
    logo_path: "Logo do veículo",
    data_publicacao: "Data",
    pauta: "Pauta",
    link: "Link da matéria",
    imagem_anexo_id: "Imagem",
    imagem_path: "Imagem",
    categorias: "Categorias",
    programa_secao: "Programa ou seção",
    tier: "Tier",
    observacoes: "Observações",
    imagem: "Imagem",
    id: "Identificador",
    cliente_id: "Cliente vinculado",
    veiculo_id: "Veículo vinculado",
    veiculo_nome_informado: "Nome informado do veículo",
    ano_referencia: "Ano de referência",
    inicio_segundos: "Início",
    fim_segundos: "Fim",
    duracao_segundos: "Duração",
  };

  const nomesDadosAlterados = Array.from(
    new Set(
      camposDadosAlterados
        .filter(({ campo }) => campo !== "imagem")
        .map(({ campo }) => rotulos[campo] ?? campo.replaceAll("_", " "))
    )
  );

  const descricaoExibida =
    mostrarVeiculoNovo && descricaoAlterada
      ? textoAlterado(novosVeiculo?.descricao)
      : descricao;
  const alcanceExibido =
    mostrarVeiculoNovo && alcanceAlterado
      ? textoAlterado(novosVeiculo?.alcance)
      : alcance;
  const linkExibido =
    mostrarMateriaNova && linkAlterado
      ? textoAlterado(novosClipping?.link)
      : link;

  async function abrirLink() {
    if (!linkExibido) return;

    setErroLink("");

    if (!/^https?:\/\/\S+$/i.test(linkExibido)) {
      setErroLink(
        "O link desta matéria não tem um endereço válido para abrir."
      );
      return;
    }

    try {
      await Linking.openURL(linkExibido);
    } catch {
      setErroLink("Não foi possível abrir o link da matéria.");
    }
  }

  function abrirClipping() {
    if (!slide.clipping_id || !podeVerClipping) return;

    if (Number(origemClippingId) === slide.clipping_id) {
      router.navigate({
        pathname: "/clipping/[id]",
        params: { id: String(slide.clipping_id) },
      });
      return;
    }

    router.navigate({
      pathname: "/clipping/[id]",
      params: {
        id: String(slide.clipping_id),
        origemTipo: "relatorio",
        origemId: String(relatorio.id),
        retornoVinculado: "origem",
      },
    });
  }

  return (
    <Modal
      visible={visible}
      onShow={restaurarRolagem}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (confirmacao) {
          if (!revisando) setConfirmacao(null);
          return;
        }
        onClose();
      }}
    >
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
        >
          <View
            style={[styles.header, { borderBottomColor: `${theme.borda}55` }]}
          >
            <View style={styles.headerTextos}>
              <Text weight="Bold" style={styles.headerTitulo}>
                Slide {slide.ordem}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.headerSubtitulo, { color: theme.textoSub }]}
              >
                {relatorio.titulo}
              </Text>
            </View>

            <View style={styles.headerAcoes}>
              {onEditar && ehMateria ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Editar este slide"
                  activeOpacity={0.8}
                  disabled={acoesBloqueadas}
                  onPress={onEditar}
                  style={[
                    styles.acaoHeader,
                    {
                      borderColor: `${theme.textoTerciaria}70`,
                      opacity: acoesBloqueadas ? 0.5 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={theme.textoTerciaria}
                  />
                </TouchableOpacity>
              ) : null}
              {onExcluir &&
              slide.tipo !== "CAPA" &&
              slide.tipo !== "ENCERRAMENTO" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Excluir este slide"
                  accessibilityHint="Abre a confirmação de exclusão"
                  activeOpacity={0.8}
                  disabled={acoesBloqueadas}
                  onPress={onExcluir}
                  style={[
                    styles.acaoHeader,
                    {
                      backgroundColor: `${theme.erro}10`,
                      borderColor: `${theme.erro}70`,
                      opacity: acoesBloqueadas ? 0.5 : 1,
                    },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.erro} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar slide"
                disabled={revisando}
                onPress={onClose}
                style={[
                  styles.fechar,
                  { backgroundColor: theme.backgroundContainer },
                ]}
              >
                <Ionicons name="close" size={22} color={theme.textoContainer} />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.navegacao,
              { borderBottomColor: `${theme.borda}40` },
            ]}
          >
            <View style={styles.navegacaoLinha}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Slide anterior"
                accessibilityState={{
                  disabled: navegacaoBloqueada || !navegacao.anterior,
                }}
                disabled={navegacaoBloqueada || !navegacao.anterior}
                onPress={() => navegar(navegacao.anterior)}
                activeOpacity={0.75}
                style={[
                  styles.navegacaoBotao,
                  {
                    backgroundColor: `${theme.primaria}0D`,
                    opacity:
                      navegacaoBloqueada || !navegacao.anterior ? 0.4 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={theme.textoTerciaria}
                />
                <Text
                  weight="SemiBold"
                  style={[
                    styles.navegacaoTexto,
                    { color: theme.textoTerciaria },
                  ]}
                >
                  Anterior
                </Text>
              </TouchableOpacity>

              <View
                style={styles.navegacaoPosicao}
                accessibilityLiveRegion="polite"
              >
                <Text weight="Bold" style={styles.navegacaoContagem}>
                  {navegacao.posicao !== null
                    ? `${navegacao.posicao} de ${navegacao.total}`
                    : navegacao.total}
                </Text>
                {navegacao.carregando ? (
                  <ActivityIndicator
                    accessibilityLabel="Carregando slide"
                    size="small"
                    color={theme.primaria}
                  />
                ) : (
                  <Text
                    style={[styles.navegacaoLegenda, { color: theme.textoSub }]}
                  >
                    slides na lista
                  </Text>
                )}
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Próximo slide"
                accessibilityState={{
                  disabled: navegacaoBloqueada || !navegacao.proximo,
                }}
                disabled={navegacaoBloqueada || !navegacao.proximo}
                onPress={() => navegar(navegacao.proximo)}
                activeOpacity={0.75}
                style={[
                  styles.navegacaoBotao,
                  {
                    backgroundColor: `${theme.primaria}0D`,
                    opacity: navegacaoBloqueada || !navegacao.proximo ? 0.4 : 1,
                  },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={[
                    styles.navegacaoTexto,
                    { color: theme.textoTerciaria },
                  ]}
                >
                  Próximo
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textoTerciaria}
                />
              </TouchableOpacity>
            </View>
            {navegacao.erro ? (
              <Text
                accessibilityRole="alert"
                style={[styles.navegacaoErro, { color: theme.erro }]}
              >
                {navegacao.erro}
              </Text>
            ) : null}
          </View>

          <ScrollView
            key={slide.id}
            ref={scrollRef}
            pointerEvents={navegacao.carregando ? "none" : "auto"}
            scrollEventThrottle={16}
            onScroll={(evento) => {
              if (visible && !restaurando.current) {
                posicao.current = Math.max(
                  0,
                  evento.nativeEvent.contentOffset.y
                );
              }
            }}
            onContentSizeChange={() => {
              if (restaurando.current) {
                restaurarRolagem();
              }
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.conteudo}
          >
            {ehMateria ? (
              <>
                <View
                  style={[
                    styles.blocoDados,
                    {
                      borderColor: theme.borda + "40",
                      backgroundColor: theme.backgroundSecundario,
                    },
                  ]}
                >
                  <View style={styles.rotuloComEstado}>
                    <Text weight="SemiBold" style={styles.tituloSecao}>
                      Prévia no relatório
                    </Text>
                    <View
                      style={[
                        styles.estado,
                        {
                          backgroundColor:
                            (revisaoAtiva ? theme.aviso : theme.alteracao) +
                            "12",
                        },
                      ]}
                    >
                      <Text
                        weight="SemiBold"
                        style={{
                          fontSize: 10,
                          color: revisaoAtiva ? theme.aviso : theme.alteracao,
                        }}
                      >
                        {revisaoAtiva ? "Revisão pendente" : "Sem pendências"}
                      </Text>
                    </View>
                  </View>
                  <RelatorioSlideVisual slide={slideParaPrevia} />
                  <Text
                    weight="SemiBold"
                    style={{
                      fontSize: 10,
                      color: theme.textoSub,
                    }}
                  >
                    (!) Algumas imagens/textos podem ficar diferentes da prévia na
                    exportação final
                  </Text>
                </View>

                <View
                  style={[
                    styles.blocoDados,
                    {
                      borderColor: theme.borda + "40",
                      backgroundColor: theme.backgroundSecundario,
                    },
                  ]}
                >
                  <View style={styles.rotuloComEstado}>
                    <Text weight="SemiBold" style={styles.tituloSecao}>
                      Matéria
                    </Text>
                    {materiaAlterada ? (
                      <BotaoAlteracao
                        cor={theme.alteracao}
                        aberto={mostrarMateriaNova}
                        plural
                        onPress={() => {
                          setErroLink("");
                          setMostrarMateriaNova((atual) => !atual);
                        }}
                      />
                    ) : null}
                  </View>

                  <View style={styles.resumoMateria}>
                    <View style={[styles.campo, { marginTop: 0 }]}>
                      {pautaExibida && slide.clipping_id && podeVerClipping ? (
                        <TouchableOpacity
                          accessibilityRole="link"
                          accessibilityLabel={`Abrir clipping: ${pautaExibida}`}
                          onPress={abrirClipping}
                          activeOpacity={0.75}
                          style={styles.linkMateria}
                        >
                          <Text
                            weight="Bold"
                            style={[
                              styles.titulo,
                              {
                                color:
                                  mostrarMateriaNova && pautaAlterada
                                    ? theme.alteracao
                                    : theme.textoTerciaria,
                                flex: 1,
                                minWidth: 0,
                              },
                            ]}
                          >
                            {pautaExibida}
                          </Text>
                          <Ionicons
                            name="open-outline"
                            size={14}
                            color={theme.textoTerciaria}
                            style={{ marginTop: 4, flexShrink: 0 }}
                          />
                        </TouchableOpacity>
                      ) : pautaExibida ? (
                        <Text
                          selectable
                          weight="Bold"
                          style={[
                            styles.titulo,
                            {
                              color:
                                mostrarMateriaNova && pautaAlterada
                                  ? theme.alteracao
                                  : theme.texto,
                            },
                          ]}
                        >
                          {pautaExibida}
                        </Text>
                      ) : (
                        <Text
                          style={{
                            color:
                              mostrarMateriaNova && pautaAlterada
                                ? theme.alteracao
                                : theme.aviso,
                          }}
                        >
                          {mostrarMateriaNova && pautaAlterada
                            ? "Pauta removida"
                            : "Sem pauta cadastrada"}
                        </Text>
                      )}
                    </View>
                    <View style={styles.semImagem}>
                      <Ionicons
                        name="image-outline"
                        size={18}
                        color={corImagem}
                      />
                      <Text weight="SemiBold" style={{ color: corImagem }}>
                        {imagemExibida
                          ? "Imagem definida"
                          : mostrarMateriaNova && imagemAlterada
                            ? "Imagem removida"
                            : "Sem imagem definida para este slide"}
                      </Text>
                    </View>
                    <View style={styles.metadados}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={theme.texto}
                      />
                      <Text
                        style={{
                          color:
                            mostrarMateriaNova && dataAlterada
                              ? theme.alteracao
                              : theme.texto,
                        }}
                      >
                        {dataExibida}
                      </Text>
                    </View>
                  </View>

                  {link || linkAlterado ? (
                    <View style={styles.campo}>
                      <Text
                        weight="SemiBold"
                        style={[styles.rotulo, { color: theme.textoSub }]}
                      >
                        Link original
                      </Text>

                      {linkExibido ? (
                        <TouchableOpacity
                          accessibilityRole="link"
                          accessibilityLabel="Abrir link original da matéria"
                          onPress={() => void abrirLink()}
                          activeOpacity={0.75}
                          style={styles.linhaLink}
                        >
                          <Text
                            numberOfLines={3}
                            ellipsizeMode="middle"
                            style={[
                              styles.valorLink,
                              {
                                color:
                                  mostrarMateriaNova && linkAlterado
                                    ? theme.alteracao
                                    : theme.textoTerciaria,
                              },
                            ]}
                          >
                            {linkExibido}
                          </Text>
                          <Ionicons
                            name="open-outline"
                            size={14}
                            color={
                              mostrarMateriaNova && linkAlterado
                                ? theme.alteracao
                                : theme.textoTerciaria
                            }
                            style={{ marginTop: 2 }}
                          />
                        </TouchableOpacity>
                      ) : (
                        <Text
                          style={{
                            color:
                              mostrarMateriaNova && linkAlterado
                                ? theme.alteracao
                                : theme.aviso,
                          }}
                        >
                          {mostrarMateriaNova && linkAlterado
                            ? "Link removido"
                            : "Sem link cadastrado"}
                        </Text>
                      )}

                      {erroLink ? (
                        <Text
                          accessibilityRole="alert"
                          style={{ color: theme.erro }}
                        >
                          {erroLink}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.blocoDados,
                    {
                      borderColor: theme.borda + "40",
                      backgroundColor: theme.backgroundSecundario,
                    },
                  ]}
                >
                  <View style={styles.rotuloComEstado}>
                    <Text weight="SemiBold" style={styles.tituloSecao}>
                      Veículo
                    </Text>
                    {dadosVeiculoAlterados ? (
                      <BotaoAlteracao
                        cor={theme.alteracao}
                        aberto={mostrarVeiculoNovo}
                        plural
                        onPress={() => setMostrarVeiculoNovo((atual) => !atual)}
                      />
                    ) : null}
                  </View>

                  {podeAbrirVeiculo ? (
                    <TouchableOpacity
                      accessibilityRole="link"
                      accessibilityLabel={`Abrir veículo ${nomeVeiculoExibido}`}
                      onPress={abrirVeiculo}
                      style={styles.linkVeiculo}
                    >
                      <Ionicons
                        name="newspaper-outline"
                        size={16}
                        color={
                          mostrarVeiculoNovo && veiculoAlterado
                            ? theme.alteracao
                            : theme.textoTerciaria
                        }
                      />
                      <Text
                        weight="SemiBold"
                        style={[
                          styles.titulo,
                          {
                            color:
                              mostrarVeiculoNovo && veiculoAlterado
                                ? theme.alteracao
                                : theme.textoTerciaria,
                          },
                        ]}
                      >
                        {nomeVeiculoExibido || "Veículo sem nome"}
                      </Text>
                      <Ionicons
                        name="open-outline"
                        size={12}
                        color={theme.textoTerciaria}
                      />
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={{
                        color:
                          mostrarVeiculoNovo && veiculoAlterado
                            ? theme.alteracao
                            : nomeVeiculoExibido
                              ? theme.textoSub
                              : theme.aviso,
                      }}
                    >
                      {nomeVeiculoExibido || "Sem veículo cadastrado"}
                    </Text>
                  )}

                  <View style={styles.semImagem}>
                    <Ionicons name="image-outline" size={18} color={corLogo} />
                    <Text weight="SemiBold" style={{ color: corLogo }}>
                      {logoEmAlteracao
                        ? logoDefinida
                          ? "Nova logo do veículo definida"
                          : "Logo removida"
                        : logoDefinida
                          ? "Logo definida para este slide"
                          : "Sem logo do veículo"}
                    </Text>
                  </View>

                  <View style={styles.campo}>
                    <Text
                      weight="SemiBold"
                      style={[styles.rotulo, { color: theme.textoSub }]}
                    >
                      Descrição
                    </Text>
                    <Text
                      selectable
                      style={{
                        color:
                          mostrarVeiculoNovo && descricaoAlterada
                            ? theme.alteracao
                            : descricaoExibida
                              ? theme.texto
                              : theme.aviso,
                      }}
                    >
                      {descricaoExibida ||
                        (mostrarVeiculoNovo && descricaoAlterada
                          ? "Descrição removida"
                          : "Sem descrição cadastrada")}
                    </Text>
                  </View>

                  <View style={styles.campo}>
                    <Text
                      weight="SemiBold"
                      style={[styles.rotulo, { color: theme.textoSub }]}
                    >
                      Alcance
                    </Text>
                    <Text
                      selectable
                      style={{
                        color:
                          mostrarVeiculoNovo && alcanceAlterado
                            ? theme.alteracao
                            : alcanceExibido
                              ? theme.texto
                              : theme.aviso,
                      }}
                    >
                      {alcanceExibido ||
                        (mostrarVeiculoNovo && alcanceAlterado
                          ? "Alcance removido"
                          : "Sem alcance cadastrado")}
                    </Text>
                  </View>
                </View>

                {nomesDadosAlterados.length > 0 ? (
                  <View
                    style={[
                      styles.resumoAlteracoes,
                      { borderTopColor: `${theme.borda}55` },
                    ]}
                  >
                    <Text
                      weight="SemiBold"
                      style={[styles.rotulo, { color: theme.textoSub }]}
                    >
                      OUTROS DADOS ALTERADOS
                    </Text>
                    <Text style={{ color: theme.alteracao, fontSize: 12 }}>
                      {nomesDadosAlterados.join(" · ")}
                    </Text>
                  </View>
                ) : null}

                {slide.clipping_id && !podeVerClipping ? (
                  <Text style={{ color: theme.textoSub }}>
                    Você não tem permissão para abrir o clipping original.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={{ color: theme.textoSub }}>
                {slide.tipo === "CAPA"
                  ? "Capa do relatório"
                  : slide.tipo === "ENCERRAMENTO"
                    ? "Encerramento do relatório"
                    : "Slide complementar"}
              </Text>
            )}

            {revisaoAtiva ? (
              <View
                style={[
                  styles.pendencia,
                  {
                    borderColor: `${theme.aviso}80`,
                    backgroundColor: theme.backgroundSecundario,
                  },
                ]}
              >
                <View style={styles.pendenciaCabecalho}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={theme.aviso}
                  />
                  <Text style={{ color: theme.aviso, flex: 1 }}>
                    {slide.revisao_pendente
                      ? "Este slide novo precisa de revisão."
                      : "Confira as alterações antes de decidir."}
                  </Text>
                </View>
                {temPermissao("RELATORIOS", "EDITAR") ? (
                  <View style={styles.slideRevisaoAcoes}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={
                        slide.revisao_pendente
                          ? "Incluir slide no relatório"
                          : "Aplicar alterações ao slide"
                      }
                      accessibilityState={{ disabled: acoesBloqueadas }}
                      disabled={acoesBloqueadas}
                      onPress={() =>
                        setConfirmacao(
                          slide.revisao_pendente ? "INCLUIR" : "ALTERAR"
                        )
                      }
                      style={[
                        styles.slideRevisaoBotao,
                        {
                          borderColor: theme.primaria,
                          backgroundColor: theme.primaria,
                        },
                      ]}
                    >
                      {revisando ? (
                        <ActivityIndicator size="small" color={theme.branco} />
                      ) : (
                        <Ionicons
                          name="checkmark-outline"
                          size={16}
                          color={theme.branco}
                        />
                      )}
                      <Text
                        weight="Bold"
                        style={{ color: theme.branco, fontSize: 11 }}
                      >
                        {slide.revisao_pendente ? "INCLUIR" : "ATUALIZAR"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Ignorar revisão do slide"
                      accessibilityState={{ disabled: acoesBloqueadas }}
                      disabled={acoesBloqueadas}
                      onPress={() => setConfirmacao("IGNORAR")}
                      style={[
                        styles.slideRevisaoBotao,
                        {
                          borderColor: theme.borda,
                          backgroundColor: theme.background,
                          opacity: acoesBloqueadas ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name="close-outline"
                        size={16}
                        color={theme.textoSub}
                      />
                      <Text
                        weight="SemiBold"
                        style={{ color: theme.textoSub, fontSize: 11 }}
                      >
                        IGNORAR
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text
                    style={{
                      color: theme.textoSub,
                      marginTop: 8,
                      fontSize: 12,
                    }}
                  >
                    Você não tem permissão para concluir a revisão.
                  </Text>
                )}

                {erroRevisao ? (
                  <Text style={{ color: theme.erro, marginTop: 6 }}>
                    {erroRevisao}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>

        <FeedbackAlert
          inline
          visible={visible && confirmacao !== null}
          variant="warning"
          title={
            confirmacao === "INCLUIR"
              ? "Incluir este slide?"
              : confirmacao === "ALTERAR"
                ? "Atualizar este slide?"
                : slide.revisao_pendente
                  ? "Ignorar novo slide?"
                  : "Ignorar alterações?"
          }
          message={
            confirmacao === "INCLUIR"
              ? "A matéria será incluída no relatório com os dados atuais do clipping e do veículo."
              : confirmacao === "ALTERAR"
                ? slide.revisao_veiculo_pendente &&
                  slide.revisao_clipping_pendente
                  ? "Os campos alterados no clipping ou veículo atualizarão os dados do slide. Edições individuais de campos não alterados na origem serão mantidas."
                  : slide.revisao_veiculo_pendente
                    ? "Os campos alterados no veículo atualizarão este slide. Edições individuais dos demais campos serão mantidas."
                    : "Os campos alterados no clipping atualizarão este slide. Edições individuais dos demais campos serão mantidas."
                : slide.revisao_pendente
                  ? "Este slide será removido do relatório e a matéria não será incluída novamente de forma automática."
                  : "O slide será mantido como está. Todas as alterações pendentes do veículo e do clipping serão desconsideradas."
          }
          primaryLabel={
            confirmacao === "ALTERAR" ? "ATUALIZAR" : (confirmacao ?? "INCLUIR")
          }
          secondaryLabel="CANCELAR"
          primaryDanger={
            confirmacao === "IGNORAR" && Boolean(slide.revisao_pendente)
          }
          loading={revisando}
          onClose={() => setConfirmacao(null)}
          onSecondary={() => setConfirmacao(null)}
          onPrimary={() => {
            const decisao = confirmacao;
            setConfirmacao(null);

            if (decisao === "IGNORAR") {
              onIgnorar();
            } else if (decisao) {
              onDecidir(decisao);
            }
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: 860,
    borderWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  navegacao: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navegacaoLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navegacaoBotao: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8,
    gap: 4,
    borderRadius: 12,
  },
  navegacaoTexto: {
    fontSize: 12,
  },
  navegacaoPosicao: {
    minWidth: 76,
    alignItems: "center",
    gap: 2,
  },
  navegacaoContagem: {
    fontSize: 13,
  },
  navegacaoLegenda: {
    fontSize: 10,
  },
  navegacaoErro: {
    marginTop: 8,
    fontSize: 12,
  },
  headerTextos: {
    flex: 1,
  },
  headerTitulo: {
    fontSize: 18,
  },
  headerSubtitulo: {
    fontSize: 12,
    marginTop: 2,
  },
  fechar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAcoes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  acaoHeader: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  conteudo: {
    padding: 14,
    gap: 12,
  },
  blocoDados: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  identificacao: {
    gap: 2,
    marginBottom: 4,
  },
  tituloSecao: {
    fontSize: 13,
    flex: 1,
    minWidth: 80,
  },
  estado: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  titulo: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 22,
  },
  resumoMateria: {
    gap: 10,
  },
  metadados: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 6,
    rowGap: 2,
  },
  linkVeiculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  valorAusente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  imagem: {
    width: "100%",
    height: 240,
  },
  semImagem: {
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  campo: {
    gap: 5,
    minWidth: 0,
  },
  linkMateria: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    gap: 6,
    paddingRight: 2,
  },
  rotulo: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  pendenciaCabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pendencia: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  rotuloComEstado: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  seloAlterado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  listaAlteracoes: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 9,
  },
  itemAlteracao: {
    gap: 2,
  },
  resumoAlteracoes: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 12,
    gap: 5,
  },
  slideRevisaoAcoes: {
    flexDirection: "row",
    gap: 7,
    marginTop: 10,
  },
  slideRevisaoBotao: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  linhaLink: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    gap: 6,
  },
  valorLink: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  abrirLink: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  erroLink: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});
