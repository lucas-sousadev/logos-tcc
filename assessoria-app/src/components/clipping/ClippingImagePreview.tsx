import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import type { ImageURISource } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  authenticatedFetch,
  getToken,
} from "@/services/api/auth";
import { obterUrlArquivoAnexo } from "@/services/api/clipping";

interface ClippingImagemPreviewProps {
  endpoint: string;
  nome: string;
}

export default function ClippingImagemPreview({
  endpoint,
  nome,
}: ClippingImagemPreviewProps) {
  const { theme } = useTheme();

  const [fonte, setFonte] = useState<ImageURISource | null>(
    null
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    let urlTemporaria: string | null = null;

    const controller = new AbortController();

    setFonte(null);
    setErro("");
    setCarregando(true);

    async function carregar() {
      try {
        const url = obterUrlArquivoAnexo(endpoint);

        if (Platform.OS === "web") {
          // No navegador, a autenticação acontece nesta requisição.
          const resposta = await authenticatedFetch(url, {
            signal: controller.signal,
          });

          if (!resposta.ok) {
            throw new Error(
              resposta.status === 403
                ? "Você não possui permissão para visualizar esta imagem."
                : "Não foi possível carregar a imagem."
            );
          }

          const arquivo = await resposta.blob();

          if (!arquivo.type.startsWith("image/")) {
            throw new Error(
              "O servidor não retornou uma imagem válida."
            );
          }

          if (!ativo) return;

          // A imagem usa uma URL local temporária, sem token na URL.
          urlTemporaria = URL.createObjectURL(arquivo);

          setFonte({
            uri: urlTemporaria,
          });

          return;
        }

        // No aplicativo nativo, Image aceita os cabeçalhos.
        const token = await getToken();

        if (!token) {
          throw new Error(
            "Sua sessão não está disponível. Entre novamente."
          );
        }

        if (!ativo) return;

        setFonte({
          uri: url,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        if (!ativo) return;

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
      ativo = false;
      controller.abort();

      if (urlTemporaria) {
        URL.revokeObjectURL(urlTemporaria);
      }
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
      ]}
    >
      {fonte ? (
        <Image
          source={fonte}
          accessibilityLabel={nome}
          style={styles.imagem}
          resizeMode="cover"
          onLoad={() => setCarregando(false)}
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