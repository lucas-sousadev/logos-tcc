import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { dataISOParaBR } from "@/utils/clippingFormatacao";
import {
  ROTULOS_STATUS,
  type ResumoRelease,
  type StatusRelease,
} from "@/services/api/release";

interface Props {
  release: ResumoRelease;
  onPress: () => void;
}

export default function ReleaseListaCard({
  release,
  onPress,
}: Props) {
  const { theme } = useTheme();

  const status: Record<
    StatusRelease,
    {
      cor: string;
      icone: ComponentProps<typeof Ionicons>["name"];
    }
  > = {
    RASCUNHO: {
      cor: theme.aviso,
      icone: "document-text-outline",
    },
    AGENDADO: {
      cor: theme.textoTerciaria,
      icone: "time-outline",
    },
    NA_FILA: {
      cor: theme.textoTerciaria,
      icone: "hourglass-outline",
    },
    ENVIANDO: {
      cor: theme.textoTerciaria,
      icone: "sync-outline",
    },
    ENVIADO: {
      cor: theme.textoTerciaria,
      icone: "paper-plane-outline",
    },
    PARCIAL: {
      cor: theme.aviso,
      icone: "alert-circle-outline",
    },
    FALHOU: {
      cor: theme.erro,
      icone: "close-circle-outline",
    },
  };

  const visual = status[release.status];
  const titulo = release.titulo || "Release sem título";
  const cliente = release.cliente_nome || "Cliente a definir";

  const data = (
    release.data_referencia || release.updated_at
  ).slice(0, 10);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        titulo +
        ". " +
        cliente +
        ". " +
        ROTULOS_STATUS[release.status] +
        ". " +
        release.total_destinatarios +
        " destinatários."
      }
      accessibilityHint="Abrir detalhes do release"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.borda + "45",
          backgroundColor: pressed
            ? theme.primaria + "08"
            : theme.backgroundSecundario,
        },
      ]}
    >
      <View style={styles.topo}>
        <View
          style={[
            styles.status,
            { backgroundColor: visual.cor + "12" },
          ]}
        >
          <Ionicons
            name={visual.icone}
            size={13}
            color={visual.cor}
          />

          <Text
            weight="SemiBold"
            style={[
              styles.statusTexto,
              { color: visual.cor },
            ]}
          >
            {ROTULOS_STATUS[release.status]}
          </Text>
        </View>

        <View style={styles.data}>
          <Ionicons
            name="calendar-outline"
            size={12}
            color={theme.textoSub}
          />

          <Text
            style={[
              styles.textoMenor,
              { color: theme.textoSub },
            ]}
          >
            {dataISOParaBR(data)}
          </Text>
        </View>
      </View>

      <View style={styles.tituloLinha}>
        <Text
          weight="Bold"
          numberOfLines={2}
          style={styles.titulo}
        >
          {titulo}
        </Text>

        <View
          style={[
            styles.abrir,
            { backgroundColor: theme.primaria + "0C" },
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
          numberOfLines={1}
          style={[
            styles.clienteNome,
            { color: theme.textoSub },
          ]}
        >
          {cliente}
        </Text>
      </View>

      <View
        style={[
          styles.rodape,
          { borderTopColor: theme.borda + "25" },
        ]}
      >
        <View style={styles.destinatarios}>
          <Ionicons
            name="people-outline"
            size={14}
            color={theme.textoTerciaria}
          />

          <Text
            style={[
              styles.textoMenor,
              { color: theme.textoSub },
            ]}
          >
            {release.total_destinatarios}{" "}
            {release.total_destinatarios === 1
              ? "destinatário"
              : "destinatários"}
          </Text>
        </View>

        <View style={styles.autor}>
          <Ionicons
            name="person-outline"
            size={12}
            color={theme.textoSub}
          />

          <Text
            numberOfLines={1}
            style={[
              styles.autorNome,
              { color: theme.textoSub },
            ]}
          >
            {release.criado_por_nome}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
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
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusTexto: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
  },
  data: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  textoMenor: {
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
  abrir: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cliente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clienteNome: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
  },
  rodape: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  destinatarios: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  autor: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  autorNome: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
  },
});