import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

export type FeedbackAlertVariant =
  | "success"
  | "error"
  | "warning"
  | "info";

interface FeedbackAlertProps {
  visible: boolean;
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
  onClose: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryDanger?: boolean;
  loading?: boolean;
}

export default function FeedbackAlert({
  visible,
  variant,
  title,
  message,
  onClose,
  primaryLabel = "ENTENDI",
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryDanger = false,
  loading = false,
}: FeedbackAlertProps) {
  const { theme } = useTheme();

  const configuracao = {
    success: {
      icon: "checkmark-circle-outline" as const,
      color: "#22C55E",
    },
    error: {
      icon: "close-circle-outline" as const,
      color: "#EF4444",
    },
    warning: {
      icon: "alert-circle-outline" as const,
      color: "#F59E0B",
    },
    info: {
      icon: "information-circle-outline" as const,
      color: theme.primaria,
    },
  }[variant];

  function fechar() {
    if (!loading) {
      onClose();
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={fechar}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={fechar}
        />

        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
            },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${configuracao.color}1A`,
              },
            ]}
          >
            <Ionicons
              name={configuracao.icon}
              size={34}
              color={configuracao.color}
            />
          </View>

          <Text weight="Bold" style={styles.title}>
            {title}
          </Text>

          <ScrollView
            style={styles.messageScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.message,
                { color: theme.textoSub },
              ]}
            >
              {message}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            {secondaryLabel && onSecondary ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onSecondary}
                disabled={loading}
                style={[
                  styles.button,
                  styles.secondaryButton,
                  { borderColor: theme.borda },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={[
                    styles.buttonText,
                    { color: theme.texto },
                  ]}
                >
                  {secondaryLabel}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={loading}
              onPress={onPrimary ?? onClose}
              style={[
                styles.button,
                {
                  backgroundColor: primaryDanger
                    ? "#EF4444"
                    : theme.backgroundContainer,
                },
              ]}
            >
              <Text
                weight="SemiBold"
                style={[
                  styles.buttonText,
                  {
                    color: primaryDanger
                      ? "#FFFFFF"
                      : theme.textoContainer,
                  },
                ]}
              >
                {loading
                  ? "PROCESSANDO..."
                  : primaryLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    justifyContent: "center",
    padding: 20,
  },

  container: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "76%",
    alignSelf: "center",
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 22,
  },

  iconContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  title: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 14,
  },

  messageScroll: {
    maxHeight: 230,
    marginTop: 10,
  },

  message: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  secondaryButton: {
    borderWidth: 1.5,
  },

  buttonText: {
    fontSize: 13,
  },
});