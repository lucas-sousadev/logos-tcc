import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import { useAbrirModulo } from "@/hooks/useNavegacaoModulos";
import type { ModuloApp } from "@/utils/navegacaoModulos";
import Text from "@/components/ui/Text";
import { useNavegacao } from "@/contexts/NavegacaoContext";
import { useTheme } from "@/contexts/ThemeContext";

interface ItemMenu {
  titulo: string;
  descricao: string;
  icone: ComponentProps<typeof Ionicons>["name"];
  rota: ModuloApp;
}

interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

export default function Mais() {
  const abrirModulo = useAbrirModulo();
  const { theme } = useTheme();
  const { atalhos, disponiveis, pronto } = useNavegacao();
  const { width } = useWindowDimensions();

  const grupos: GrupoMenu[] = [
    "Conteúdo e comunicação",
    "Cadastros",
    "Equipe",
  ].map((titulo) => ({
    titulo,
    itens: disponiveis
      .filter(
        (modulo) => modulo.grupo === titulo && !atalhos.includes(modulo.id)
      )
      .map((modulo) => ({
        titulo: modulo.titulo,
        descricao: modulo.descricao,
        icone: modulo.icone,
        rota: modulo.id,
      })),
  }));
  const gruposVisiveis = pronto
    ? grupos.filter((grupo) => grupo.itens.length > 0)
    : [];

  return (
    <View style={[styles.tela, { backgroundColor: theme.background }]}>
      <Header title="Mais" showBackButton />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
      >
        <View style={styles.corpo}>
          <View style={styles.introducao}>
            <Text
              weight="SemiBold"
              style={[styles.sobretitulo, { color: theme.textoTerciaria }]}
            >
              ESPAÇO DE TRABALHO
            </Text>

            <Text weight="Bold" style={styles.titulo}>
              Gestão da assessoria
            </Text>

            <Text style={[styles.descricao, { color: theme.textoSub }]}>
              Os módulos que não estão nos seus atalhos ficam aqui.
            </Text>
          </View>

          {!pronto ? (
            <ActivityIndicator
              color={theme.primaria}
              accessibilityLabel="Carregando módulos"
            />
          ) : null}
          <View style={styles.grade}>
            {gruposVisiveis.map((grupo) => (
              <View
                key={grupo.titulo}
                style={[
                  styles.grupo,
                  {
                    width: width >= 720 ? "48.5%" : "100%",
                  },
                ]}
              >
                <Text weight="SemiBold" style={styles.tituloGrupo}>
                  {grupo.titulo}
                </Text>

                <View
                  style={[
                    styles.superficie,
                    {
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda + "40",
                    },
                  ]}
                >
                  {grupo.itens.map((item, indice) => (
                    <Pressable
                      key={item.titulo}
                      accessibilityRole="button"
                      accessibilityLabel={item.titulo + ". " + item.descricao}
                      onPress={() => abrirModulo(item.rota, "mais")}
                      style={({ pressed }) => [
                        styles.item,
                        {
                          backgroundColor: pressed
                            ? theme.primaria + "10"
                            : "transparent",
                          borderTopWidth: indice > 0 ? 1 : 0,
                          borderTopColor: theme.borda + "25",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.icone,
                          {
                            backgroundColor: theme.primaria + "12",
                          },
                        ]}
                      >
                        <Ionicons
                          name={item.icone}
                          size={21}
                          color={theme.textoTerciaria}
                        />
                      </View>

                      <View style={styles.textos}>
                        <Text weight="SemiBold" style={styles.nomeItem}>
                          {item.titulo}
                        </Text>

                        <Text
                          style={[styles.detalhe, { color: theme.textoSub }]}
                        >
                          {item.descricao}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={theme.textoSub}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {pronto && gruposVisiveis.length === 0 ? (
            <View
              style={[
                styles.vazio,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor: theme.borda + "40",
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={26}
                color={theme.textoSub}
              />

              <Text weight="SemiBold">Nenhum outro módulo disponível</Text>

              <Text
                style={[
                  styles.detalhe,
                  {
                    color: theme.textoSub,
                    textAlign: "center",
                  },
                ]}
              >
                Os acessos aparecem conforme as permissões da sua conta.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  conteudo: {
    padding: 16,
    paddingBottom: 30,
  },
  corpo: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    gap: 24,
  },
  introducao: {
    gap: 6,
    paddingTop: 2,
  },
  sobretitulo: {
    fontSize: 10,
    letterSpacing: 1.1,
  },
  titulo: {
    fontSize: 22,
    lineHeight: 29,
  },
  descricao: {
    fontSize: 13,
    lineHeight: 19,
  },
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  grupo: {
    gap: 9,
  },
  tituloGrupo: {
    fontSize: 13,
    paddingLeft: 2,
  },
  superficie: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  item: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 11,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nomeItem: {
    fontSize: 14,
    lineHeight: 19,
  },
  detalhe: {
    fontSize: 12,
    lineHeight: 17,
  },
  vazio: {
    padding: 22,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    gap: 10,
  },
});