import { useCallback, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import ReleaseDashboardCard from "@/components/releases/ReleaseDashboardCard";

import {
  useAbrirModulo,
  useAbrirTelaInicial,
} from "@/hooks/useNavegacaoModulos";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import { listarFuncionarios } from "@/services/api/auth";
import { listarClientes } from "@/services/api/cliente";
import { listarClippings } from "@/services/api/clipping";
import { listarJornalistas } from "@/services/api/jornalista";
import {
  listarRelatorios,
  type ResumoRelatorio,
} from "@/services/api/relatorio";
import { listarVeiculos } from "@/services/api/veiculo";
import { listarTemplates } from "@/services/api/template";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ChaveTotal =
  | "relatorios"
  | "clippings"
  | "veiculos"
  | "clientes"
  | "contatos"
  | "funcionarios"
  | "templates";
type Totais = Record<ChaveTotal, number | null>;

const TOTAIS_VAZIOS: Totais = {
  relatorios: null,
  clippings: null,
  veiculos: null,
  clientes: null,
  contatos: null,
  funcionarios: null,
  templates: null,
};

interface Modulo {
  chave: ChaveTotal;
  titulo: string;
  detalhe: string;
  icone: IconName;
  abrir: () => void;
}

export default function Dashboard() {
  const abrirModulo = useAbrirModulo();
  const abrirTela = useAbrirTelaInicial();
  const { theme } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { temPermissao, usuario } = useAuth();

  const podeVerRelatorios = temPermissao("RELATORIOS", "VISUALIZAR");
  const podeVerClippings = temPermissao("CLIPPING", "VISUALIZAR");
  const podeVerVeiculos = temPermissao("VEICULOS", "VISUALIZAR");
  const podeVerClientes = temPermissao("CLIENTES", "VISUALIZAR");
  const podeVerContatos = temPermissao("MAILING", "VISUALIZAR");
  const podeVerFuncionarios = temPermissao("USUARIOS", "VISUALIZAR");
  const podeVerConvites = temPermissao("CONVITES", "VISUALIZAR");
  const podeVerReleases = temPermissao("RELEASES", "VISUALIZAR");
  const podeVerTemplates = temPermissao("TEMPLATES", "VISUALIZAR");
  const podeCriarTemplate = temPermissao("TEMPLATES", "CRIAR");
  const podeCriarRelease = temPermissao("RELEASES", "CRIAR");
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
  const [recargaConcluida, setRecargaConcluida] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const controller = new AbortController();
      const prazo = setTimeout(() => controller.abort(), 20000);

      async function carregar() {
        setCarregando(true);

        const consultas: {
          chave: ChaveTotal;
          buscar: () => Promise<number>;
        }[] = [];

        if (podeVerRelatorios) {
          consultas.push({
            chave: "relatorios",
            buscar: async () =>
              (await listarRelatorios({ page: 1, limit: 1 }, controller.signal))
                .pagination.total,
          });
        }
        if (podeVerClippings) {
          consultas.push({
            chave: "clippings",
            buscar: async () =>
              (await listarClippings({ page: 1, limit: 1 }, controller.signal))
                .pagination.total,
          });
        }
        if (podeVerVeiculos) {
          consultas.push({
            chave: "veiculos",
            buscar: async () =>
              (await listarVeiculos({ page: 1, limit: 1 }, controller.signal))
                .pagination.total,
          });
        }
        if (podeVerClientes) {
          consultas.push({
            chave: "clientes",
            buscar: async () =>
              (
                await listarClientes(
                  { page: 1, limit: 1, ativo: 1 },
                  controller.signal
                )
              ).pagination.total,
          });
        }
        if (podeVerContatos) {
          consultas.push({
            chave: "contatos",
            buscar: async () =>
              (
                await listarJornalistas(
                  { page: 1, limit: 1, ativo: 1 },
                  controller.signal
                )
              ).pagination.total,
          });
        }
        if (podeVerFuncionarios) {
          consultas.push({
            chave: "funcionarios",
            buscar: async () =>
              (
                await listarFuncionarios(
                  { page: 1, limit: 1 },
                  controller.signal
                )
              ).pagination.total,
          });
        }

        if (podeVerTemplates) {
          consultas.push({
            chave: "templates",
            buscar: async () =>
              (
                await listarTemplates(
                  { page: 1, busca: "", origem: "TODOS" },
                  controller.signal
                )
              ).pagination.total,
          });
        }

        const buscaRevisoes = podeVerRelatorios
          ? listarRelatorios(
              { page: 1, limit: 2, pendencias: "com" },
              controller.signal
            ).then(
              (dados) => ({ dados, erro: false }),
              () => ({ dados: null, erro: true })
            )
          : Promise.resolve({ dados: null, erro: false });

        const [resultados, resultadoRevisoes] = await Promise.all([
          Promise.allSettled(consultas.map(({ buscar }) => buscar())),
          buscaRevisoes,
        ]);

        clearTimeout(prazo);

        if (!ativo) {
          return;
        }

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
        setRecargaConcluida(recarga);
      }

      void carregar();
      return () => {
        ativo = false;
        clearTimeout(prazo);
        controller.abort();
      };
    }, [
      podeVerRelatorios,
      podeVerClippings,
      podeVerVeiculos,
      podeVerClientes,
      podeVerContatos,
      podeVerFuncionarios,
      podeVerTemplates,
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
      abrir: () => abrirModulo("relatorios"),
    });
  }
  if (podeVerClippings) {
    modulos.push({
      chave: "clippings",
      titulo: "Clippings",
      detalhe: "cadastrados",
      icone: "newspaper-outline",
      abrir: () => abrirModulo("clipping"),
    });
  }
  if (podeVerVeiculos) {
    modulos.push({
      chave: "veiculos",
      titulo: "Veículos",
      detalhe: "cadastrados",
      icone: "radio-outline",
      abrir: () => abrirModulo("veiculos"),
    });
  }
  if (podeVerClientes) {
    modulos.push({
      chave: "clientes",
      titulo: "Clientes",
      detalhe: "ativos",
      icone: "business-outline",
      abrir: () => abrirModulo("clientes"),
    });
  }
  if (podeVerContatos) {
    modulos.push({
      chave: "contatos",
      titulo: "Contatos",
      detalhe: "ativos",
      icone: "people-outline",
      abrir: () => abrirModulo("mailing"),
    });
  }
  if (podeVerFuncionarios) {
    modulos.push({
      chave: "funcionarios",
      titulo: "Equipe",
      detalhe: "na assessoria",
      icone: "person-outline",
      abrir: () => abrirModulo("funcionarios"),
    });
  }

  if (podeVerTemplates || podeCriarTemplate) {
    modulos.push({
      chave: "templates",
      titulo: "Templates",
      detalhe: "modelos de conteúdo",
      icone: "albums-outline",
      abrir: () => abrirModulo("templates"),
    });
  }

  const atalhos: AtalhoDashboard[] = [];
  if (podeCriarRelease) {
    atalhos.push({
      chave: "novo-release",
      titulo: "Novo release",
      descricao: "Prepare o conteúdo e os destinatários",
      icone: "add-outline",
      abrir: () => abrirTela("/releases/novo"),
    });
  }
  if (podeCriarRelatorio) {
    atalhos.push({
      chave: "novo-relatorio",
      titulo: "Novo relatório",
      descricao: "Escolha o cliente e o período",
      icone: "bar-chart-outline",
      abrir: () => abrirTela("/relatorios/novo"),
    });
  }
  if (podeCriarClipping) {
    atalhos.push({
      chave: "novo-clipping",
      titulo: "Novo clipping",
      descricao: "Cadastre uma matéria",
      icone: "newspaper-outline",
      abrir: () =>
        abrirTela({
          pathname: "/clipping/novo",
          params: { ano: String(new Date().getFullYear()) },
        }),
    });
  }
  if (podeCriarContato) {
    atalhos.push({
      chave: "novo-contato",
      titulo: "Novo contato",
      descricao: "Adicione um jornalista ao mailing",
      icone: "person-add-outline",
      abrir: () => abrirTela("/mailing/novo"),
    });
  }
  if (podeImportarClipping) {
    atalhos.push({
      chave: "importar-clippings",
      titulo: "Importar clippings",
      descricao: "Adicione matérias em lote",
      icone: "download-outline",
      abrir: () =>
        abrirTela({
          pathname: "/clipping/importar",
          params: { ano: String(new Date().getFullYear()) },
        }),
    });
  }
  if (podeVerConvites) {
    atalhos.push({
      chave: "convites",
      titulo: "Convites",
      descricao: "Gerencie os acessos da equipe",
      icone: "mail-outline",
      abrir: () => abrirModulo("convites"),
    });
  }

  const colunas = fontScale > 1.3 || width < 320 ? 1 : width >= 1000 ? 3 : 2;
  const linhas = Array.from(
    { length: Math.ceil(modulos.length / colunas) },
    (_, indice) => modulos.slice(indice * colunas, (indice + 1) * colunas)
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={carregando && recarga !== recargaConcluida}
            onRefresh={() => {
              if (!carregando) {
                setRecarga((atual) => atual + 1);
              }
            }}
            tintColor={theme.textoTerciaria}
            colors={[theme.textoTerciaria]}
          />
        }
      >
        <View style={styles.corpo}>
          {podeVerReleases ? (
            <ReleaseDashboardCard
              key={
                usuario ? usuario.assessoria_id + "-" + usuario.id : "sem-conta"
              }
              recarga={recarga}
              onVerTodos={() => abrirModulo("releases")}
              onAbrirRelease={(id) =>
                abrirTela({
                  pathname: "/releases/[id]",
                  params: { id: String(id), origem: "dashboard" },
                })
              }
              onCriar={
                podeCriarRelease ? () => abrirTela("/releases/novo") : undefined
              }
            />
          ) : null}

          {modulos.length > 0 ? (
            <View style={styles.secao}>
              <View style={styles.secaoTopo}>
                <Text weight="SemiBold" style={styles.tituloSecao}>
                  Visão geral
                </Text>
                {carregando ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.textoTerciaria}
                    accessibilityLabel="Atualizando o painel"
                  />
                ) : null}
              </View>
              <View style={styles.grade}>
                {linhas.map((linha) => (
                  <View key={linha[0].chave} style={styles.linhaGrade}>
                    {linha.map((modulo) => (
                      <TouchableOpacity
                        key={modulo.chave}
                        accessibilityRole="button"
                        accessibilityLabel={
                          modulo.titulo +
                          ": " +
                          (totais[modulo.chave] ??
                            (carregando
                              ? "carregando"
                              : "contagem indisponível")) +
                          ". Abrir módulo"
                        }
                        onPress={modulo.abrir}
                        activeOpacity={0.75}
                        style={[
                          styles.cartao,
                          {
                            backgroundColor: theme.backgroundSecundario,
                            borderColor: theme.borda + "40",
                          },
                        ]}
                      >
                        <View style={styles.cartaoTopo}>
                          <View
                            style={[
                              styles.cartaoIcone,
                              { backgroundColor: theme.primaria + "0E" },
                            ]}
                          >
                            <Ionicons
                              name={modulo.icone}
                              size={18}
                              color={theme.textoTerciaria}
                            />
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={15}
                            color={theme.textoSub}
                          />
                        </View>
                        <Text
                          weight="Bold"
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          style={styles.cartaoNumero}
                        >
                          {totais[modulo.chave]?.toLocaleString("pt-BR") ??
                            (carregando ? "…" : "—")}
                        </Text>
                        <Text weight="SemiBold" style={styles.cartaoTitulo}>
                          {modulo.titulo}
                        </Text>
                        <Text
                          style={[styles.textoMenor, { color: theme.textoSub }]}
                        >
                          {modulo.detalhe}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {Array.from(
                      { length: colunas - linha.length },
                      (_, indice) => (
                        <View
                          key={"espaco-" + indice}
                          style={styles.espacoGrade}
                        />
                      )
                    )}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {podeVerRelatorios ? (
            <View style={styles.secao}>
              <Text weight="SemiBold" style={styles.tituloSecao}>
                Para revisar
              </Text>
              <View
                style={[
                  styles.revisoesCard,
                  {
                    backgroundColor: theme.backgroundSecundario,
                    borderColor:
                      revisoes && revisoes.total > 0
                        ? theme.aviso + "50"
                        : theme.borda + "40",
                  },
                ]}
              >
                {carregando && !revisoes ? (
                  <ActivityIndicator
                    color={theme.textoTerciaria}
                    style={styles.carregamento}
                    accessibilityLabel="Carregando revisões"
                  />
                ) : revisoes === null ? (
                  <Text style={[styles.descricao, { color: theme.textoSub }]}>
                    Não foi possível carregar as revisões. Tente atualizar o
                    painel.
                  </Text>
                ) : revisoes.total === 0 ? (
                  <View style={styles.resumoRevisoes}>
                    <View
                      style={[
                        styles.iconeRevisoes,
                        { backgroundColor: theme.alteracao + "12" },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={22}
                        color={theme.alteracao}
                      />
                    </View>
                    <View style={styles.textos}>
                      <Text weight="SemiBold" style={styles.nomeAtalho}>
                        {totais.relatorios === 0
                          ? "Nenhum relatório cadastrado"
                          : "Nenhuma revisão pendente"}
                      </Text>
                      <Text
                        style={[styles.textoMenor, { color: theme.textoSub }]}
                      >
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
                          styles.iconeRevisoes,
                          { backgroundColor: theme.aviso + "12" },
                        ]}
                      >
                        <Ionicons
                          name="alert-circle-outline"
                          size={22}
                          color={theme.aviso}
                        />
                      </View>
                      <View style={styles.textos}>
                        <Text weight="Bold" style={styles.nomeAtalho}>
                          {revisoes.total}{" "}
                          {revisoes.total === 1
                            ? "relatório para revisar"
                            : "relatórios para revisar"}
                        </Text>
                        <Text
                          style={[styles.textoMenor, { color: theme.textoSub }]}
                        >
                          Confira os slides com pendências.
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
                          abrirTela({
                            pathname: "/relatorios/[id]",
                            params: {
                              id: String(relatorio.id),
                              origem: "dashboard",
                            },
                          })
                        }
                        style={[
                          styles.relatorioPendente,
                          { borderTopColor: theme.borda + "25" },
                        ]}
                      >
                        <View style={styles.textos}>
                          <Text
                            weight="SemiBold"
                            numberOfLines={2}
                            style={styles.nomeAtalho}
                          >
                            {relatorio.titulo}
                          </Text>
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.textoMenor,
                              { color: theme.textoSub },
                            ]}
                          >
                            {relatorio.cliente_nome} ·{" "}
                            {relatorio.total_pendentes}{" "}
                            {relatorio.total_pendentes === 1
                              ? "slide"
                              : "slides"}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={17}
                          color={theme.textoTerciaria}
                        />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {revisoes !== null ? (
                  <View
                    style={[
                      styles.rodapeRevisoes,
                      { borderTopColor: theme.borda + "25" },
                    ]}
                  >
                    <Button
                      title={
                        revisoes.total > 0
                          ? "VER RELATÓRIOS A REVISAR"
                          : "VER RELATÓRIOS"
                      }
                      variant="outline"
                      size="small"
                      icon="arrow-forward-outline"
                      onPress={() =>
                        abrirTela({
                          pathname: "/relatorios",
                          params:
                            revisoes.total > 0 ? { pendencias: "com" } : {},
                        })
                      }
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {atalhos.length > 0 ? (
            <View style={styles.secao}>
              <Text weight="SemiBold" style={styles.tituloSecao}>
                Acesso rápido
              </Text>
              <View
                style={[
                  styles.superficie,
                  {
                    backgroundColor: theme.backgroundSecundario,
                    borderColor: theme.borda + "40",
                  },
                ]}
              >
                {atalhos.map((item, indice) => (
                  <Atalho
                    key={item.chave}
                    item={item}
                    primeiro={indice === 0}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {modulos.length === 0 && !podeVerReleases && atalhos.length === 0 ? (
            <View
              style={[
                styles.vazio,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor: theme.borda + "40",
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={26}
                color={theme.textoSub}
              />
              <Text weight="SemiBold" style={styles.nomeAtalho}>
                Nenhum acesso disponível
              </Text>
              <Text style={[styles.descricao, { color: theme.textoSub }]}>
                Consulte o responsável pela assessoria para liberar seus
                acessos.
              </Text>
            </View>
          ) : null}

          {falha && !carregando ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Atualizar os dados do painel"
              activeOpacity={0.75}
              onPress={() => setRecarga((atual) => atual + 1)}
              style={[
                styles.avisoErro,
                {
                  backgroundColor: theme.aviso + "08",
                  borderColor: theme.aviso + "35",
                },
              ]}
            >
              <Ionicons name="refresh-outline" size={20} color={theme.aviso} />
              <View style={styles.textos}>
                <Text
                  weight="SemiBold"
                  style={[styles.nomeAtalho, { color: theme.aviso }]}
                >
                  Alguns dados não carregaram
                </Text>
                <Text style={[styles.textoMenor, { color: theme.textoSub }]}>
                  Toque para tentar novamente.
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

interface AtalhoDashboard {
  chave: string;
  titulo: string;
  descricao: string;
  icone: IconName;
  abrir: () => void;
}

function Atalho({
  item,
  primeiro,
}: {
  item: AtalhoDashboard;
  primeiro: boolean;
}) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={item.titulo + ". " + item.descricao}
      activeOpacity={0.75}
      onPress={item.abrir}
      style={[
        styles.atalho,
        {
          borderTopWidth: primeiro ? 0 : 1,
          borderTopColor: theme.borda + "25",
        },
      ]}
    >
      <View
        style={[styles.atalhoIcone, { backgroundColor: theme.primaria + "0E" }]}
      >
        <Ionicons name={item.icone} size={20} color={theme.textoTerciaria} />
      </View>
      <View style={styles.textos}>
        <Text weight="SemiBold" style={styles.nomeAtalho}>
          {item.titulo}
        </Text>
        <Text style={[styles.textoMenor, { color: theme.textoSub }]}>
          {item.descricao}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.textoSub} />
    </TouchableOpacity>
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
  },
  corpo: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    gap: 20,
  },
  secao: {
    gap: 10,
  },
  secaoTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  tituloSecao: {
    fontSize: 14,
    lineHeight: 20,
  },
  textoMenor: {
    fontSize: 11,
    lineHeight: 16,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 19,
  },
  superficie: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  espacoGrade: {
    flex: 1,
  },
  grade: {
    gap: 10,
  },
  linhaGrade: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  cartao: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 2,
  },
  cartaoTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 7,
  },
  cartaoIcone: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cartaoNumero: {
    fontSize: 26,
    lineHeight: 32,
  },
  cartaoTitulo: {
    fontSize: 12,
    lineHeight: 18,
  },
  revisoesCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  carregamento: {
    paddingVertical: 12,
  },
  resumoRevisoes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
  },
  iconeRevisoes: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nomeAtalho: {
    fontSize: 13,
    lineHeight: 19,
  },
  relatorioPendente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  rodapeRevisoes: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  atalho: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    gap: 10,
    paddingVertical: 12,
  },
  atalhoIcone: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avisoErro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  vazio: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
});
