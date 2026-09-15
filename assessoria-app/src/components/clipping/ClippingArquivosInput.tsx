import { useRef, useState } from "react";
import {
  TouchableOpacity,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  ArquivoClippingSelecionado,
} from "@/services/api/clipping";

const MAX_BYTES = 30 * 1024 * 1024;

export interface ArquivoRascunho
  extends ArquivoClippingSelecionado {
  chave: string;
  tamanhoBytes: number | null;
}

interface ClippingArquivosInputProps {
  arquivos: ArquivoRascunho[];
  disabled?: boolean;
  podeSelecionar: boolean;
  onChange: (arquivos: ArquivoRascunho[]) => void;
  onOcupadoChange: (ocupado: boolean) => void;
}

export default function ClippingArquivosInput({
  arquivos,
  disabled = false,
  podeSelecionar,
  onChange,
  onOcupadoChange,
}: ClippingArquivosInputProps) {
  const { theme } = useTheme();

  const trava = useRef(false);
  const sequencia = useRef(0);

  const [selecionando, setSelecionando] = useState(false);
  const [erro, setErro] = useState("");

  async function selecionar() {
    if (disabled || !podeSelecionar || trava.current) {
      return;
    }

    trava.current = true;
    setSelecionando(true);
    onOcupadoChange(true);
    setErro("");

    try {
      const resultado =
        await DocumentPicker.getDocumentAsync({
          type: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "audio/mpeg",
            "audio/wav",
            "audio/x-wav",
            "audio/vnd.wave",
          ],
          multiple: true,
          copyToCacheDirectory: true,
          base64: false,
        });

      if (resultado.canceled) return;

      try {
        const selecionados: ArquivoRascunho[] =
          resultado.assets.map((arquivo) => {
            if (
              arquivo.size !== undefined &&
              (arquivo.size <= 0 || arquivo.size > MAX_BYTES)
            ) {
              throw new Error(
                `A seleção não foi adicionada: "${arquivo.name}" está vazio ou ultrapassa 30 MB.`
              );
            }

            sequencia.current += 1;

            return {
              chave: `${Date.now()}-${sequencia.current}`,
              uri: arquivo.uri,
              nome: arquivo.name,
              mimeType:
                arquivo.mimeType || "application/octet-stream",
              file: arquivo.file,
              tamanhoBytes: arquivo.size ?? null,
            };
          });

        onChange([...arquivos, ...selecionados]);
      } finally {
        // No navegador, enviarAnexo utiliza o objeto File.
        // Não precisamos manter URLs de prévia em memória.
        for (const arquivo of resultado.assets) {
          if (
            arquivo.file &&
            arquivo.uri.startsWith("blob:") &&
            typeof URL !== "undefined" &&
            typeof URL.revokeObjectURL === "function"
          ) {
            URL.revokeObjectURL(arquivo.uri);
          }
        }
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível selecionar os arquivos."
      );
    } finally {
      trava.current = false;
      setSelecionando(false);
      onOcupadoChange(false);
    }
  }

  function remover(chave: string) {
    if (disabled || trava.current) return;

    setErro("");
    onChange(
      arquivos.filter((arquivo) => arquivo.chave !== chave)
    );
  }

  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        weight="SemiBold"
        style={{ fontSize: 12, marginBottom: 8 }}
      >
        ANEXOS
      </Text>

      <Text
        style={{
          fontSize: 12,
          lineHeight: 18,
          color: theme.textoSub,
          marginBottom: 10,
        }}
      >
        {podeSelecionar
          ? "Os arquivos serão enviados ao salvar. Imagens JPG, PNG ou WEBP, PDF, vídeos MP4, WEBM ou MOV e áudios MP3 ou WAV. Até 30 MB por arquivo."
          : "Você não possui permissão para enviar anexos. O clipping pode ser salvo sem arquivos."}
      </Text>

      <Button
        title="ADICIONAR ARQUIVOS"
        variant="outline"
        size="small"
        disabled={disabled || !podeSelecionar}
        loading={selecionando}
        onPress={() => void selecionar()}
      />

      {arquivos.map((arquivo) => (
        <View
          key={arquivo.chave}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: theme.borda,
          }}
        >
          <Ionicons
            name="document-attach-outline"
            size={20}
            color={theme.textoSub}
          />

          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={2}
              style={{ fontSize: 12 }}
            >
              {arquivo.nome}
            </Text>

            {arquivo.tamanhoBytes !== null ? (
              <Text
                style={{
                  fontSize: 11,
                  color: theme.textoSub,
                  marginTop: 3,
                }}
              >
                {(arquivo.tamanhoBytes / 1024 / 1024).toFixed(2)}
                {" MB"}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remover ${arquivo.nome} da seleção`}
            disabled={disabled}
            onPress={() => remover(arquivo.chave)}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Ionicons
              name="close-circle-outline"
              size={22}
              color={theme.textoSub}
            />
          </TouchableOpacity>
        </View>
      ))}

      {erro ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontSize: 12,
            lineHeight: 18,
            color: "#DC2626",
            marginTop: 8,
          }}
        >
          {erro}
        </Text>
      ) : null}
    </View>
  );
}