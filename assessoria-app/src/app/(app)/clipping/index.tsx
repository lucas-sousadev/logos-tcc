import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  RefreshControl
} from "react-native";

import { useCallback, } from "react";
import { useRouter,} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { listarClippingAnos } from "@/services/api/clipping";
import { useConsultaClipping } from "@/hooks/useConsultaClipping";

export default function Clipping() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const anoAtual = new Date().getFullYear();
 
  const consultarAnos = useCallback(async () => {
    const resposta = await listarClippingAnos();

    const possuiAnoAtual = resposta.anos.some(
      (item) => item.ano_referencia === anoAtual
    );

    const lista = possuiAnoAtual
      ? resposta.anos
      : [
          {
            ano_referencia: anoAtual,
            total_clippings: 0,
            total_clientes: 0,
          },
          ...resposta.anos,
        ];

    return [...lista].sort((a, b) => {
      const aAtual = a.ano_referencia === anoAtual;
      const bAtual = b.ano_referencia === anoAtual;

      if (aAtual !== bAtual) {
        return aAtual ? -1 : 1;
      }

      return b.ano_referencia - a.ano_referencia;
    });
  }, [anoAtual]);

  const {
    dados,
    carregando,
    atualizando,
    erro,
    recarregar: carregarAnos,
  } = useConsultaClipping(
    consultarAnos,
    String(anoAtual)
  );

  const anos = dados ?? [];

  function abrirAno(ano: number) {
    router.push({
      pathname: "/clipping/ano",
      params: {
        ano: String(ano),
      },
    });
  }

  function novoClipping() {
    router.push({
      pathname: "/clipping/novo",
      params: {
        ano: String(anoAtual),
      },
    });
  }

  function importarCsv() {
    router.push({
      pathname: "/clipping/importar",
      params: { ano: String(anoAtual) },
    });
  }

    const podeCriar = temPermissao("CLIPPING", "CRIAR");
  const podeImportar = temPermissao("CLIPPING", "IMPORTAR");

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Clipping" />

      {carregando ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.textoTerciaria} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.conteudo}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => void carregarAnos()}
              tintColor={theme.textoTerciaria}
              colors={[theme.textoTerciaria]}
            />
          }
        >
          {podeCriar || podeImportar ? (
            <View style={styles.acoes}>
              {podeCriar ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  onPress={novoClipping}
                  style={[
                    styles.botaoAcao,
                    { backgroundColor: theme.primaria },
                  ]}
                >
                  <Ionicons name="add-outline" size={16} color={theme.branco} />
                  <Text
                    weight="SemiBold"
                    style={[styles.textoBotaoAcao, { color: theme.branco }]}
                  >
                    NOVO CLIPPING
                  </Text>
                </TouchableOpacity>
              ) : null}

              {podeImportar ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  onPress={importarCsv}
                  style={[
                    styles.botaoAcao,
                    { backgroundColor: theme.primaria },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={15}
                    color={theme.branco}
                  />
                  <Text
                    weight="SemiBold"
                    style={[styles.textoBotaoAcao, { color: theme.branco }]}
                  >
                    IMPORTAR CSV
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.cabecalhoAnos}>
            <Text weight="Bold" style={styles.tituloAnos}>
              Grupos Anuais
            </Text>
            <Text style={[styles.descricaoAnos, { color: theme.textoSub }]}>
              Selecione um ano para ver seus clientes e publicações.
            </Text>
          </View>

          {erro ? (
            <View style={[styles.mensagem, { borderColor: theme.borda }]}>
              <Ionicons name="alert-circle-outline" size={22} color={theme.erro} />
              <Text
                accessibilityRole="alert"
                style={[styles.textoMensagem, { color: theme.erro }]}
              >
                {erro}
              </Text>
              <Button
                title="TENTAR NOVAMENTE"
                size="small"
                onPress={() => void carregarAnos()}
              />
            </View>
          ) : null}

          <View style={styles.listaAnos}>
            {anos.map((item) => {
              const atual = item.ano_referencia === anoAtual;
              const publicacoes = item.total_clippings.toLocaleString("pt-BR");
              const clientes = item.total_clientes.toLocaleString("pt-BR");
              const rotuloPublicacoes =
                item.total_clippings === 1 ? "publicação" : "publicações";
              const rotuloClientes =
                item.total_clientes === 1 ? "cliente" : "clientes";

              const indicadores = [
                {
                  icone: "document-text-outline",
                  total: publicacoes,
                  rotulo: rotuloPublicacoes,
                },
                {
                  icone: "people-outline",
                  total: clientes,
                  rotulo: rotuloClientes,
                },
              ] as const;

              return (
                <TouchableOpacity
                  key={item.ano_referencia}
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${item.ano_referencia}${atual ? ", ano atual" : ""}. ` +
                    `${publicacoes} ${rotuloPublicacoes}. ` +
                    `${clientes} ${rotuloClientes} com publicações.`
                  }
                  accessibilityHint="Abrir os clientes e publicações deste ano"
                  activeOpacity={0.8}
                  onPress={() => abrirAno(item.ano_referencia)}
                  style={[
                    styles.cartaoAno,
                    {
                      borderColor: atual ? theme.borda : theme.borda + "66",
                      backgroundColor: atual
                        ? theme.primaria + "0F"
                        : theme.backgroundSecundario,
                    },
                  ]}
                >
                  <View style={styles.topoAno}>
                    <View
                      style={[
                        styles.iconeAno,
                        { backgroundColor: theme.primaria + "1A" },
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={17}
                        color={theme.textoTerciaria}
                      />
                    </View>

                    <Text
                      weight="Bold"
                      style={[
                        styles.ano,
                        { color: atual ? theme.textoTerciaria : theme.texto },
                      ]}
                    >
                      {item.ano_referencia}
                    </Text>

                    {atual ? (
                      <Text
                        weight="SemiBold"
                        style={[
                          styles.selo,
                          {
                            color: theme.textoTerciaria,
                            backgroundColor: theme.primaria + "1A",
                          },
                        ]}
                      >
                        Ano atual
                      </Text>
                    ) : null}

                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color={theme.textoSub}
                    />
                  </View>

                  <View
                    style={[
                      styles.resumo,
                      { borderTopColor: theme.borda + "40" },
                    ]}
                  >
                    {indicadores.map(({ icone, total, rotulo }) => (
                      <View key={icone} style={styles.indicador}>
                        <Ionicons
                          name={icone}
                          size={14}
                          color={theme.textoTerciaria}
                        />
                        <Text weight="SemiBold" style={styles.total}>
                          {total}
                        </Text>
                        <Text
                          style={[styles.rotuloTotal, { color: theme.textoSub }]}
                        >
                          {rotulo}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}

            {!erro && anos.length === 0 ? (
              <View style={[styles.mensagem, { borderColor: theme.borda }]}>
                <Text weight="SemiBold">Nenhum ano disponível</Text>
                <Text style={[styles.textoMensagem, { color: theme.textoSub }]}>
                  Os anos aparecem aqui conforme as publicações são cadastradas.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  conteudo: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acoes: {
    flexDirection: "row",
    gap: 8,
  },
  botaoAcao: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  textoBotaoAcao: {
    flexShrink: 1,
    fontSize: 10,
    textAlign: "center",
  },
  cabecalhoAnos: {
    gap: 4,
  },
  tituloAnos: {
    fontSize: 15,
  },
  descricaoAnos: {
    fontSize: 12,
    lineHeight: 18,
  },
  listaAnos: {
    gap: 10,
  },
  cartaoAno: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 9,
  },
  topoAno: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconeAno: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  ano: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
  },
  selo: {
    fontSize: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resumo: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
  },
  indicador: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 5,
    rowGap: 2,
  },
  total: {
    fontSize: 13,
  },
  rotuloTotal: {
    fontSize: 11,
  },
  mensagem: {
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  textoMensagem: {
    fontSize: 12,
    textAlign: "center",
  },
});