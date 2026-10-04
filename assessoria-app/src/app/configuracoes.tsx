import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Switch
} from "react-native";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function Configuracoes() {
  const { theme, mode, toggleTheme } = useTheme();


  const { logout } = useAuth();
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

      <View style={[styles.switchContainer, {borderColor: theme.borda}]}>
        <Switch
          value={mode === "dark"}
          onValueChange={toggleTheme}
          trackColor={{ false: "#ddd", true: "#555" }}
          thumbColor={mode === "dark" ? "#fffffe" : "#333333"}

      />
        <Text style={styles.switchText} onPress={toggleTheme}>
          Alternar modo
        </Text>
      </View> 
      <View>
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
      </View> 
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
    marginTop: 10,
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
  },
  themeButton: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  switchContainer:{
    flex: 1,
    marginTop: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
  },
  switchText:{
    marginLeft: 10,
  }
});
