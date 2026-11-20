import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { dataISOParaBR } from "@/utils/clippingFormatacao";
import type { ResumoRelatorio } from "@/services/api/relatorio";

interface Props {
  relatorio: ResumoRelatorio;
  onPress: () => void;
}

export default function RelatorioListaCard({
  relatorio,
  onPress,
}: Props) {
  const { theme } = useTheme();

  const corInclusao = relatorio.inclusao_automatica
    ? theme.textoTerciaria
    : theme.textoSub;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={
        "Abrir relatório " + relatorio.titulo
      }
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: theme.borda + "45",
          backgroundColor: theme.backgroundSecundario,
        },
      ]}
    >
      <View style={styles.topo}>
        <View
          style={[
            styles.status,
            {
              backgroundColor: corInclusao + "12",
            },
          ]}
        >
          <Ionicons
            name={
              relatorio.inclusao_automatica
                ? "sync-outline"
                : "pause-circle-outline"
            }
            size={13}
            color={corInclusao}
          />

          <Text
            weight="SemiBold"
            style={[
              styles.statusTexto,
              { color: corInclusao },
            ]}
          >
            Inclusão automática{" "}
            {relatorio.inclusao_automatica
              ? "ativa"
              : "pausada"}
          </Text>
        </View>

        <View style={styles.contagem}>
          <Ionicons
            name="documents-outline"
            size={13}
            color={theme.textoTerciaria}
          />

          <Text
            style={[
              styles.contagemTexto,
              { color: theme.textoTerciaria },
            ]}
          >
            {relatorio.total_materias}{" "}
            {relatorio.total_materias === 1
              ? "matéria"
              : "matérias"}
          </Text>
        </View>
      </View>

      <View style={styles.tituloLinha}>
        <Text
          weight="Bold"
          style={styles.titulo}
        >
          {relatorio.titulo}
        </Text>

        <View
          style={[
            styles.seta,
            {
              backgroundColor: theme.primaria + "0C",
            },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={17}
            color={theme.textoTerciaria}
          />
        </View>
      </View>

      <View style={styles.cliente}>
        <Ionicons
          name="business-outline"
          size={14}
          color={theme.textoSub}
        />

        <Text
          weight="Medium"
          style={[
            styles.clienteTexto,
            { color: theme.textoSub },
          ]}
        >
          {relatorio.cliente_nome}
        </Text>
      </View>

      <View
        style={[
          styles.periodo,
          {
            borderTopColor: theme.borda + "25",
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={theme.textoSub}
        />

        <Text
          style={[
            styles.periodoTexto,
            { color: theme.textoSub },
          ]}
        >
          {dataISOParaBR(relatorio.periodo_inicio)}
          {" a "}
          {dataISOParaBR(relatorio.periodo_fim)}
        </Text>
      </View>

      {relatorio.total_pendentes > 0 ? (
        <View
          style={[
            styles.pendencia,
            {
              backgroundColor: theme.aviso + "12",
            },
          ]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={15}
            color={theme.aviso}
          />

          <Text
            weight="SemiBold"
            style={[
              styles.pendenciaTexto,
              { color: theme.aviso },
            ]}
          >
            {relatorio.total_pendentes}{" "}
            {relatorio.total_pendentes === 1
              ? "slide para revisar"
              : "slides para revisar"}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  topo: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  status: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusTexto: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
  },
  contagem: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  contagemTexto: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  tituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titulo: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 23,
  },
  seta: {
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cliente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clienteTexto: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 18,
  },
  periodo: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  periodoTexto: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 17,
  },
  pendencia: {
    maxWidth: "100%",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 6,
  },
  pendenciaTexto: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 17,
  },
});