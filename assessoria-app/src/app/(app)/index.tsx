import { useCallback, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { listarClientes } from "@/services/api/cliente";
import { listarClippings } from "@/services/api/clipping";
import { listarJornalistas } from "@/services/api/jornalista";
import { listarRelatorios, type ResumoRelatorio } from "@/services/api/relatorio";
import { listarVeiculos } from "@/services/api/veiculo";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ChaveTotal =
  | "relatorios"
  | "clippings"
  | "veiculos"
  | "clientes"
  | "contatos"
  | "funcionarios";
type Totais = Record<ChaveTotal, number | null>;

const TOTAIS_VAZIOS: Totais = {
  relatorios: null,
  clippings: null,
  veiculos: null,
  clientes: null,
  contatos: null,
  funcionarios: null,
};

interface Modulo {
  chave: ChaveTotal;
  titulo: string;
  detalhe: string;
  icone: IconName;
  abrir: () => void;
}

export default function Dashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const { listarFuncionarios, temPermissao } = useAuth();

  const podeVerRelatorios = temPermissao("RELATORIOS", "VISUALIZAR");
  const podeVerClippings = temPermissao("CLIPPING", "VISUALIZAR");
  const podeVerVeiculos = temPermissao("VEICULOS", "VISUALIZAR");
  const podeVerClientes = temPermissao("CLIENTES", "VISUALIZAR");
  const podeVerContatos = temPermissao("MAILING", "VISUALIZAR");
  const podeVerFuncionarios = temPermissao("USUARIOS", "VISUALIZAR");
  const podeVerConvites = temPermissao("CONVITES", "VISUALIZAR");
  const podeCriarRelatorio = temPermissao("RELATORIOS", "CRIAR");
  const podeCriarClipping = temPermissao("CLIPPING", "CRIAR");
  const podeCriarContato = temPermissao("MAILING", "CRIAR");
  const podeImportarClipping = temPermissao("CLIPPING", "IMPORTAR");

  const [totais, setTotais] = useState<Totais>(TOTAIS_VAZIOS);
  const [revisoes, setRevisoes] = useState<{
    total: number;
    relatorios: ResumoRelatorio[];
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falha, setFalha] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregar() {
        setCarregando(true);

        const consultas: Array<{
          chave: ChaveTotal;
          buscar: () => Promise<number>;
        }> = [];

        if (podeVerRelatorios) {
          consultas.push({
            chave: "relatorios",
            buscar: async () =>
              (await listarRelatorios({ page: 1, limit: 1 })).pagination.total,
          });
        }
        if (podeVerClippings) {
          consultas.push({
            chave: "clippings",
            buscar: async () =>
              (await listarClippings({ page: 1, limit: 1 })).pagination.total,
          });
        }
        if (podeVerVeiculos) {
          consultas.push({
            chave: "veiculos",
            buscar: async () =>
              (await listarVeiculos({ page: 1, limit: 1 })).pagination.total,
          });
        }
        if (podeVerClientes) {
          consultas.push({
            chave: "clientes",
            buscar: async () =>
              (await listarClientes({ page: 1, limit: 1, ativo: 1 }))
                .pagination.total,
          });
        }
        if (podeVerContatos) {
          consultas.push({
            chave: "contatos",
            buscar: async () =>
              (await listarJornalistas({ page: 1, limit: 1, ativo: 1 }))
                .pagination.total,
          });
        }
        if (podeVerFuncionarios) {
          consultas.push({
            chave: "funcionarios",
            buscar: async () =>
              (await listarFuncionarios({ page: 1, limit: 1 })).pagination
                .total,
          });
        }

        const buscaRevisoes = podeVerRelatorios
          ? listarRelatorios({ page: 1, limit: 2, pendencias: "com" }).then(
              (dados) => ({ dados, erro: false }),
              () => ({ dados: null, erro: true })
            )
          : Promise.resolve({ dados: null, erro: false });

        const [resultados, resultadoRevisoes] = await Promise.all([
          Promise.allSettled(consultas.map(({ buscar }) => buscar())),
          buscaRevisoes,
        ]);

        if (!ativo) return;

        const proximosTotais = { ...TOTAIS_VAZIOS };
        resultados.forEach((resultado, indice) => {
          if (resultado.status === "fulfilled") {
            proximosTotais[consultas[indice].chave] = resultado.value;
          }
        });

        setTotais(proximosTotais);
        setRevisoes(
          resultadoRevisoes.dados
            ? {
                total: resultadoRevisoes.dados.pagination.total,
                relatorios: resultadoRevisoes.dados.relatorios,
              }
            : null
        );
        setFalha(
          resultadoRevisoes.erro ||
            resultados.some((resultado) => resultado.status === "rejected")
        );
        setCarregando(false);
      }

      void carregar();
      return () => {
        ativo = false;
      };
    }, [
      listarFuncionarios,
      podeVerRelatorios,
      podeVerClippings,
      podeVerVeiculos,
      podeVerClientes,
      podeVerContatos,
      podeVerFuncionarios,
      recarga,
    ])
  );

  const modulos: Modulo[] = [];
  if (podeVerRelatorios) {
    modulos.push({
      chave: "relatorios",
      titulo: "Relatórios",
      detalhe: "cadastrados",
      icone: "bar-chart-outline",
      abrir: () => router.push("/relatorios"),
    });
  }
  if (podeVerClippings) {
    modulos.push({
      chave: "clippings",
      titulo: "Clippings",
      detalhe: "cadastrados",
      icone: "newspaper-outline",
      abrir: () => router.push("/clipping"),
    });
  }
  if (podeVerVeiculos) {
    modulos.push({
      chave: "veiculos",
      titulo: "Veículos",
      detalhe: "cadastrados",
      icone: "radio-outline",
      abrir: () => router.push("/veiculos"),
    });
  }
  if (podeVerClientes) {
    modulos.push({
      chave: "clientes",
      titulo: "Clientes",
      detalhe: "ativos",
      icone: "business-outline",
      abrir: () => router.push("/clientes"),
    });
  }
  if (podeVerContatos) {
    modulos.push({
      chave: "contatos",
      titulo: "Contatos",
      detalhe: "ativos",
      icone: "people-outline",
      abrir: () => router.push("/mailing"),
    });
  }
  if (podeVerFuncionarios) {
    modulos.push({
      chave: "funcionarios",
      titulo: "Equipe",
      detalhe: "na assessoria",
      icone: "person-outline",
      abrir: () => router.push("/funcionarios"),
    });
  }

  const temAtalhos =
    podeCriarRelatorio ||
    podeCriarClipping ||
    podeCriarContato ||
    podeImportarClipping ||
    podeVerConvites;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={carregando && recarga > 0}
            onRefresh={() => setRecarga((atual) => atual + 1)}
            tintColor={theme.textoTerciaria}
          />
        }
      >
        {modulos.length > 0 ? (
          <View style={styles.secao}>
            <Text weight="Bold" style={styles.tituloSecao}>
              Visão geral
            </Text>
            <View style={styles.grade}>
              {modulos.map((modulo) => (
                <TouchableOpacity
                  key={modulo.chave}
                  accessibilityRole="button"
                  accessibilityLabel={
                    modulo.titulo +
                    ": " +
                    (totais[modulo.chave] ?? "contagem indisponível") +
                    ". Abrir módulo"
                  }
                  onPress={modulo.abrir}
                  activeOpacity={0.75}
                  style={[
                    styles.cartao,
                    {
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda + "90",
                    },
                  ]}
                >
                  <View style={styles.cartaoTopo}>
                    <Ionicons
                      name={modulo.icone}
                      size={19}
                      color={theme.textoTerciaria}
                    />
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={theme.textoSub}
                    />
                  </View>
                  <Text
                    weight="Bold"
                    style={[
                      styles.cartaoNumero,
                      { color: theme.textoTerciaria },
                    ]}
                  >
                    {totais[modulo.chave] ?? (carregando ? "…" : "—")}
                  </Text>
                  <Text weight="SemiBold" style={styles.cartaoTitulo}>
                    {modulo.titulo}
                  </Text>
                  <Text style={[styles.textoMenor, { color: theme.textoSub }]}>
                    {modulo.detalhe}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {podeVerRelatorios ? (
          <View style={styles.secao}>
            <View style={styles.secaoTopo}>
              <Text weight="Bold" style={styles.tituloSecao}>
                Para revisar
              </Text>
              {carregando && revisoes ? (
                <ActivityIndicator size="small" color={theme.textoSub} />
              ) : null}
            </View>
            <View
              style={[
                styles.revisoesCard,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor:
                    revisoes && revisoes.total > 0 ? theme.aviso : theme.borda,
                },
              ]}
            >
              {carregando && !revisoes ? (
                <ActivityIndicator color={theme.textoTerciaria} />
              ) : revisoes === null ? (
                <Text style={{ color: theme.textoSub }}>
                  Não foi possível carregar as revisões.
                </Text>
              ) : revisoes.total === 0 ? (
                <View style={styles.revisoesVazio}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={24}
                    color={theme.alteracao}
                  />
                  <View style={styles.revisoesVazioTexto}>
                    <Text weight="SemiBold">
                      {totais.relatorios === 0
                        ? "Nenhum relatório cadastrado"
                        : "Nenhuma revisão pendente"}
                    </Text>
                    <Text style={[styles.textoMenor, { color: theme.textoSub }]}>
                      {totais.relatorios === 0
                        ? "Crie um relatório para acompanhar as matérias."
                        : "Os relatórios estão em dia."}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.resumoRevisoes}>
                    <View
                      style={[
                        styles.iconeAlerta,
                        { backgroundColor: theme.aviso + "18" },
                      ]}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={22}
                        color={theme.aviso}
                      />
                    </View>
                    <View style={styles.resumoRevisoesTexto}>
                      <Text weight="Bold" style={styles.numeroRevisoes}>
                        {revisoes.total}
                      </Text>
                      <Text style={[styles.textoMenor, { color: theme.textoSub }]}>
                        {revisoes.total === 1
                          ? "relatório com slides para revisar"
                          : "relatórios com slides para revisar"}
                      </Text>
                    </View>
                  </View>
                  {revisoes.relatorios.map((relatorio) => (
                    <TouchableOpacity
                      key={relatorio.id}
                      accessibilityRole="button"
                      accessibilityLabel={
                        "Abrir " +
                        relatorio.titulo +
                        ", " +
                        relatorio.total_pendentes +
                        " slides para revisar"
                      }
                      activeOpacity={0.75}
                      onPress={() =>
                        router.push({
                          pathname: "/relatorios/[id]",
                          params: {
                            id: String(relatorio.id),
                            origem: "dashboard",
                          },
                        })
                      }
                      style={[
                        styles.relatorioPendente,
                        { borderTopColor: theme.borda + "55" },
                      ]}
                    >
                      <View style={styles.relatorioPendenteTexto}>
                        <Text weight="SemiBold" numberOfLines={1}>
                          {relatorio.titulo}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.textoMenor, { color: theme.textoSub }]}
                        >
                          {relatorio.cliente_nome} · {relatorio.total_pendentes}{" "}
                          {relatorio.total_pendentes === 1 ? "slide" : "slides"}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={theme.textoTerciaria}
                      />
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {revisoes !== null ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push({
                      pathname: "/relatorios",
                      params: revisoes.total > 0 ? { pendencias: "com" } : {},
                    })
                  }
                  style={[
                    styles.verRelatorios,
                    { borderTopColor: theme.borda + "55" },
                  ]}
                >
                  <Text weight="Bold" style={{ color: theme.textoTerciaria }}>
                    {revisoes.total > 0
                      ? "VER RELATÓRIOS A REVISAR"
                      : "VER RELATÓRIOS"}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={theme.textoTerciaria}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {temAtalhos ? (
          <View style={styles.secao}>
            <Text weight="Bold" style={styles.tituloSecao}>
              Acesso rápido
            </Text>
            <View
              style={[
                styles.atalhos,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor: theme.borda + "90",
                },
              ]}
            >
              {podeCriarRelatorio ? (
                <Atalho
                  titulo="Novo relatório"
                  descricao="Escolha o cliente e o período"
                  icone="add-circle-outline"
                  onPress={() => router.push("/relatorios/novo")}
                />
              ) : null}
              {podeCriarClipping ? (
                <Atalho
                  titulo="Novo clipping"
                  descricao="Cadastre uma matéria"
                  icone="newspaper-outline"
                  onPress={() =>
                    router.push({
                      pathname: "/clipping/novo",
                      params: { ano: String(new Date().getFullYear()) },
                    })
                  }
                />
              ) : null}
              {podeCriarContato ? (
                <Atalho
                  titulo="Novo contato"
                  descricao="Cadastre um jornalista no mailing"
                  icone="person-add-outline"
                  onPress={() => router.push("/mailing/novo")}
                />
              ) : null}
              {podeImportarClipping ? (
                <Atalho
                  titulo="Importar clippings"
                  descricao="Adicione matérias em lote"
                  icone="cloud-upload-outline"
                  onPress={() =>
                    router.push({
                      pathname: "/clipping/importar",
                      params: { ano: String(new Date().getFullYear()) },
                    })
                  }
                />
              ) : null}
              {podeVerConvites ? (
                <Atalho
                  titulo="Convites"
                  descricao="Gerenciar e convidar colaboradores"
                  icone="mail-outline"
                  onPress={() => router.push("/convites")}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {falha && !carregando ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setRecarga((atual) => atual + 1)}
            style={styles.avisoErro}
          >
            <Ionicons name="refresh-outline" size={17} color={theme.aviso} />
            <Text style={[styles.textoMenor, { color: theme.aviso }]}>
              Alguns dados não carregaram. Toque para tentar novamente.
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Atalho({
  titulo,
  descricao,
  icone,
  onPress,
}: {
  titulo: string;
  descricao: string;
  icone: IconName;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={titulo}
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.atalho, { borderBottomColor: theme.borda + "45" }]}
    >
      <View style={[styles.atalhoIcone, { backgroundColor: theme.borda + "20" }]}>
        <Ionicons name={icone} size={21} color={theme.textoTerciaria} />
      </View>
      <View style={styles.atalhoTexto}>
        <Text weight="SemiBold">{titulo}</Text>
        <Text style={[styles.textoMenor, { color: theme.textoSub }]}>
          {descricao}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textoSub} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conteudo: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 30,
    gap: 20,
  },
  tituloPagina: { fontSize: 20, lineHeight: 26 },
  subtitulo: { fontSize: 12, lineHeight: 18 },
  secao: { gap: 8 },
  secaoTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tituloSecao: { fontSize: 16, lineHeight: 22 },
  textoMenor: { fontSize: 11, lineHeight: 16 },
  revisoesCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    minHeight: 90,
  },
  revisoesVazio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 14,
  },
  revisoesVazioTexto: {
    flex: 1, gap: 2 },
  resumoRevisoes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingBottom: 13,
  },
  iconeAlerta: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resumoRevisoesTexto: { flex: 1 },
  numeroRevisoes: { fontSize: 25, lineHeight: 29 },
  relatorioPendente: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    gap: 8,
  },
  relatorioPendenteTexto: { flex: 1, gap: 3 },
  verRelatorios: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
  },
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cartao: {
    width: "48%",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cartaoTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartaoNumero: { fontSize: 26, lineHeight: 30, marginTop: 3 },
  cartaoTitulo: { fontSize: 13, lineHeight: 17 },
  atalhos: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 13,
    overflow: "hidden",
  },
  atalho: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    gap: 11,
    borderBottomWidth: 1,
  },
  atalhoIcone: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  atalhoTexto: { flex: 1, gap: 2 },
  avisoErro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
});
