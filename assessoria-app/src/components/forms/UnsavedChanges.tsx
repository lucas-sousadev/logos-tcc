import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";
import Text from "@/components/ui/Text";

interface UnsavedChangesProps {
  visible: boolean;
  saving?: boolean;
  alterations?: number;
  onSave: () => void;
  onDiscard: () => void;
}

export default function UnsavedChanges({
  visible,
  saving = false,
  alterations,
  onSave,
  onDiscard,
}: UnsavedChangesProps) {
  const { theme } = useTheme();

  if (!visible) {
    return null;
  }

  return (
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
        <Ionicons
          name="alert-circle-outline"
          size={22}
          color="#EF4444"
        />

        <View style={styles.textContainer}>
          <Text weight="Bold" style={styles.title}>
            Alterações não salvas
          </Text>

          <Text
            style={[
                styles.description,
                {
                color: theme.textoSub,
                },
            ]}
            >
            {alterations === 1
                ? "1 alteração pendente."
                : `${alterations} alterações pendentes.`}
            </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onDiscard}
          style={[
            styles.actionButton,
            {
              borderColor: theme.borda,
            },
          ]}
          disabled={saving}
        >
          <Text
            weight="SemiBold"
            style={{
              color: theme.texto,
              fontSize: 13,
            }}
          >
            DESCARTAR
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onSave}
          style={[
            styles.actionButton,
            styles.saveButton,
            {
              backgroundColor:
                theme.backgroundContainer,
            },
          ]}
          disabled={saving}
        >
          <Text
            weight="SemiBold"
            style={{
              color: theme.textoContainer,
              fontSize: 13,
            }}
          >
            {saving ? "SALVANDO..." : "SALVAR"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 15,
    marginTop: 16,
    marginBottom: 5,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,

    elevation: 8,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  textContainer: {
    flex: 1,
    marginLeft: 10,
  },

  title: {
    fontSize: 15,
  },

  description: {
    fontSize: 12,
    marginTop: 3,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },

  actionButton: {
    minWidth: 100,
    height: 40,

    borderWidth: 1.5,
    borderRadius: 20,

    justifyContent: "center",
    alignItems: "center",

    paddingHorizontal: 15,
  },

  saveButton: {
    borderWidth: 0,
  },
});
