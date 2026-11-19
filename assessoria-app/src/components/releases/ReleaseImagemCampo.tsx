import { useRef, useState, type RefObject } from "react";
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  type TextInput,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import ClippingImagemPreview from "@/components/clipping/ClippingImagePreview";
import {
  carregarImagemRelease,
  obterEndpointImagemRelease,
} from "@/services/api/release";

const FORMATOS = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  url: string;
  disabled: boolean;
  inputRef: RefObject<TextInput | null>;
  onInputLayout: () => void;
  onChange: (url: string) => void;
  onOcupadoChange: (ocupado: boolean) => void;
  contextoImagem?: "RELEASES" | "TEMPLATES";
}

export default function ReleaseImagemCampo({
  url,
  disabled,
  inputRef,
  onInputLayout,
  onChange,
  onOcupadoChange,
  contextoImagem = "RELEASES",
}: Props) {
  const { theme } = useTheme();
  const trava = useRef(false);
  const selecionando = useRef(false);
  const seletorWeb = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [urlComErro, setUrlComErro] = useState("");

  const podeExibir = /^https?:\/\/\S+$/i.test(url);
  const exibirImagem = podeExibir && urlComErro !== url;
  const endpointImagem = obterEndpointImagemRelease(url);

  async function enviar(imagem: DocumentPicker.DocumentPickerAsset) {
    if (disabled || trava.current) return;

    if (imagem.size !== undefined && (imagem.size <= 0 || imagem.size > 5 * 1024 * 1024)) {
      setErro("Selecione uma imagem de até 5 MB.");
      return;
    }

    trava.current = true;
    setOcupado(true);
    onOcupadoChange(true);
    setErro("");

    try {
      const endereco = await carregarImagemRelease(imagem,contextoImagem);
      setUrlComErro("");
      onChange(endereco);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar a imagem.");
    } finally {
      trava.current = false;
      setOcupado(false);
      onOcupadoChange(false);
    }
  }

  async function carregar() {
    if (disabled || trava.current || selecionando.current) return;

    if (Platform.OS === "web") {
      seletorWeb.current?.click();
      return;
    }

    selecionando.current = true;

    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: FORMATOS,
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });

      if (!resultado.canceled && resultado.assets[0]) {
        await enviar(resultado.assets[0]);
      }
    } catch {
      setErro("Não foi possível abrir o seletor de imagens.");
    } finally {
      selecionando.current = false;
    }
  }

  function alterarLink(valor: string) {
    if (trava.current) return;
    setErro("");
    onChange(valor.trim());
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.cartao,
          {
            borderColor: theme.borda + "65",
            backgroundColor: theme.background,
            borderStyle: url ? "solid" : "dashed",
          },
        ]}
      >
        {endpointImagem ? (
          <ClippingImagemPreview
            endpoint={endpointImagem}
            nome="Miniatura da imagem do release"
            style={styles.miniatura}
            resizeMode="contain"
          />
        ) : exibirImagem ? (
          <Image
            accessibilityLabel="Miniatura da imagem do release"
            source={{ uri: url }}
            style={styles.miniatura}
            resizeMode="contain"
            onError={() => setUrlComErro(url)}
          />
        ) : (
          <View style={[styles.icone, { backgroundColor: theme.primaria + "12" }]}>
            <Ionicons name="images-outline" size={22} color={theme.textoTerciaria} />
          </View>
        )}

        <View style={styles.detalhes}>
          <Text weight="SemiBold">
            {endpointImagem || exibirImagem
              ? "Imagem selecionada"
              : podeExibir
                ? "Prévia indisponível"
                : "Imagem / logo"}
          </Text>
          <Text style={{ color: theme.textoSub, fontSize: 12 }}>
            JPG, PNG ou WEBP · até 5 MB
          </Text>
        </View>

        {url ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Remover imagem"
            disabled={disabled || ocupado}
            onPress={() => alterarLink("")}
            style={styles.remover}
          >
            <Ionicons name="close-circle-outline" size={23} color={theme.erro} />
          </TouchableOpacity>
        ) : null}
      </View>

      {Platform.OS === "web" ? (
        <input
          type="file"
          accept={FORMATOS.join(",")}
          ref={seletorWeb}
          style={{ display: "none" }}
          onChange={(evento) => {
            const arquivo = evento.currentTarget.files?.[0];
            evento.currentTarget.value = "";

            if (arquivo) {
              void enviar({
                uri: "",
                file: arquivo,
                name: arquivo.name,
                size: arquivo.size,
                mimeType: arquivo.type,
                lastModified: arquivo.lastModified,
              });
            }
          }}
        />
      ) : null}
      <Button
        title={url ? "TROCAR IMAGEM" : "CARREGAR IMAGEM"}
        icon="add-outline"
        variant="outline"
        size="small"
        loading={ocupado}
        disabled={disabled}
        onPress={() => void carregar()}
      />

      <Input
        label="OU USE UM LINK DE IMAGEM"
        value={url}
        onChangeText={alterarLink}
        editable={!disabled && !ocupado}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={2048}
        placeholder="https://..."
        inputRef={inputRef}
        onLayout={onInputLayout}
        containerStyle={styles.campo}
        clearable
      />

      {erro ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.erro }}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    gap: 8 
},
  cartao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  miniatura: {
    width: 52, 
    height: 52, 
    borderRadius: 7 
  },
  icone: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  detalhes: { 
    flex: 1, 
    minWidth: 0,
    gap: 3 
},
  remover: { 
    width: 36, 
    height: 44, 
    alignItems: "center", 
    justifyContent: "center" 
},
  campo: { 
    marginBottom: 0 
  },
});