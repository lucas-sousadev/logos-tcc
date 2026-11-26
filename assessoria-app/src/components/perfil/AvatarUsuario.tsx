import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { obterUrlFotoPerfil } from "@/services/api/perfil";
import type { Usuario } from "@/services/api/auth";

export default function AvatarUsuario({
  usuario,
  tamanho = 44,
  uri,
}: {
  usuario: Pick<Usuario, "nome" | "foto_path"> | null;
  tamanho?: number;
  uri?: string | null;
}) {
  const { theme } = useTheme();
  const [falha, setFalha] = useState<string | null>(null);
  const endereco =
    uri === undefined ? obterUrlFotoPerfil(usuario?.foto_path) : uri;
  const partes = (usuario?.nome?.trim() || "Usuário").split(/\s+/);
  const iniciais = partes
    .filter((_, i) => i === 0 || i === partes.length - 1)
    .map((p) => Array.from(p)[0])
    .join("")
    .toLocaleUpperCase("pt-BR");

  return (
    <View
      style={[
        styles.container,
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          backgroundColor: theme.backgroundContainer,
        },
      ]}
    >
      {endereco && falha !== endereco ? (
        <Image
          accessible={false}
          source={{ uri: endereco }}
          resizeMode="cover"
          onError={() => setFalha(endereco)}
          style={styles.imagem}
        />
      ) : (
        <Text
          weight="Bold"
          maxFontSizeMultiplier={1.5}
          style={{
            color: theme.textoContainer,
            fontSize: Math.round(tamanho * 0.32),
          }}
        >
          {iniciais}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  imagem: {
    width: "100%",
    height: "100%",
  },
});
