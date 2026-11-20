import { StyleSheet, View } from "react-native";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  pagina: number;
  limite: number;
  total: number;
  disabled?: boolean;
  onChange: (pagina: number) => void;
}

export default function PaginacaoLista({
  pagina,
  limite,
  total,
  disabled = false,
  onChange,
}: Props) {
  const { theme } = useTheme();
  const ultima = Math.max(1, Math.ceil(total / limite));
  const podeVoltar = !disabled && pagina > 1;
  const podeAvancar = !disabled && pagina < ultima;

  if (ultima === 1 && pagina === 1) return null;

  return (
    <View style={styles.container}>
      <Text
        style={{
          color: theme.textoSub,
          fontSize: 12,
          lineHeight: 18,
          textAlign: "center",
        }}
      >
        Página {pagina} de {ultima}
      </Text>

      <View style={styles.botoes}>
        <Button
          title="ANTERIOR"
          variant="outline"
          size="small"
          disabled={!podeVoltar}
          onPress={() => {
            if (podeVoltar) onChange(pagina - 1);
          }}
          style={styles.botao}
        />

        <Button
          title="PRÓXIMA"
          variant="outline"
          size="small"
          disabled={!podeAvancar}
          onPress={() => {
            if (podeAvancar) onChange(pagina + 1);
          }}
          style={styles.botao}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", minWidth: 0, marginTop: 18, gap: 12 },
  botoes: { flexDirection: "row", gap: 10 },
  botao: { flex: 1, width: "auto", minWidth: 0 },
});
