import { View } from "react-native";

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

  if (ultima === 1 && pagina === 1) return null;

  return (
    <View style={{ marginTop: 18, gap: 12 }}>
      <Text
        style={{
          color: theme.textoSub,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        Página {pagina} de {ultima}
      </Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title="ANTERIOR"
          variant="outline"
          size="small"
          disabled={disabled || pagina <= 1}
          onPress={() => onChange(pagina - 1)}
          style={{ flex: 1 }}
        />

        <Button
          title="PRÓXIMA"
          variant="outline"
          size="small"
          disabled={disabled || pagina >= ultima}
          onPress={() => onChange(pagina + 1)}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}