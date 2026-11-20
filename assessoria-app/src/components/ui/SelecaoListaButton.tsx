import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";

import Button from "@/components/ui/Button";
import { useTheme } from "@/contexts/ThemeContext";

type Props = Pick<
  ComponentProps<typeof Button>,
  "title" | "onPress" | "disabled" | "style"
>;

export default function SelecaoListaButton({
  style,
  ...props
}: Props) {
  const { theme } = useTheme();

  return (
    <Button
      {...props}
      variant="outline"
      size="small"
      icon="checkmark-circle-outline"
      style={[
        styles.botao,
        {
          backgroundColor: theme.background,
          borderColor: theme.primaria + "45",
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  botao: {
    minHeight: 40,
    borderRadius: 12,
    marginBottom: 12,
  },
});