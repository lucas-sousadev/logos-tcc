import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface SalvarAlteracoesProps {
  visible?: boolean;
  saving?: boolean;
  busy?: boolean;
  alterations?: number;
  changed?: boolean;
  disabled?: boolean;
  safeArea?: boolean;
  message?: string;
  error?: string;
  saveLabel?: string;
  discardLabel?: string;
  onSave: () => void;
  onDiscard: () => void;
}

export default function SalvarAlteracoes({
  visible = true,
  saving = false,
  busy = false,
  alterations,
  changed = alterations !== undefined && alterations > 0,
  disabled = false,
  safeArea = false,
  message,
  error,
  saveLabel = "SALVAR",
  discardLabel = "CANCELAR",
  onSave,
  onDiscard,
}: SalvarAlteracoesProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const descricao =
    message ??
    (saving
      ? "Salvando suas alterações..."
      : changed
        ? alterations === undefined
          ? "Alterações pendentes de confirmação."
          : `${alterations} ${alterations === 1 ? "alteração pendente" : "alterações pendentes"}.`
        : "Nenhuma alteração pendente.");

  return (
    <View
      testID="salvar-alteracoes"
      style={[
        styles.rodape,
        {
          paddingBottom: safeArea ? Math.max(insets.bottom, 12) : 12,
          paddingLeft: 16 + insets.left,
          paddingRight: 16 + insets.right,
        },
      ]}
    >
      <View
        style={[
          styles.conteudo,
          {
            backgroundColor: theme.backgroundSecundario,
            borderColor: theme.borda + "60",
            shadowColor: theme.texto,
          },
        ]}
      >
        <View style={styles.resumo}>
          <View
            style={[styles.icone, { backgroundColor: theme.primaria + "0D" }]}
          >
            <Ionicons
              name="save-outline"
              size={18}
              color={theme.textoTerciaria}
            />
          </View>
          <View style={styles.textos}>
            <Text weight="SemiBold" style={styles.titulo}>
              Salvar alterações
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.descricao, { color: theme.textoSub }]}
            >
              {descricao}
            </Text>
          </View>
        </View>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.descricao, { color: theme.erro }]}
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.acoes}>
          <Button
            title={discardLabel}
            variant="outline"
            disabled={saving || busy}
            onPress={onDiscard}
            style={styles.botao}
          />
          <Button
            title={saveLabel}
            icon="checkmark-outline"
            loading={saving}
            disabled={!changed || disabled || busy}
            onPress={onSave}
            style={styles.botao}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rodape: {
    flexShrink: 0,
    paddingTop: 8,
  },
  conteudo: {
    width: "100%",
    maxWidth: 728,
    alignSelf: "center",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  resumo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  icone: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titulo: {
    fontSize: 12,
    lineHeight: 17,
  },
  descricao: {
    fontSize: 10,
    lineHeight: 15,
  },
  acoes: {
    flexDirection: "row",
    gap: 8,
  },
  botao: {
    flex: 1,
    minWidth: 0,
    width: "auto",
  },
});
