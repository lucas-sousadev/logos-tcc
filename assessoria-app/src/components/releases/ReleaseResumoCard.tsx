import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ROTULOS_STATUS,
  type DetalheRelease,
  type StatusRelease,
} from "@/services/api/release";

interface Props {
  release: DetalheRelease;
  status: StatusRelease;
}

export default function ReleaseResumoCard({
  release,
  status,
}: Props) {
  const { theme } = useTheme();

  const corStatus =
    status === "FALHOU"
      ? theme.erro
      : status === "RASCUNHO" || status === "PARCIAL"
        ? theme.aviso
        : theme.textoTerciaria;

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.borda + "40",
          backgroundColor: theme.backgroundSecundario,
        },
      ]}
    >
      <View style={styles.topo}>
        <View style={styles.cliente}>
          <Ionicons
            name="business-outline"
            size={14}
            color={theme.textoSub}
          />

          <Text
            style={[
              styles.clienteNome,
              { color: theme.textoSub },
            ]}
          >
            {release.cliente_nome || "Sem cliente vinculado"}
          </Text>
        </View>

        <View
          style={[
            styles.status,
            { backgroundColor: corStatus + "12" },
          ]}
        >
          <View
            style={[
              styles.ponto,
              { backgroundColor: corStatus },
            ]}
          />

          <Text
            weight="SemiBold"
            accessibilityLiveRegion="polite"
            style={[
              styles.statusTexto,
              { color: corStatus },
            ]}
          >
            {ROTULOS_STATUS[status]}
          </Text>
        </View>
      </View>

      <Text weight="Bold" style={styles.titulo}>
        {release.titulo || "Release sem título"}
      </Text>

      <View
        style={[
          styles.dados,
          { borderTopColor: theme.borda + "25" },
        ]}
      >
        <View style={styles.linha}>
          <Text
            style={[
              styles.rotulo,
              { color: theme.textoSub },
            ]}
          >
            Assunto
          </Text>

          <Text weight="SemiBold" style={styles.valor}>
            {release.assunto || "Não preenchido"}
          </Text>
        </View>

        <View style={styles.linha}>
          <Text
            style={[
              styles.rotulo,
              { color: theme.textoSub },
            ]}
          >
            Remetente
          </Text>

          <View style={styles.detalhe}>
            <Text weight="Medium" style={styles.textoCampo}>
              {release.nome_remetente || "LOGOS"}
            </Text>

            <Text
              style={[
                styles.ajuda,
                { color: theme.textoSub },
              ]}
            >
              Endereço padrão do LOGOS
            </Text>
          </View>
        </View>

        <View style={styles.linha}>
          <Text
            style={[
              styles.rotulo,
              { color: theme.textoSub },
            ]}
          >
            Responder a
          </Text>

          <Text selectable style={styles.valor}>
            {release.responder_para ||
              "Endereço padrão do LOGOS"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cliente: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clienteNome: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  status: {
    maxWidth: "60%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  ponto: {
    width: 5,
    height: 5,
    borderRadius: 3,
    flexShrink: 0,
  },
  statusTexto: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
  },
  titulo: {
    fontSize: 18,
    lineHeight: 24,
  },
  dados: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  linha: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rotulo: {
    width: 72,
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 19,
  },
  valor: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 19,
  },
  detalhe: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  textoCampo: {
    fontSize: 12,
    lineHeight: 19,
  },
  ajuda: {
    fontSize: 10,
    lineHeight: 15,
  },
});