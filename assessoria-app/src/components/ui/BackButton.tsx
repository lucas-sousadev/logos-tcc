import {
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";

import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import Text from "@/components/ui/Text";

interface BackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
}

export default function BackButton({
  onPress,
  style,
  color,
}: BackButtonProps) {
  const router = useRouter();
  const { theme } = useTheme();

  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }

    router.back();
  }

  return (
    <TouchableOpacity
      style={[styles.backButton, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text
        weight="Regular"
        style={[
          styles.backButtonText,
          {
            color: color ?? theme.texto,
          },
        ]}
      >
        ‹
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,

    width: 40,
    height: 40,

    justifyContent: "center",
    alignItems: "center",

    zIndex: 10,
  },

  backButtonText: {
    fontSize: 36,
    lineHeight: 40,
  },
});