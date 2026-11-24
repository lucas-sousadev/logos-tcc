import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform
} from "react-native";

import * as DocumentPicker from "@/services/seletorArquivos";
import { File} from "expo-file-system";
import React, { useState, useCallback, useRef} from "react";
import { useRouter, useFocusEffect, useNavigation } from "expo-router";
import { salvarArquivo } from "@/services/salvarArquivo";
import MailingFilterModal from "@/components/ui/Filtros/MailingFilterModal";
import type {
  FiltrosMailing,
} from "@/components/ui/Filtros/MailingFilterModal";
import ContadorLista from "@/components/ui/ContadorLista";
import SelecaoListaButton from "@/components/ui/SelecaoListaButton";

import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import SearchBar from "@/components/ui/SearchBar";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import LimparFiltrosButton from "@/components/ui/LimparFiltrosButton";
import FeedbackAlert, { type FeedbackAlertVariant,} from "@/components/forms/FeedbackAlert";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import BotaoTransferencia from "@/components/ui/BotaoTransferencia";

import { useListaPaginada } from "@/hooks/useListaPaginada";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

import { Jornalista, listarJornalistas, exportarJornalistas, importarJornalistas, excluirJornalistasEmLote } from "@/services/api/jornalista";
  function nomeArquivoMailing(): string {
    const agora = new Date();

    const ano = agora.getFullYear();
    const mes = String(
      agora.getMonth() + 1
    ).padStart(2, "0");
    const dia = String(
      agora.getDate()
    ).padStart(2, "0");

    const hora = String(
      agora.getHours()
    ).padStart(2, "0");
    const minuto = String(
      agora.getMinutes()
    ).padStart(2, "0");
    const segundo = String(
      agora.getSeconds()
    ).padStart(2, "0");

    return (
      `mailing-${ano}-${mes}-${dia}-` +
      `${hora}${minuto}${segundo}.csv`
    );
  }

interface FeedbackState {
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDanger?: boolean;
  onPrimary?: () => void;
}

const LIMITE_SELECAO_EM_LOTE = 100;

