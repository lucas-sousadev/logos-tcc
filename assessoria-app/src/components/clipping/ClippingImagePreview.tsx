import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import type {
  ImageURISource,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { randomUUID } from "expo-crypto";
import { File as ExpoFile, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

import { authenticatedFetch } from "@/services/api/auth";
import { obterUrlArquivoAnexo } from "@/services/api/clipping";

interface ClippingImagemPreviewProps {
  endpoint: string;
  nome: string;
  style?: StyleProp<ViewStyle>;
  resizeMode?: "cover" | "contain";
  onDimensions?: (width: number, height: number) => void;
}

export default function ClippingImagemPreview({
  endpoint,
  nome,
  style,
  resizeMode = "cover",
  onDimensions,
}: ClippingImagemPreviewProps) {
  const { theme } = useTheme();

  const [fonte, setFonte] = useState<ImageURISource | null>(
    null
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let urlTemporaria: string | null = null;
    let arquivoTemporario: ExpoFile | null = null;

    function liberarArquivo(arquivo: ExpoFile) {
      try {
        if (arquivo.exists) arquivo.delete();
      } catch {
        // O sistema pode já ter limpado o cache.
      }
    }

    setFonte(null);
    setErro("");
    setCarregando(true);

    async function carregar() {
      try {
        const resposta = await authenticatedFetch(
          obterUrlArquivoAnexo(endpoint),
          { signal: controller.signal },
          Platform.OS === "web" ? fetch : expoFetch
        );

        if (!resposta.ok) {
          throw new Error(
            resposta.status === 403
              ? "Você não possui permissão para visualizar esta imagem."
              : "Não foi possível carregar a imagem."
          );
        }

        const tipo = resposta.headers.get("Content-Type")?.split(";")[0].trim();

        if (!tipo?.startsWith("image/")) {
          throw new Error("O servidor não retornou uma imagem válida.");
        }

        if (controller.signal.aborted) return;

        if (Platform.OS === "web") {
          const imagem = await resposta.blob();

          if (controller.signal.aborted) return;

          urlTemporaria = URL.createObjectURL(imagem);
          setFonte({ uri: urlTemporaria });
          return;
        }

        if (!resposta.body) {
          throw new Error("A resposta da imagem veio vazia.");
        }

        const extensao = tipo === "image/jpeg"
          ? "jpg"
          : tipo.slice("image/".length).replace(/[^a-z0-9]/gi, "");

        const arquivo = new ExpoFile(
          Paths.cache,
          "previa-" + randomUUID() + "." + (extensao || "img")
        );

        try {
          arquivo.create();
          await resposta.body.pipeTo(arquivo.writableStream(), {
            signal: controller.signal,
          });

          if (!controller.signal.aborted) {
            arquivoTemporario = arquivo;
            setFonte({ uri: arquivo.uri });
          }
        } finally {
          if (arquivoTemporario !== arquivo) liberarArquivo(arquivo);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a imagem."
        );
        setCarregando(false);
      }
    }

    void carregar();

    return () => {
      controller.abort();
      if (urlTemporaria) URL.revokeObjectURL(urlTemporaria);
      if (arquivoTemporario) liberarArquivo(arquivoTemporario);
    };
  }, [endpoint, tentativa]);

  if (erro) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${erro} Tentar carregar ${nome} novamente.`}
        onPress={() => setTentativa((atual) => atual + 1)}
        style={[
          styles.preview,
          styles.centralizado,
          { backgroundColor: `${theme.primaria}12` },
          style
        ]}
      >
        <Ionicons
          name="reload-outline"
          size={18}
          color={theme.textoTerciaria}
        />

        <Text
          style={[
            styles.textoErro,
            { color: theme.textoTerciaria },
          ]}
        >
          Tentar{"\n"}novamente
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.preview,
        { backgroundColor: `${theme.primaria}12` },
        style
      ]}
    >
      {fonte ? (
        <Image
          source={fonte}
          accessibilityLabel={nome}
          style={styles.imagem}
          resizeMode={resizeMode}
          onLoad={({ nativeEvent }) => {
            setCarregando(false);

            const largura = nativeEvent.source?.width;
            const altura = nativeEvent.source?.height;

            if (largura && altura) {
              onDimensions?.(largura, altura);
            }
          }}
          onError={() => {
            setErro("Não foi possível exibir esta imagem.");
            setCarregando(false);
          }}  
        />
      ) : null}

      {carregando ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.centralizado,
          ]}
        >
          <ActivityIndicator
            size="small"
            color={theme.primaria}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: 58,
    height: 58,
    borderRadius: 10,
    overflow: "hidden",
  },

  imagem: {
    width: "100%",
    height: "100%",
  },

  centralizado: {
    alignItems: "center",
    justifyContent: "center",
  },

  textoErro: {
    fontSize: 9,
    lineHeight: 11,
    textAlign: "center",
    marginTop: 3,
  },
});