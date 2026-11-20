import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function ContadorLista({
  children,
  style,
}: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.contador,
        {
          backgroundColor: theme.primaria + "0C",
        },
        style,
      ]}
    >
      <Text
        weight="Medium"
        numberOfLines={1}
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[
          styles.texto,
          { color: theme.textoSub },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contador: {
    maxWidth: "100%",
    minWidth: 0,
    minHeight: 34,
    flexShrink: 1,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  texto: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
