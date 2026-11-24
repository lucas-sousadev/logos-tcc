import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { MetricasAberturaRelease } from "@/services/api/release";

interface Props {
  metricas: MetricasAberturaRelease;
}

export default function ReleaseAberturasCard({ metricas }: Props) {
  const { theme } = useTheme();
  const taxa = metricas.taxa_percentual;
  const largura: `${number}%` = `${Math.min(100, Math.max(0, taxa ?? 0))}%`;
  const percentual =
    taxa !== null
      ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
          taxa
        ) + "%"
      : "—";

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
        <View
          style={[
            styles.icone,
            { backgroundColor: theme.textoTerciaria + "12" },
          ]}
        >
          <Ionicons
            name="mail-open-outline"
            size={20}
            color={theme.textoTerciaria}
          />
        </View>
        <View style={styles.titulos}>
          <Text weight="Bold" style={styles.titulo}>
            Taxa de abertura
          </Text>
          <Text style={[styles.ajuda, { color: theme.textoSub }]}>
            Aberturas detectadas
          </Text>
        </View>
      </View>

      {taxa !== null ? (
        <>
          <View style={styles.resumo}>
            <Text
              weight="Bold"
              accessibilityLiveRegion="polite"
              style={[styles.percentual, { color: theme.textoTerciaria }]}
            >
              {percentual}
            </Text>
            <Text style={[styles.quantidade, { color: theme.textoSub }]}>
              <Text weight="Bold">
                {metricas.destinatarios_abertos} de {metricas.envios_rastreados}
              </Text>
              {"\n"}
              {metricas.envios_rastreados === 1
                ? "destinatário monitorado"
                : "destinatários monitorados"}
            </Text>
          </View>
          <View
            style={[styles.barra, { backgroundColor: theme.borda + "20" }]}
            accessible={false}
          >
            <View
              style={[
                styles.preenchimento,
                { width: largura, backgroundColor: theme.textoTerciaria },
              ]}
            />
          </View>
          <Text style={[styles.ajuda, { color: theme.textoSub }]}>
            Cada destinatário entra uma vez na taxa, mesmo que carregue a imagem
            novamente. A base considera os envios rastreados aceitos pelo SMTP.
          </Text>
        </>
      ) : (
        <Text style={[styles.descricao, { color: theme.textoSub }]}>
          {metricas.envios_sem_rastreamento > 0
            ? "Este release possui e-mails enviados sem rastreamento. A taxa não está disponível para esses envios."
            : !metricas.coleta_configurada
              ? "O acompanhamento aguarda ativação. Após a configuração, as aberturas poderão ser registradas em novos envios."
              : "A taxa aparecerá quando houver envios rastreados aceitos pelo servidor."}
        </Text>
      )}

      {metricas.envios_rastreados > 0 &&
      metricas.envios_sem_rastreamento > 0 ? (
        <Text style={[styles.ajuda, { color: theme.textoSub }]}>
          {metricas.envios_sem_rastreamento} envio(s) sem rastreamento ficaram
          fora da taxa.
        </Text>
      ) : null}
      {metricas.aberturas_sem_confirmacao > 0 ? (
        <Text style={[styles.ajuda, { color: theme.aviso }]}>
          Há {metricas.aberturas_sem_confirmacao} abertura(s) em envios sem
          confirmação do SMTP. Esses registros ficam fora da taxa.
        </Text>
      ) : null}
      <Text
        style={[
          styles.limite,
          { color: theme.textoSub, borderTopColor: theme.borda + "25" },
        ]}
      >
        Estimativa de engajamento: carregamentos automáticos e bloqueios de
        imagens podem alterar os resultados.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, minWidth: 0 },
  topo: { flexDirection: "row", alignItems: "center", gap: 10 },
  icone: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titulos: { flex: 1, minWidth: 0, gap: 2 },
  titulo: { fontSize: 15, lineHeight: 20 },
  resumo: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
  },
  percentual: { fontSize: 36, lineHeight: 44 },
  quantidade: { flex: 1, minWidth: 130, fontSize: 12, lineHeight: 19 },
  barra: { height: 6, width: "100%", borderRadius: 3, overflow: "hidden" },
  preenchimento: { height: "100%", borderRadius: 3 },
  ajuda: { fontSize: 11, lineHeight: 16 },
  descricao: { fontSize: 12, lineHeight: 19 },
  limite: { paddingTop: 10, borderTopWidth: 1, fontSize: 10, lineHeight: 15 },
});
