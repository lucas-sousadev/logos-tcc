import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";

import { useAuth } from "../../contexts/AuthContext";
import { Colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/fonts";
import { useTheme } from "@/contexts/ThemeContext";

interface HeaderProps {
  title?: string;
}

export default function Header({
  title = "LOGOS",
}: HeaderProps) {
  const { usuario, logout } = useAuth();
  const { theme } = useTheme();  

  const nome = usuario?.nome || "Usuário";

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  return (
  <View style={[styles.container, {backgroundColor: theme.background, borderBottomColor: theme.borda}]}>
    <View>
      <Text style={[styles.logo, {color: theme.texto}]}>LOGOS</Text>

      <Text style={[styles.greeting, {color: theme.textoTerciaria}]}>
        {title === "LOGOS" ? `Olá, ${nome}` : title}
      </Text>
    </View>

    <View style={styles.actions}>
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={logout}
      >
        <Ionicons
          name="log-out-outline"
          size={26}
          color={Colors.corTexto}
        />
      </TouchableOpacity>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {iniciais}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  
  container: {
    minHeight: 90,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 15,
    
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
  },

  logo: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: Fonts.MontserratRegular,
    letterSpacing: 1,
  },

  greeting: {
    fontSize: 22,
    fontFamily: Fonts.MontserratBold,
    marginTop: 3,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginRight: 10
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F0FF",
    justifyContent: "center",
    alignItems: "center",
        marginRight: 10

  },

  avatarText: {
    color: Colors.corTextoBack,
    fontSize: 16,
    fontWeight: "700",
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