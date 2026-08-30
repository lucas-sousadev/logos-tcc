import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { Fonts } from "@/constants/fonts";

interface ButtonProps {
  title: string;
  onPress: () => void;

  variant?: "primary" | "outline";
  size?: "small" | "medium" | "large";

  disabled?: boolean;
  loading?: boolean;

  style?: StyleProp<ViewStyle>;
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();

  const bloqueado = disabled || loading;

  const backgroundColor =
    variant === "primary"
    ? theme.backgroundContainer
    : "transparent";

  const textColor =
    variant === "primary"
    ? theme.textoContainer
    : theme.texto;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={bloqueado}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor: theme.borda,
          opacity: bloqueado ? 0.5 : 1,
        },
        variant === "outline" && styles.outline,
        size === "small" && styles.small,
        size === "large" && styles.large,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: textColor,
            },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    minHeight: 50,
    paddingHorizontal: 20,

    borderRadius: 30,

    justifyContent: "center",
    alignItems: "center",
  },

  text: {
    fontFamily: Fonts.MontserratBold,
    fontSize: 16,
    textAlign: "center",
  },

  outline: {
    backgroundColor: "transparent",
    borderWidth: 2,
  },

  small: {
    minHeight: 40,
    borderRadius: 20,
  },

  large: {
    minHeight: 58,
    borderRadius: 30,
  },
});