import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  tipo: "importar" | "exportar";
  onPress: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  compacto?: boolean;
}

export default function BotaoTransferencia({
  tipo,
  onPress,
  label,
  loading = false,
  disabled = false,
  compacto = false,
}: Props) {
  const { theme } = useTheme();
  const bloqueado = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        label ?? (tipo === "importar" ? "Importar" : "Exportar")
      }
      accessibilityState={{
        disabled: bloqueado,
        busy: loading,
      }}
      activeOpacity={0.75}
      disabled={bloqueado}
      onPress={onPress}
      hitSlop={compacto ? 5 : 2}
      style={[
        styles.botao,
        compacto && styles.compacto,
        {
          borderColor: theme.primaria + "40",
          backgroundColor: theme.background,
          opacity: bloqueado ? 0.45 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={theme.texto}
        />
      ) : (
        <Ionicons
          name={
            tipo === "importar"
              ? "download-outline"
              : "cloud-upload-outline"
          }
          size={compacto ? 18 : 20}
          color={theme.texto}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  compacto: {
    width: 34,
    height: 34,
  },
});