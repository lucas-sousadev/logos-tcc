import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

export default function SecaoEdicao({
  titulo,
  descricao,
  children,
  ativa = true,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  ativa?: boolean;
}) {
  const { theme } = useTheme();
  if (!ativa) return <>{children}</>;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundSecundario,
          borderColor: theme.borda + "40",
        },
      ]}
    >
      <View style={styles.cabecalho}>
        <Text weight="SemiBold" style={styles.titulo}>
          {titulo}
        </Text>
        {descricao ? (
          <Text style={[styles.descricao, { color: theme.textoSub }]}>
            {descricao}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cabecalho: {
    gap: 4,
  },
  titulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 18,
  },
});
