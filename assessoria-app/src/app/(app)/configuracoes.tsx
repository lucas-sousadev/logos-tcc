import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity
} from "react-native";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function Configuracoes() {
  const { theme } = useTheme();
  const { usuario, logout } = useAuth();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header
        title="Configurações"
        showBackButton
        showSettings={false}
      />

      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text weight="Bold" style={styles.title}>
          Configurações
        </Text>

        <Text style={styles.description}>
          Gerencie as configurações da sua conta.
        </Text>

        <TouchableOpacity
                style={styles.logoutButton}
                onPress={logout}
              >
                <Ionicons
                  name="log-out-outline"
                  size={26}
                  color={theme.texto}
                />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
  },

  title: {
    fontSize: 22,
  },

  description: {
    marginTop: 8,
    color: "#808080",
  },
  logoutButton: {
    height: 40,
    width: 40,
    borderRadius: 10,
    backgroundColor: "red",

    justifyContent: "center",
    alignItems: "center",
  },
});