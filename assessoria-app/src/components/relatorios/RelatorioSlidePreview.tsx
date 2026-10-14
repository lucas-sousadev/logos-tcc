import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useRouter } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import Button from "../ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import RelatorioSlideVisual from "@/components/relatorios/RelatorioSlideVisual";

import { marcarSlideRevisado } from "@/services/api/relatorio";
import type {
  RelatorioDetalhado,
  SlideRelatorio,
} from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

interface Props {
  slide: SlideRelatorio;
  relatorio: RelatorioDetalhado;
  onClose: () => void;
  onReviewed: () => void;
}

export default function RelatorioSlidePreview({
  slide,
  relatorio,
  onClose,
  onReviewed,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { temPermissao } = useAuth();
  const [erroLink, setErroLink] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [erroRevisao, setErroRevisao] = useState("");

  const podeVerClipping = temPermissao(
    "CLIPPING",
    "VISUALIZAR"
  );
  const ehMateria = slide.tipo === "CLIPPING";
  const clipping = slide.dados_json?.clipping;
  const veiculo = slide.dados_json?.veiculo;

  const veiculoId = Number(veiculo?.id);
  const podeAbrirVeiculo =
    Number.isSafeInteger(veiculoId) &&
    veiculoId > 0 &&
    temPermissao("VEICULOS", "VISUALIZAR");

  const pauta = ehMateria
    ? clipping?.pauta?.trim()
    : slide.titulo?.trim();

  function abrirVeiculo() {
    if (!podeAbrirVeiculo) return;

    onClose();
    router.push({
      pathname: "/veiculos/[id]",
      params: {
        id: String(veiculoId),
        origemRelatorioId: String(relatorio.id),
      },
    });
  }
  
  const data =
    dataISOParaBR(clipping?.data_publicacao ?? null) ||
    "Sem data";

  const descricao = veiculo?.descricao?.trim();
  const alcance = veiculo?.alcance?.trim();
  const link = slide.link?.trim();

  const endpointImagem =
    slide.clipping_id && slide.imagem_anexo_id
      ? `/clippings/${slide.clipping_id}/anexos/${slide.imagem_anexo_id}/arquivo`
      : null;

  async function abrirLink() {
    if (!link) return;

    setErroLink("");

    if (!/^https?:\/\/\S+$/i.test(link)) {
        setErroLink(
        "O link desta matéria não tem um endereço válido para abrir."
        );
        return;
    }

    try {
        await Linking.openURL(link);
    } catch {
        setErroLink("Não foi possível abrir o link da matéria.");
    }
  }

  function abrirClipping() {
    if (!slide.clipping_id || !podeVerClipping) return;

    onClose();

    router.push({
        pathname: "/clipping/[id]",
        params: {
        id: String(slide.clipping_id),
        origemTipo: "relatorio",
        origemId: String(relatorio.id),
        retornoVinculado: "origem",
        },
    });
  }

  async function concluirRevisao() {
    if (revisando || !slide.revisao_pendente) return;

    setRevisando(true);
    setErroRevisao("");

    try {
      await marcarSlideRevisado(relatorio.id, slide.id);
      onReviewed();
    } catch (error) {
      setErroRevisao(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a revisão."
      );
    } finally {
      setRevisando(false);
    }
  }
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
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
            style={[
              styles.header,
              { borderBottomColor: `${theme.borda}55` },
            ]}
          >
            <View style={styles.headerTextos}>
              <Text weight="Bold" style={styles.headerTitulo}>
                Slide {slide.ordem}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.headerSubtitulo,
                  { color: theme.textoSub },
                ]}
              >
                {relatorio.titulo}
              </Text>
            </View>

            <View style={styles.headerAcoes}>
                {ehMateria && slide.clipping_id && podeVerClipping ? (
                    <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Abrir clipping original"
                    accessibilityHint="Abre os detalhes do clipping desta matéria"
                    activeOpacity={0.8}
                    onPress={abrirClipping}
                    style={[
                        styles.atalhoClipping,
                        {
                        backgroundColor: theme.backgroundSecundario,
                        borderColor: `${theme.borda}70`,
                        },
                    ]}
                    >
                    <Ionicons
                        name="newspaper-outline"
                        size={18}
                        color={theme.textoTerciaria}
                    />
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Fechar slide"
                    onPress={onClose}
                    style={[
                    styles.fechar,
                    { backgroundColor: theme.backgroundContainer },
                    ]}
                >
                    <Ionicons
                    name="close"
                    size={22}
                    color={theme.textoContainer}
                    />
                </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.conteudo}
          >
            {ehMateria ? (
              <>
                <Text
                  weight="SemiBold"
                  style={{ color: theme.textoSub, fontSize: 11 }}
                >
                  PRÉVIA DO SLIDE
                </Text>

                <RelatorioSlideVisual slide={slide} />

                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoSub,
                    fontSize: 11,
                    marginTop: 8,
                  }}
                >
                  DADOS DO SLIDE
                </Text>
              </>
            ) : null}
            <View style={styles.identificacao}>
              <View style={styles.campoResumo}>
                <Text weight="SemiBold" style={styles.nomeCliente}>
                  {relatorio.cliente_nome}
                </Text>
              </View>

              <View style={styles.campoResumo}>
                {pauta ? (
                  <Text selectable weight="Bold" style={[styles.titulo, {color: theme.textoTerciaria}]}>
                    {pauta}
                  </Text>
                ) : (
                  <View style={styles.valorAusente}>
                    <Ionicons name="alert-circle-outline" size={16} color={theme.aviso} />
                    <Text weight="SemiBold" style={{ color: theme.aviso }}>
                      {ehMateria ? "Sem pauta cadastrada" : "Sem título"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            {ehMateria ? (
              <>
                <View style={styles.metadados}>
                  {podeAbrirVeiculo ? (
                    <TouchableOpacity
                      accessibilityRole="link"
                      accessibilityLabel={`Abrir veículo ${veiculo?.nome ?? ""}`}
                      onPress={abrirVeiculo}
                      hitSlop={8}
                      style={styles.linkVeiculo}
                    >
                      <Ionicons
                        name="newspaper-outline"
                        size={16}
                        color={theme.textoTerciaria}
                      />
                      <Text weight="SemiBold" style={{ color: theme.textoTerciaria }}>
                        {veiculo?.nome?.trim()}
                      </Text>
                      <Ionicons
                        name="open-outline"
                        size={13}
                        color={theme.textoTerciaria}
                      />
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ color: veiculo?.nome ? theme.textoSub : theme.aviso }}>
                      {veiculo?.nome?.trim() || "Sem veículo cadastrado"}
                    </Text>
                  )}

                  <Text style={{ color: theme.textoSub, marginLeft: -8}}>- {data}</Text>
                </View>

                {endpointImagem ? (
                <View
                  style={[
                    styles.semImagem,
                    {
                      borderColor: `${theme.textoTerciaria}80`,
                      backgroundColor: `${theme.textoTerciaria}10`,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={theme.textoTerciaria}
                  />
                  <Text weight="SemiBold" style={{ color: theme.textoTerciaria }}>
                    IMAGEM DEFINIDA
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.semImagem,
                    {
                      borderColor: `${theme.aviso}80`,
                      backgroundColor: `${theme.aviso}10`,
                    },
                  ]}
                >
                  <Ionicons name="image-outline" size={18} color={theme.aviso} />
                  <Text style={{ color: theme.aviso }}>
                    Sem imagem definida para este slide
                  </Text>
                </View>
              )}

                <View style={styles.campo}>
                  <Text weight="SemiBold" style={[styles.rotulo, { color: theme.textoSub }]}>
                    DESCRIÇÃO DO VEÍCULO
                  </Text>
                  {descricao ? (
                    <Text selectable>{descricao}</Text>
                  ) : (
                    <View style={styles.valorAusente}>
                      <Ionicons name="alert-circle-outline" size={16} color={theme.aviso} />
                      <Text style={{ color: theme.aviso }}>Sem descrição cadastrada</Text>
                    </View>
                  )}
                </View>

                <View style={styles.campo}>
                  <Text weight="SemiBold" style={[styles.rotulo, { color: theme.textoSub }]}>
                    ALCANCE
                  </Text>
                  {alcance ? (
                    <Text selectable>{alcance}</Text>
                  ) : (
                    <View style={styles.valorAusente}>
                      <Ionicons name="alert-circle-outline" size={16} color={theme.aviso} />
                      <Text style={{ color: theme.aviso }}>Sem alcance cadastrado</Text>
                    </View>
                  )}
                </View>

                {link ? (
                <View style={styles.campo}>
                    <Text
                    weight="SemiBold"
                    style={[styles.rotulo, { color: theme.textoSub }]}
                    >
                    LINK DA MATÉRIA
                    </Text>

                    <View style={styles.linhaLink}>
                    <Text
                        selectable
                        style={[
                        styles.valorLink,
                        { color: theme.textoTerciaria },
                        ]}
                    >
                        {link}
                    </Text>

                    <TouchableOpacity
                        accessibilityRole="link"
                        accessibilityLabel="Abrir link da matéria"
                        activeOpacity={0.75}
                        hitSlop={4}
                        onPress={() => void abrirLink()}
                        style={[
                        styles.abrirLink,
                        {
                            backgroundColor: theme.backgroundSecundario,
                            borderColor: `${theme.borda}70`,
                        },
                        ]}
                    >
                        <Ionicons
                        name="open-outline"
                        size={17}
                        color={theme.textoTerciaria}
                        />
                    </TouchableOpacity>
                    </View>

                    {erroLink ? (
                    <Text
                        accessibilityRole="alert"
                        style={[styles.erroLink, { color: theme.erro }]}
                    >
                        {erroLink}
                    </Text>
                    ) : null}
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

            {slide.revisao_pendente ? (
              <View
                style={[
                  styles.pendencia,
                  {
                    borderColor: `${theme.aviso}80`,
                    backgroundColor: `${theme.aviso}10`,
                  },
                ]}
              >
                <View style={styles.pendenciaCabecalho}>
                  <Ionicons name="alert-circle-outline" size={18} color={theme.aviso} />
                  <Text style={{ color: theme.aviso, flex: 1 }}>
                    Este slide novo precisa de revisão.
                  </Text>
                </View>
                {temPermissao("RELATORIOS", "EDITAR") ? (
                  <Button
                    title="MARCAR COMO REVISADO"
                    onPress={() => void concluirRevisao()}
                    loading={revisando}
                    style={{ marginTop: 10 }}
                  />
                ) : (
                  <Text style={{ color: theme.textoSub, marginTop: 8, fontSize: 12 }}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    maxHeight: "92%",
    borderWidth: 1.5,
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
    atalhoClipping: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    },
  conteudo: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 6, // antes: 8
  },
  cliente: {
    fontSize: 12,
  },
  identificacao: {
    gap: 3, 
  },
  campoResumo: {
    marginTop: -4,
    gap: 3,
  },
  nomeCliente: {
    fontSize: 14,
  },
  titulo: {
    fontSize: 17,
  },
  metadados: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  linkVeiculo: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
},
  campo: {
    gap: 5,
    marginTop: 4,
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
  linhaLink: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
},
valorLink: {
  flex: 1,
  minWidth: 0,
  fontSize: 12,
  lineHeight: 19,
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