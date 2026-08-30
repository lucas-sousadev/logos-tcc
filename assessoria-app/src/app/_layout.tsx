import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import { useFonts } from "expo-font";
import { ThemeProvider } from "@/contexts/ThemeContext";

function RootNavigator() {
  const { autenticado, carregando } = useAuth();
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

  if (carregando) {
    return null;
  }

  return (
    <Stack screenOptions={{
        headerShown: false,
      }}>
      <Stack.Protected guard={autenticado}>
        <Stack.Screen name="(app)"/>
      </Stack.Protected>

      <Stack.Protected guard={!autenticado}>
        <Stack.Screen name="entrar"/>
        <Stack.Screen name="login-assessor"/>
        <Stack.Screen name="login-funcionario"/>
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="cadastro-funcionario"/>
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator/>
      </AuthProvider>
    </ThemeProvider>
  );
}