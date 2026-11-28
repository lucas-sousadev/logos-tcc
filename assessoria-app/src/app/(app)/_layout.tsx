import { Tabs } from "expo-router";
import BarraNavegacao from "@/components/layout/BarraNavegacao";
import { useDescartesRelease } from "@/hooks/useDescartesRelease";
import { abrirModuloPelaBarra, ehModuloApp } from "@/utils/navegacaoModulos";

export default function AppLayout() {
  useDescartesRelease();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BarraNavegacao {...props} />}
      backBehavior="initialRoute"
      screenListeners={({ navigation, route }) => ({
        tabPress: (evento) => {
          if (!ehModuloApp(route.name)) return;
          evento.preventDefault();
          abrirModuloPelaBarra(navigation, route.name);
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Início" }} />
      <Tabs.Screen
        name="clipping"
        options={{ title: "Clipping", href: null }}
      />
      <Tabs.Screen name="mailing" options={{ title: "Mailing", href: null }} />
      <Tabs.Screen
        name="releases"
        options={{ title: "Releases", href: null }}
      />
      <Tabs.Screen name="mais" options={{ title: "Mais" }} />
      <Tabs.Screen name="clientes" options={{ href: null }} />
      <Tabs.Screen name="relatorios" options={{ href: null }} />
      <Tabs.Screen name="veiculos" options={{ href: null }} />
      <Tabs.Screen name="convites" options={{ href: null }} />
      <Tabs.Screen name="funcionarios" options={{ href: null }} />
      <Tabs.Screen name="templates" options={{ href: null }} />
    </Tabs>
  );
}