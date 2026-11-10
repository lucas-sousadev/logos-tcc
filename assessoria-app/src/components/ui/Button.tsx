import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import { Fonts } from "@/constants/fonts";

interface ButtonProps {
  title: string;
  onPress: () => void;

  variant?: "primary" | "outline" | "danger";
  size?: "small" | "medium" | "large";

  disabled?: boolean;
  loading?: boolean;

  style?: StyleProp<ViewStyle>;
  icon?: ComponentProps<typeof Ionicons>["name"];
}

const TAMANHOS = {
  small: {
    minHeight: 35,
    fontSize: 11,
    iconSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  medium: {
    minHeight: 42,
    fontSize: 12,
    iconSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  large: {
    minHeight: 48,
    fontSize: 14,
    iconSize: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
} as const;

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  icon,
}: ButtonProps) {
  const { theme } = useTheme();

  const variantes = {
    primary: {
      backgroundColor: theme.primaria,
      borderColor: theme.primaria,
      textColor: theme.branco,
      fontFamily: Fonts.MontserratBold,
    },
    outline: {
      backgroundColor: "transparent",
      borderColor: theme.borda,
      textColor: theme.texto,
      fontFamily: Fonts.MontserratSemiBold,
    },
    danger: {
      backgroundColor: "#EF4444",
      borderColor: "#EF4444",
      textColor: theme.branco,
      fontFamily: Fonts.MontserratBold,
    },
  };

  const visual = variantes[variant];
  const icone =
    icon ??
    (variant === "danger"
      ? "trash-outline"
      : undefined);
  const tamanho = TAMANHOS[size];
  const bloqueado = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{
        disabled: bloqueado,
        busy: loading,
      }}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={bloqueado}
      hitSlop={
        size === "small"
          ? { top: 5, bottom: 5 }
          : undefined
      }
      style={[
        styles.button,
        {
          minHeight: tamanho.minHeight,
          paddingHorizontal: tamanho.paddingHorizontal,
          paddingVertical: tamanho.paddingVertical,
          backgroundColor: visual.backgroundColor,
          borderColor: visual.borderColor,
          opacity: bloqueado ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.conteudo,
          { opacity: loading ? 0 : 1 },
        ]}
      >
        {icone ? (
          <Ionicons
            name={icone}
            size={tamanho.iconSize}
            color={visual.textColor}
          />
        ) : null}

        <Text
          style={[
            styles.text,
            {
              color: visual.textColor,
              fontFamily: visual.fontFamily,
              fontSize: tamanho.fontSize,
              lineHeight: tamanho.fontSize + 5,
            },
          ]}
        >
          {title}
        </Text>
      </View>

      {loading ? (
        <View
          pointerEvents="none"
          style={styles.carregando}
        >
          <ActivityIndicator
            size="small"
            color={visual.textColor}
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  conteudo: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flexShrink: 1,
  },
  text: {
    textAlign: "center",
    flexShrink: 1,
  },
  carregando: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});