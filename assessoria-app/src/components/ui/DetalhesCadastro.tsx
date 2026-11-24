import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

type Icone = ComponentProps<typeof Ionicons>["name"];

interface ResumoProps {
  nome: string;
  categoria: string;
  ativo: boolean;
  avatar?: ReactNode;
}

interface Campo {
  id: string;
  icone: Icone;
  rotulo: string;
  valor: string;
  vinculo?: boolean;
  acao?: {
    icone: Icone;
    rotulo: string;
    onPress: () => void;
  };
}

interface Grupo {
  id: string;
  titulo: string;
  campos: Campo[];
}

export function ResumoCadastro({
  nome,
  categoria,
  ativo,
  avatar,
}: ResumoProps) {
  const { theme } = useTheme();
  const corStatus = ativo ? theme.alteracao : theme.textoSub;
  const partes = nome.trim().split(/\s+/).filter(Boolean);

  const iniciais =
    partes
      .filter((_, indice) => indice === 0 || indice === partes.length - 1)
      .map((parte) => Array.from(parte)[0])
      .join("")
      .toLocaleUpperCase("pt-BR") || "?";

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.borda + "40",
          backgroundColor: theme.backgroundSecundario,
        },
      ]}
    >
      <View style={styles.identidade}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.backgroundContainer },
          ]}
        >
          {avatar ?? (
            <Text
              weight="Bold"
              style={{
                color: theme.textoContainer,
                fontSize: 18,
              }}
            >
              {iniciais}
            </Text>
          )}
        </View>

        <View style={styles.resumoConteudo}>
          <Text
            weight="Medium"
            style={[styles.categoria, { color: theme.textoSub }]}
          >
            {categoria}
          </Text>

          <Text weight="Bold" selectable style={styles.nome}>
            {nome}
          </Text>

          <View style={styles.status}>
            <View style={[styles.ponto, { backgroundColor: corStatus }]} />
            <Text
              weight="SemiBold"
              style={[styles.statusTexto, { color: corStatus }]}
            >
              {ativo ? "Ativo" : "Inativo"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function InformacoesCadastro({ grupos }: { grupos: Grupo[] }) {
  const { theme } = useTheme();

  return (
    <View style={styles.grupos}>
      {grupos.map((grupo) => (
        <View
          key={grupo.id}
          style={[
            styles.card,
            styles.grupo,
            {
              borderColor: theme.borda + "40",
              backgroundColor: theme.backgroundSecundario,
            },
          ]}
        >
          <Text weight="SemiBold" style={styles.titulo}>
            {grupo.titulo}
          </Text>

          {grupo.campos.map((campo, indice) => (
            <View
              key={campo.id}
              style={[
                styles.linha,
                indice > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: theme.borda + "20",
                },
                indice === grupo.campos.length - 1 && styles.ultimaLinha,
              ]}
            >
              <View
                style={[
                  styles.icone,
                  {
                    backgroundColor: theme.textoTerciaria + "0D",
                  },
                ]}
              >
                <Ionicons
                  name={campo.icone}
                  size={17}
                  color={theme.textoTerciaria}
                />
              </View>

              <View style={styles.conteudo}>
                <Text style={[styles.rotulo, { color: theme.textoSub }]}>
                  {campo.rotulo}
                </Text>

                <Text
                  selectable
                  style={[
                    styles.valor,
                    campo.vinculo && {
                      color: theme.alteracao,
                    },
                  ]}
                >
                  {campo.valor}
                </Text>
              </View>

              {campo.acao ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={campo.acao.rotulo}
                  activeOpacity={0.75}
                  onPress={campo.acao.onPress}
                  style={[
                    styles.acao,
                    {
                      borderColor: theme.primaria + "30",
                      backgroundColor: theme.primaria + "0A",
                    },
                  ]}
                >
                  <Ionicons
                    name={campo.acao.icone}
                    size={18}
                    color={theme.textoTerciaria}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 0,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  resumoConteudo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  categoria: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 2,
  },
  ponto: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusTexto: {
    fontSize: 10,
    lineHeight: 15,
  },
  identidade: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  nome: {
    minWidth: 0,
    fontSize: 18,
    lineHeight: 24,
  },
  grupos: {
    gap: 12,
  },
  grupo: {
    paddingBottom: 12,
  },
  titulo: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  ultimaLinha: {
    paddingBottom: 0,
  },
  icone: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  conteudo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rotulo: {
    fontSize: 10,
    lineHeight: 15,
  },
  valor: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  acao: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
