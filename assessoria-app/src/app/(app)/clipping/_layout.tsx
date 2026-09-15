import { Stack } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { ClippingNovosProvider } from "@/contexts/ClippingNovosContext";

export default function ClippingLayout() {
  const { usuario } = useAuth();

  const chaveUsuario =
    `${usuario?.assessoria_id ?? 0}:${usuario?.id ?? 0}`;

  return (
    <ClippingNovosProvider key={chaveUsuario}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ClippingNovosProvider>
  );
}