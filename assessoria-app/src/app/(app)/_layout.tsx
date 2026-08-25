import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

export default function AppLayout() {
      const insets = useSafeAreaInsets();
  return (

    <Tabs
      screenOptions={{
      headerShown: false,
        tabBarActiveTintColor: Colors.corPrincipal,
        tabBarInactiveTintColor: "#50525a",
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: 1,
          borderTopColor: "#E5E5E5",
          backgroundColor: "#FFF",
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="mailing"
        options={{
          title: "Mailing",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="people-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="releases"
        options={{
          title: "Releases",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="document-text-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="clipping"
        options={{
          title: "Clipping",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="newspaper-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="mais"
        options={{
          title: "Mais",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="ellipsis-horizontal-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="clientes"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="relatorios"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="veiculos"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="convites"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}