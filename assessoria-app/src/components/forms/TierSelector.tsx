import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { DESCRICOES_TIER, Tier } from "@/constants/tier";

interface TierSelectorProps {
  value: Tier | null;
  onChange: (tier: Tier | null) => void;
  disabled?: boolean;
  showChanged?: boolean;
}

const OPCOES: (Tier | null)[] = [null, 1, 2, 3];

export default function TierSelector({
  value,
  onChange,
  disabled = false,
  showChanged = false,
}: TierSelectorProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text weight="Medium" style={styles.label}>TIER</Text>
        {showChanged && (
          <Ionicons name="create-outline" size={15} color={theme.primaria} />
        )}
      </View>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Tier do veículo">
        {OPCOES.map((tier) => {
          const selecionado = value === tier;
          const label = tier === null ? "Não definido" : `Tier ${tier}`;

          return (
            <TouchableOpacity
              key={tier ?? "indefinido"}
              accessibilityRole="radio"
              accessibilityLabel={tier === null ? label : `${label}: ${DESCRICOES_TIER[tier]}`}
              accessibilityState={{ checked: selecionado, disabled }}
              aria-checked={selecionado}
              aria-disabled={disabled}
              activeOpacity={0.8}
              disabled={disabled}
              onPress={() => onChange(tier)}
              style={[
                styles.option,
                {
                  borderColor: selecionado ? theme.primaria : theme.borda,
                  backgroundColor: selecionado ? theme.backgroundContainer : theme.background,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons
                name={selecionado ? "radio-button-on" : "radio-button-off"}
                size={17}
                color={selecionado ? theme.textoContainer : theme.textoSub}
              />
              <Text
                weight={selecionado ? "SemiBold" : "Medium"}
                style={[styles.optionText, { color: selecionado ? theme.textoContainer : theme.texto }]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: theme.textoSub }]}>
        Opcional. Tier 1: mais conhecidos · Tier 2: intermediários · Tier 3: menos conhecidos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 22 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  label: { fontSize: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: { fontSize: 12 },
  hint: { fontSize: 11, lineHeight: 17, marginTop: 8 },
});
