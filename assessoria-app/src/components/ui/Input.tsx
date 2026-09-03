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
import { Ionicons } from "@expo/vector-icons";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  showChanged?: boolean;
}

export default function Input({
  label,
  error,
  containerStyle,
  showChanged = false,
  style,
  ...props
}: InputProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text
            weight="Medium"
            style={styles.label}
          >
            {label}
          </Text>

          {showChanged && (
            <Ionicons
              name="create-outline"
              size={15}
              color={theme.primaria}
            />
          )}
        </View>
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
            fontFamily: Fonts.MontserratRegular,
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

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },

  label: {
    fontSize: 15,
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