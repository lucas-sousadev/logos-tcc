import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import Text from "@/components/ui/Text";
import { Ionicons } from "@expo/vector-icons";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  clearable?: boolean;
  onClear?: () => void;
  showChanged?: boolean;
  onUndo?: () => void;
  showPasswordToggle?: boolean;
}

export default function Input({
  label,
  error,
  containerStyle,
  showChanged = false,
  style,
  value,
  onChangeText,
  clearable = false,
  onClear,
  onUndo,
  secureTextEntry,
  showPasswordToggle = false,
  ...props
}: InputProps) {
  const { theme } = useTheme();

  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const mostrarLimpar =
    clearable &&
    typeof value === "string" &&
    value.length > 0;

  const mostrarBotaoSenha = Boolean(
    showPasswordToggle && secureTextEntry
  );
  
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <View style={styles.labelTitle}>
            <Text weight="Medium" style={styles.label}>
              {label}
            </Text>

            {showChanged ? (
              <Ionicons
                name="create-outline"
                size={15}
                color={theme.primaria}
              />
            ) : null}
          </View>

          {showChanged && onUndo ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Desfazer alteração em ${label}`}
              disabled={props.editable === false}
              activeOpacity={0.75}
              hitSlop={6}
              onPress={onUndo}
              style={styles.undoButton}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={14}
                color={theme.textoTerciaria}
              />
              <Text
                weight="SemiBold"
                style={[styles.undoText, { color: theme.textoTerciaria }]}
              >
                DESFAZER
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputWrapper}>
        <TextInput
          {...props}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={
            mostrarBotaoSenha
              ? !senhaVisivel
              : secureTextEntry
          }
          style={[
            styles.input,
            {
              color: theme.textoInput,
              borderColor: error
                ? "#EF4444"
                : theme.borda,
              backgroundColor: theme.surface,
            },
            mostrarLimpar && styles.inputWithClear,
            mostrarBotaoSenha &&
              styles.inputWithPasswordToggle,
            mostrarLimpar &&
              mostrarBotaoSenha &&
              styles.inputWithTwoButtons,
            style,
          ]}
        />

        {mostrarLimpar ? (
          <TouchableOpacity
            onPress={() => {
              onChangeText?.("");
              onClear?.();
            }}
            style={[
              styles.clearButton,
              mostrarBotaoSenha &&
                styles.clearButtonWithPasswordToggle,
            ]}
            accessibilityLabel="Limpar campo"
          >
            <Ionicons
              name="close"
              size={18}
              color={theme.textoSub}
            />
          </TouchableOpacity>
        ) : null}

        {mostrarBotaoSenha ? (
          <TouchableOpacity
            onPress={() =>
              setSenhaVisivel((atual) => !atual)
            }
            style={styles.passwordToggle}
            accessibilityLabel={
              senhaVisivel
                ? "Ocultar senha"
                : "Mostrar senha"
            }
          >
            <Ionicons
              name={
                senhaVisivel
                  ? "eye-off-outline"
                  : "eye-outline"
              }
              size={20}
              color={theme.textoSub}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text
          weight="Medium"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  labelTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  label: {
    fontSize: 15,
    flexShrink: 1,
  },
  undoButton: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 6,
  },
undoText: {
  fontSize: 10,
},
  inputWrapper: {
  position: "relative",
  },

  inputWithClear: {
    paddingRight: 50,
  },

  inputWithPasswordToggle: {
    paddingRight: 50,
  },

  inputWithTwoButtons: {
    paddingRight: 88,
  },

  clearButtonWithPasswordToggle: {
    right: 43,
  },

  passwordToggle: {
    position: "absolute",
    width: 36,
    height: 36,
    right: 7,
    top: 7,
    alignItems: "center",
    justifyContent: "center",
},
  clearButton: {
    position: "absolute",
    width: 36,
    height: 36,
    right: 7,
    top: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    height: 50,
    paddingHorizontal: 15,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 14,
  },

  error: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 5,
  },
});