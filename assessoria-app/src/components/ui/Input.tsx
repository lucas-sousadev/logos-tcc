import React from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import Text from "@/components/ui/Text";
import { Fonts } from "@/constants/fonts";
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function Input({
  label,
  error,
  containerStyle,
  style,
  ...props
}: InputProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          weight="Medium"
          style={styles.label}
        >
          {label}
        </Text>
      ) : null}

      <TextInput
        {...props}
        style={[
          styles.input,
          {
            color: theme.textoInput,
            backgroundColor: theme.surface,
            borderColor: error
              ? "#EF4444"
              : theme.borda,
            fontFamily: Fonts.MontserratRegular
          },
          style,
        ]}
        placeholderTextColor={theme.textoSub}
      />

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

  label: {
    fontSize: 15,
    marginBottom: 8,
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