import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const { autenticado, carregando } = useAuth();

  if (carregando) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (autenticado) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/entrar" />;
}