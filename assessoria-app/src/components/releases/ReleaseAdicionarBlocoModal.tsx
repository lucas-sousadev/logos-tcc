import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { BlocoTemplateRelease } from "@/services/api/release";

type TipoBloco = BlocoTemplateRelease["tipo"];

const GRUPOS = [
  {
    titulo: "Conteúdo",
    opcoes: [
      {
        tipo: "titulo",
        nome: "Título",
        descricao: "Destaque principal",
        icone: "text-outline",
      },
      {
        tipo: "linha_fina",
        nome: "Linha fina",
        descricao: "Resumo da matéria",
        icone: "reorder-two-outline",
      },
      {
        tipo: "texto",
        nome: "Texto",
        descricao: "Parágrafos e informações",
        icone: "document-text-outline",
      },
      {
        tipo: "contato",
        nome: "Contato de imprensa",
        descricao: "Dados da assessoria",
        icone: "person-circle-outline",
      },
    ],
  },
  {
    titulo: "Mídia e links",
    opcoes: [
      {
        tipo: "imagem",
        nome: "Imagem / logo",
        descricao: "Imagem com legenda",
        icone: "image-outline",
      },
      {
        tipo: "botao",
        nome: "Botão com link",
        descricao: "Acesso em destaque",
        icone: "link-outline",
      },
      {
        tipo: "arquivo",
        nome: "Arquivo",
        descricao: "Link para download",
        icone: "attach-outline",
      },
    ],
  },
  {
    titulo: "Organização",
    opcoes: [
      {
        tipo: "divisor",
        nome: "Divisor",
        descricao: "Linha de separação",
        icone: "remove-outline",
      },
      {
        tipo: "espacamento",
        nome: "Espaçamento",
        descricao: "Respiro entre blocos",
        icone: "resize-outline",
      },
    ],
  },
] as const;

interface Props {
  disabled?: boolean;
  onClose: () => void;
  onAdicionar: (tipo: TipoBloco) => void;
}

export default function ReleaseAdicionarBlocoModal({
  disabled = false,
  onClose,
  onAdicionar,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [selecionado, setSelecionado] =
    useState<TipoBloco>("texto");

  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar seleção de blocos"
        />

        <View
          style={[
            styles.painel,
            {
              backgroundColor: theme.background,
              paddingBottom: Math.max(insets.bottom, 16),
              borderColor: theme.borda + "55",
            },
          ]}
        >
          <View style={styles.cabecalho}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                weight="Bold"
                style={{ fontSize: 18 }}
              >
                Adicionar bloco
              </Text>

              <Text
                style={{
                  color: theme.textoSub,
                  fontSize: 12,
                }}
              >
                Escolha o que deseja incluir na matéria.
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.fechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={6}
            >
              <Ionicons
                name="close-outline"
                size={24}
                color={theme.textoSub}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.grupos}
            showsVerticalScrollIndicator={false}
          >
            {GRUPOS.map((grupo) => (
              <View
                key={grupo.titulo}
                style={{ gap: 8 }}
              >
                <Text
                  weight="SemiBold"
                  style={{
                    fontSize: 12,
                    color: theme.textoSub,
                  }}
                >
                  {grupo.titulo}
                </Text>

                <View style={styles.opcoes}>
                  {grupo.opcoes.map((opcao) => {
                    const marcado =
                      selecionado === opcao.tipo;

                    return (
                      <TouchableOpacity
                        key={opcao.tipo}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityLabel={
                          opcao.nome + ". " + opcao.descricao
                        }
                        accessibilityState={{
                          checked: marcado,
                          disabled,
                        }}
                        onPress={() =>
                          setSelecionado(opcao.tipo)
                        }
                        activeOpacity={0.75}
                        style={[
                          styles.opcao,
                          {
                            borderColor: marcado
                              ? theme.primaria
                              : theme.borda + "45",
                            backgroundColor: marcado
                              ? theme.primaria + "0C"
                              : theme.backgroundSecundario,
                            opacity: disabled ? 0.5 : 1,
                          },
                        ]}
                      >
                        <View style={styles.topoOpcao}>
                          <Ionicons
                            name={opcao.icone}
                            size={23}
                            color={theme.textoTerciaria}
                          />

                          {marcado ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={theme.primaria}
                            />
                          ) : null}
                        </View>

                        <Text
                          weight="SemiBold"
                          style={{ fontSize: 13 }}
                        >
                          {opcao.nome}
                        </Text>

                        <Text
                          style={{
                            color: theme.textoSub,
                            fontSize: 11,
                          }}
                        >
                          {opcao.descricao}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.acoes}>
            <TouchableOpacity
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              onPress={() => {
                if (!disabled) {
                  onAdicionar(selecionado);
                }
              }}
              style={[
                styles.botao,
                {
                  borderColor: theme.primaria,
                  backgroundColor: theme.primaria,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons
                name="add-outline"
                size={16}
                color={theme.branco}
              />

              <Text
                weight="Bold"
                style={{
                  color: theme.branco,
                  fontSize: 11,
                }}
              >
                INSERIR BLOCO
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.botao,
                { borderColor: theme.borda },
              ]}
            >
              <Ionicons
                name="close-outline"
                size={16}
                color={theme.textoSub}
              />

              <Text
                weight="SemiBold"
                style={{
                  color: theme.textoSub,
                  fontSize: 11,
                }}
              >
                CANCELAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  painel: {
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fechar: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  grupos: {
    gap: 18,
    paddingBottom: 4,
  },
  opcoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  opcao: {
    width: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  topoOpcao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  acoes: {
    flexDirection: "row",
    gap: 7,
  },
  botao: {
    flex: 1,
    minHeight: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
  },
});