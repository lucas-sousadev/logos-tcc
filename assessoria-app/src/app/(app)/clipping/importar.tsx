import { useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import VeiculoSelector, {
  type SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useClippingNovos } from "@/contexts/ClippingNovosContext";
import { dataISOParaBR, segundosParaTempo } from "@/utils/clippingFormatacao";

import {
  confirmarImportacaoClipping,
  ErroApiClipping,
  obterPreviaImportacaoClipping,
  type ArquivoCsvClipping,
  type LinhaPreviaImportacao,
  type PreviaImportacaoClipping,
  type ResultadoImportacaoClipping,
} from "@/services/api/clipping";

const LIMITE_CSV_BYTES = 5 * 1024 * 1024;

export default function ImportarClippings() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const { marcarNovo } = useClippingNovos();

  const params = useLocalSearchParams<{
    clienteId?: string;
    ano?: string;
    clienteNome?: string;
  }>();

  const clienteId = Number(params.clienteId);
  const ano = Number(params.ano);
  const clienteNome =
    params.clienteNome?.trim() || `Cliente #${clienteId}`;

  const podeImportar = temPermissao("CLIPPING", "IMPORTAR");
  const podeBuscarVeiculos =
    temPermissao("VEICULOS", "VISUALIZAR");

  const trava = useRef(false);

  const [arquivo, setArquivo] =
    useState<ArquivoCsvClipping | null>(null);

  const [previa, setPrevia] =
    useState<PreviaImportacaoClipping | null>(null);

  const [resultado, setResultado] =
    useState<ResultadoImportacaoClipping | null>(null);

  const [buscasVeiculos, setBuscasVeiculos] =
    useState<Record<string, SelecaoVeiculo>>({});

  // ausência da chave: ainda não resolvido.
  // null: o usuário escolheu importar sem veículo.
  const [associacoes, setAssociacoes] =
    useState<Record<string, number | null>>({});

  const [selecionados, setSelecionados] =
    useState<Set<number>>(() => new Set());

  const [precisaNovaPrevia, setPrecisaNovaPrevia] =
    useState(false);
 
  const [confirmacaoAberta, setConfirmacaoAberta] =
    useState(false);

  // mantém exatamente a mesma seleção caso a resposta da confirmação se perca por falha de rede.
  const [envioPendente, setEnvioPendente] =
    useState<number[] | null>(null);

  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const [resolvendoVeiculos, setResolvendoVeiculos] = useState(false);
  const [veiculoEmEdicao, setVeiculoEmEdicao] = useState<string | null>(null);

  const [filtrosLinhas, setFiltrosLinhas] = useState<Set<"validos" | "avisos" | "erros">>(() => new Set(["validos"]));

  const [detalhesAbertos, setDetalhesAbertos] = useState<Set<number>>(() => new Set());

  const [avisoSaidaAberto, setAvisoSaidaAberto] = useState(false);

  const contextoValido =
    Number.isSafeInteger(clienteId) &&
    clienteId > 0 &&
    Number.isInteger(ano) &&
    ano >= 1000 &&
    ano <= 9999;

  function sairParaListagem() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/clipping");
  }

  function voltar() {
    if (ocupado) return;

    if (resolvendoVeiculos) {
      setResolvendoVeiculos(false);
      return;
    }

    if (envioPendente) {
      setAvisoSaidaAberto(true);
      return;
    }

    sairParaListagem();
  }

  async function selecionarArquivo() {
    if (trava.current || envioPendente) return;
    trava.current = true;
    setOcupado(true);
    
    setErro("");

    try {
      const escolha = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });

      if (escolha.canceled || !escolha.assets[0]) {
        return;
      }

      const selecionado = escolha.assets[0];

      if (!/\.csv$/i.test(selecionado.name)) {
        throw new Error("Selecione um arquivo com extensão .csv.");
      }

      if (
        selecionado.size !== undefined &&
        (selecionado.size <= 0 ||
          selecionado.size > LIMITE_CSV_BYTES)
      ) {
        throw new Error(
          "O CSV deve ter conteúdo e no máximo 5 MB."
        );
      }

      setArquivo({
        uri: selecionado.uri,
        nome: selecionado.name,
        file: selecionado.file,
      });

      setPrevia(null);
      setResultado(null);
      setAssociacoes({});
      setBuscasVeiculos({});
      setSelecionados(new Set());
      setPrecisaNovaPrevia(false);
      setResolvendoVeiculos(false);
      setVeiculoEmEdicao(null);
      setFiltrosLinhas(
        new Set<"validos" | "avisos" | "erros">(["validos"])
      );
      setDetalhesAbertos(new Set());
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível selecionar o arquivo."
      );
    } finally {
    trava.current = false;
    setOcupado(false);
    } 
  }

  async function analisarArquivo() {
    if (
      trava.current ||
      !arquivo ||
      !contextoValido ||
      !podeImportar ||
      envioPendente
    ) {
      return;
    }

    trava.current = true;
    setOcupado(true);
    setErro("");

    try {
      const veiculos = Object.entries(associacoes).map(
        ([nome, veiculo_id]) => ({
          nome,
          veiculo_id,
        })
      );

      const novaPrevia =
        await obterPreviaImportacaoClipping(
          arquivo,
          clienteId,
          ano,
          veiculos
        );

      setPrevia(novaPrevia);
      setPrecisaNovaPrevia(false);
      setResolvendoVeiculos(false);
      setDetalhesAbertos(new Set());
      setSelecionados((atuais) => {
        const validos = new Set(
          novaPrevia.linhas
            .filter(
              (linha) =>
                linha.dados !== null &&
                linha.erros.length === 0
            )
            .map((linha) => linha.registro)
        );

        // Na primeira análise, marca todos os válidos.
        if (previa === null) {
          return validos;
        }

        // Ao atualizar, conserva somente os registros que
        // a pessoa já havia marcado e continuam válidos.
        return new Set(
          [...atuais].filter((registro) =>
            validos.has(registro)
          )
        );
      });
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível analisar o CSV."
      );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  function alterarVeiculo(
    nomeOriginal: string,
    selecao: SelecaoVeiculo
  ) { 
    if (ocupado || envioPendente) return;

    setBuscasVeiculos((atuais) => ({
        ...atuais,
        [nomeOriginal]: selecao,
    }));

    const novoId = selecao.id;

    // Apenas digitar no campo não altera a associação.
    if (novoId === null) {
        return;
    }

    const anterior =
        Object.prototype.hasOwnProperty.call(
        associacoes,
        nomeOriginal
        )
        ? associacoes[nomeOriginal]
        : undefined;

    if (anterior !== novoId) {
        setPrecisaNovaPrevia(true);
    }

    setAssociacoes((atuais) => ({
        ...atuais,
        [nomeOriginal]: novoId,
    }));

    setVeiculoEmEdicao(null);
  }

  function deixarVeiculoPendente(nomeOriginal: string) {
    if (ocupado || envioPendente) return;

    const anterior =
        Object.prototype.hasOwnProperty.call(
        associacoes,
        nomeOriginal
        )
        ? associacoes[nomeOriginal]
        : undefined;

    if (anterior !== null) {
        setPrecisaNovaPrevia(true);
    }

    setAssociacoes((atuais) => ({
        ...atuais,
        [nomeOriginal]: null,
    }));

    setBuscasVeiculos((atuais) => ({
        ...atuais,
        [nomeOriginal]: {
        id: null,
        nome: "",
        },
    }));

    setVeiculoEmEdicao(null);
}

  function alternarRegistro(registro: number) {
    if (ocupado || envioPendente) return;

    setSelecionados((atuais) => {
      const proximos = new Set(atuais);

      if (proximos.has(registro)) {
        proximos.delete(registro);
      } else {
        proximos.add(registro);
      }

      return proximos;
    });
  }

  function selecionarLinhas(semAvisos: boolean) {
    if (!previa || ocupado || envioPendente || precisaNovaPrevia) {
        return;
    }

    const registros = previa.linhas
        .filter(
        (linha) =>
            linha.dados !== null &&
            linha.erros.length === 0 &&
            (!semAvisos || linha.avisos.length === 0)
        )
        .map((linha) => linha.registro);

    // Sempre considera o CSV inteiro, independentemente
    // do filtro TODOS / ERROS / AVISOS que estiver aberto.
    setSelecionados(new Set(registros));
    }

  async function executarConfirmacao(registros: number[]) {
    if (
      trava.current ||
      !previa ||
      precisaNovaPrevia ||
      registros.length === 0
    ) {
      return;
    }

    trava.current = true;
    setOcupado(true);
    setErro("");
    setEnvioPendente(registros);

    try {
      const resposta = await confirmarImportacaoClipping(
        previa.token,
        registros
      );

      setResultado(resposta);
      setEnvioPendente(null);

      resposta.resultados.forEach((item) => {
        if (
          item.status === "importado" &&
          item.clipping_id !== null
        ) {
          marcarNovo(item.clipping_id);
        }
      });
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a importação."
      );

      // resposta explícita da API: a confirmação foi recusada. É possível voltar a analisar o CSV. 
      // falha de rede: manter os mesmos registros para reenviar com o mesmo token.
      if (
        error instanceof ErroApiClipping &&
        [404, 409, 422].includes(error.status)
      ) {
        setEnvioPendente(null);
        setPrecisaNovaPrevia(true);
      }
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  function pedirConfirmacao() {
    if (
      !previa ||
      ocupado ||
      envioPendente ||
      precisaNovaPrevia ||
      selecionados.size === 0
    ) {
      return;
    }

    setConfirmacaoAberta(true);
  }

  function renderizarLinha({
    item,
    }: {
    item: LinhaPreviaImportacao;
    }) {
    const valido =
        item.erros.length === 0 && item.dados !== null;

    const marcado = selecionados.has(item.registro);
    const detalhesVisiveis =
        detalhesAbertos.has(item.registro);

    const pauta =
        item.dados?.pauta ||
        item.originais.pauta ||
        "Pauta pendente";

    const nomeVeiculo =
        item.veiculo_nome ||
        item.originais.veiculo ||
        "Veículo pendente";

    const atributos: string[] = [];

    if (item.dados?.categorias?.length) {
        atributos.push(item.dados.categorias.join(", "));
    }

    if (item.dados?.tier != null) {
        atributos.push(`Tier ${item.dados.tier}`);
    }

    if (item.dados?.duracao_segundos != null) {
        atributos.push(
        `Duração ${segundosParaTempo(
            item.dados.duracao_segundos
        )}`
        );
    }

    const quantidadeMensagens =
        item.erros.length + item.avisos.length;

    const situacao = !valido
        ? "Corrigir no CSV"
        : item.avisos.length > 0
        ? "Revisar aviso"
        : "Pronto para importar ao clipping";

    const corSituacao = !valido
        ? "#EF4444"
        : item.avisos.length > 0
        ? "#B7791F"
        : theme.primaria;

    function alternarDetalhes() {
        setDetalhesAbertos((atuais) => {
        const proximos = new Set(atuais);

        if (proximos.has(item.registro)) {
            proximos.delete(item.registro);
        } else {
            proximos.add(item.registro);
        }

        return proximos;
        });
    }

    return (
        <View
        style={[
            styles.linha,
            {
            backgroundColor: theme.background,
            borderColor: valido
                ? theme.borda
                : "#EF4444",
            },
        ]}
        >
        <TouchableOpacity
            activeOpacity={0.8}
            disabled={
            !valido ||
            ocupado ||
            Boolean(envioPendente) ||
            precisaNovaPrevia
            }
            onPress={() =>
            alternarRegistro(item.registro)
            }
            accessibilityRole="checkbox"
            accessibilityState={{
            checked: marcado,
            disabled:
                !valido ||
                ocupado ||
                precisaNovaPrevia,
            }}
            accessibilityLabel={
            `Linha ${item.registro}: ${pauta}. ` +
            situacao
            }
            style={styles.linhaTopo}
        >
            <Ionicons
            name={
                !valido
                ? "close-circle-outline"
                : marcado
                    ? "checkbox"
                    : "square-outline"
            }
            size={22}
            color={corSituacao}
            />

            <Text
            weight="SemiBold"
            style={styles.linhaTitulo}
            >
            {pauta}
            </Text>
        </TouchableOpacity>

        <Text
            style={[
            styles.linhaInfo,
            { color: theme.textoSub },
            ]}
        >
            Linha {item.registro}
            {" · "}
            {item.dados?.data_publicacao
            ? dataISOParaBR(item.dados.data_publicacao)
            : item.originais.data_publicacao?.trim() ||
                "Data pendente"}
            {" · "}
            {nomeVeiculo}
            {" · "}
            {item.dados?.ano_referencia ?? ano}
        </Text>

        {atributos.length > 0 ? (
            <Text
            style={[
                styles.linhaInfo,
                { color: theme.textoSub },
            ]}
            >
            {atributos.join(" · ")}
            </Text>
        ) : null}

        <Text
            weight="SemiBold"
            style={[
            styles.situacaoLinha,
            { color: corSituacao },
            ]}
        >
            {situacao}
            {quantidadeMensagens > 0
            ? ` · ${quantidadeMensagens} mensagem(ns)`
            : ""}
        </Text>

        {quantidadeMensagens > 0 ? (
            <Button
            title={
                detalhesVisiveis
                ? "OCULTAR MENSAGENS"
                : "VER MENSAGENS"
            }
            variant="outline"
            size="small"
            onPress={alternarDetalhes}
            style={styles.botaoDetalhes}
            />
        ) : null}

        {detalhesVisiveis ? (
            <View style={styles.mensagensLinha}>
            {item.erros.map((mensagem, indice) => (
                <Text
                key={`erro-${indice}`}
                style={styles.erroLinha}
                >
                Erro: {mensagem}
                </Text>
            ))}

            {item.avisos.map((mensagem, indice) => (
                <Text
                key={`aviso-${indice}`}
                style={styles.avisoLinha}
                >
                Aviso: {mensagem}
                </Text>
            ))}
            </View>
        ) : null}
        </View>
    );
    }

  if (!podeImportar || !contextoValido) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Importar clippings"
          showBackButton
          onBackPress={voltar}
        />

        <Text style={styles.mensagemCentral}>
          {!contextoValido
            ? "Cliente ou ano inválido."
            : "Você não possui permissão para importar clippings."}
        </Text>
      </View>
    );
  }

  if (resultado) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Resultado da importação"
          showBackButton
          onBackPress={voltar}
        />

        <FlatList
          data={resultado.resultados}
          keyExtractor={(item) => String(item.registro)}
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            <View style={styles.cabecalho}>
              <Text weight="Bold" style={styles.titulo}>
                {resultado.message}
              </Text>

              <Text
                style={{ color: theme.textoSub }}
              >
                {resultado.resumo.importados} importados
                {" · "}
                {resultado.resumo.erros} com erro
                {" · "}
                {resultado.resumo.ignorados} ignorados
              </Text>

            <Text style={{ color: theme.textoSub }}>
              {resultado.resumo.veiculos_criados} veículo(s) criado(s)
              {" · "}
              {resultado.resumo.vinculos_pendentes} vínculo(s) pendente(s)
            </Text>

            {resultado.veiculos_criados.length > 0 ? (
              <Text style={{ color: theme.textoSub }}>
                Criados: {resultado.veiculos_criados
                  .map((veiculo) => veiculo.nome)
                  .join(", ")}
              </Text>
            ) : null}
              <Text
                style={[
                  styles.ajuda,
                  { color: theme.textoSub },
                ]}
              >
                Confira o resultado de cada linha. Se alguma
                falhou, corrija o CSV antes de iniciar outra
                importação.
              </Text>
              
            </View>
          }
          ListFooterComponent={
            <Button
              title="VOLTAR À LISTAGEM"
              variant="outline"
              onPress={voltar}
              style={{ marginTop: 8 }}
            />
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.linha,
                {
                  backgroundColor: theme.background,
                  borderColor:
                    item.status === "erro"
                      ? "#EF4444"
                      : theme.borda,
                },
              ]}
            >
              <Text weight="SemiBold">
                Linha {item.registro} · {item.status}
              </Text>

              <Text
                style={[
                  styles.linhaInfo,
                  { color: theme.textoSub },
                ]}
              >
                {item.message}
                {item.clipping_id !== null
                  ? ` · Clipping #${item.clipping_id}`
                  : ""}
              </Text>
            </View>
          )}
        />
      </View>
    );
  }

  const quantidadeValida =
  previa?.resumo.validos ?? 0;

    const quantidadeErros =
    (previa?.resumo.total ?? 0) -
    quantidadeValida;

    const quantidadeSemAvisos =
    previa?.linhas.filter(
        (linha) =>
        linha.dados !== null &&
        linha.erros.length === 0 &&
        linha.avisos.length === 0
    ).length ?? 0;

    const quantidadeAvisosValidos =
    previa?.linhas.filter(
      (linha) =>
        linha.dados !== null &&
        linha.erros.length === 0 &&
        linha.avisos.length > 0
    ).length ?? 0;
    
    const selecionadosComAvisos =
    previa?.linhas.filter(
        (linha) =>
        selecionados.has(linha.registro) &&
        linha.avisos.length > 0
    ).length ?? 0;

    const veiculosNovos = [
      ...new Set(
        (previa?.linhas ?? []).flatMap((linha) =>
          selecionados.has(linha.registro) &&
          linha.erros.length === 0 &&
          linha.dados !== null &&
          linha.veiculo_para_criar !== null
            ? [linha.veiculo_para_criar]
            : []
        )
      ),
    ];

    const vinculosPendentes = (previa?.linhas ?? []).filter(
      (linha) =>
        selecionados.has(linha.registro) &&
        linha.erros.length === 0 &&
        linha.dados !== null &&
        linha.dados.veiculo_id === null &&
        Boolean(linha.dados.veiculo_nome_informado) &&
        linha.veiculo_para_criar === null
    ).length;

    const vistos = new Set<string>();

    const veiculosParaRevisao = [
      ...(previa?.veiculos_pendentes ?? []),
      ...Object.keys(associacoes),
    ].filter((nome) => {
      const chave = nome
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("pt-BR");

      if (vistos.has(chave)) return false;

      vistos.add(chave);
      return true;
    });

    const quantidadeVeiculosPendentes =
      previa?.veiculos_pendentes.length ?? 0;

    const linhasExibidas =
      previa?.linhas.filter((linha) => {
        // Nenhum marcado = mostrar todas as linhas.
        if (filtrosLinhas.size === 0) return true;

        if (linha.erros.length > 0 || linha.dados === null) {
          return filtrosLinhas.has("erros");
        }

        if (linha.avisos.length > 0) {
          return filtrosLinhas.has("avisos");
        }

        return filtrosLinhas.has("validos");
      }) ?? [];

    // ETAPA 1: escolher o arquivo.
    if (!previa) {
    return (
        <View
        style={[
            styles.container,
            { backgroundColor: theme.background },
        ]}
        >
        <Header
            title="Importar clippings"
            showBackButton
            onBackPress={voltar}
        />

        <ScrollView
            contentContainerStyle={styles.conteudo}
            showsVerticalScrollIndicator={false}
        >
            <Text weight="Bold" style={styles.etapaTitulo}>
            1. Escolha o arquivo
            </Text>

            <Text
            style={[
                styles.etapaDescricao,
                { color: theme.textoSub },
            ]}
            >
            Você está importando clippings para{" "}
            {clienteNome}. O ano inicial é {ano};
            publicações com data de outro ano serão
            organizadas no ano da própria data.
            </Text>

            <View
            style={[
                styles.painel,
                {
                backgroundColor: theme.background,
                borderColor: theme.borda,
                },
            ]}
            >
            <Ionicons
                name="document-text-outline"
                size={30}
                color={theme.primaria}
            />

            <Text
                weight="SemiBold"
                style={{ marginTop: 10 }}
            >
                {arquivo
                ? arquivo.nome
                : "Nenhum CSV selecionado"}
            </Text>

            <Text
                style={[
                styles.etapaDescricao,
                {
                    color: theme.textoSub,
                    marginTop: 6,
                },
                ]}
            >
                Até 5 MB e 1.000 registros. Você
                poderá conferir as linhas antes de importar.
            </Text>

            <Button
                title={
                arquivo
                    ? "TROCAR ARQUIVO"
                    : "ESCOLHER CSV"
                }
                variant="outline"
                size="small"
                disabled={ocupado}
                onPress={() =>
                void selecionarArquivo()
                }
                style={{ marginTop: 16 }}
            />
            </View>

            {erro ? (
            <Text style={styles.erroGeral}>
                {erro}
            </Text>
            ) : null}
        </ScrollView>

        <View
            style={[
            styles.rodape,
            {
                backgroundColor: theme.background,
                borderColor: theme.borda,
            },
            ]}
        >
            <Button
            title="ANALISAR CSV"
            disabled={!arquivo || ocupado}
            loading={ocupado}
            onPress={() =>
                void analisarArquivo()
            }
            />
          
        </View>
        </View>
    );
    }

    // TELA AUXILIAR: veículos desconhecidos.
    // Deixa de ocupar espaço acima de todas as linhas.
    if (resolvendoVeiculos) {
    return (
        <View
        style={[
            styles.container,
            { backgroundColor: theme.background },
        ]}
        >
        <Header
            title="Associar veículos"
            showBackButton
            onBackPress={voltar}
        />

        <FlatList
            data={veiculosParaRevisao}
            keyExtractor={(nome) => nome}
            contentContainerStyle={styles.conteudo}
            ListHeaderComponent={
            <View style={{ marginBottom: 18 }}>
                <Text
                weight="Bold"
                style={styles.etapaTitulo}
                >
                Veículos do arquivo
                </Text>

                <Text
                style={[
                    styles.etapaDescricao,
                    { color: theme.textoSub },
                ]}
                >
                Associe cada nome do CSV a um veículo
                existente ou escolha deixá-lo pendente.
                Depois, atualize a prévia para conferir
                como as linhas ficarão.
                </Text>
                <Text style={[styles.etapaDescricao, { color: theme.textoSub }]}>
                  {quantidadeVeiculosPendentes} veículo(s) não encontrados. A associação é opcional; você também pode alterar associações já feitas.
                </Text>

                {erro ? <Text style={styles.erroGeral}>{erro}</Text> : null}
            </View>
            }
            renderItem={({ item: nomeOriginal }) => {
                const foiResolvido =
                    Object.prototype.hasOwnProperty.call(
                    associacoes,
                    nomeOriginal
                    );

                const veiculoId = foiResolvido
                    ? associacoes[nomeOriginal]
                    : undefined;

                const semVeiculo =
                    foiResolvido && veiculoId === null;

                const buscaAberta =
                    veiculoEmEdicao === nomeOriginal;

                const selecaoAtual =
                    buscasVeiculos[nomeOriginal];

                const nomeAssociado =
                  selecaoAtual && selecaoAtual.id === veiculoId
                    ? selecaoAtual.nome
                    : `Veículo #${veiculoId}`;

                const status = !foiResolvido
                  ? previa.pode_criar_veiculos
                    ? "Será criado ao importar"
                    : "Será importado com vínculo pendente"
                  : semVeiculo
                    ? "Vínculo pendente por escolha"
                    : `Associado a ${nomeAssociado}`;

                const corStatus = !foiResolvido || semVeiculo
                  ? "#B7791F"
                  : theme.primaria;

                return (
                    <View
                    style={[
                        styles.painel,
                        {
                        backgroundColor: theme.background,
                        borderColor: theme.borda,
                        marginTop: 0,
                        marginBottom: 12,
                        },
                    ]}
                    >
                    <Text weight="SemiBold">
                        No CSV: {nomeOriginal}
                    </Text>

                    <Text
                        weight="SemiBold"
                        style={{
                        color: corStatus,
                        fontSize: 12,
                        marginTop: 8,
                        }}
                    >
                        {status}
                    </Text>

                    {buscaAberta && podeBuscarVeiculos ? (
                        <View style={{ marginTop: 14 }}>
                        <VeiculoSelector
                            value={
                            buscasVeiculos[nomeOriginal] ?? {
                                id: null,
                                nome: nomeOriginal,
                            }
                            }
                            onChange={(selecao) =>
                            alterarVeiculo(
                                nomeOriginal,
                                selecao
                            )
                            }
                            disabled={
                            ocupado ||
                            Boolean(envioPendente)
                            }
                            modoFiltro
                            modoImportacao
                        />

                        <Button
                            title="FECHAR BUSCA"
                            variant="outline"
                            size="small"
                            onPress={() =>
                            setVeiculoEmEdicao(null)
                            }
                        />
                        </View>
                    ) : (
                        <>
                        {podeBuscarVeiculos ? (
                            <Button
                            title={
                                foiResolvido
                                ? "ALTERAR ASSOCIAÇÃO"
                                : "BUSCAR VEÍCULO EXISTENTE"
                            }
                            variant="outline"
                            size="small"
                            disabled={
                                ocupado ||
                                Boolean(envioPendente)
                            }
                            onPress={() =>
                                setVeiculoEmEdicao(
                                nomeOriginal
                                )
                            }
                            style={{ marginTop: 12 }}
                            />
                        ) : (
                            <Text
                            style={[
                                styles.etapaDescricao,
                                { color: theme.textoSub },
                            ]}
                            >
                            Sua permissão não permite buscar
                            veículos existentes.
                            </Text>
                        )}

                        {!semVeiculo ? (
                            <Button
                            title="DEIXAR VÍNCULO PENDENTE"
                            variant="outline"
                            size="small"
                            disabled={
                                ocupado ||
                                Boolean(envioPendente)
                            }
                            onPress={() =>
                                deixarVeiculoPendente(
                                nomeOriginal
                                )
                            }
                            style={{ marginTop: 8 }}
                            />
                        ) : null}
                        </>
                    )}
                    </View>
                );
                }}
        />

        <View
            style={[
            styles.rodape,
            {
                backgroundColor: theme.background,
                borderColor: theme.borda,
            },
            ]}
        >
            <Button
            title={
                precisaNovaPrevia
                ? "ATUALIZAR PRÉVIA"
                : "VOLTAR À PRÉVIA"
            }
            loading={ocupado}
            disabled={ocupado}
            onPress={() => {
                if (precisaNovaPrevia) {
                void analisarArquivo();
                } else {
                setResolvendoVeiculos(false);
                }
            }}
            />
        </View>
        </View>
    );
    }
    
  const desmarcarDesabilitado =
    ocupado ||
    Boolean(envioPendente) ||
    precisaNovaPrevia ||
    selecionados.size === 0;

    // ETAPA 2: revisar e selecionar os registros.
    return (
    <View
        style={[
        styles.container,
        { backgroundColor: theme.background },
        ]}
    >
        <Header
        title="Revisar importação"
        showBackButton
        onBackPress={voltar}
        />

        <FlatList
        data={linhasExibidas}
        keyExtractor={(item) =>
            String(item.registro)
        }
        renderItem={renderizarLinha}
        contentContainerStyle={styles.conteudo}
        ListHeaderComponent={
            <View>
            <Text
                weight="Bold"
                style={styles.etapaTitulo}
            >
                2. Revise os registros
            </Text>

            <Text
                style={[
                styles.etapaDescricao,
                { color: theme.textoSub },
                ]}
            >
                {clienteNome} · {ano}
            </Text>
            {erro ? (
                <Text style={styles.erroGeral}>
                    {erro}
                </Text>
            ) : null}

            <View
                style={[
                styles.arquivoPainel,
                { borderColor: theme.borda },
                ]}
            >
                <View style={{ flex: 1 }}>
                <Text
                    weight="SemiBold"
                    numberOfLines={1}
                >
                    {arquivo?.nome}
                </Text>

                <Text
                    style={[
                    styles.arquivoAjuda,
                    { color: theme.textoSub },
                    ]}
                >
                    CSV analisado
                </Text>
                </View>

                <Button
                title="TROCAR"
                variant="outline"
                size="small"
                disabled={
                    ocupado ||
                    Boolean(envioPendente)
                }
                onPress={() =>
                    void selecionarArquivo()
                }
                style={styles.trocarBotao}
                />
            </View>

            {envioPendente ? (
                <Text style={styles.avisoLinha}>
                A resposta da confirmação pode ter se
                perdido. Use o botão abaixo para reenviar
                exatamente a mesma solicitação.
                </Text>
            ) : null}

            {veiculosParaRevisao.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Revisar veículos do CSV"
                disabled={ocupado || Boolean(envioPendente)}
                onPress={() => setResolvendoVeiculos(true)}
                style={[
                  styles.arquivoPainel,
                  {
                    borderColor: theme.borda,
                    backgroundColor: theme.background,
                    opacity: ocupado || envioPendente ? 0.5 : 1,
                    marginTop: 0
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text weight="SemiBold">
                    Revisão de veículos
                  </Text>

                  <Text
                    style={[
                      styles.arquivoAjuda,
                      { color: theme.texto, lineHeight: 17 },
                    ]}
                  >
                    {precisaNovaPrevia
                      ? "As associações mudaram. Atualize a prévia para conferir o resultado."
                      : `${veiculosNovos.length} veículo(s) serão criados ao importar as linhas marcadas; ${vinculosPendentes} clipping(s) ficarão com vínculo pendente.`}
                  </Text>

                  <Text
                    style={[
                      styles.arquivoAjuda,
                      { color: theme.primaria },
                    ]}
                  >
                    Toque para associar ou deixar pendente
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textoSub}
                />
              </TouchableOpacity>
            ) : null}

            {precisaNovaPrevia ? (
                <Text style={styles.avisoLinha}>
                Você mudou uma associação. A lista
                abaixo ainda mostra a prévia anterior.
                Atualize-a antes de importar.
                </Text>
            ) : null}

            {previa.ignoradas.length > 0 ? (
                <Text style={styles.avisoLinha}>
                Colunas não utilizadas:{" "}
                {previa.ignoradas.join(", ")}
                </Text>
            ) : null}


            <View style={styles.filtrosLinha}>
              {([
                ["validos", "SEM AVISOS", quantidadeSemAvisos],
                ["avisos", "AVISOS", quantidadeAvisosValidos],
                ["erros", "ERROS", quantidadeErros],
              ] as const).map(([valor, rotulo, total]) => {
                const ativo = filtrosLinhas.has(valor);
                const corNumero =
                  valor === "erros"
                    ? "#EF4444"
                    : valor === "avisos"
                      ? "#B7791F"
                      : theme.texto;

                return (
                  <TouchableOpacity
                    key={valor}
                    activeOpacity={0.8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: ativo }}
                    onPress={() => {
                      setFiltrosLinhas((atuais) => {
                        const proximos = new Set(atuais);

                        if (proximos.has(valor)) {
                          proximos.delete(valor);
                        } else {
                          proximos.add(valor);
                        }

                        return proximos;
                      });
                    }}
                    style={[
                      styles.filtroAba,
                      {
                        backgroundColor: theme.background,
                        borderColor: ativo
                          ? theme.primaria
                          : theme.borda,
                        borderWidth: ativo ? 2 : 1,
                      },
                    ]}
                  >
                    <Text
                      weight="Bold"
                      style={[
                        styles.filtroNumero,
                        { color: corNumero },
                      ]}
                    >
                      {total}
                    </Text>

                    <Text
                      weight="SemiBold"
                      style={[
                        styles.filtroLegenda,
                        {
                          color: ativo
                            ? theme.primaria
                            : theme.textoSub,
                        },
                      ]}
                    >
                      {rotulo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.selecaoTitulo}>
                <Text weight="SemiBold" style={{ flex: 1 }}>
                    {selecionados.size} de {quantidadeValida} válidos selecionados
                </Text>
              <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Desmarcar todos os clippings selecionados"
                  accessibilityState={{ disabled: desmarcarDesabilitado }}
                  disabled={desmarcarDesabilitado}
                  onPress={() => setSelecionados(new Set<number>())}
                  style={[
                    styles.selecaoBotao,
                    { opacity: desmarcarDesabilitado ? 0.45 : 1 },
                  ]}
                >
                  <Text
                    weight="SemiBold"
                    style={{ color: theme.primaria, fontSize: 12 }}
                  >
                    DESMARCAR
                  </Text>
                </TouchableOpacity>
              </View>

                <View style={styles.acoesSelecao}>
                <Button
                    title="SEM AVISOS"
                    variant="outline"
                    size="small"
                    disabled={
                    ocupado ||
                    Boolean(envioPendente) ||
                    precisaNovaPrevia ||
                    quantidadeSemAvisos === 0
                    }
                    onPress={() => selecionarLinhas(true)}
                    style={styles.acaoSelecao}
                />

                <Button
                    title="TODOS VÁLIDOS"
                    variant="outline"
                    size="small"
                    disabled={
                    ocupado ||
                    Boolean(envioPendente) ||
                    precisaNovaPrevia ||
                    quantidadeValida === 0
                    }
                    onPress={() => selecionarLinhas(false)}
                    style={styles.acaoSelecao}
                />
                </View>
            </View>
        }
        ListEmptyComponent={
            <Text
            style={[
                styles.etapaDescricao,
                { color: theme.textoSub },
            ]}
            >
            Nenhuma linha neste filtro.
            </Text>
        }
        />

        <View
        style={[
            styles.rodape,
            {
            backgroundColor: theme.background,
            borderColor: theme.borda,
            },
        ]}
        >
        <Text
            style={[
            styles.rodapeAjuda,
            { color: theme.textoSub },
            ]}
        >
            {envioPendente
            ? "Reenviar a mesma confirmação não cria registros novamente."
            : precisaNovaPrevia
                ? "Atualize a prévia para conferir as associações."
                : "Somente as linhas marcadas serão importadas."}
        </Text>

        <Button
            title={
            envioPendente
                ? "TENTAR CONFIRMAÇÃO NOVAMENTE"
                : precisaNovaPrevia
                ? "ATUALIZAR PRÉVIA"
                : `IMPORTAR ${selecionados.size} REGISTRO(S)`
            }
            disabled={
            ocupado ||
            (!envioPendente &&
                !precisaNovaPrevia &&
                selecionados.size === 0)
            }
            loading={ocupado}
            onPress={() => {
            if (envioPendente) {
                void executarConfirmacao(
                envioPendente
                );
            } else if (precisaNovaPrevia) {
                void analisarArquivo();
            } else {
                pedirConfirmacao();
            }
            }}
        />  
        </View>

        <FeedbackAlert
        visible={confirmacaoAberta}
        variant="warning"
        title="Confirmar importação?"
        message={
            `${veiculosNovos.length} veículo(s) novo(s) serão criados. ` +
            `${vinculosPendentes} clipping(s) ficarão com vínculo pendente. ` +
            `${selecionados.size} registro(s) serão criados para ${clienteNome}. ` +
            `${selecionadosComAvisos} selecionado(s) possuem avisos. ` +
            "Linhas com erro não são importadas. " +
            "Confira especialmente links repetidos e mudanças de ano."
        }
        primaryLabel="IMPORTAR"
        secondaryLabel="REVISAR"
        onSecondary={() =>
            setConfirmacaoAberta(false)
        }
        onClose={() =>
            setConfirmacaoAberta(false)
        }
        onPrimary={() => {
            setConfirmacaoAberta(false);

            void executarConfirmacao(
            [...selecionados].sort(
                (a, b) => a - b
            )
            );
        }}
        />

        <FeedbackAlert
          visible={avisoSaidaAberto}
          variant="warning"
          title="Confirmação sem resposta"
          message="O servidor pode ter concluído a importação. Reenviar a mesma confirmação é seguro. Se sair, confira a listagem antes de importar o arquivo novamente."
          primaryLabel="CONTINUAR AQUI"
          secondaryLabel="SAIR E CONFERIR"
          onClose={() => setAvisoSaidaAberto(false)}
          onPrimary={() => setAvisoSaidaAberto(false)}
          onSecondary={() => {
            setAvisoSaidaAberto(false);
            sairParaListagem();
          }}
        />
    </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  lista: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },

  titulo: {
    fontSize: 18,
    marginBottom: 8,
  },

  ajuda: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  arquivo: {
    fontSize: 12,
    marginTop: 10,
  },

  mensagemCentral: {
    margin: 20,
    fontSize: 14,
  },

  resumo: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  filtroAba: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    borderRadius: 13,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filtrosLinha: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  
  filtroNumero: {
    fontSize: 17,
  },

  filtroLegenda: {
    fontSize: 11,
    marginTop: 3,
  },

  selecao: {
    marginTop: 20,
    marginBottom: 12,
    gap: 10,
  },

  selecaoTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    },

    acoesSelecao: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    },

    acaoSelecao: {
    flex: 1,
    width: "auto",
    minHeight: 40,
    paddingHorizontal: 5,
    },

    ajudaSelecao: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 14,
    },
  linha: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },

  linhaTopo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  linhaTitulo: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  linhaInfo: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },

  erroLinha: {
    color: "#EF4444",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  erroGeral: {
    color: "#EF4444",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },

  avisoLinha: {
    color: "#B7791F",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  cabecalho: {
    marginBottom: 18,
  },

  rodape: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 2,
  },
  conteudo: {
  paddingHorizontal: 16,
  paddingTop: 18,
  paddingBottom: 32,
},

etapaTitulo: {
  fontSize: 19,
  lineHeight: 26,
},

etapaDescricao: {
  fontSize: 12,
  lineHeight: 19,
  marginTop: 8,
},

painel: {
  borderWidth: 1,
  borderRadius: 18,
  padding: 18,
  marginTop: 20,
},

arquivoPainel: {
  borderWidth: 1,
  borderRadius: 14,
  padding: 12,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  marginTop: 15,
  marginBottom: 14,
},

arquivoAjuda: {
  fontSize: 11,
  marginTop: 3,
},

trocarBotao: {
  width: "auto",
  minHeight: 38,
  paddingHorizontal: 10,
},

numeros: {
  flexDirection: "row",
  gap: 8,
  marginBottom: 14,
},

numeroCaixa: {
  flex: 1,
  borderWidth: 1,
  borderRadius: 13,
  paddingVertical: 10,
  alignItems: "center",
},

numero: {
  fontSize: 17,
},

numeroLegenda: {
  fontSize: 11,
  marginTop: 3,
},

listaTitulo: {
  fontSize: 14,
  marginTop: 18,
  marginBottom: 10,
},

filtroBotao: {
  flex: 1,
  width: "auto",
  minHeight: 38,
  paddingHorizontal: 4,
},

selecaoLinha: {
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
},

selecaoBotao: {
  minHeight: 24,
  paddingHorizontal: 8,
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
},
situacaoLinha: {
  fontSize: 11,
  marginTop: 8,
},

botaoDetalhes: {
  minHeight: 36,
  marginTop: 10,
},

mensagensLinha: {
  marginTop: 4,
},

rodapeAjuda: {
  fontSize: 11,
  lineHeight: 16,
  textAlign: "center",
  marginBottom: 8,
},
});