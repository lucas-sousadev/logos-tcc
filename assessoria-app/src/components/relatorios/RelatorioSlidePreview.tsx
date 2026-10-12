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
import ClippingImagemPreview from "@/components/clipping/ClippingImagePreview";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  RelatorioDetalhado,
  SlideRelatorio,
} from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

interface Props {
  slide: SlideRelatorio;
  relatorio: RelatorioDetalhado;
  onClose: () => void;
}

export default function RelatorioSlidePreview({
  slide,
  relatorio,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { temPermissao } = useAuth();
  const [erroLink, setErroLink] = useState("");
  const podeVerClipping = temPermissao(
    "CLIPPING",
    "VISUALIZAR"
  );
  const ehMateria = slide.tipo === "CLIPPING";
  const clipping = slide.dados_json?.clipping;
  const veiculo = slide.dados_json?.veiculo;
  const titulo =
    (ehMateria
      ? clipping?.pauta?.trim()
      : slide.titulo?.trim()) ||
    slide.titulo?.trim() ||
    "Slide sem título";

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
            <Text
              weight="SemiBold"
              style={[
                styles.cliente,
                { color: theme.textoTerciaria },
              ]}
            >
              {relatorio.cliente_nome}
            </Text>

            <Text
              selectable
              weight="Bold"
              style={styles.titulo}
            >
              {titulo}
            </Text>
            
            {ehMateria ? (
              <>
                <View style={styles.metadados}>
                  <Ionicons
                    name="newspaper-outline"
                    size={17}
                    color={theme.textoTerciaria}
                  />
                  <Text
                    weight="SemiBold"
                    style={{ color: theme.textoTerciaria }}
                  >
                    {veiculo?.nome?.trim() || "Sem veículo"}
                  </Text>
                  <Text style={{ color: theme.textoSub }}>
                    · {data}
                  </Text>
                </View>

                {endpointImagem ? (
                  <ClippingImagemPreview
                    endpoint={endpointImagem}
                    nome={`Imagem do slide ${slide.ordem}`}
                    style={styles.imagem}
                    resizeMode="contain"
                  />
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
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={theme.aviso}
                    />
                    <Text style={{ color: theme.aviso }}>
                      Sem imagem definida para este slide
                    </Text>
                  </View>
                )}

                {descricao ? (
                  <View style={styles.campo}>
                    <Text
                      weight="SemiBold"
                      style={[
                        styles.rotulo,
                        { color: theme.textoSub },
                      ]}
                    >
                      DESCRIÇÃO DO VEÍCULO
                    </Text>
                    <Text selectable>{descricao}</Text>
                  </View>
                ) : null}

                {alcance ? (
                  <View style={styles.campo}>
                    <Text
                      weight="SemiBold"
                      style={[
                        styles.rotulo,
                        { color: theme.textoSub },
                      ]}
                    >
                      ALCANCE
                    </Text>
                    <Text selectable>{alcance}</Text>
                  </View>
                ) : null}

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
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={theme.aviso}
                />
                <Text style={{ color: theme.aviso }}>
                  Este slide novo precisa de revisão.
                </Text>
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
    gap: 10,
  },
  cliente: {
    fontSize: 12,
  },
  titulo: {
  fontSize: 19,
  lineHeight: 20,
},
  metadados: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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
  pendencia: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
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