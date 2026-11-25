import { useCallback, useState, type ComponentProps } from "react";
import {
  Modal,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useIsFocused, type Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavegacao } from "@/contexts/NavegacaoContext";
import { ACOES_CRIACAO } from "@/constants/modulosNavegacao";
import {
  abrirModuloNaNavegacao,
  abrirModuloPelaBarra,
  type ModuloApp,
} from "@/utils/navegacaoModulos";

type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export default function BarraNavegacao({ state, navigation, insets }: Props) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const { conta, atalhos, disponiveis, pronto } = useNavegacao();
  const { height } = useWindowDimensions();
  const focada = useIsFocused();
  const [menu, setMenu] = useState<{
    conta: string | null;
    rota: string;
  } | null>(null);
  const atual = state.routes[state.index];
  const acoes = ACOES_CRIACAO.filter((acao) =>
    temPermissao(acao.permissao, "CRIAR")
  );
  const podeCriar = acoes.length > 0;
  const aberto =
    focada && podeCriar && menu?.conta === conta && menu?.rota === atual.key;

  useFocusEffect(
    useCallback(() => {
      if (!podeCriar) return;
      return () => setMenu(null);
    }, [podeCriar])
  );

  const vagas = atalhos.map((id) =>
    disponiveis.find((modulo) => modulo.id === id)
  );
  const itens = [
    { id: "index", rotulo: "Início", icone: "home-outline", ativo: "home" },
    vagas[0],
    null,
    vagas[1],
    { id: "mais", rotulo: "Mais", icone: "grid-outline", ativo: "grid" },
  ] as const;
  const emMais =
    atual.name !== "index" &&
    !atalhos.includes(atual.name as (typeof atalhos)[number]);

  function abrir(modulo: ModuloApp) {
    const rota = state.routes.find((item) => item.name === modulo);
    if (!rota) return;
    const evento = navigation.emit({
      type: "tabPress",
      target: rota.key,
      canPreventDefault: true,
    });
    if (!evento.defaultPrevented) abrirModuloPelaBarra(navigation, modulo);
  }

  return (
    <>
      <View
        style={[
          styles.container,
          {
            height: 94 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingLeft: Math.max(insets.left, 8),
            paddingRight: Math.max(insets.right, 8),
            backgroundColor: theme.background,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.fundo,
            {
              backgroundColor: theme.backgroundSecundario,
              borderTopColor: theme.borda + "35",
            },
          ]}
        />
        <View style={styles.linha}>
          {itens.map((item, indice) => {
            if (indice === 2)
              return (
                <View key="novo" style={styles.vagaNovo}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Criar novo"
                    aria-expanded={aberto}
                    aria-disabled={!pronto || acoes.length === 0}
                    accessibilityState={{
                      expanded: aberto,
                      disabled: !pronto || acoes.length === 0,
                    }}
                    disabled={!pronto || acoes.length === 0}
                    onPress={() => {
                      Keyboard.dismiss();
                      setMenu({ conta, rota: atual.key });
                    }}
                    style={({ pressed }) => [
                      styles.novo,
                      {
                        backgroundColor: theme.primaria,
                        borderColor: theme.backgroundSecundario,
                        opacity:
                          !pronto || !acoes.length ? 0.45 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="add" size={29} color={theme.branco} />
                  </Pressable>
                  <Text
                    weight="SemiBold"
                    maxFontSizeMultiplier={1.3}
                    style={[styles.rotulo, { color: theme.textoSub }]}
                  >
                    Novo
                  </Text>
                </View>
              );
            const selecionado =
              item?.id === atual.name || (item?.id === "mais" && emMais);
            const cor = selecionado ? theme.textoTerciaria : theme.textoSub;
            return (
              <Pressable
                key={indice}
                accessibilityRole="tab"
                aria-selected={selecionado}
                aria-disabled={!item || !pronto}
                accessibilityLabel={item?.rotulo ?? "Atalho indisponível"}
                accessibilityState={{
                  selected: selecionado,
                  disabled: !item || !pronto,
                }}
                disabled={!item || !pronto}
                onPress={() => item && abrir(item.id)}
                onLongPress={() => {
                  const rota = state.routes.find(
                    (candidata) => candidata.name === item?.id
                  );
                  if (rota)
                    navigation.emit({ type: "tabLongPress", target: rota.key });
                }}
                style={({ pressed }) => [
                  styles.item,
                  { opacity: !item || !pronto ? 0.4 : pressed ? 0.65 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.icone,
                    {
                      backgroundColor: selecionado
                        ? theme.primaria + "12"
                        : "transparent",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      item
                        ? selecionado
                          ? item.ativo
                          : item.icone
                        : "remove-outline"
                    }
                    size={22}
                    color={cor}
                  />
                </View>
                <Text
                  weight="SemiBold"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  maxFontSizeMultiplier={1.3}
                  style={[styles.rotulo, { color: cor }]}
                >
                  {item?.rotulo ?? "Atalho"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {aberto && (
        <MenuCriacao
          altura={height}
          fechar={() => setMenu(null)}
          acoes={acoes}
          criar={(acao) => {
            setMenu(null);
            abrirModuloNaNavegacao(
              navigation,
              acao.modulo,
              "inicio",
              acao.tela,
              acao.modulo === "templates"
                ? { criar: "1" }
                : acao.modulo === "clipping"
                  ? { ano: String(new Date().getFullYear()) }
                  : {},
              true
            );
          }}
        />
      )}
    </>
  );
}

type Acao = (typeof ACOES_CRIACAO)[number];

function MenuCriacao({
  altura,
  fechar,
  acoes,
  criar,
}: {
  altura: number;
  fechar: () => void;
  acoes: readonly Acao[];
  criar: (acao: Acao) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={fechar}
      statusBarTranslucent
    >
      <View
        style={[
          styles.modal,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 94,
            paddingLeft: Math.max(insets.left, 12),
            paddingRight: Math.max(insets.right, 12),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar menu de criação"
          onPress={fechar}
          style={[StyleSheet.absoluteFill, { backgroundColor: "#00000070" }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.painel,
            {
              maxHeight: Math.max(
                140,
                altura - insets.top - insets.bottom - 118
              ),
              backgroundColor: theme.backgroundSecundario,
              borderColor: theme.borda + "40",
            },
          ]}
        >
          <View style={styles.cabecalho}>
            <View style={styles.textos}>
              <Text weight="Bold" style={styles.titulo}>
                O que você deseja criar?
              </Text>
              <Text style={[styles.descricao, { color: theme.textoSub }]}>
                Selecione uma opção
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={fechar}
              style={styles.fechar}
            >
              <Ionicons name="close" size={22} color={theme.textoSub} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.lista}
          >
            {acoes.map((acao) => (
              <Pressable
                key={acao.modulo}
                accessibilityRole="button"
                accessibilityLabel={acao.titulo}
                onPress={() => criar(acao)}
                style={({ pressed }) => [
                  styles.acao,
                  {
                    backgroundColor: pressed
                      ? theme.primaria + "12"
                      : theme.primaria + "05",
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconeAcao,
                    { backgroundColor: theme.primaria + "12" },
                  ]}
                >
                  <Ionicons
                    name={acao.icone}
                    size={21}
                    color={theme.textoTerciaria}
                  />
                </View>
                <View style={styles.textos}>
                  <Text weight="SemiBold" style={styles.nomeAcao}>
                    {acao.titulo}
                  </Text>
                  <Text style={[styles.descricao, { color: theme.textoSub }]}>
                    {acao.descricao}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={theme.textoSub}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
  },
  fundo: {
    ...StyleSheet.absoluteFill,
    top: 20,
    borderTopWidth: 1,
  },
  linha: {
    height: 94,
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 8,
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2,
  },
  icone: {
    width: 46,
    height: 29,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rotulo: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  vagaNovo: {
    flex: 1,
    minWidth: 0,
    height: 84,
    alignItems: "center",
    gap: 4,
  },
  novo: {
    width: 60,
    height: 60,
    borderRadius: 22,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },
  painel: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 12,
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titulo: {
    fontSize: 18,
    lineHeight: 25,
  },
  descricao: {
    fontSize: 11,
    lineHeight: 17,
  },
  fechar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  lista: {
    padding: 10,
    paddingTop: 0,
    gap: 6,
  },
  acao: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    padding: 10,
    gap: 10,
    borderRadius: 13,
  },
  iconeAcao: {
    width: 39,
    height: 39,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nomeAcao: {
    fontSize: 13,
    lineHeight: 19,
  },
});
