import type { ComponentProps, ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/ui/Text";
import Input from "@/components/ui/Input";
import { useTheme } from "@/contexts/ThemeContext";

type Icone = ComponentProps<typeof Ionicons>["name"];

interface Props {
  titulo: string;
  descricao: string;
  children: ReactNode;
  onBack?: () => void;
  ocupado?: boolean;
  rodape?: ReactNode;
}

export default function AcessoLayout({
  titulo,
  descricao,
  children,
  rodape,
  onBack,
  ocupado = false,
}: Props) {
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[
        styles.tela,
        { backgroundColor: theme.background },
      ]}
      behavior={
        Platform.OS === "ios" ? "padding" : undefined
      }
    >
      <StatusBar
        barStyle={
          mode === "dark"
            ? "light-content"
            : "dark-content"
        }
      />

      <Image
        accessible={false}
        source={
          mode === "light"
            ? require("@/assets/images/background-logos-white.png")
            : require("@/assets/images/background-logos-dark.png")
        }
        style={styles.fundo}
        resizeMode="cover"
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
            styles.scroll,
            {
                paddingTop: insets.top + 16,
                paddingBottom: rodape
                ? 16
                : insets.bottom + 24,
            },
        ]}
        style={styles.areaScroll}
      >
        <View style={styles.corpo}>
          <View style={styles.cabecalho}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                accessibilityState={{ disabled: ocupado }}
                disabled={ocupado}
                onPress={onBack}
                style={({ pressed }) => [
                  styles.voltar,
                  {
                    borderColor: theme.borda + "35",
                    backgroundColor: pressed
                      ? theme.primaria + "12"
                      : theme.backgroundSecundario,
                    opacity: ocupado ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="chevron-back"
                  size={21}
                  color={theme.texto}
                />
              </Pressable>
            ) : null}

            <View style={styles.marca}>
              <Text
                weight="Bold"
                style={[
                  styles.logo,
                  { color: theme.textoTerciaria },
                ]}
              >
                LOGOS
              </Text>

              <Text
                style={[
                  styles.marcaDescricao,
                  { color: theme.textoSub },
                ]}
              >
                ASSESSORIA DE IMPRENSA
              </Text>
            </View>
          </View>

          <View style={styles.apresentacao}>
            <Text weight="Bold" style={styles.titulo}>
              {titulo}
            </Text>

            <Text
              style={[
                styles.descricao,
                { color: theme.textoSub },
              ]}
            >
              {descricao}
            </Text>
          </View>

          <View style={styles.conteudo}>
            {children}
          </View>
        </View>
      </ScrollView>
      {rodape ? (
        <View
            style={[
            styles.rodape,
            {
                paddingBottom: insets.bottom + 20,
            },
            ]}
        >
            <View style={styles.rodapeConteudo}>
            {rodape}
            </View>
        </View>
        ) : null}
    </KeyboardAvoidingView>
  );
}

export function SecaoAcesso({
  titulo,
  descricao,
  icone,
  children,
}: {
  titulo: string;
  descricao?: string;
  icone: Icone;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.secao,
        {
          borderColor: theme.borda + "35",
          backgroundColor: theme.backgroundSecundario,
        },
      ]}
    >
      <View style={styles.secaoTopo}>
        <View
          style={[
            styles.icone,
            { backgroundColor: theme.primaria + "10" },
          ]}
        >
          <Ionicons
            name={icone}
            size={20}
            color={theme.textoTerciaria}
          />
        </View>

        <View style={styles.textos}>
          <Text
            weight="SemiBold"
            style={styles.secaoTitulo}
          >
            {titulo}
          </Text>

          {descricao ? (
            <Text
              style={[
                styles.legenda,
                { color: theme.textoSub },
              ]}
            >
              {descricao}
            </Text>
          ) : null}
        </View>
      </View>

      {children}
    </View>
  );
}

export function CampoAcesso(
  props: ComponentProps<typeof Input>
) {
  const { theme } = useTheme();

  return (
    <Input
      {...props}
      clearable={
        props.editable === false
          ? false
          : props.clearable
      }
      containerStyle={[
        styles.campo,
        props.containerStyle,
      ]}
      style={[
        {
          borderColor: props.error
            ? theme.erro
            : theme.borda + "65",
        },
        props.style,
      ]}
    />
  );
}

export function MensagemAcesso({
  mensagem,
}: {
  mensagem: string;
}) {
  const { theme } = useTheme();

  if (!mensagem) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.aviso,
        { backgroundColor: theme.erro + "0C" },
      ]}
    >
      <Ionicons
        name="alert-circle-outline"
        size={18}
        color={theme.erro}
      />

      <Text
        style={[
          styles.avisoTexto,
          { color: theme.erro },
        ]}
      >
        {mensagem}
      </Text>
    </View>
  );
}

export function OpcaoAcesso({
  titulo,
  descricao,
  icone,
  onPress,
}: {
  titulo: string;
  descricao: string;
  icone: Icone;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo + ". " + descricao}
      onPress={onPress}
      style={({ pressed }) => [
        styles.opcao,
        {
          borderColor: pressed
            ? theme.primaria
            : theme.borda + "45",
          backgroundColor: pressed
            ? theme.primaria + "10"
            : theme.backgroundSecundario,
        },
      ]}
    >
      <View
        style={[
          styles.opcaoIcone,
          { backgroundColor: theme.primaria + "12" },
        ]}
      >
        <Ionicons
          name={icone}
          size={23}
          color={theme.textoTerciaria}
        />
      </View>

      <View style={styles.textos}>
        <Text
          weight="SemiBold"
          style={styles.opcaoTitulo}
        >
          {titulo}
        </Text>

        <Text
          style={[
            styles.legenda,
            { color: theme.textoSub },
          ]}
        >
          {descricao}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.textoTerciaria}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1 
},
  fundo: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    opacity: 0.2,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  areaScroll: {
  flex: 1,
},

corpo: {
  flexGrow: 1,
  width: "100%",
  maxWidth: 520,
  alignSelf: "center",
},

rodape: {
  paddingHorizontal: 20,
  paddingTop: 12,
},

rodapeConteudo: {
  width: "100%",
  maxWidth: 520,
  alignSelf: "center",
},
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  voltar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  marca: { 
    flex: 1, 
    minWidth: 0, 
    gap: 3 
},
  logo: { 
    fontSize: 19, 
    letterSpacing: 2 
},
  marcaDescricao: { 
    fontSize: 9, 
    letterSpacing: 1 
},
  apresentacao: { 
    gap: 9, 
    marginBottom: 22 
},
  titulo: { 
    fontSize: 28, 
    lineHeight: 35 
},
  descricao: { 
    fontSize: 13, 
    lineHeight: 20 
},
  conteudo: {
    flexGrow: 1,
    gap: 14,
  },
  secao: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  secaoTopo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 3,
  },
  icone: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: { 
    flex: 1, 
    minWidth: 0, 
    gap: 4 
},
  secaoTitulo: { 
    fontSize: 15, 
    lineHeight: 21 
},
  legenda: { 
    fontSize: 12, 
    lineHeight: 18 
},
  campo: { 
    marginBottom: 0 
},
  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
  },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    gap: 12,
    minHeight: 92,
  },
  opcaoIcone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  opcaoTitulo: { 
    fontSize: 15, 
    lineHeight: 21 
},
});