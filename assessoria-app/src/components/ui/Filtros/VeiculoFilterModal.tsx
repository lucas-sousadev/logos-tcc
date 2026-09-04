import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

export interface FiltrosVeiculos {
  ativo?: number;
}

interface VeiculoFilterModalProps {
  visible: boolean;
  filtros: FiltrosVeiculos;
  onClose: () => void;
  onApply: (filtros: FiltrosVeiculos) => void;
}

export default function VeiculoFilterModal({
  visible,
  filtros,
  onClose,
  onApply,
}: VeiculoFilterModalProps) {
  const { theme } = useTheme();
  const [ativo, setAtivo] = useState<number | undefined>(
    filtros.ativo
  );

  useEffect(() => {
    if (visible) setAtivo(filtros.ativo);
  }, [visible, filtros]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
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
              <Text style={[styles.subtitle, { color: theme.textoSub }]}>
                Refine os veículos exibidos
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              style={[
                styles.closeButton,
                { backgroundColor: theme.backgroundContainer },
              ]}
            >
              <Ionicons name="close" size={22} color={theme.textoContainer} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text weight="SemiBold" style={styles.sectionTitle}>
              STATUS
            </Text>
            <View style={styles.optionsRow}>
              <Opcao
                label="Ativos"
                selected={ativo === 1}
                onPress={() => setAtivo(1)}
              />
              <Opcao
                label="Inativos"
                selected={ativo === 0}
                onPress={() => setAtivo(0)}
              />
              <Opcao
                label="Todos"
                selected={ativo === undefined}
                onPress={() => setAtivo(undefined)}
              />
            </View>
          </View>

          <View style={[styles.footer, { borderTopColor: theme.borda }]}>
            <Button
              title="LIMPAR"
              variant="outline"
              onPress={() => setAtivo(undefined)}
              style={styles.footerButton}
            />
            <Button
              title="APLICAR"
              onPress={() => onApply({ ativo })}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Opcao({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.option,
        {
          borderColor: selected ? theme.primaria : theme.borda,
          backgroundColor: selected
            ? theme.backgroundContainer
            : theme.background,
        },
      ]}
    >
      <Text
        weight="Medium"
        style={{
          color: selected ? theme.textoContainer : theme.texto,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  container: {
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
  title: { fontSize: 18 },
  subtitle: { fontSize: 12, marginTop: 3 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionTitle: { fontSize: 13, marginBottom: 10 },
  optionsRow: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
  },
  footerButton: { flex: 1 },
});
