import { useCallback } from "react";
import {
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/ui/Text";
import AvatarUsuario from "@/components/perfil/AvatarUsuario";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";
import { useAbrirTelaConta } from "@/hooks/useNavegacaoConta";

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  showSettings?: boolean;
  onBackPress?: () => void;
  backFallback?: Href;
}

export default function Header({
  title = "LOGOS",
  showBackButton = false,
  showSettings = true,
  onBackPress,
  backFallback,
}: HeaderProps) {
  const abrirTelaConta = useAbrirTelaConta();
  const pathname = usePathname();
  const retornar = useRetornoSeguro(backFallback);
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();
  const { theme, mode } = useTheme();

  const nome = usuario?.nome?.trim() || "Usuário";
  const partes = nome.split(/\s+/);
  const noPerfil = pathname === "/perfil";

  const handleBack = useCallback(() => {
    if (onBackPress) {
      onBackPress();
      return;
    }

    retornar();
  }, [onBackPress, retornar]);

  useFocusEffect(
    useCallback(() => {
      if (!showBackButton || Platform.OS !== "android") return;

      const evento = BackHandler.addEventListener("hardwareBackPress", () => {
        handleBack();
        return true;
      });

      return () => evento.remove();
    }, [showBackButton, handleBack])
  );

  return (
    <>
      <StatusBar
        barStyle={mode === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            borderBottomColor: theme.borda + "35",
            // Mantém o conteúdo abaixo da barra de status e do recorte.
            paddingTop: insets.top + 12,
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              activeOpacity={0.7}
              onPress={handleBack}
              style={[
                styles.iconButton,
                { backgroundColor: theme.primaria + "0A" },
              ]}
            >
              <Ionicons name="chevron-back" size={23} color={theme.texto} />
            </TouchableOpacity>
          )}
          <View style={styles.titleContainer}>
            <Text
              weight="SemiBold"
              style={[styles.logo, { color: theme.textoSub }]}
            >
              LOGOS
            </Text>
            <Text
              weight="Bold"
              numberOfLines={2}
              style={[styles.title, { color: theme.textoTerciaria }]}
            >
              {title === "LOGOS" ? `Olá, ${partes[0]}` : title}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {showSettings && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Configurações"
              activeOpacity={0.7}
              onPress={() => abrirTelaConta("configuracoes")}
              style={[
                styles.iconButton,
                {
                  backgroundColor: theme.primaria + "0A",
                  borderColor: theme.borda + "25",
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={theme.textoTerciaria}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Meu perfil, ${nome}`}
            accessibilityState={{ disabled: noPerfil }}
            disabled={noPerfil}
            activeOpacity={0.75}
            onPress={() => abrirTelaConta("perfil")}
            style={[
              styles.avatar,
              {
                backgroundColor: theme.backgroundContainer,
                borderColor: theme.primaria + "35",
              },
            ]}
          >
            <AvatarUsuario usuario={usuario} tamanho={40} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  leftSection: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  logo: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 2,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  actions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderWidth: 2,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
