import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface AvisoClippingSalvoProps {
  mensagem: string;
  onVisualizar: () => void;
  onFechar: () => void;
}

export default function AvisoClippingSalvo({
  mensagem,
  onVisualizar,
  onFechar,
}: AvisoClippingSalvoProps) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderColor: theme.borda,
        },
      ]}
    >
      <Ionicons
        name="checkmark-circle-outline"
        size={22}
        color="#22C55E"
        style={styles.icone}
      />

      <View style={styles.conteudo}>
        <Text style={styles.mensagem}>
          {mensagem}
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={onVisualizar}
          activeOpacity={0.7}
          style={styles.visualizar}
        >
          <Text
            weight="SemiBold"
            style={[
              styles.acao,
              { color: theme.texto },
            ]}
          >
            Ver clipping
          </Text>

          <Ionicons
            name="arrow-forward-outline"
            size={16}
            color={theme.texto}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Fechar aviso de sucesso"
        onPress={onFechar}
        activeOpacity={0.7}
        style={styles.fechar}
      >
        <Ionicons
          name="close"
          size={20}
          color={theme.textoSub}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },

  icone: {
    marginTop: 3,
  },

  conteudo: {
    flex: 1,
    paddingTop: 3,
  },

  mensagem: {
    fontSize: 12,
    lineHeight: 18,
  },

  visualizar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
  },

  acao: {
    fontSize: 12,
  },

  fechar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});