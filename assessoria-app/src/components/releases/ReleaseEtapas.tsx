import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

const ETAPAS = [
  { id: "DESTINO", nome: "Destino" },
  { id: "TEMPLATE", nome: "Template" },
  { id: "CONTEUDO", nome: "Conteúdo" },
  { id: "ENVIO", nome: "E-mail" },
  { id: "REVISAO", nome: "Revisão" },
] as const;

export type EtapaRelease =
  (typeof ETAPAS)[number]["id"];

interface Props {
  atual: EtapaRelease;
  disponiveis: readonly EtapaRelease[];
  disabled?: boolean;
  onSelecionar: (etapa: EtapaRelease) => void;
}

export default function ReleaseEtapas({
  atual,
  disponiveis,
  disabled = false,
  onSelecionar,
}: Props) {
  const { theme } = useTheme();

  const indiceAtual = ETAPAS.findIndex(
    (etapa) => etapa.id === atual
  );

  return (
    <View
      style={styles.barra}
      accessibilityRole="tablist"
    >
      {ETAPAS.map((etapa, indice) => {
        const selecionada = etapa.id === atual;
        const anterior = indice < indiceAtual;
        const liberada = disponiveis.includes(etapa.id);
        const bloqueada = disabled || !liberada;
        const destacada = selecionada || anterior;

        return (
          <TouchableOpacity
            key={etapa.id}
            accessibilityRole="tab"
            accessibilityLabel={
              "Etapa " + (indice + 1) + ", " + etapa.nome
            }
            accessibilityState={{
              selected: selecionada,
              disabled: bloqueada,
            }}
            disabled={bloqueada}
            onPress={() => onSelecionar(etapa.id)}
            style={styles.etapa}
          >
            <View
              style={[
                styles.trilho,
                {
                  backgroundColor: destacada
                    ? theme.primaria
                    : theme.borda + "40",
                },
              ]}
            />

            <View
              style={[
                styles.numero,
                {
                  backgroundColor: selecionada
                    ? theme.backgroundContainer
                    : theme.background,
                  borderColor: destacada
                    ? theme.primaria
                    : theme.borda + "60",
                },
              ]}
            >
              {anterior ? (
                <Ionicons
                  name="checkmark"
                  size={15}
                  color={theme.primaria}
                />
              ) : (
                <Text
                  weight="SemiBold"
                  style={{
                    color: selecionada
                      ? theme.textoContainer
                      : theme.textoSub,
                    fontSize: 12,
                  }}
                >
                  {indice + 1}
                </Text>
              )}
            </View>

            <Text
              weight={
                selecionada ? "SemiBold" : "Regular"
              }
              style={[
                styles.nome,
                {
                  color: selecionada
                    ? theme.textoTerciaria
                    : theme.textoSub,
                },
              ]}
            >
              {etapa.nome}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: "row",
    gap: 4,
  },
  etapa: {
    flex: 1,
    minWidth: 0,
    minHeight: 70,
    alignItems: "center",
    gap: 5,
    paddingTop: 2,
  },
  trilho: {
    height: 3,
    alignSelf: "stretch",
    borderRadius: 3,
    marginBottom: 2,
  },
  numero: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nome: {
    fontSize: 11,
    textAlign: "center",
    alignSelf: "stretch",
  },
});