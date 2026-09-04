import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface FiltroStatusProps {
  ativo?: number;
  onChange: (ativo: number | undefined) => void;
  marginBottom?: number;
}

export default function FiltroStatus({
  ativo,
  onChange,
  marginBottom = 0,
}: FiltroStatusProps) {
  return (
    <View style={{ marginBottom }}>
      <Text
        weight="SemiBold"
        style={styles.sectionTitle}
      >
        STATUS
      </Text>

      <View style={styles.optionsRow}>
        <OpcaoStatus
          label="Ativos"
          selecionado={ativo === 1}
          onPress={() => onChange(1)}
        />

        <OpcaoStatus
          label="Inativos"
          selecionado={ativo === 0}
          onPress={() => onChange(0)}
        />

        <OpcaoStatus
          label="Todos"
          selecionado={ativo === undefined}
          onPress={() => onChange(undefined)}
        />
      </View>
    </View>
  );
}

function OpcaoStatus({
  label,
  selecionado,
  onPress,
}: {
  label: string;
  selecionado: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.option,
        {
          borderColor: selecionado
            ? theme.primaria
            : theme.borda,
          backgroundColor: selecionado
            ? theme.backgroundContainer
            : theme.background,
        },
      ]}
    >
      <Text
        weight="Medium"
        style={{
          color: selecionado
            ? theme.textoContainer
            : theme.texto,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    marginBottom: 10,
  },

  optionsRow: {
    flexDirection: "row",
    gap: 8,
  },

  option: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
});