import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { DestinatarioRelease } from "@/services/api/release";

interface Props {
  selecionados: readonly DestinatarioRelease[];
  disabled?: boolean;
  onPress: () => void;
}

export default function ReleaseDestinatariosCampo({
  selecionados,
  disabled = false,
  onPress,
}: Props) {
  const { theme } = useTheme();

  const total = selecionados.length;
  const temSelecao = total > 0;
  const visiveis = selecionados.slice(0, 2);
  const restantes = total - visiveis.length;

  const titulo = temSelecao
    ? total +
      (total === 1
        ? " contato selecionado"
        : " contatos selecionados")
    : "Selecionar contatos";

  return (
    <View style={styles.container}>
      <Text weight="SemiBold" style={styles.label}>
        DESTINATÁRIOS
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          temSelecao
            ? titulo
            : "Selecionar contatos. Nenhum contato selecionado."
        }
        accessibilityHint="Abre a seleção de destinatários do release."
        accessibilityState={{ disabled }}
        style={[
          styles.campo,
          {
            borderColor: temSelecao
              ? theme.primaria
              : theme.borda,
            backgroundColor: theme.backgroundSecundario,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.linha}>
          <View
            style={[
              styles.icone,
              { backgroundColor: theme.primaria + "14" },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={22}
              color={theme.textoTerciaria}
            />
          </View>

          <View style={styles.resumo}>
            <Text
              weight="SemiBold"
              style={styles.titulo}
            >
              {titulo}
            </Text>

            <Text
              style={{
                color: theme.textoSub,
                fontSize: 12,
              }}
            >
              {temSelecao
                ? "Toque para revisar a seleção"
                : "Escolha os contatos do Mailing"}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.textoTerciaria}
          />
        </View>

        {temSelecao ? (
          <View style={styles.selecionados}>
            {visiveis.map((contato) => (
              <View
                key={contato.id}
                style={[
                  styles.nome,
                  {
                    backgroundColor:
                      theme.primaria + "10",
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.texto,
                    fontSize: 11,
                    flexShrink: 1,
                  }}
                >
                  {contato.nome}
                </Text>
              </View>
            ))}

            {restantes > 0 ? (
              <View
                style={[
                  styles.nome,
                  {
                    backgroundColor:
                      theme.primaria + "18",
                  },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoTerciaria,
                    fontSize: 11,
                  }}
                >
                  +{restantes}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 12,
  },
  campo: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    justifyContent: "center",
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icone: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  resumo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titulo: {
    fontSize: 13,
  },
  selecionados: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  nome: {
    maxWidth: 132,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});