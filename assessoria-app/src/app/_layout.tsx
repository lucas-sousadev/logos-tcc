import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function RootNavigator() {
  const { autenticado, carregando } = useAuth();

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
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}