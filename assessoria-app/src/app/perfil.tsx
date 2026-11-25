import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import { InformacoesCadastro } from "@/components/ui/DetalhesCadastro";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function Perfil() {
  const { usuario } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const nome = usuario?.nome?.trim() || "Usuário";
  const partes = nome.split(/\s+/);
  const iniciais = partes
    .filter((_, indice) => indice === 0 || indice === partes.length - 1)
    .map((parte) => Array.from(parte)[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
  const perfil = usuario?.perfil === "FUNCIONARIO" ? "Funcionário" : "Assessor";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Meu perfil" showBackButton />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 16,
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <View style={styles.conteudo}>
          <View
            style={[
              styles.identidade,
              {
                borderColor: theme.borda + "40",
                backgroundColor: theme.backgroundSecundario,
              },
            ]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.backgroundContainer },
              ]}
            >
              <Text
                weight="Bold"
                maxFontSizeMultiplier={1.5}
                style={[styles.iniciais, { color: theme.textoContainer }]}
              >
                {iniciais}
              </Text>
            </View>
            <View style={styles.resumo}>
              <Text style={[styles.rotulo, { color: theme.textoSub }]}>
                SUA CONTA
              </Text>
              <Text weight="Bold" selectable style={styles.nome}>
                {nome}
              </Text>
              <View
                style={[
                  styles.perfil,
                  { backgroundColor: theme.primaria + "0E" },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={13}
                  color={theme.textoTerciaria}
                />
                <Text
                  weight="SemiBold"
                  style={[styles.perfilTexto, { color: theme.textoTerciaria }]}
                >
                  {perfil}
                </Text>
              </View>
            </View>
          </View>

          <InformacoesCadastro
            grupos={[
              {
                id: "dados",
                titulo: "Informações pessoais",
                campos: [
                  {
                    id: "email",
                    icone: "mail-outline",
                    rotulo: "E-mail",
                    valor: usuario?.email || "Não informado",
                  },
                  {
                    id: "telefone",
                    icone: "call-outline",
                    rotulo: "Telefone",
                    valor: usuario?.telefone || "Não informado",
                  },
                ],
              },
            ]}
          />

          <View
            style={[styles.aviso, { backgroundColor: theme.primaria + "08" }]}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={theme.textoTerciaria}
            />
            <View style={styles.resumo}>
              <Text weight="SemiBold" style={styles.avisoTitulo}>
                Seu espaço no LOGOS
              </Text>
              <Text style={[styles.avisoTexto, { color: theme.textoSub }]}>
                Em breve, você poderá atualizar seus dados e adicionar uma foto
                por aqui.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingTop: 20,
  },
  conteudo: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    gap: 14,
  },
  identidade: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderRadius: 18,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  iniciais: {
    fontSize: 22,
    lineHeight: 30,
  },
  resumo: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  rotulo: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.6,
  },
  nome: {
    fontSize: 20,
    lineHeight: 27,
  },
  perfil: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  perfilTexto: {
    fontSize: 10,
    lineHeight: 15,
  },
  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  avisoTitulo: {
    fontSize: 12,
    lineHeight: 18,
  },
  avisoTexto: {
    fontSize: 12,
    lineHeight: 19,
  },
});
