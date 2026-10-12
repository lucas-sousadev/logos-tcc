import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  onEditar?: () => void;
  onExcluir?: () => void;
  editarDesabilitado?: boolean;
  excluirDesabilitado?: boolean;
  excluindo?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AcoesDetalhes({
  onEditar,
  onExcluir,
  editarDesabilitado = false,
  excluirDesabilitado = false,
  excluindo = false,
  style,
}: Props) {
  const { theme, mode } = useTheme();
  const vermelho = mode === "dark" ? "#F2A7A7" : "#A94E58";

  if (!onEditar && !onExcluir) return null;

  return (
    <View style={[styles.acoes, style]}>
      {onEditar ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={editarDesabilitado || excluindo}
          onPress={onEditar}
          style={[
            styles.botao,
            {
              borderColor: `${theme.borda}30`,
              backgroundColor:
                theme.backgroundSecundario,
              opacity: editarDesabilitado || excluindo ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons
            name="create-outline"
            size={17}
            color={theme.textoTerciaria}
          />
          <Text
            weight="SemiBold"
            style={[styles.texto, { color: theme.textoTerciaria }]}
          >
            Editar
          </Text>
        </TouchableOpacity>
      ) : null}

      {onExcluir ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={excluirDesabilitado || excluindo}
          onPress={onExcluir}
          style={[
            styles.botao,
            {
              borderColor: `${vermelho}35`,
              opacity: excluirDesabilitado || excluindo ? 0.5 : 1,
            },
          ]}
        >
          {excluindo ? (
            <ActivityIndicator size="small" color={vermelho} />
          ) : (
            <Ionicons
              name="trash-outline"
              size={17}
              color={vermelho}
            />
          )}
          <Text
            weight="SemiBold"
            style={[styles.texto, { color: vermelho }]}
          >
            Excluir
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  acoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  botao: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  texto: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});