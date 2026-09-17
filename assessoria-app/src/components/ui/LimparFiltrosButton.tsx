import {
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface LimparFiltrosButtonProps {
  visible: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export default function LimparFiltrosButton({
  visible,
  disabled = false,
  onPress,
}: LimparFiltrosButtonProps) {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Limpar filtros aplicados"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { borderColor: theme.borda },
      ]}
    >
      <Text
        weight="SemiBold"
        style={[
          styles.text,
          { color: theme.texto },
        ]}
      >
        LIMPAR FILTROS
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },

  text: {
    fontSize: 12,
  },
});