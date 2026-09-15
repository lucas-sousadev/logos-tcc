import { useState } from "react";
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  segundosParaTempo,
  tempoParaSegundos,
  validarTrecho,
} from "@/utils/clippingFormatacao";

interface ClippingTrechoInputProps {
  inicio: string;
  fim: string;
  onInicioChange: (valor: string) => void;
  onFimChange: (valor: string) => void;
  erroInicio?: string;
  erroFim?: string;
  disabled?: boolean;
}

export default function ClippingTrechoInput({
  inicio,
  fim,
  onInicioChange,
  onFimChange,
  erroInicio,
  erroFim,
  disabled = false,
}: ClippingTrechoInputProps) {
  const { theme } = useTheme();
  const { fontScale } = useWindowDimensions();

  const [tocouInicio, setTocouInicio] = useState(false);
  const [tocouFim, setTocouFim] = useState(false);

  const inicioConvertido = tempoParaSegundos(inicio);
  const fimConvertido = tempoParaSegundos(fim);
  const errosLocais = validarTrecho(inicio, fim);

  const ambosValidos =
    inicioConvertido !== null && fimConvertido !== null;

  const duracao =
    inicioConvertido !== null &&
    fimConvertido !== null &&
    fimConvertido > inicioConvertido
      ? fimConvertido - inicioConvertido
      : null;

  const erroInicioExibido =
    erroInicio ||
    (tocouInicio ? errosLocais.inicioSegundos : undefined);

  const erroFimExibido =
    erroFim ||
    (tocouFim || ambosValidos
      ? errosLocais.fimSegundos
      : undefined);

  // O teclado precisa permitir a digitação de ":".
  const teclado =
    Platform.OS === "ios"
      ? "numbers-and-punctuation"
      : "default";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.linha,
          fontScale > 1.2 && styles.coluna,
        ]}
      >
        <View style={styles.campo}>
          <Input
            label="INÍCIO"
            accessibilityLabel="Início do trecho"
            value={inicio}
            onChangeText={(texto) => {
              if (!disabled) onInicioChange(texto);
            }}
            onBlur={() => {
              setTocouInicio(true);

              if (!disabled && inicioConvertido !== null) {
                const formatado =
                  segundosParaTempo(inicioConvertido);

                if (formatado !== inicio) {
                  onInicioChange(formatado);
                }
              }
            }}
            placeholder="00:00"
            keyboardType={teclado}
            autoCorrect={false}
            autoCapitalize="none"
            editable={!disabled}
            clearable={!disabled}
            error={erroInicioExibido}
            containerStyle={styles.input}
          />
        </View>

        <View style={styles.campo}>
          <Input
            label="FIM"
            accessibilityLabel="Fim do trecho"
            value={fim}
            onChangeText={(texto) => {
              if (!disabled) onFimChange(texto);
            }}
            onBlur={() => {
              setTocouFim(true);

              if (!disabled && fimConvertido !== null) {
                const formatado =
                  segundosParaTempo(fimConvertido);

                if (formatado !== fim) {
                  onFimChange(formatado);
                }
              }
            }}
            placeholder="00:00"
            keyboardType={teclado}
            autoCorrect={false}
            autoCapitalize="none"
            editable={!disabled}
            clearable={!disabled}
            error={erroFimExibido}
            containerStyle={styles.input}
          />
        </View>
      </View>

      <Text
        style={[
          styles.duracao,
          {
            color:
              duracao !== null
                ? theme.textoTerciaria
                : theme.textoSub,
          },
        ]}
      >
        {duracao !== null
          ? `Duração do trecho: ${segundosParaTempo(duracao)}`
          : "A duração será calculada com início e fim válidos."}
      </Text>
      <Text style={[styles.ajuda, { color: theme.textoSub }]}>
        Ex.: 02:10 (2min e 10seg) ou 01:05:30 para incluir horas.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  linha: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  coluna: {
    flexDirection: "column",
  },
  campo: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
    minWidth: 120,
  },
  input: {
    marginBottom: 0,
  },
  duracao: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
});