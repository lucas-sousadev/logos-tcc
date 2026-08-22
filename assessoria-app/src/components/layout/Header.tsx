import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../../contexts/AuthContext";

interface HeaderProps {
  title?: string;
}

export default function Header({
  title = "LOGOS",
}: HeaderProps) {
  const { usuario } = useAuth();

  const nome = usuario?.nome || "Usuário";

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.logo}>LOGOS</Text>

        <Text style={styles.greeting}>
          {title === "LOGOS"
            ? `Olá, ${nome}`
            : title}
        </Text>
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {iniciais}
        </Text>
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

    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },

  logo: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4D86FF",
    letterSpacing: 1,
  },

  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginTop: 3,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F0FF",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#4D86FF",
    fontSize: 16,
    fontWeight: "700",
  },
});