import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function RootNavigator() {
  const { autenticado, carregando } = useAuth();

  if (carregando) {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={autenticado}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!autenticado}>
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="cadastro" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}