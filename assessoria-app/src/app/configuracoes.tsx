import {
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function Configuracoes() {
  const { theme, mode, toggleTheme } = useTheme();
  const { usuario, logout } = useAuth();

  const nome = usuario?.nome?.trim() || "Usuário";
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title="Configurações"
        showBackButton
        showSettings={false}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
      >
        <View style={styles.introducao}>
          <Text weight="Bold" style={styles.tituloPagina}>
            Preferências
          </Text>
          <Text style={[styles.descricaoPagina, { color: theme.textoSub }]}>
            Personalize a aparência e gerencie sua sessão.
          </Text>
        </View>

        <View
          style={[
            styles.contaCard,
            {
              backgroundColor: theme.backgroundSecundario,
              borderColor: theme.borda + "90",
            },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.backgroundContainer },
            ]}
          >
            <Text weight="Bold" style={{ color: theme.textoContainer }}>
              {iniciais}
            </Text>
          </View>
          <View style={styles.contaTexto}>
            <Text weight="Bold" numberOfLines={1} style={styles.nome}>
              {nome}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.email, { color: theme.textoSub }]}
            >
              {usuario?.email || "E-mail não informado"}
            </Text>
            <Text
              weight="SemiBold"
              style={[styles.perfil, { color: theme.textoTerciaria }]}
            >
              {usuario?.perfil === "FUNCIONARIO" ? "Funcionário" : "Assessor"}
            </Text>
          </View>
        </View>

        <View style={styles.secao}>
          <Text weight="Bold" style={styles.tituloSecao}>
            Aparência
          </Text>
          <View
            style={[
              styles.opcaoCard,
              {
                backgroundColor: theme.backgroundSecundario,
                borderColor: theme.borda + "90",
              },
            ]}
          >
            <View
              style={[
                styles.iconeOpcao,
                { backgroundColor: theme.borda + "20" },
              ]}
            >
              <Ionicons
                name={mode === "dark" ? "moon-outline" : "sunny-outline"}
                size={22}
                color={theme.textoTerciaria}
              />
            </View>
            <View style={styles.opcaoTexto}>
              <Text weight="SemiBold" style={styles.nomeOpcao}>
                Modo escuro
              </Text>
              <Text style={[styles.descricaoOpcao, { color: theme.textoSub }]}>
                {mode === "dark" ? "Ativado" : "Desativado"}
              </Text>
            </View>
            <Switch
              value={mode === "dark"}
              onValueChange={toggleTheme}
              accessibilityLabel="Modo escuro"
              accessibilityHint="Alterna entre os temas claro e escuro"
              trackColor={{
                false: theme.borda + "70",
                true: theme.primaria,
              }}
              thumbColor={theme.branco}
              ios_backgroundColor={theme.borda + "70"}
            />
          </View>
          <Text style={[styles.ajuda, { color: theme.textoSub }]}>
            Sua escolha fica salva neste dispositivo.
          </Text>
        </View>

        <View style={styles.secao}>
          <Text weight="Bold" style={styles.tituloSecao}>
            Sessão
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            accessibilityHint="Encerra a sessão neste dispositivo"
            activeOpacity={0.75}
            onPress={() => void logout()}
            style={[
              styles.opcaoCard,
              {
                backgroundColor: theme.backgroundSecundario,
                borderColor: theme.erro + "70",
              },
            ]}
          >
            <View
              style={[
                styles.iconeOpcao,
                { backgroundColor: theme.erro + "15" },
              ]}
            >
              <Ionicons
                name="log-out-outline"
                size={22}
                color={theme.erro}
              />
            </View>
            <View style={styles.opcaoTexto}>
              <Text
                weight="SemiBold"
                style={[styles.nomeOpcao, { color: theme.erro }]}
              >
                Sair da conta
              </Text>
              <Text style={[styles.descricaoOpcao, { color: theme.textoSub }]}>
                Encerrar sessão neste dispositivo
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.erro}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1 
  },
  conteudo: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 30,
    gap: 22,
  },
  introducao: { 
    gap: 4 
  },
  tituloPagina: { 
    fontSize: 20, 
    lineHeight: 26 
  },
  descricaoPagina: { 
    fontSize: 12, 
    lineHeight: 18 
  },
  contaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  contaTexto: { 
    flex: 1, 
    gap: 2 
  },
  nome: { 
    fontSize: 15, 
    lineHeight: 20 
  },
  email: { 
    fontSize: 12, 
    lineHeight: 17 
  },
  perfil: { 
    fontSize: 11, 
    lineHeight: 16 
  },
  secao: { 
    gap: 9 
  },
  tituloSecao: { 
    fontSize: 16, 
    lineHeight: 22 
  },
  opcaoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 72,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  iconeOpcao: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  opcaoTexto: {
    flex: 1, 
    gap: 2 
  },
  nomeOpcao: { 
    fontSize: 13, 
    lineHeight: 18 
  },
  descricaoOpcao: { 
    fontSize: 11, 
    lineHeight: 16 
  },
  ajuda: { 
    fontSize: 11, 
    lineHeight: 16 
  },
});
