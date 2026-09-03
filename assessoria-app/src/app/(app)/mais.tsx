import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface MenuItemProps {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}

export default function Mais() {
  const router = useRouter();

  const { theme } = useTheme();
  const { usuario, temPermissao } = useAuth();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header title="Mais" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text
          weight="SemiBold"
          style={styles.sectionTitle}
        >
          Gerenciamento
        </Text>
        
        {temPermissao("CLIENTES", "VISUALIZAR") && (
          <MenuItem
            title="Clientes"
            description="Gerencie os clientes da assessoria."
            icon="business-outline"
            onPress={() =>
              router.push("/clientes")
            }
          />
        )}

        {temPermissao("VEICULOS", "VISUALIZAR") && (
          <MenuItem
            title="Veículos"
            description="Gerencie os veículos de comunicação cadastrados."
          icon="radio-outline"
          onPress={() =>
            router.push("/veiculos")
          }
        />
        )}

        {temPermissao("RELATORIOS", "VISUALIZAR") && (
        <MenuItem
          title="Relatórios"
          description="Gere e consulte os relatórios da assessoria."
          icon="bar-chart-outline"
          onPress={() =>
            router.push("/relatorios")
          }
        />
        )}

        {usuario?.perfil === "ASSESSOR" && (
          <>
            <MenuItem
              title="Funcionários"
              description="Gerencie funcionários e suas permissões."
              icon="people-outline"
              onPress={() =>
                router.push("/funcionarios")
              }
            />

            <MenuItem
              title="Convites"
              description="Crie e acompanhe convites para funcionários."
              icon="mail-outline"
              onPress={() =>
                router.push("/(app)/convites")
              }
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MenuItem({
  title,
  description,
  icon,
  onPress,
}: MenuItemProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.item,
        {
          backgroundColor: theme.background,
          borderColor: theme.borda,
        },
      ]}
    >
      <View style={styles.itemContent}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme.backgroundContainer,
              },
            ]}
        >
          <Ionicons
            name={icon}
            size={22}
            color={theme.textoContainer}
          />
        </View>

        <View style={styles.textContainer}>
          <Text
            weight="SemiBold"
            style={[
              styles.itemTitle,
              {
                color: theme.textoTerciaria,
              },
            ]}
          >
            {title}
          </Text>

          <Text
            weight="Regular"
            style={[
              styles.itemDescription,
              {
                color: theme.texto,
              },
            ]}
          >
            {description}
          </Text>
        </View>

        <Ionicons
          name="arrow-forward-outline"
          size={21}
          color={theme.texto}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 30,
  },

  sectionTitle: {
    fontSize: 22,
    marginBottom: 18,
  },

  item: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 17,
    marginBottom: 12,
  },

  itemContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  itemTitle: {
    fontSize: 17,
  },

  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
});