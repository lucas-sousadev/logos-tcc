import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface FiltroModalBaseProps {
  visible: boolean;
  subtitle: string;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  children: ReactNode;
}

export default function FiltroModalBase({
  visible,
  subtitle,
  onClose,
  onClear,
  onApply,
  children,
}: FiltroModalBaseProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
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
          <View style={styles.header}>
            <View>
              <Text weight="Bold" style={styles.title}>
                FILTROS
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  { color: theme.textoSub },
                ]}
              >
                {subtitle}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              style={[
                styles.closeButton,
                {
                  backgroundColor:
                    theme.backgroundContainer,
                },
              ]}
            >
              <Ionicons
                name="close"
                size={22}
                color={theme.textoContainer}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: theme.borda },
            ]}
          >
            <Button
              title="LIMPAR"
              variant="outline"
              onPress={onClear}
              style={styles.footerButton}
            />

            <Button
              title="APLICAR"
              onPress={onApply}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  container: {
    maxHeight: "90%",
    borderTopWidth: 1.5,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },

  title: {
    fontSize: 18,
  },

  subtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
  },

  footerButton: {
    flex: 1,
  },
});