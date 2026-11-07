import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useConsultaClipping } from "@/hooks/useConsultaClipping";
import { listarRelatorios } from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

const POR_PAGINA = 10;

export default function RelatoriosVinculados({ clienteId }: { clienteId: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [pagina, setPagina] = useState(1);

  const consultar = useCallback(
    () =>
      listarRelatorios({
        cliente_id: clienteId,
        page: pagina,
        limit: POR_PAGINA,
      }),
    [clienteId, pagina]
  );

  const { dados, carregando, atualizando, erro, recarregar } =
    useConsultaClipping(consultar, `relatorios:${clienteId}:${pagina}`);

  const total = dados?.pagination.total ?? 0;
  const ultimaPagina = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaInvalida = dados !== null && pagina > ultimaPagina;

  useEffect(() => {
    if (paginaInvalida && !erro) {
      setPagina(ultimaPagina);
    }
  }, [erro, paginaInvalida, ultimaPagina]);

  return (
    <View style={styles.secao}>
      <View style={styles.cabecalho}>
        <View style={styles.info}>
          <Text weight="Bold">RELATÓRIOS VINCULADOS</Text>
          <Text style={[styles.descricao, { color: theme.textoSub }]}>
            Relatórios criados para este cliente
          </Text>
        </View>

        {dados && !erro ? (
          <View style={[styles.contador, { backgroundColor: theme.backgroundContainer }]}>
            <Text weight="Bold" style={{ color: theme.textoContainer }}>
              {total}
            </Text>
          </View>
        ) : null}
      </View>

      {erro ? (
        <View style={[styles.mensagem, { borderColor: theme.borda }]}>
          <Text style={[styles.textoMensagem, { color: theme.erro }]}>{erro}</Text>
          <Button
            title="TENTAR NOVAMENTE"
            size="small"
            onPress={() => void recarregar()}
          />
        </View>
      ) : carregando || paginaInvalida ? (
        <ActivityIndicator
          color={theme.textoTerciaria}
          style={styles.carregamento}
        />
      ) : !dados?.relatorios.length ? (
        <View style={[styles.mensagem, { borderColor: theme.borda }]}>
          <Text style={[styles.textoMensagem, { color: theme.textoSub }]}>
            Nenhum relatório criado para este cliente.
          </Text>
        </View>
      ) : (
        <>
          {dados.relatorios.map((relatorio) => {
            const inicio = dataISOParaBR(relatorio.periodo_inicio);
            const fim = dataISOParaBR(relatorio.periodo_fim);
            const periodo = `${inicio} a ${fim}`;
            const totalMaterias = relatorio.total_materias;
            const materias = `${totalMaterias} ${totalMaterias === 1 ? "matéria" : "matérias"}`;
            const inclusao = relatorio.inclusao_automatica
              ? "Inclusão automática ativa"
              : "Inclusão automática pausada";
            const pendentes = relatorio.total_pendentes;
            const temPendencias = pendentes > 0;
            const revisao = temPendencias
              ? `${pendentes} ${pendentes === 1 ? "slide" : "slides"} para revisar`
              : "Nenhum slide para revisar";
            const corRevisao = temPendencias ? theme.aviso : theme.textoSub;

            return (
              <TouchableOpacity
                key={relatorio.id}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={[
                  `Abrir relatório ${relatorio.titulo}`,
                  periodo,
                  materias,
                  inclusao,
                  revisao,
                ].join(". ")}
                onPress={() =>
                  router.push({
                    pathname: "/relatorios/[id]",
                    params: {
                      id: String(relatorio.id),
                      origemClienteId: String(clienteId),
                    },
                  })
                }
                style={[
                  styles.cartao,
                  {
                    borderColor: theme.borda,
                    backgroundColor: theme.backgroundSecundario,
                  },
                ]}
              >
                <Ionicons
                  name="stats-chart-outline"
                  size={19}
                  color={theme.textoTerciaria}
                />

                <View style={styles.info}>
                  <Text weight="SemiBold">{relatorio.titulo}</Text>
                  <Text style={[styles.descricao, { color: theme.textoSub }]}>
                    {periodo}
                  </Text>

                  <View style={styles.indicadores}>
                    <Text
                      weight="SemiBold"
                      style={[styles.textoIndicador, { color: theme.textoTerciaria }]}
                    >
                      {materias}
                    </Text>
                    <Text style={[styles.textoIndicador, { color: theme.textoSub, marginLeft: -5 }]}>
                      - {inclusao}
                    </Text>
                  </View>

                  <View style={styles.revisao}>
                    <Ionicons
                      name={temPendencias ? "alert-circle-outline" : "checkmark-circle-outline"}
                      size={14}
                      color={corRevisao}
                    />
                    <Text
                      weight={temPendencias ? "SemiBold" : "Regular"}
                      style={[styles.textoIndicador, { color: corRevisao }]}
                    >
                      {revisao}
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textoSub}
                />
              </TouchableOpacity>
            );
          })}

          <PaginacaoLista
            pagina={pagina}
            limite={POR_PAGINA}
            total={total}
            disabled={atualizando}
            onChange={setPagina}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    marginTop: 20,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  descricao: {
    fontSize: 11,
    marginTop: 3,
  },
  contador: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cartao: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 14,
  },
  indicadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 3,
    marginTop: 6,
  },
  textoIndicador: {
    fontSize: 11,
    flexShrink: 1,
  },
  revisao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  mensagem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  textoMensagem: {
    fontSize: 12,
    textAlign: "center",
  },
  carregamento: {
    marginVertical: 24,
  },
});
