import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  valor: number;
  original: number;
  disabled?: boolean;
  onChange: (valor: number) => void;
}

export default function RelatorioSlideTamanhoImagem({
  valor,
  original,
  disabled,
  onChange,
}: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.cartao, { borderColor: theme.borda + "40" }]}>
      <View style={styles.cabecalho}>
        <Text weight="SemiBold" style={{ fontSize: 12 }}>
          Tamanho no slide
        </Text>
        {valor !== original ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Restaurar tamanho da imagem"
            disabled={disabled}
            onPress={() => onChange(original)}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={18}
              color={theme.alteracao}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.controles}>
        {([-1, 1] as const).map((direcao) => {
          const bloqueado =
            disabled || (direcao === -1 ? valor <= 25 : valor >= 100);
          const botao = (
            <TouchableOpacity
              key={direcao}
              accessibilityRole="button"
              accessibilityLabel={
                direcao === -1
                  ? "Diminuir imagem no slide"
                  : "Aumentar imagem no slide"
              }
              disabled={bloqueado}
              onPress={() =>
                onChange(Math.max(25, Math.min(100, valor + direcao * 5)))
              }
              style={[
                styles.botao,
                {
                  backgroundColor: theme.primaria + "0D",
                  opacity: bloqueado ? 0.4 : 1,
                },
              ]}
            >
              <Ionicons
                name={direcao === -1 ? "remove" : "add"}
                size={20}
                color={theme.textoTerciaria}
              />
            </TouchableOpacity>
          );
          return direcao === -1 ? (
            <View key={direcao} style={styles.metade}>
              {botao}
              <Text
                accessibilityLiveRegion="polite"
                weight="SemiBold"
                style={styles.percentual}
              >
                {valor}%
              </Text>
            </View>
          ) : (
            botao
          );
        })}
      </View>
      <Text style={{ color: theme.textoSub, fontSize: 11, lineHeight: 16 }}>
        De 25% a 100% da área disponível, mantendo a proporção da imagem.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  controles: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metade: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  botao: {
    minHeight: 40,
    width: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  percentual: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
  },
});
