import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  linkInicial?: string;
  disabled?: boolean;
  onCapturar: (link: string) => void;
}

export default function CapturaSiteBotao({
  linkInicial = "",
  disabled,
  onCapturar,
}: Props) {
  const { theme } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState("");
  const [erro, setErro] = useState("");

  function capturar() {
    const endereco = /^https?:\/\//i.test(link.trim())
      ? link.trim()
      : "https://" + link.trim();
    try {
      const url = new URL(endereco);
      if (
        !link.trim() ||
        !url.hostname ||
        !["https:", "http:"].includes(url.protocol) ||
        endereco.length > 2048 ||
        /\s/.test(endereco)
      )
        throw new Error();
      setErro("");
      onCapturar(endereco);
      setAberto(false);
    } catch {
      setErro("Informe um link HTTP ou HTTPS válido para capturar a logo.");
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto, disabled }}
        activeOpacity={0.75}
        disabled={disabled}
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          minHeight: 32,
          gap: 5,
          paddingVertical: 6,
          opacity: disabled ? 0.5 : 1,
        }}
        onPress={() => {
          if (!aberto) {
            setLink(linkInicial);
            setErro("");
          }
          setAberto(!aberto);
        }}
      >
        <Ionicons
          name={aberto ? "close-outline" : "link-outline"}
          size={15}
          color={theme.textoTerciaria}
        />
        <Text
          weight="SemiBold"
          style={{ color: theme.textoTerciaria, fontSize: 11 }}
        >
          {aberto ? "Fechar captura" : "Capturar logo do site"}
        </Text>
      </TouchableOpacity>
      {aberto ? (
        <View style={{ gap: 8 }}>
          <Input
            label="Link do site"
            placeholder="https://site.com.br"
            value={link}
            onChangeText={(valor) => {
              setLink(valor);
              setErro("");
            }}
            maxLength={2048}
            editable={!disabled}
            autoCapitalize="none"
            keyboardType="url"
            error={erro}
            containerStyle={{ marginBottom: 0 }}
          />
          <Button
            title="ABRIR CAPTURA"
            icon="camera-outline"
            disabled={disabled}
            onPress={capturar}
          />
        </View>
      ) : null}
    </View>
  );
}
