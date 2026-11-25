import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useUltimoReleaseDashboard } from "@/hooks/useUltimoReleaseDashboard";
import { ROTULOS_STATUS } from "@/services/api/release";
import { formatarAgendamentoRelease } from "@/utils/agendamentoRelease";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

interface Props {
  recarga: number;
  onVerTodos: () => void;
  onAbrirRelease: (id: number) => void;
  onCriar?: () => void;
}

export default function ReleaseDashboardCard({
  recarga,
  onVerTodos,
  onAbrirRelease,
  onCriar,
}: Props) {
  const { theme } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { release, envio, carregando, erro, erroEstatisticas, atualizar } =
    useUltimoReleaseDashboard(recarga);
  const status = envio?.release.status ?? release?.status;
  const dataCriacao = release
    ? dataISOParaBR(release.created_at.slice(0, 10))
    : "";
  const corCliente = release?.cliente_id ? theme.alteracao : theme.textoSub;
  const corStatus =
    status === "FALHOU"
      ? theme.erro
      : status === "RASCUNHO" || status === "PARCIAL"
        ? theme.aviso
        : status === "CANCELADO"
          ? theme.textoSub
          : theme.textoTerciaria;
  const metricas = envio?.aberturas;
  const taxa = metricas?.taxa_percentual;
  const taxaDisponivel = taxa !== null && taxa !== undefined;
  const detalheAberturas =
    taxaDisponivel && metricas
      ? metricas.destinatarios_abertos +
        " de " +
        metricas.envios_rastreados +
        " rastreados"
      : !metricas
        ? "Indisponível"
        : metricas.envios_sem_rastreamento > 0
          ? "Sem rastreamento"
          : !metricas.coleta_configurada
            ? "Aguardando ativação"
            : "Aguardando envios rastreados";
  const estatisticas = [
    {
      rotulo: "Destinatários",
      valor:
        (envio?.totais.total ?? release?.total_destinatarios)?.toLocaleString(
          "pt-BR"
        ) ?? "—",
      detalhe: "Contatos selecionados",
      cor: theme.texto,
    },
    {
      rotulo: "Aceitos",
      valor: envio?.totais.aceitos.toLocaleString("pt-BR") ?? "—",
      detalhe: "Pelo servidor de e-mail",
      cor: theme.texto,
    },
    {
      rotulo: "Falhas",
      valor: envio?.totais.falhas.toLocaleString("pt-BR") ?? "—",
      detalhe: "Registradas no envio",
      cor: envio && envio.totais.falhas > 0 ? theme.erro : theme.texto,
    },
    {
      rotulo: "Aberturas detectadas",
      valor: taxaDisponivel
        ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
            taxa
          ) + "%"
        : "—",
      detalhe: detalheAberturas,
      cor: theme.textoTerciaria,
    },
  ];
  const colunas = fontScale > 1.3 ? 1 : width >= 760 ? 4 : 2;
  const linhas = Array.from(
    { length: Math.ceil(estatisticas.length / colunas) },
    (_, indice) => estatisticas.slice(indice * colunas, (indice + 1) * colunas)
  );
  const avisos: string[] = [];
  if (envio) {
    if (
      ["NA_FILA", "ENVIANDO"].includes(envio.release.status) &&
      envio.totais.pendentes > 0
    ) {
      avisos.push(envio.totais.pendentes + " aguardando envio");
    }
    if (envio.totais.processando > 0)
      avisos.push(envio.totais.processando + " em processamento");
    if (envio.totais.incertos > 0)
      avisos.push(envio.totais.incertos + " sem confirmação");
    if (envio.totais.cancelados > 0)
      avisos.push(
        envio.totais.cancelados +
          (envio.totais.cancelados === 1 ? " cancelado" : " cancelados")
      );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundSecundario,
          borderColor: theme.borda + "50",
        },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Releases. Ver todos os releases"
        activeOpacity={0.8}
        onPress={onVerTodos}
        style={[
          styles.cabecalho,
          {
            backgroundColor: theme.primaria + "07",
            borderBottomColor: theme.borda + "25",
          },
        ]}
      >
        <View
          style={[styles.icone, { backgroundColor: theme.backgroundContainer }]}
        >
          <Ionicons
            name="paper-plane-outline"
            size={22}
            color={theme.textoContainer}
          />
        </View>
        <View style={styles.textos}>
          <Text weight="Bold" style={styles.titulo}>
            Releases
          </Text>
          <Text style={[styles.descricao, { color: theme.textoSub }]}>
            {release && !carregando
              ? "Último release criado"
              : "Envios da assessoria"}
          </Text>
        </View>
        <View
          style={[
            styles.abrirTodos,
            {
              backgroundColor: theme.primaria + "0C",
              borderColor: theme.primaria + "25",
            },
          ]}
        >
          <Ionicons
            name="arrow-forward-outline"
            size={18}
            color={theme.textoTerciaria}
          />
        </View>
      </TouchableOpacity>

      <View style={styles.conteudo}>
        {carregando ? (
          <View style={styles.carregamento}>
            <ActivityIndicator color={theme.textoTerciaria} />
            <Text style={[styles.descricao, { color: theme.textoSub }]}>
              Carregando o último release…
            </Text>
          </View>
        ) : erro ? (
          <View style={styles.vazio}>
            <Ionicons
              name="cloud-offline-outline"
              size={26}
              color={theme.textoSub}
            />
            <Text style={[styles.descricao, { color: theme.textoSub }]}>
              {erro}
            </Text>
            <Button
              title="ATUALIZAR"
              variant="outline"
              icon="refresh-outline"
              size="small"
              onPress={atualizar}
            />
          </View>
        ) : !release ? (
          <View style={styles.vazio}>
            <Text weight="SemiBold" style={styles.nomeRelease}>
              Seu primeiro release começa aqui
            </Text>
            <Text style={[styles.descricao, { color: theme.textoSub }]}>
              {onCriar
                ? "Prepare o conteúdo e acompanhe os resultados do envio."
                : "Os releases da assessoria aparecerão neste espaço."}
            </Text>
            <Button
              title={onCriar ? "CRIAR RELEASE" : "VER RELEASES"}
              icon={onCriar ? "add-outline" : "arrow-forward-outline"}
              size="small"
              onPress={onCriar ?? onVerTodos}
            />
          </View>
        ) : (
          <>
            <View
              style={[
                styles.resumo,
                {
                  backgroundColor: theme.primaria + "04",
                  borderColor: theme.borda + "25",
                },
              ]}
            >
              <View style={styles.metadados}>
                {dataCriacao ? (
                  <View style={styles.dataCriacao}>
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color={theme.textoSub}
                    />
                    <Text
                      accessibilityLabel={"Criado em " + dataCriacao}
                      style={[styles.dataTexto, { color: theme.textoSub }]}
                    >
                      {dataCriacao}
                    </Text>
                  </View>
                ) : null}
                {status ? (
                  <View
                    style={[
                      styles.status,
                      { backgroundColor: corStatus + "12" },
                    ]}
                  >
                    <View
                      style={[styles.ponto, { backgroundColor: corStatus }]}
                    />
                    <Text
                      weight="SemiBold"
                      style={[styles.statusTexto, { color: corStatus }]}
                    >
                      {ROTULOS_STATUS[status]}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text weight="Bold" style={styles.nomeRelease}>
                {release.titulo || "Release sem título"}
              </Text>
              <View style={styles.cliente}>
                <Ionicons
                  name="business-outline"
                  size={14}
                  color={corCliente}
                />
                <Text
                  style={[
                    styles.descricao,
                    styles.clienteNome,
                    { color: corCliente },
                  ]}
                >
                  {release.cliente_nome || "Sem cliente vinculado"}
                </Text>
              </View>
              {status === "AGENDADO" && envio?.release.agendado_para ? (
                <Text
                  style={[styles.descricao, { color: theme.textoTerciaria }]}
                >
                  {formatarAgendamentoRelease(envio.release.agendado_para)} ·
                  Brasília
                </Text>
              ) : null}
            </View>

            <View style={styles.estatisticas}>
              {linhas.map((linha, indice) => (
                <View key={indice} style={styles.linhaEstatisticas}>
                  {linha.map((item) => (
                    <View
                      key={item.rotulo}
                      style={[
                        styles.estatistica,
                        {
                          backgroundColor: theme.primaria + "06",
                          borderColor: theme.borda + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rotuloEstatistica,
                          { color: theme.textoSub },
                        ]}
                      >
                        {item.rotulo}
                      </Text>
                      <Text
                        weight="Bold"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[styles.numero, { color: item.cor }]}
                      >
                        {item.valor}
                      </Text>
                      <Text style={[styles.detalhe, { color: theme.textoSub }]}>
                        {item.detalhe}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {erroEstatisticas ? (
              <View style={styles.aviso}>
                <Text style={[styles.descricao, { color: theme.aviso }]}>
                  {erroEstatisticas}
                </Text>
                <Button
                  title="ATUALIZAR"
                  size="small"
                  variant="outline"
                  onPress={atualizar}
                />
              </View>
            ) : (
              <>
                {avisos.length > 0 ? (
                  <Text style={[styles.descricao, { color: theme.textoSub }]}>
                    {avisos.join(" · ")}
                  </Text>
                ) : null}
                <Text style={[styles.detalhe, { color: theme.textoSub }]}>
                  Aceites não confirmam a entrega. Aberturas são estimadas pelo
                  carregamento de imagens.
                </Text>
              </>
            )}

            <Button
              title="VER RELEASE"
              icon="arrow-forward-outline"
              onPress={() => onAbrirRelease(release.id)}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    minWidth: 0,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  icone: {
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  abrirTodos: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: {
    fontSize: 18,
    lineHeight: 24,
  },
  descricao: {
    fontSize: 11,
    lineHeight: 17,
  },
  conteudo: {
    padding: 16,
    gap: 14,
  },
  carregamento: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  vazio: {
    gap: 12,
  },
  resumo: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  metadados: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dataCriacao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dataTexto: {
    fontSize: 10,
    lineHeight: 15,
  },
  status: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ponto: {
    width: 5,
    height: 5,
    flexShrink: 0,
    borderRadius: 3,
  },
  statusTexto: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
  },
  nomeRelease: {
    fontSize: 20,
    lineHeight: 27,
  },
  cliente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clienteNome: {
    flex: 1,
    minWidth: 0,
  },
  estatisticas: {
    gap: 8,
  },
  linhaEstatisticas: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  estatistica: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    borderWidth: 1,
    borderRadius: 12,
    gap: 4,
  },
  rotuloEstatistica: {
    fontSize: 10,
    lineHeight: 15,
  },
  numero: {
    fontSize: 24,
    lineHeight: 30,
  },
  detalhe: {
    fontSize: 10,
    lineHeight: 15,
  },
  aviso: {
    gap: 8,
  },
});
