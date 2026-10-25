import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  StyleSheet,
  type GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { File as ExpoFile } from "expo-file-system";
import {
  ImageManipulator,
  SaveFormat,
} from "expo-image-manipulator";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  capturarPagina,
  type CapturaPagina,
  type OrigemCaptura,
} from "@/services/api/capturaPagina";
import { Ionicons } from "@expo/vector-icons";

interface Area {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface ImagemRecortada {
  uri: string;
  nome: string;
  mimeType: "image/jpeg";
  file?: File;
  tamanhoBytes: number | null;
}

interface Props {
  visivel: boolean;
  link: string;
  origem: OrigemCaptura;
  onFechar: () => void;
  onConfirmar: (
    imagem: ImagemRecortada
  ) => void | Promise<void>;
  embutido?: boolean;
}

function limitar(valor: number): number {
  return Math.max(0, Math.min(1, valor));
}

const TOTAL_TRECHOS = 37;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_PASSO = 0.25;

export default function CapturaPaginaModal({
  visivel,
  link,
  origem,
  onFechar,
  onConfirmar,
  embutido = false,
}: Props) {
  const { theme } = useTheme();
  const tela = useWindowDimensions();
  const inicio = useRef({ x: 0, y: 0 });

  const [captura, setCaptura] = useState<CapturaPagina | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [modo, setModo] = useState<"recortar" | "navegar">("recortar");
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (visivel) setZoom(1);
  }, [visivel, link, origem]);
  const [trecho, setTrecho] = useState(0);
  const [trechoDigitado, setTrechoDigitado] = useState("1");
  const [erroTrecho, setErroTrecho] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!visivel) {
        setCaptura(null);
        setTrecho(0);
        setTrechoDigitado("1");
        setErroTrecho("");
        return;
    }

    let ativo = true;

    setCaptura(null);
    setArea(null);
    setModo("recortar");
    setErro("");
    setCarregando(true);

    capturarPagina(link, origem, trecho)
      .then((resultado) => {
        if (ativo) {
          setCaptura(resultado);
        } else {
          resultado.liberar();
        }
      })
      .catch((falha) => {
        if (ativo) {
          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível capturar a página."
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [visivel, link, origem, tentativa, trecho]);

  useEffect(() => {
    setTrechoDigitado(String(trecho + 1));
    setErroTrecho("");
  }, [trecho]);

  useEffect(() => {
    return () => captura?.liberar();
  }, [captura]);

  const larguraBase = Math.min(tela.width - 28, 800);
  const larguraImagem = larguraBase * zoom;
  const alturaImagem = captura
    ? larguraImagem * captura.altura / captura.largura
    : 0;

  useEffect(() => {
    if (Platform.OS !== "web" || !visivel) return;

    const html = document.documentElement;
    const body = document.body;
    const anteriorHtml = html.style.overscrollBehaviorX;
    const anteriorBody = body.style.overscrollBehaviorX;

    html.style.overscrollBehaviorX = "none";
    body.style.overscrollBehaviorX = "none";

    return () => {
        html.style.overscrollBehaviorX = anteriorHtml;
        body.style.overscrollBehaviorX = anteriorBody;
    };
  }, [visivel]);
  
  function irParaTrecho() {
    if (carregando || processando) return;

    const numero = Number(trechoDigitado);
    if (
      !/^\d{1,2}$/.test(trechoDigitado) ||
      numero < 1 ||
      numero > TOTAL_TRECHOS
    ) {
      setErroTrecho(`Informe um trecho de 1 a ${TOTAL_TRECHOS}.`);
      return;
    }

    Keyboard.dismiss();
    setErroTrecho("");

    if (numero - 1 === trecho) {
      setTentativa((atual) => atual + 1);
    } else {
      setTrecho(numero - 1);
    }
  }

  function ponto(evento: GestureResponderEvent) {
    return {
      x: limitar(evento.nativeEvent.locationX / larguraImagem),
      y: limitar(evento.nativeEvent.locationY / alturaImagem),
    };
  }

  function iniciarRecorte(evento: GestureResponderEvent) {
    inicio.current = ponto(evento);
    setArea(null);
    setErro("");
  }

  function moverRecorte(evento: GestureResponderEvent) {
    const atual = ponto(evento);

    setArea({
      x: Math.min(inicio.current.x, atual.x),
      y: Math.min(inicio.current.y, atual.y),
      largura: Math.abs(atual.x - inicio.current.x),
      altura: Math.abs(atual.y - inicio.current.y),
    });
  }

  async function confirmar() {
    if (!captura || !area || processando) return;

    const originX = Math.floor(area.x * captura.largura);
    const originY = Math.floor(area.y * captura.altura);

    const largura = Math.min(
      captura.largura - originX,
      Math.round(area.largura * captura.largura)
    );
    const altura = Math.min(
      captura.altura - originY,
      Math.round(area.altura * captura.altura)
    );

    if (largura < 40 || altura < 40) {
      setErro("Selecione uma área maior para o recorte.");
      return;
    }

    setProcessando(true);
    setErro("");

    try {
      const manipulador = ImageManipulator.manipulate(captura.uri);
      manipulador.crop({
        originX,
        originY,
        width: largura,
        height: altura,
      });

      const imagem = await manipulador.renderAsync();
      const resultado = await imagem.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.9,
      });

      const nome = `captura-${Date.now()}.jpg`;

      if (Platform.OS === "web") {
        const resposta = await fetch(resultado.uri);
        const blob = await resposta.blob();
        const file = new File([blob], nome, {
          type: "image/jpeg",
        });

        await onConfirmar({
          uri: resultado.uri,
          nome,
          mimeType: "image/jpeg",
          file,
          tamanhoBytes: blob.size,
        });
      } else {
        const arquivo = new ExpoFile(resultado.uri);

        await onConfirmar({
          uri: resultado.uri,
          nome,
          mimeType: "image/jpeg",
          tamanhoBytes: arquivo.size,
        });
      }
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível recortar a imagem."
      );
    } finally {
      setProcessando(false);
    }
  }
    
    const conteudo = (
        <SafeAreaView
            style={[
            styles.container,
            { backgroundColor: theme.background },
            ]}
        >
            <View style={styles.cabecalho}>
            <View style={styles.cabecalhoTexto}>
                <Text weight="Bold" style={styles.titulo}>
                Capturar imagem
                </Text>
                <Text
                style={[
                    styles.subtitulo,
                    { color: theme.textoSub },
                ]}
                >
                Escolha a parte da página que deseja usar.
                </Text>
            </View>

            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar captura"
                disabled={processando}
                onPress={onFechar}
                style={styles.fechar}
            >
                <Text weight="Bold">✕</Text>
            </TouchableOpacity>
            </View>

            {captura ? (
            <>
                <View style={styles.controles}>
                {(["recortar", "navegar"] as const).map((opcao) => (
                    <TouchableOpacity
                    key={opcao}
                    accessibilityRole="button"
                    onPress={() => setModo(opcao)}
                    style={[
                        styles.botaoModo,
                        {
                        borderColor: theme.borda,
                        backgroundColor:
                            modo === opcao
                            ? theme.primaria
                            : theme.background,
                        },
                    ]}
                    >
                    <Text
                        weight="SemiBold"
                        style={[
                        styles.textoBotaoModo,
                        {
                            color:
                            modo === opcao
                                ? theme.branco
                                : theme.texto,
                        },
                        ]}
                    >
                        {opcao === "recortar"
                        ? "RECORTAR"
                        : "NAVEGAR"}
                    </Text>
                    </TouchableOpacity>
                ))}

                <View style={styles.espacador} />

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir zoom"
                    disabled={zoom <= ZOOM_MIN}
                    onPress={() =>
                    setZoom((atual) => Math.max(ZOOM_MIN, atual - ZOOM_PASSO))
                    }
                    style={styles.botaoZoom}
                >
                    <Text weight="Bold" style={styles.simboloZoom}>
                    −
                    </Text>
                </TouchableOpacity>

                <Text style={styles.valorZoom}>
                    {Math.round(zoom * 100)}%
                </Text>

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar zoom"
                    disabled={zoom >= ZOOM_MAX}
                    onPress={() =>
                    setZoom((atual) => Math.min(ZOOM_MAX, atual + ZOOM_PASSO))
                    }
                    style={styles.botaoZoom}
                >
                    <Text weight="Bold" style={styles.simboloZoom}>
                    +
                    </Text>
                </TouchableOpacity>
                </View>

                <Text
                style={[
                    styles.instrucao,
                    { color: theme.textoSub },
                ]}
                >
                {modo === "recortar"
                    ? "Arraste sobre a imagem para marcar o recorte."
                    : "Deslize para navegar pela imagem ampliada."}
                </Text>

                <ScrollView
                horizontal
                style={[
                    styles.visualizador,
                    { borderColor: theme.borda },
                    Platform.OS === "web"
                        ? ({ overscrollBehaviorX: "contain" } as any)
                        : null,
                ]}
                >
                <ScrollView
                    nestedScrollEnabled
                    contentContainerStyle={{ alignItems: "center" }}
                    style={{
                    width: Math.max(larguraBase, larguraImagem),
                    maxHeight: Math.min(tela.height * 0.58, 650),
                    }}
                >
                    <View
                    style={[
                        styles.areaImagem,
                        {
                        width: larguraImagem,
                        height: alturaImagem,
                        },
                    ]}
                    >
                    <Image
                        source={{ uri: captura.uri }}
                        resizeMode="stretch"
                        style={{
                        width: larguraImagem,
                        height: alturaImagem,
                        }}
                    />

                    {area ? (
                        <View
                        pointerEvents="none"
                        style={[
                            styles.selecao,
                            {
                            left: area.x * larguraImagem,
                            top: area.y * alturaImagem,
                            width: area.largura * larguraImagem,
                            height: area.altura * alturaImagem,
                            borderColor: theme.primaria,
                            },
                        ]}
                        />
                    ) : null}

                    <View
                        pointerEvents={
                        modo === "recortar" ? "auto" : "none"
                        }
                        onStartShouldSetResponder={() =>
                        modo === "recortar"
                        }
                        onResponderTerminationRequest={() => false}
                        onResponderGrant={iniciarRecorte}
                        onResponderMove={moverRecorte}
                        onResponderRelease={moverRecorte}
                        onResponderTerminate={() => setArea(null)}
                        style={[
                            styles.camadaDeRecorte,
                            Platform.OS === "web" && modo === "recortar"
                                ? ({ touchAction: "none" } as any)
                                : null,
                        ]}
                    />
                </View>
                </ScrollView>
                </ScrollView>

                <TouchableOpacity
                accessibilityRole="button"
                disabled={processando}
                onPress={() =>
                    setTentativa((atual) => atual + 1)
                }
                style={styles.refazer}
                >
                <Text
                    weight="SemiBold"
                    style={{ color: theme.textoTerciaria }}
                >
                    Refazer captura
                </Text>
                </TouchableOpacity>
            </>
            ) : (
            <View style={styles.estadoCentral}>
                {carregando ? (
                    <>
                    <ActivityIndicator color={theme.primaria} />
                    <Text style={styles.textoCarregando}>
                        Capturando a página...
                    </Text>
                    </>
                ) : (
                    <>
                    {erro ? (
                        <View
                        style={[
                            styles.caixaErroCaptura,
                            { borderColor: theme.erro },
                        ]}
                        >
                        <Ionicons
                            name="alert-circle-outline"
                            size={19}
                            color={theme.erro}
                        />
                        <Text
                            style={{
                            flex: 1,
                            color: theme.erro,
                            fontSize: 12,
                            lineHeight: 18,
                            }}
                        >
                            {erro}
                        </Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => setTentativa((atual) => atual + 1)}
                    >
                        <Text
                        weight="SemiBold"
                        style={{ color: theme.textoTerciaria }}
                        >
                        Tentar novamente
                        </Text>
                    </TouchableOpacity>
                    </>
                )}
                </View>
            )}

            <View style={styles.navegacaoTrechos}>
                <Text
                    weight="SemiBold"
                    style={[styles.rotuloTrecho, { color: theme.textoSub }]}
                >
                    IR PARA TRECHO
                </Text>
                <View style={styles.linhaTrechos}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Capturar trecho anterior da página"
                    disabled={trecho === 0 || carregando || processando}
                    onPress={() => {
                    Keyboard.dismiss();
                    setTrecho((atual) => Math.max(0, atual - 1));
                    }}
                    style={[
                    styles.botaoTrecho,
                    {
                        borderColor: theme.borda,
                        backgroundColor: theme.backgroundSecundario,
                        opacity:
                        trecho === 0 || carregando || processando
                            ? 0.45
                            : 1,
                    },
                    ]}
                >
                    <Ionicons
                        name="chevron-back"
                        size={14}
                        color={theme.textoTerciaria}
                    />
                    <Text
                    weight="SemiBold"
                    style={[
                        styles.botaoTrechoTexto,
                        { color: theme.textoTerciaria },
                    ]}
                    >
                    ANTERIOR
                    </Text>
                </TouchableOpacity>

                <View style={styles.seletorTrecho}>
                        <TextInput
                            accessibilityLabel={`Número do trecho, de 1 a ${TOTAL_TRECHOS}`}
                            value={trechoDigitado}
                            onChangeText={(texto) => {
                                setTrechoDigitado(texto.replace(/\D/g, "").slice(0, 2));
                                setErroTrecho("");
                            }}
                            onSubmitEditing={irParaTrecho}
                            editable={!carregando && !processando}
                            keyboardType="number-pad"
                            returnKeyType="go"
                            selectTextOnFocus
                            maxLength={2}
                            style={[
                                styles.campoTrecho,
                                {
                                    borderColor: theme.borda,
                                    backgroundColor: theme.backgroundSecundario,
                                    color: theme.texto,
                                },
                            ]}
                        />
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Ir para o trecho informado"
                            disabled={carregando || processando}
                            onPress={irParaTrecho}
                            style={[
                                styles.botaoIrTrecho,
                                {
                                    backgroundColor: theme.primaria,
                                    opacity: carregando || processando ? 0.5 : 1,
                                },
                            ]}
                        >
                            <Text
                                weight="Bold"
                                style={[styles.textoIrTrecho, { color: theme.branco }]}
                            >
                                IR
                            </Text>
                        </TouchableOpacity>
                </View>

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Capturar próximo trecho da página"
                    disabled={
                    !captura?.temProxima || carregando || processando
                    }
                    onPress={() => {
                    Keyboard.dismiss();
                    setTrecho((atual) => Math.min(TOTAL_TRECHOS - 1, atual + 1));
                    }}
                    style={[
                    styles.botaoTrecho,
                    {
                        borderColor: theme.borda,
                        backgroundColor: theme.backgroundSecundario,
                        opacity:
                        !captura?.temProxima || carregando || processando
                            ? 0.45
                            : 1,
                    },
                    ]}
                >
                    <Text
                    weight="SemiBold"
                    style={[
                        styles.botaoTrechoTexto,
                        { color: theme.textoTerciaria },
                    ]}
                    >
                    PRÓXIMO
                    </Text>
                    <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={theme.textoTerciaria}
                    />
                </TouchableOpacity>
                </View>
            </View>

            {erroTrecho ? (
            <Text style={[styles.erroTrecho, { color: theme.erro }]}>
                {erroTrecho}
            </Text>
            ) : null}

            {captura?.incompleta ? (
            <Text
                style={[
                styles.avisoCarregamento,
                { color: theme.aviso },
                ]}
            >
                Alguns elementos podem não ter carregado. Você pode
                refazer esta captura ou tentar outro trecho.
            </Text>
            ) : null}

            {erro && captura ? (
                <Text style={[styles.erro, { color: theme.erro }]}>
                    {erro}
                </Text>
            ) : null}

            <View style={styles.acoes}>
            <TouchableOpacity
                accessibilityRole="button"
                disabled={processando}
                onPress={onFechar}
                style={[
                styles.botaoAcao,
                styles.botaoCancelar,
                { borderColor: theme.borda },
                ]}
            >
                <Text weight="Bold">CANCELAR</Text>
            </TouchableOpacity>

            <TouchableOpacity
                accessibilityRole="button"
                disabled={!area || !captura || processando}
                onPress={() => void confirmar()}
                style={[
                styles.botaoAcao,
                {
                    backgroundColor: theme.primaria,
                    opacity:
                    !area || !captura || processando
                        ? 0.5
                        : 1,
                },
                ]}
            >
                <Text
                weight="Bold"
                style={{ color: theme.branco }}
                >
                {processando
                    ? "RECORTANDO..."
                    : "USAR RECORTE"}
                </Text>
            </TouchableOpacity>
            </View>
        </SafeAreaView> 
    );

    if (embutido) {
    return visivel ? conteudo : null;
    }

    return (
    <Modal
        visible={visivel}
        animationType="slide"
        onRequestClose={() => {
        if (!processando) onFechar();
        }}
    >
        {conteudo}
    </Modal>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
  },
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cabecalhoTexto: {
    flex: 1,
  },
  titulo: {
    fontSize: 18,
  },
  subtitulo: {
    fontSize: 12,
    marginTop: 3,
  },
  fechar: {
    padding: 10,
  },
  navegacaoTrechos: {
    alignItems: "center",
    gap: 7,
    marginTop: 8,
    marginBottom: 12,
  },
linhaTrechos: {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
},
botaoTrecho: {
  flex: 1,
  minWidth: 0,
  height: 38,
  borderWidth: 1,
  borderRadius: 8,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  paddingHorizontal: 4,
},
botaoTrechoTexto: {
  fontSize: 10,
},
seletorTrecho: {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
},
rotuloTrecho: {
  fontSize: 11,
  textAlign: "center",
},
campoTrecho: {
  width: 46,
  height: 38,
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 4,
  fontSize: 12,
  textAlign: "center",
},
botaoIrTrecho: {
  width: 38,
  height: 38,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
},
textoIrTrecho: {
  fontSize: 10,
},
erroTrecho: {
  fontSize: 11,
  marginBottom: 8,
  textAlign: "center",
},
avisoCarregamento: {
  fontSize: 11,
  lineHeight: 16,
  marginBottom: 10,
},
  controles: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  botaoModo: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  textoBotaoModo: {
    fontSize: 12,
  },
  espacador: {
    flex: 1,
  },
  botaoZoom: {
    padding: 8,
  },
  simboloZoom: {
    fontSize: 20,
  },
  valorZoom: {
    fontSize: 12,
  },
  instrucao: {
    fontSize: 12,
    marginBottom: 8,
  },
  visualizador: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
  },
  areaImagem: {
    position: "relative",
  },
  selecao: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "rgba(81,112,255,0.18)",
  },
  camadaDeRecorte: {
    ...StyleSheet.absoluteFill,
  },
  refazer: {
    alignSelf: "flex-start",
    paddingVertical: 12,
  },
  estadoCentral: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textoCarregando: {
    marginTop: 12,
  },
  caixaErroCaptura: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  erro: {
    fontSize: 12,
    marginBottom: 10,
  },
  acoes: {
    flexDirection: "row",
    gap: 10,
  },
  botaoAcao: {
    flex: 1,
    padding: 13,
    borderRadius: 9,
    alignItems: "center",
  },
  botaoCancelar: {
    borderWidth: 1,
  },
});
