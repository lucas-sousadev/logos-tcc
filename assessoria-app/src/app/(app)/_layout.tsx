import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import { useFonts } from "expo-font";
import { Fonts } from "@/constants/fonts"
import { useTheme } from "@/contexts/ThemeContext";

export default function AppLayout() {
    const insets = useSafeAreaInsets();
    const [fontsLoaded] = useFonts({
      Montserrat_400Regular,
      Montserrat_500Medium,
      Montserrat_600SemiBold,
      Montserrat_700Bold,
      Montserrat_800ExtraBold,
    });

    if (!fontsLoaded) {
      return null;
    }
    const { theme } = useTheme();

  return (

    <Tabs
      screenOptions={{
      headerShown: false,
        tabBarActiveTintColor: theme.textoTerciaria,
        tabBarInactiveTintColor: theme.texto,
        tabBarStyle: {
          height: 70 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: 2,
          borderTopColor: theme.borda,
          backgroundColor: theme.background,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: Fonts.MontserratMedium,
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

<Tabs.Screen
  name="funcionarios"
  options={{
    href: null,
  }}
/>

<Tabs.Screen
  name="configuracoes"
  options={{
    href: null,
  }}
/>
      
    </Tabs>
  );
}