import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

export interface ArquivoLogo {
  uri: string;
  nome: string;
  mimeType: string;
  file?: File;
}

interface LogoPickerProps {
  logoAtualUri?: string | null;
  logoSelecionado?: ArquivoLogo | null;  
  onSelect: (
    arquivo: ArquivoLogo
  ) => void;
  onRemove: () => void;
  disabled?: boolean;
  error?: string;
  showChanged?: boolean;
}

const TAMANHO_MAXIMO = 2 * 1024 * 1024;

function resolverMimeType(
  mimeType: string | undefined,
  nome: string
): string | null {
  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (
    mimeType &&
    tiposPermitidos.includes(mimeType)
  ) {
    return mimeType;
  }

  const extensao =
    nome.split(".").pop()?.toLocaleLowerCase();

  const tiposPorExtensao: Record<
    string,
    string
  > = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };

  return extensao
    ? tiposPorExtensao[extensao] ?? null
    : null;
}

export default function LogoPicker({
  logoAtualUri,
  logoSelecionado,
  onSelect,
  onRemove,
  disabled = false,
  error,
  showChanged = false,
}: LogoPickerProps) {
  const { theme } = useTheme();
  const [erroLocal, setErroLocal] = useState("");

  const uriLogo =
    logoSelecionado?.uri ?? logoAtualUri;

  async function selecionarLogo() {
    try {
      const resultado =
        await DocumentPicker.getDocumentAsync({
          type: [
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
          copyToCacheDirectory: true,
          multiple: false,
        });

      if (resultado.canceled) {
        return;
      }

      const arquivo = resultado.assets[0];

      const mimeType = resolverMimeType(
        arquivo.mimeType,
        arquivo.name
      );

      if (!mimeType) {
        setErroLocal(
          "Selecione uma imagem JPG, PNG ou WEBP."
        );

        return;
      }

      if (
        arquivo.size !== undefined &&
        arquivo.size > TAMANHO_MAXIMO
      ) {
        setErroLocal(
          "O logo deve possuir no máximo 2 MB."
        );

        return;
      }

      setErroLocal("");

      onSelect({
        uri: arquivo.uri,
        nome: arquivo.name,
        mimeType,
        file: arquivo.file,
      });
    } catch {
      setErroLocal(
        "Não foi possível selecionar a imagem."
      );
    }
  }

  const mensagemErro = error || erroLocal;

  return (
    <View style={styles.container}>
      <Text
        weight="SemiBold"
        style={styles.label}
      >
        LOGO
      </Text>

      {uriLogo ? (
        <View
          style={[
            styles.previewContainer,
            {
              borderColor: theme.borda,
              backgroundColor:
                theme.background,
            },
          ]}
        >
          <View
            style={[
              styles.preview,
              {
                backgroundColor:
                  theme.backgroundContainer,
              },
            ]}
          >
            <Image
              source={{ uri: uriLogo }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>

          <View style={styles.previewInfo}>
            <Text
              weight="SemiBold"
              style={styles.previewTitle}
            >
              {logoSelecionado
                ? "Novo logo selecionado"
                : "Logo atual"}
            </Text>

            <Text
              style={[
                styles.previewText,
                { color: theme.textoSub },
              ]}
            >
              JPG, PNG ou WEBP · até 2 MB
            </Text>

            <View style={styles.previewActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={disabled}
                onPress={selecionarLogo}
                style={[
                  styles.changeButton,
                  {
                    backgroundColor:
                      theme.backgroundContainer,
                    opacity: disabled ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={[
                    styles.actionText,
                    {
                      color: theme.textoContainer,
                    },
                  ]}
                >
                  TROCAR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={disabled}
                onPress={() => {
                  setErroLocal("");
                  onRemove();
                }}
                style={[
                  styles.removeButton,
                  {
                    borderColor: "#EF4444",
                    opacity: disabled ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={[
                    styles.actionText,
                    { color: "#EF4444" },
                  ]}
                >
                  REMOVER
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={disabled}
          onPress={selecionarLogo}
          style={[
            styles.emptyButton,
            {
              borderColor: theme.borda,
              backgroundColor: theme.background,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons
            name="image-outline"
            size={22}
            color={theme.texto}
          />

          <View style={styles.emptyInfo}>
            <Text
              weight="SemiBold"
              style={styles.emptyTitle}
            >
              SELECIONAR LOGO
            </Text>

            <Text
              style={[
                styles.emptyText,
                { color: theme.textoSub },
              ]}
            >
              JPG, PNG ou WEBP · até 2 MB
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {showChanged ? (
        <Text
          weight="Medium"
          style={[
            styles.changed,
            { color: theme.primaria },
          ]}
        >
          Alteração pendente
        </Text>
      ) : null}

      {mensagemErro ? (
        <Text
          weight="Medium"
          style={styles.error}
        >
          {mensagemErro}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },

  label: {
    fontSize: 12,
    marginBottom: 8,
  },

  emptyButton: {
    minHeight: 76,
    borderWidth: 1.5,
    borderRadius: 15,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  emptyInfo: {
    flex: 1,
  },

  emptyTitle: {
    fontSize: 12,
  },

  emptyText: {
    fontSize: 11,
    marginTop: 3,
  },

  previewContainer: {
    minHeight: 92,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 10,
    flexDirection: "row",
  },

  preview: {
    width: 70,
    height: 70,
    borderRadius: 11,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  previewInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },

  previewTitle: {
    fontSize: 12,
  },

  previewText: {
    fontSize: 10,
    marginTop: 3,
  },

  previewActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
  },

  changeButton: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  removeButton: {
    height: 28,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  actionText: {
    fontSize: 10,
  },

  changed: {
    fontSize: 11,
    marginTop: 6,
  },

  error: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
  },
});