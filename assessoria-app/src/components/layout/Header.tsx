import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import Text from "@/components/ui/Text";
import { Fonts } from "@/constants/fonts";

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  showSettings?: boolean;
  onBackPress?: () => void;
}

export default function Header({
  title = "LOGOS",
  showBackButton = false,
  showSettings = true,
  onBackPress,
}: HeaderProps) {
  const router = useRouter();

  const { usuario } = useAuth();
  const { theme } = useTheme();

  const nome = usuario?.nome || "Usuário";

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  function handleBack() {
    if (onBackPress) {
      onBackPress();
      return;
    }

    router.back();
  }

  function handleSettings() {
    router.push("/configuracoes");
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.borda,
        },
      ]}
    >
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={theme.texto}
            />
          </TouchableOpacity>
        )}

        <View style={styles.titleContainer}>
          <Text
            weight="Regular"
            style={[
              styles.logo,
              {
                color: theme.texto,
              },
            ]}
          >
            LOGOS
          </Text>

          <Text
            weight="Bold"
            style={[
              styles.greeting,
              {
                color: theme.textoTerciaria,
              },
            ]}
          >
            {title === "LOGOS"
              ? `Olá, ${nome}`
              : title}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {showSettings && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleSettings}
            activeOpacity={0.7}
          >
            <Ionicons
              name="settings-outline"
              size={25}
              color={theme.texto}
            />
          </TouchableOpacity>
        )}

        <View
          style={[
            styles.avatar,
            {
              backgroundColor:
                theme.backgroundContainer,
            },
          ]}
        >
          <Text
            weight="Bold"
            style={[
              styles.avatarText,
              {
                color: theme.textoContainer,
              },
            ]}
          >
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

  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 40,
    height: 40,

    justifyContent: "center",
    alignItems: "center",

    marginRight: 10,
    marginLeft: -8,
  },

  titleContainer: {
    flex: 1,
  },

  logo: {
    fontSize: 14,
    letterSpacing: 1,
  },

  greeting: {
    fontSize: 22,
    marginTop: 3,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },

  iconButton: {
    width: 40,
    height: 40,

    justifyContent: "center",
    alignItems: "center",
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,

    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 16,
  },
});