export default function Mailing() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const navigation = useNavigation();
  const travaExportacao = useRef(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);

  const [modoSelecao, setModoSelecao] = useState(false);

  const [idsSelecionados, setIdsSelecionados] = useState<number[]>([]);

  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false);
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  function mostrarFeedback(
    dados: FeedbackState
  ) {
    setFeedback(dados);
  }

  function fecharFeedback() {
    setFeedback(null);
  }

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] =
    useState("");

  const [filtrosAberto, setFiltrosAberto] = useState(false);

  const [filtros, setFiltros] =
    useState<FiltrosMailing>({
      estado: "",
      cidade: "",
      cargo: "",
      ativo: 1,
    });

  const consultarPagina = useCallback(
    async (page: number, limit: number) => {
      const resposta = await listarJornalistas({
        page,
        limit,
        busca: buscaAplicada,
        estado: filtros.estado,
        cidade: filtros.cidade,
        cargo: filtros.cargo,
        veiculo_id: filtros.veiculoId,
        ativo: filtros.ativo,
      });

      return {
        itens: resposta.jornalistas,
        total: resposta.pagination.total,
      };
    },
    [
      buscaAplicada,
      filtros.estado,
      filtros.cidade,
      filtros.cargo,
      filtros.veiculoId,
      filtros.ativo,
    ]
  );

  const {
    itens: jornalistas,
    pagina,
    total,
    carregando,
    erro,
    limite,
    carregarPagina,
  } = useListaPaginada<Jornalista>({
    chave: JSON.stringify([buscaAplicada, filtros]),
    consultar: consultarPagina,
  });

  function carregarJornalistas(reset = false) {
    return carregarPagina(reset ? 1 : undefined);
  }

  useFocusEffect(
    useCallback(() => () => {
      setIdsSelecionados([]);
      setModoSelecao(false);
    }, [])
  );

  function realizarBusca() {
    sairModoSelecao();

    const texto = busca.trim();

    if (texto === buscaAplicada) {
      void carregarPagina(1);
    } else {
      setBuscaAplicada(texto);
    }
  }

  function limparBusca() {
    sairModoSelecao();
    setBusca("");

    if (buscaAplicada === "") {
      void carregarPagina(1);
    } else {
      setBuscaAplicada("");
    }
  }

  function abrirFiltros() {
    setFiltrosAberto(true);
  }

  function aplicarFiltros(
    novosFiltros: FiltrosMailing
  ) {
    sairModoSelecao();

    const mesmos =
      JSON.stringify(novosFiltros) ===
      JSON.stringify(filtros);

    setFiltros(novosFiltros);
    setFiltrosAberto(false);

    if (mesmos) {
      void carregarPagina(1);
    }
  }

  function filtrosAtivos() {
      return Boolean(
        filtros.estado ||
        filtros.cidade ||
        filtros.cargo ||
        filtros.veiculoId ||
        filtros.ativo !== 1
      );
    }
  async function exportarMailing() {
    if (travaExportacao.current) return;

    travaExportacao.current = true;
    sairModoSelecao();
    setExportando(true);

    try {
      const response = await exportarJornalistas({
        busca: buscaAplicada,
        estado: filtros.estado,
        cidade: filtros.cidade,
        cargo: filtros.cargo,
        veiculo_id: filtros.veiculoId,
        ativo: filtros.ativo,
      });

      const conteudo = await response.arrayBuffer();

      if (!navigation.isFocused()) return;

      const resultado = await salvarArquivo(
        conteudo,
        nomeArquivoMailing(),
        "text/csv"
      );

      if (
        resultado.status === "cancelado" ||
        !navigation.isFocused()
      ) {
        return;
      }

      mostrarFeedback({
        variant:
          resultado.status === "salvo" ? "success" : "info",
        title:
          resultado.status === "salvo"
            ? "Arquivo salvo"
            : "Download solicitado",
        message:
          resultado.status === "solicitado"
            ? mensagemExportacao(resultado.nome)
            : resultado.mensagem,
      });
    } catch (error) {
      if (navigation.isFocused()) {
        mostrarFeedback({
          variant: "error",
          title: "Não foi possível exportar",
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível exportar os contatos.",
        });
      }
    } finally {
      travaExportacao.current = false;
      setExportando(false);
    }
  }

  function selecionarEImportarArquivo() {
    if (temPermissao("VEICULOS", "CRIAR")) {
      void executarImportacaoArquivo();
      return;
    }

    mostrarFeedback({
      variant: "warning",
      title: "Veículos novos no CSV",
      message:
        "Você pode importar contatos ligados a veículos já cadastrados. " +
        "Se o CSV trouxer um veículo desconhecido, a importação mostrará " +
        "as linhas que precisam de correção e não incluirá contatos.",
      primaryLabel: "ESCOLHER CSV",
      secondaryLabel: "CANCELAR",
      onPrimary: () => {
        fecharFeedback();
        void executarImportacaoArquivo();
      },
    });
  }

  async function executarImportacaoArquivo() {
    sairModoSelecao();

    try {
      const resultadoSeletor =
        await DocumentPicker.getDocumentAsync({
          type: [
            "text/csv",
            "text/comma-separated-values",
            "application/csv",
            "application/vnd.ms-excel",
          ],
          copyToCacheDirectory: true,
          multiple: false,
        });

      if (resultadoSeletor.canceled) {
        return;
      }

      const selecionado =
        resultadoSeletor.assets[0];

      if (
        !selecionado.name
          .toLocaleLowerCase()
          .endsWith(".csv")
      ) {
        mostrarFeedback({
          variant: "error",
          title: "Arquivo inválido",
          message: "Selecione um arquivo no formato CSV.",
        });

        return;
      }

      if (
        selecionado.size !== undefined &&
        selecionado.size > 5 * 1024 * 1024
      ) {
        mostrarFeedback({
          variant: "error",
          title: "Arquivo muito grande",
          message:
            "O arquivo deve possuir no máximo 5 MB.",
        });

        return;
      }

      setImportando(true);

      const arquivo: Blob =
        Platform.OS === "web" &&
        selecionado.file
          ? selecionado.file
          : new File(selecionado.uri);

      const resultado =
        await importarJornalistas(
          arquivo,
          selecionado.name
        );

      if (!resultado.success) {
         const resumo = resultado.resumo;

          const detalhes = resultado.erros
            ?.slice(0, 3)
            .map(
              (erro) =>
                `• Linha ${erro.linha}: ${erro.mensagem}`
            )
            .join("\n") ?? "";

          const demaisErros =
            (resultado.erros?.length ?? 0) - 3;

          let mensagem = resultado.message;

          if (resumo) {
            mensagem +=
              `\n\nContatos analisados: ${resumo.lidos}` +
              `\nErros encontrados: ${resumo.erros}` +
              "\nNenhum contato foi incluído.";
          }

          if (detalhes) {
            mensagem +=
              `\n\nCorrija os seguintes itens:\n${detalhes}`;
          }

          if (demaisErros > 0) {
            mensagem +=
              `\n• E mais ${demaisErros} erro(s).`;
          }

          mostrarFeedback({
            variant: "error",
            title: "Importação não realizada",
            message: mensagem,
          });

          return;
        }

      await carregarJornalistas(true);

      const resumo = resultado.resumo;

      const importados = resumo?.importados ?? 0;
      const ignorados = resultado.ignorados ?? [];

      const detalhesIgnorados = ignorados
        .slice(0, 3)
        .map(
          (contato) =>
            `• ${contato.nome}: ${contato.motivo}`
        )
        .join("\n");

      const demaisIgnorados = ignorados.length - 3;

      let mensagem =
        `Arquivo analisado: ${selecionado.name}` +
        `\n\nContatos lidos: ${resumo?.lidos ?? 0}` +
        `\nImportados: ${importados}` +
        `\nIgnorados: ${ignorados.length}`;

      if (detalhesIgnorados) {
        mensagem +=
          `\n\nContatos não incluídos:\n` +
          detalhesIgnorados;
      }

      if (demaisIgnorados > 0) {
        mensagem +=
          `\n• E mais ${demaisIgnorados} contato(s).`;
      }

           mostrarFeedback({
        variant:
          ignorados.length > 0
            ? "warning"
            : "success",
        title:
          importados === 0
            ? "Nenhum contato novo foi importado"
            : ignorados.length > 0
              ? "Importação concluída com avisos"
              : "Importação concluída",
        message: mensagem,
      });
    } catch (error) {
      mostrarFeedback({
        variant: "error",
        title: "Não foi possível importar",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível importar o arquivo.",
      });
    } finally {
      setImportando(false);
    }
  }

  function mensagemExportacao(
    nomeArquivo: string
  ): string {
    const possuiFiltros = Boolean(
      buscaAplicada ||
      filtros.estado ||
      filtros.cidade ||
      filtros.cargo ||
      filtros.veiculoId ||
      filtros.ativo !== 1
    );

    return [
      `Arquivo gerado: ${nomeArquivo}`,
      "",
      possuiFiltros
        ? `${total} contato(s) exportado(s) conforme os filtros aplicados.`
        : `${total} contato(s) exportado(s) da assessoria.`,
      possuiFiltros
        ? "Os filtros atuais foram mantidos no arquivo."
        : "O arquivo contém todos os contatos disponíveis.",
    ].join("\n");
  }

  function abrirModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(true);
  }

  function sairModoSelecao() {
    setIdsSelecionados([]);
    setModoSelecao(false);
  }

  function alternarContatoSelecionado(id: number) {
    if (idsSelecionados.includes(id)) {
      setIdsSelecionados((atual) =>
        atual.filter((item) => item !== id)
      );

      return;
    }

    if (
      idsSelecionados.length >=
      LIMITE_SELECAO_EM_LOTE
    ) {
      mostrarFeedback({
        variant: "warning",
        title: "Limite de seleção atingido",
        message:
          "Você pode selecionar até 100 contatos por vez. Desmarque algum contato antes de selecionar outro.",
      });

      return;
    }

    setIdsSelecionados((atual) => [
      ...atual,
      id,
    ]);
  }

  function selecionarTodosVisiveis() {
    const idsVisiveis = jornalistas.map(
      (contato) => contato.id
    );

    const todosSelecionados =
      idsVisiveis.length > 0 &&
      idsVisiveis.every((id) =>
        idsSelecionados.includes(id)
      );

    if (
      todosSelecionados ||
      idsSelecionados.length >=
        LIMITE_SELECAO_EM_LOTE
    ) {
      setIdsSelecionados([]);
      return;
    }

    const vagasRestantes =
      LIMITE_SELECAO_EM_LOTE -
      idsSelecionados.length;

    const idsParaAdicionar = idsVisiveis
      .filter(
        (id) => !idsSelecionados.includes(id)
      )
      .slice(0, vagasRestantes);

    setIdsSelecionados((atual) => [
      ...atual,
      ...idsParaAdicionar,
    ]);

    const existemMaisVisiveis =
      idsVisiveis.filter(
        (id) => !idsSelecionados.includes(id)
      ).length > idsParaAdicionar.length;

    if (existemMaisVisiveis) {
      mostrarFeedback({
        variant: "info",
        title: "Limite de seleção atingido",
        message:
          "Foram selecionados os primeiros contatos disponíveis até o limite de 100 por exclusão.",
      });
    }
  }

  function confirmarExclusaoSelecionados() {
    const quantidade = idsSelecionados.length;

    if (quantidade === 0) {
      mostrarFeedback({
        variant: "warning",
        title: "Nenhum contato selecionado",
        message:
          "Selecione pelo menos um contato para excluir.",
      });

      return;
    }

    mostrarFeedback({
      variant: "warning",
      title: `Excluir ${quantidade} contato(s)?`,
      message:
        "Essa ação não pode ser desfeita. Caso algum contato esteja vinculado a outro registro, nenhum contato será excluído.",
      primaryLabel: "EXCLUIR",
      secondaryLabel: "CANCELAR",
      primaryDanger: true,
      onPrimary: excluirSelecionados,
    });
  }

  async function excluirSelecionados() {
    const ids = [...idsSelecionados];

    if (ids.length === 0) {
      return;
    }

    fecharFeedback();
    setExcluindoSelecionados(true);

    try {
      const resultado =
        await excluirJornalistasEmLote(ids);

      sairModoSelecao();

      await carregarJornalistas(true);

      mostrarFeedback({
        variant: "success",
        title: "Contatos excluídos",
        message:
          `${resultado.excluidos} contato(s) ` +
          "foram excluídos com sucesso.",
      });
    } catch (error) {
      mostrarFeedback({
        variant: "error",
        title: "Não foi possível excluir",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir os contatos.",
      });
    } finally {
      setExcluindoSelecionados(false);
    }
  }

  const todosVisiveisSelecionados =
    jornalistas.length > 0 &&
    jornalistas.every((contato) =>
      idsSelecionados.includes(contato.id)
    );
  if (carregando) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor:
              theme.background,
          },
        ]}
      >
        <Header title="Mailing" showBackButton />

        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            theme.background,
        },
      ]}
    >
      <Header title="Mailing" showBackButton />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ref={scrollRef}
      >
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar contatos, e-mail..."
          onSearch={realizarBusca}
          onFilterPress={abrirFiltros}
          filterActive={filtrosAtivos()}
          onClear={limparBusca}
        />

        <View style={styles.topRow}>
          <ContadorLista>
            {total} {total === 1 ? "contato" : "contatos"}
          </ContadorLista>

          <View style={styles.topActions}>
            {temPermissao("MAILING", "IMPORTAR") ? (
              <BotaoTransferencia
                tipo="importar"
                label="Importar contatos para o mailing"
                onPress={selecionarEImportarArquivo}
                loading={importando}
                disabled={importando || exportando}
              />
            ) : null}

            {temPermissao("MAILING", "EXPORTAR") ? (
              <BotaoTransferencia
                tipo="exportar"
                label="Exportar contatos do mailing"
                onPress={exportarMailing}
                loading={exportando}
                disabled={importando || exportando}
              />
            ) : null}

            {temPermissao("MAILING", "CRIAR") && (
              <Button
                icon="add-outline"
                title="CONTATO"
                size="small"
                onPress={() =>
                  router.push("/mailing/novo")
                }
                style={[styles.newButton]}
              />
            )}
          </View>
        </View>
          <LimparFiltrosButton
            visible={filtrosAtivos()}
            disabled={
              carregando ||
              excluindoSelecionados ||
              importando ||
              exportando
            }
            onPress={() => {
              aplicarFiltros({
                estado: "",
                cidade: "",
                cargo: "",
                ativo: 1,
                veiculoId: undefined,
                veiculoNome: undefined,
              });
            }}
          />
          {temPermissao("MAILING", "EXCLUIR") &&
          jornalistas.length > 0 ? (
            modoSelecao ? (
              <View
                style={[
                  styles.selectionToolbar,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.borda,
                  },
                ]}
              >
                <View style={styles.selectionInfo}>
                  <Text weight="SemiBold" style={styles.selectionTitle}>
                    {idsSelecionados.length} de{" "}
                    {LIMITE_SELECAO_EM_LOTE} selecionado(s)
                  </Text>

                  <Text
                    style={[
                      styles.selectionSubtitle,
                      { color: theme.textoSub },
                    ]}
                  >
                    Escolha os contatos que deseja excluir.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={selecionarTodosVisiveis}
                  disabled={excluindoSelecionados}
                  style={[
                    styles.selectAllButton,
                    { borderColor: theme.borda },
                  ]}
                >
                  <Text
                    weight="SemiBold"
                    style={[
                      styles.selectAllText,
                      { color: theme.texto },
                    ]}
                  >
                    {todosVisiveisSelecionados ||
                    idsSelecionados.length >=
                      LIMITE_SELECAO_EM_LOTE
                      ? "LIMPAR"
                      : "TODOS"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={confirmarExclusaoSelecionados}
                  disabled={
                    idsSelecionados.length === 0 ||
                    excluindoSelecionados
                  }
                  style={[
                    styles.selectionIconButton,
                    {
                      backgroundColor: "#EF4444",
                      opacity:
                        idsSelecionados.length === 0 ||
                        excluindoSelecionados
                          ? 0.5
                          : 1,
                    },
                  ]}
                >
                  {excluindoSelecionados ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={sairModoSelecao}
                  disabled={excluindoSelecionados}
                  style={[
                    styles.selectionIconButton,
                    {
                      backgroundColor: theme.backgroundContainer,
                    },
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={theme.textoContainer}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <SelecaoListaButton
                title="SELECIONAR CONTATOS"
                onPress={abrirModoSelecao}
              />
            )
          ) : null}

        {jornalistas.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                borderColor:
                  theme.borda,
              },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={34}
              color={theme.textoSub}
            />

            <Text
              weight="SemiBold"
              style={styles.emptyTitle}
            >
              Nenhum contato encontrado
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    theme.textoSub,
                },
              ]}
            >
              Tente alterar a busca ou os filtros.
            </Text>
          </View>
        ) : (
          jornalistas.map((jornalista) => (
            <TouchableOpacity
              key={jornalista.id}
              activeOpacity={0.8}
              onPress={() => {
                if (modoSelecao) {
                  alternarContatoSelecionado(jornalista.id);
                  return;
                }

                router.push({
                  pathname: "/mailing/[id]",
                  params: {
                    id: jornalista.id.toString(),
                  },
                });
              }}
              style={[
                styles.item,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor: theme.borda + "45",
                },
              ]}
            >
              <View style={styles.itemMain}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: theme.primaria + "12",
                    },
                  ]}
                >
                  <Text
                    weight="Bold"
                    style={{
                      color: theme.textoTerciaria,
                    }}
                  >
                    {jornalista.nome.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View
                  style={styles.itemInfo}
                >
                  <Text
                    weight="SemiBold"
                    style={
                      styles.itemName
                    }
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {jornalista.nome}
                  </Text>

                  <Text
                    style={[
                      styles.itemEmail,
                      {
                        color:
                          theme.textoSub,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {jornalista.email}
                  </Text>

                  <Text
                    style={[
                      styles.itemMeta,
                      {
                        color:
                          theme.texto,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {[
                      jornalista.cargo,
                      jornalista.cidade &&
                        jornalista.estado
                        ? `${jornalista.cidade} - ${jornalista.estado}`
                        : jornalista.cidade ||
                          jornalista.estado,
                      jornalista.veiculo_nome,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </View>

                {modoSelecao ? (
                <View
                  style={[
                    styles.selectionCheckbox,
                    {
                      borderColor:
                        idsSelecionados.includes(jornalista.id)
                          ? theme.backgroundContainer
                          : theme.borda,
                      backgroundColor:
                        idsSelecionados.includes(jornalista.id)
                          ? theme.backgroundContainer
                          : theme.background,
                    },
                  ]}
                >
                  {idsSelecionados.includes(jornalista.id) ? (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={theme.textoContainer}
                    />
                  ) : null}
                </View>
              ) : (
                <View
                  style={[
                    styles.itemArrow,
                    { backgroundColor: theme.primaria + "0C" },
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={theme.textoTerciaria}
                  />
                </View>
              )}
              </View>
            </TouchableOpacity>
          ))
        )}


      {!erro && total > 0 ? (
        <PaginacaoLista
          pagina={pagina}
          limite={limite}
          total={total}
          disabled={carregando || excluindoSelecionados || importando || exportando}
          onChange={(destino) => {
            void carregarPagina(destino);

            scrollRef.current?.scrollTo({
              y: 0,
              animated: false,
            });
          }}
        />
      ) : null}
      </ScrollView>
      <MailingFilterModal
        visible={filtrosAberto}
        filtros={filtros}
        onClose={() => setFiltrosAberto(false)}
        onApply={aplicarFiltros}
      />

      <FeedbackAlert
        visible={feedback !== null}
        variant={feedback?.variant ?? "info"}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        primaryLabel={feedback?.primaryLabel}
        secondaryLabel={feedback?.secondaryLabel}
        primaryDanger={feedback?.primaryDanger}
        onClose={fecharFeedback}
        onPrimary={() => {
          if (feedback?.onPrimary) {
            void feedback.onPrimary();
            return;
          }

          fecharFeedback();
        }}
        onSecondary={fecharFeedback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 30,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  topActions: {
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },

  exportButton: {
    width: 40,
    height: 40,
  borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  // botoes de exclusão em lote abaixo
  selectionStartButton: {
    minHeight: 42,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },

  selectionStartText: {
    fontSize: 12,
  },

  selectionToolbar: {
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    marginBottom: 12,
  },

  selectionInfo: {
    flex: 1,
  },

  selectionTitle: {
    fontSize: 13,
  },

  selectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  selectAllButton: {
    height: 36,
    borderWidth: 1.5,
    borderRadius: 18,
    justifyContent: "center",
    paddingHorizontal: 11,
  },

  selectAllText: {
    fontSize: 11,
  },

  selectionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  selectionCheckbox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  // botoes de exclusao em lote acima

  count: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
  },


  newButton: {
    width: "auto",
    borderRadius: 12

  },
  item: {
    width: "100%",
    minWidth: 0,
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  itemMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  itemEmail: {
    fontSize: 11,
    lineHeight: 15,
  },

  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  itemName: {
    fontSize: 14,
    lineHeight: 19,
  },

  itemMeta: {
    fontSize: 11,
    lineHeight: 15,
  },

  itemArrow: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    minHeight: 220,
    borderWidth: 1.5,
    borderRadius: 16,

    justifyContent: "center",
    alignItems: "center",

    padding: 25,
    marginTop: 10,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
  },

  emptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 13,
  },

  moreButton: {
    marginTop: 8,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
