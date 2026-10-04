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
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import VeiculoSelector, { type SelecaoVeiculo,} from "@/components/forms/VeiculoSelector";
import MapeamentoColunasClipping from "@/components/clipping/MapeamentoColunasClipping";
import ClienteImportacaoSelector from "@/components/clipping/ClienteImportacaoSeletor";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useClippingNovos } from "@/contexts/ClippingNovosContext";
import { dataISOParaBR, segundosParaTempo } from "@/utils/clippingFormatacao";

import {
  confirmarImportacaoClipping,
  ErroApiClipping,
  obterPreviaImportacaoClipping,
  inspecionarColunasClipping,
  type ArquivoCsvClipping,
  type LinhaPreviaImportacao,
  type PreviaImportacaoClipping,
  type ResultadoImportacaoClipping,
  type CampoImportacaoClipping,
  type EstruturaImportacaoClipping,
} from "@/services/api/clipping";

const LIMITE_CSV_BYTES = 5 * 1024 * 1024;

function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function totalAvisosLinha(linha: LinhaPreviaImportacao) {
  return linha.avisos.length + (linha.avisos_link?.length ?? 0);
}

function temLinkRepetido(linha: LinhaPreviaImportacao) {
  return (linha.avisos_link ?? []).some(
    (aviso) =>
      aviso.tipo === "no_csv" ||
      aviso.tipo === "cadastrado"
  );
}

export default function ImportarClippings() {
  const router = useRouter();
  const { theme, mode } = useTheme();
  const corAcao = mode === "dark" ? "#B5C4E5" : "#283570";
  const fundoFiltroAtivo = mode === "dark"  ? "#001da070"  : "#5e7bff2d";
  const fundoSelecionado = mode === "dark" ? "#5170FF" : "#5170FF";
  const bordaNeutra = mode === "dark" ? "#6B86FF" : "#6B86FF";
  const corAviso = mode === "dark" ? "#E2BD7E" : "#98671B";
  const corErro = mode === "dark" ? "#F0A5B2" : "#A42E4B";
  const { temPermissao } = useAuth();
  const { marcarNovo } = useClippingNovos();

  const params = useLocalSearchParams<{
    clienteId?: string;
    ano?: string;
    clienteNome?: string;
  }>();

  const clienteId = params.clienteId ? Number(params.clienteId) : null;
  const [anoTexto, setAnoTexto] = useState(
    /^\d{4}$/.test(params.ano ?? "") ? params.ano! : ""
  );
  const ano = Number(anoTexto);
  const clienteNome = params.clienteNome?.trim()
    || (clienteId !== null ? `Cliente #${clienteId}` : "clientes do CSV");

  const podeImportar = temPermissao("CLIPPING", "IMPORTAR");
  const podeBuscarVeiculos =
    temPermissao("VEICULOS", "VISUALIZAR");
  const podeBuscarClientes = temPermissao("CLIENTES", "VISUALIZAR");

  const trava = useRef(false);

  const [arquivo, setArquivo] =
    useState<ArquivoCsvClipping | null>(null);

  const [estrutura, setEstrutura] =useState<EstruturaImportacaoClipping | null>(null);
  const [mapeamento, setMapeamento] =useState<Array<CampoImportacaoClipping | null>>([]);
  const [colunasIgnoradas, setColunasIgnoradas] = useState<Set<number>>(() => new Set());

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
  const [associacoesClientes, setAssociacoesClientes] =
    useState<Record<string, number | null>>({});
  const [nomesClientesAssociados, setNomesClientesAssociados] =
    useState<Record<string, string>>({});

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
  const [resolvendoClientes, setResolvendoClientes] = useState(false);
  const [veiculoEmEdicao, setVeiculoEmEdicao] = useState<string | null>(null);
  const [clienteEmEdicao, setClienteEmEdicao] = useState<string | null>(null);
  const [buscaClientesRevisao, setBuscaClientesRevisao] = useState("");
  const [buscaVeiculosRevisao, setBuscaVeiculosRevisao] = useState("");
  const [buscaPrevia, setBuscaPrevia] = useState("");

  const [filtrosLinhas, setFiltrosLinhas] = useState<Set<"validos" | "avisos" | "erros">>(() => new Set(["validos"]));
  const [filtroAvisos, setFiltroAvisos] = useState<"todos" | "repetidos" | "demais">("todos");
  
  const [detalhesAbertos, setDetalhesAbertos] = useState<Set<number>>(() => new Set());

  const [avisoSaidaAberto, setAvisoSaidaAberto] = useState(false);

  const haColunasPendentes = estrutura?.colunas.some(
  (coluna) =>
    coluna.tem_dados &&
    mapeamento[coluna.indice] === null &&
    !colunasIgnoradas.has(coluna.indice)
) ?? false;

  const clienteValido =
    clienteId === null ||
    (Number.isSafeInteger(clienteId) && clienteId > 0);

  const anoValido =
    anoTexto.length === 4 &&
    Number.isInteger(ano) &&
    ano >= 1000 &&
    ano <= 9999;

  const contextoValido = clienteValido && anoValido;

  function sairParaListagem() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/clipping");
  }

  function voltar() {
    if (ocupado) return;

    if (resolvendoClientes) {
      setResolvendoClientes(false);
      return;
    }

    if (resolvendoVeiculos) {
      setResolvendoVeiculos(false);
      return;
    }

    if (envioPendente) {
      setAvisoSaidaAberto(true);
      return;
    }

    if (previa !== null && resultado === null) {
      setPrevia(null);
      setErro("");
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

      const novoArquivo: ArquivoCsvClipping = {
        uri: selecionado.uri,
        nome: selecionado.name,
        file: selecionado.file,
      };

      const novaEstrutura =
        await inspecionarColunasClipping(novoArquivo);

      setArquivo(novoArquivo);
      setEstrutura(novaEstrutura);
      setMapeamento(
        novaEstrutura.colunas.map(
          (coluna) => coluna.campo
        )
      );
      setColunasIgnoradas(new Set());
      setPrevia(null);
      setResultado(null);
      setAssociacoes({});
      setAssociacoesClientes({});
      setNomesClientesAssociados({});
      setBuscasVeiculos({});
      setSelecionados(new Set());
      setPrecisaNovaPrevia(false);
      setResolvendoVeiculos(false);
      setResolvendoClientes(false);
      setVeiculoEmEdicao(null);
      setClienteEmEdicao(null);
      setBuscaClientesRevisao("");
      setBuscaVeiculosRevisao("");
      setBuscaPrevia("");
      setFiltrosLinhas(
        new Set<"validos" | "avisos" | "erros">(["validos"])
      );
      setDetalhesAbertos(new Set());
      setFiltroAvisos("todos");
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

  async function alterarLinhaCabecalho(
  linhaCabecalho: number
) {
  if (
    !arquivo
    || trava.current
    || envioPendente
  ) {
    return;
  }

  const sugerida = estrutura?.linhas_iniciais.find(
    (item) =>
      item.linha === estrutura.linha_sugerida
  );

  const escolhida = estrutura?.linhas_iniciais.find(
    (item) => item.linha === linhaCabecalho
  );

  if (
    (sugerida?.campos_reconhecidos ?? 0) >= 2
    && escolhida?.campos_reconhecidos === 0
  ) {
    setErro(
      `A linha ${linhaCabecalho} parece conter uma publicação. Use a linha ${estrutura?.linha_sugerida}, que contém os títulos das colunas.`
    );
    return;
  }

  trava.current = true;
  setOcupado(true);
  setErro("");

  try {
    const novaEstrutura =
      await inspecionarColunasClipping(
        arquivo,
        linhaCabecalho
      );

    setEstrutura(novaEstrutura);
    setMapeamento(
      novaEstrutura.colunas.map(
        (coluna) => coluna.campo
      )
    );
    setColunasIgnoradas(new Set());
    setPrevia(null);
    setSelecionados(new Set());
  } catch (error) {
    setErro(
      error instanceof Error
        ? error.message
        : "Não foi possível trocar o cabeçalho."
    );
  } finally {
    trava.current = false;
    setOcupado(false);
  }
}

  function alterarCampoMapeado(
    indice: number,
    campo: CampoImportacaoClipping
  ) {
    setColunasIgnoradas((atual) => {
      const proximo = new Set(atual);
      proximo.delete(indice);
      return proximo;
    });

    setMapeamento((atual) => {
      const proximoCampo =
        atual[indice] === campo ? null : campo;

      return atual.map((valor, posicao) => {
        if (posicao === indice) return proximoCampo;

        if (
          proximoCampo !== null &&
          valor === proximoCampo
        ) {
          return null;
        }

        return valor;
      });
    });
  }

  function ignorarColuna(indice: number) {
    setColunasIgnoradas((atual) =>
      new Set(atual).add(indice)
    );

    setMapeamento((atual) =>
      atual.map((valor, posicao) =>
        posicao === indice ? null : valor
      )
    );
  }

  function desfazerIgnorarColuna(indice: number) {
    setColunasIgnoradas((atual) => {
      const proximo = new Set(atual);
      proximo.delete(indice);
      return proximo;
    });
  }

  async function analisarArquivo() {
    if (
      trava.current ||
      !arquivo ||
      !contextoValido ||
      !podeImportar ||
      !estrutura ||
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
      const clientes = Object.entries(associacoesClientes).map(
        ([nome, cliente_id]) => ({ nome, cliente_id })
      );

      const novaPrevia =
        await obterPreviaImportacaoClipping(
          arquivo,
          clienteId,
          ano,
          veiculos,
          mapeamento,
          estrutura.linha_cabecalho,
          clientes
        );

      setPrevia(novaPrevia);
      setPrecisaNovaPrevia(false);
      setResolvendoVeiculos(false);
      setResolvendoClientes(false);
      setDetalhesAbertos(new Set());
      setFiltroAvisos("todos");
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
          return new Set(
            novaPrevia.linhas
              .filter(
                (linha) =>
                  linha.dados !== null &&
                  linha.erros.length === 0 &&
                  totalAvisosLinha(linha) === 0
              )
              .map((linha) => linha.registro)
          );
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

  function associarCliente(
    nomeNoCsv: string,
    cliente: { id: number; nome: string }
  ) {
    if (ocupado || envioPendente) return;

    if (associacoesClientes[nomeNoCsv] !== cliente.id) {
      setPrecisaNovaPrevia(true);
    }

    setAssociacoesClientes((atuais) => ({
      ...atuais,
      [nomeNoCsv]: cliente.id,
    }));
    setNomesClientesAssociados((atuais) => ({
      ...atuais,
      [nomeNoCsv]: cliente.nome,
    }));
    setClienteEmEdicao(null);
  }

  function criarClienteNaImportacao(nomeNoCsv: string) {
    if (ocupado || envioPendente) return;

    if (associacoesClientes[nomeNoCsv] !== null) {
      setPrecisaNovaPrevia(true);
    }

    setAssociacoesClientes((atuais) => ({
      ...atuais,
      [nomeNoCsv]: null,
    }));
    setClienteEmEdicao(null);
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
            (!semAvisos || totalAvisosLinha(linha) === 0)
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

    const quantidadeAvisos = totalAvisosLinha(item);
    const quantidadeMensagens =
      item.erros.length + quantidadeAvisos;

    const situacao = !valido
      ? "Corrigir no CSV"
      : quantidadeAvisos > 0
        ? "Revisar aviso"
        : "Pronto para importar ao clipping";

    const corSituacao = !valido
      ? corErro
      : quantidadeAvisos > 0
        ? corAviso
        : theme.textoTerciaria;

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
                ? bordaNeutra
                : corErro,
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
            {item.cliente_nome || item.originais.cliente || clienteNome}
            {" · "}
            {item.dados?.data_publicacao
            ? dataISOParaBR(item.dados.data_publicacao)
            : "Data pendente"}
            {" · "}
            {nomeVeiculo}
            {" · "}
            {item.dados?.ano_referencia ?? ano}
        </Text>

        {item.originais.mes_ano || item.originais.dia_mes ? (
          <Text style={[styles.linhaInfo, { color: theme.textoSub }]}>
            No CSV: {[
              item.originais.mes_ano
                ? `mês/ano ${item.originais.mes_ano}`
                : null,
              item.originais.dia_mes
                ? `dia ${item.originais.dia_mes}`
                : null,
            ].filter(Boolean).join(" · ")}
          </Text>
        ) : null}

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
            style={[styles.botaoDetalhes, { borderColor: bordaNeutra }]}
            />
        ) : null}

        {detalhesVisiveis ? (
            <View style={styles.mensagensLinha}>
            {item.erros.map((mensagem, indice) => (
                <Text
                key={`erro-${indice}`}
                style={[styles.erroLinha, { color: corErro }]}
                >
                Erro: {mensagem}
                </Text>
            ))}

            {(item.avisos_link ?? []).map((aviso, indice) => (
              <Text
                key={`link-${indice}`}
                style={[styles.avisoLinha, { color: corAviso }]}
              >
                {aviso.tipo === "invalido"
                  ? "Link inválido: "
                  : aviso.tipo === "no_csv"
                    ? "Repetido no CSV: "
                    : "Já cadastrado: "}
                {aviso.mensagem}
              </Text>
            ))}

            {item.avisos.map((mensagem, indice) => (
                <Text
                key={`aviso-${indice}`}
                style={[styles.avisoLinha, { color: corAviso }]}
                >
                Aviso: {mensagem}
                </Text>
            ))}
            </View>
        ) : null}
        </View>
    );
    }

  if (!podeImportar || !clienteValido) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Importar"
          showBackButton
          onBackPress={voltar}
        />

        <Text style={styles.mensagemCentral}>
          {!clienteValido
            ? "Cliente inválido."
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
          title="Resultado"
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
              {resultado.resumo.clientes_criados} cliente(s) criado(s)
              {" · "}
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
            {resultado.clientes_criados.length > 0 ? (
              <Text style={{ color: theme.textoSub }}>
                Clientes criados: {resultado.clientes_criados
                  .map((cliente) => cliente.nome)
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
              style={{ marginTop: 8, borderColor: bordaNeutra }}
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
                      ? corErro
                      : bordaNeutra,
                },
              ]}
            >
              <Text weight="SemiBold">
                Linha {item.registro}
                {item.cliente_nome ? ` · ${item.cliente_nome}` : ""}
                {` · ${item.status}`}
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
          totalAvisosLinha(linha) === 0
      ).length ?? 0;

    const quantidadeAvisosValidos =
      previa?.linhas.filter(
        (linha) =>
          linha.dados !== null &&
          linha.erros.length === 0 &&
          totalAvisosLinha(linha) > 0
      ).length ?? 0;

    const quantidadeLinksRepetidos =
      previa?.linhas.filter(
        (linha) =>
          linha.dados !== null &&
          linha.erros.length === 0 &&
          temLinkRepetido(linha)
      ).length ?? 0;

    const quantidadeDemaisAvisos =
      quantidadeAvisosValidos - quantidadeLinksRepetidos;

    const selecionadosComAvisos =
      previa?.linhas.filter(
        (linha) =>
          selecionados.has(linha.registro) &&
          totalAvisosLinha(linha) > 0
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

    const clientesNovos = [
      ...new Set(
        (previa?.linhas ?? []).flatMap((linha) =>
          selecionados.has(linha.registro) &&
          linha.erros.length === 0 &&
          linha.cliente_para_criar
            ? [normalizarBusca(linha.cliente_para_criar)]
            : []
        )
      ),
    ];

    const clientesParaRevisao = [
      ...(previa?.clientes_pendentes ?? []),
      ...Object.keys(associacoesClientes),
    ].filter((nome, indice, lista) =>
      lista.findIndex((item) =>
        normalizarBusca(item) === normalizarBusca(nome)
      ) === indice
    );

    const clientesVisiveis = clientesParaRevisao.filter((nome) =>
      normalizarBusca(nome).includes(normalizarBusca(buscaClientesRevisao))
    );

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

    const veiculosVisiveis = veiculosParaRevisao.filter((nome) =>
      normalizarBusca(nome).includes(normalizarBusca(buscaVeiculosRevisao))
    );

    const termoPrevia = normalizarBusca(buscaPrevia);
    const linhasExibidas =
      previa?.linhas.filter((linha) => {
        // Nenhum marcado = mostrar todas as linhas.
        const correspondeBusca = !termoPrevia || normalizarBusca([
          String(linha.registro),
          linha.cliente_nome,
          linha.dados?.pauta,
          linha.veiculo_nome,
          linha.dados?.data_publicacao,
          linha.dados?.ano_referencia,
          ...(linha.dados?.categorias ?? []),
          ...Object.values(linha.originais),
          ...linha.erros,
          ...linha.avisos,
          ...(linha.avisos_link ?? []).map(
            (aviso) => aviso.mensagem
          ),
        ].filter(Boolean).join(" ")).includes(termoPrevia);

        if (!correspondeBusca) return false;
        if (filtrosLinhas.size === 0) return true;

        if (linha.erros.length > 0 || linha.dados === null) {
          return filtrosLinhas.has("erros");
        }

        if (totalAvisosLinha(linha) > 0) {
          if (!filtrosLinhas.has("avisos")) return false;

          if (filtroAvisos === "repetidos") {
            return temLinkRepetido(linha);
          }

          if (filtroAvisos === "demais") {
            return !temLinkRepetido(linha);
          }

          return true;
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
            title="Importar"
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
            {clienteId === null
              ? "O CSV pode conter vários clientes. Associe a coluna Cliente antes de abrir a prévia."
              : `Você iniciou por ${clienteNome}. Se o CSV trouxer outros clientes, cada linha seguirá o nome informado no arquivo.`}
            Cada linha usa o ano identificado no CSV. O ano
            padrão abaixo vale somente quando ela não informar um.
            </Text>

            <Input
              label="ANO PADRÃO DO ARQUIVO"
              value={anoTexto}
              onChangeText={(valor) =>
                setAnoTexto(valor.replace(/\D/g, "").slice(0, 4))
              }
              keyboardType="number-pad"
              maxLength={4}
              placeholder="Ex.: 2026"
              error={anoTexto !== "" && !anoValido
                ? "Informe um ano válido com quatro dígitos."
                : undefined}
              containerStyle={{ marginTop: 14 }}
              style={{
                color: theme.texto,
                backgroundColor: theme.background,
                borderColor: bordaNeutra,
              }}
            />

            <View
            style={[
                styles.painel,
                {
                backgroundColor: theme.background,
                borderColor: bordaNeutra,
                },
            ]}
            >
            <Ionicons
                name="document-text-outline"
                size={30}
                color={corAcao}
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
                style={{ marginTop: 16, borderColor: bordaNeutra }}
            />
            </View>

            {estrutura ? (
              <MapeamentoColunasClipping
                estrutura={estrutura}
                mapeamento={mapeamento}
                ignoradas={colunasIgnoradas}
                ocupado={ocupado}
                onAlterarCampo={alterarCampoMapeado}
                onIgnorarColuna={ignorarColuna}
                onAlterarCabecalho={(linha) =>
                  void alterarLinhaCabecalho(linha)
                }
                onDesfazerIgnorarColuna={desfazerIgnorarColuna}
              />
            ) : null}

            {clienteId === null && estrutura && !mapeamento.includes("cliente") ? (
              <Text style={[styles.erroGeral, { color: corErro }]}>
                Associe uma coluna ao campo Cliente para importar pela tela inicial.
              </Text>
            ) : null}
            
            {erro ? (
            <Text style={[styles.erroGeral, { color: corErro }]}>
                {erro}
            </Text>
            ) : null}
        </ScrollView>

        <View
            style={[
            styles.rodape,
            {
                backgroundColor: theme.background,
                borderColor: bordaNeutra,
            },
            ]}
        >
            <Button
              title="VER PRÉVIA"
              disabled={
                !arquivo
                || !estrutura
                || ocupado
                || !anoValido
                || (clienteId === null && !mapeamento.includes("cliente"))
                || haColunasPendentes
                || !mapeamento.some(
                  (campo) => campo !== null
                )
              }
              loading={ocupado}
              onPress={() => void analisarArquivo()}
              style={{ backgroundColor: fundoSelecionado, borderColor: corAcao }}
            />
          
        </View>
      </View>
    );
    }

    if (resolvendoClientes) {
      return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <Header
            title="Associar clientes"
            showBackButton
            onBackPress={voltar}
          />

          <FlatList
            data={clientesVisiveis}
            keyExtractor={(nome) => nome}
            contentContainerStyle={styles.conteudo}
            ListHeaderComponent={
              <View style={{ marginBottom: 18 }}>
                <Text weight="Bold" style={styles.etapaTitulo}>
                  Clientes do CSV
                </Text>
                <Text style={[styles.etapaDescricao, { color: theme.textoSub }]}>
                  Associe nomes a clientes cadastrados ou confira quais serão criados.
                  Nenhum cliente é cadastrado antes da confirmação.
                </Text>
                <Text style={[styles.etapaDescricao, { color: theme.texto }]}>
                  {clientesParaRevisao.length} nome(s) para conferir
                </Text>
                <Input
                  label="BUSCAR NOME DO CSV"
                  value={buscaClientesRevisao}
                  onChangeText={setBuscaClientesRevisao}
                  placeholder="Cliente no arquivo"
                  containerStyle={{ marginTop: 14 }}
                  clearable
                />
                {erro ? (
                  <Text style={[styles.erroGeral, { color: corErro }]}>{erro}</Text>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <Text style={{ color: theme.textoSub }}>
                Nenhum cliente encontrado nesta busca.
              </Text>
            }
            renderItem={({ item: nomeNoCsv }) => {
              const escolhaFeita = Object.prototype.hasOwnProperty.call(
                associacoesClientes,
                nomeNoCsv
              );
              const id = escolhaFeita
                ? associacoesClientes[nomeNoCsv]
                : undefined;
              const ambiguo = previa.clientes_ambiguos.some(
                (nome) => normalizarBusca(nome) === normalizarBusca(nomeNoCsv)
              );
              const jaExiste = previa.clientes_existentes.some(
                (nome) => normalizarBusca(nome) === normalizarBusca(nomeNoCsv)
              );
              const podeCriar = previa.pode_criar_clientes && !jaExiste;
              const status = typeof id === "number"
                ? `Associado a ${nomesClientesAssociados[nomeNoCsv] ?? `cliente #${id}`}`
                : ambiguo
                  ? "Há cadastros com o mesmo nome. Escolha um deles."
                  : podeCriar
                    ? "Será criado se houver linhas marcadas deste cliente."
                    : "Associe a um cliente existente para importar suas linhas.";

              return (
                <View style={[
                  styles.painel,
                  {
                    backgroundColor: theme.background,
                    borderColor: bordaNeutra,
                    marginTop: 0,
                    marginBottom: 12,
                  },
                ]}>
                  <Text weight="SemiBold">Nome no CSV: {nomeNoCsv}</Text>
                  <Text style={{
                    color: typeof id === "number" ? corAcao : corAviso,
                    fontSize: 12,
                    marginTop: 8,
                  }}>
                    {status}
                  </Text>

                  {clienteEmEdicao === nomeNoCsv && podeBuscarClientes ? (
                    <View>
                      <ClienteImportacaoSelector
                        nomeNoCsv={nomeNoCsv}
                        disabled={ocupado || Boolean(envioPendente)}
                        onSelect={(cliente) => associarCliente(nomeNoCsv, cliente)}
                      />
                      <Button
                        title="FECHAR BUSCA"
                        variant="outline"
                        size="small"
                        onPress={() => setClienteEmEdicao(null)}
                        style={{ marginTop: 8, borderColor: bordaNeutra }}
                      />
                    </View>
                  ) : (
                    <>
                      {podeBuscarClientes ? (
                        <Button
                          title={typeof id === "number"
                            ? "ALTERAR ASSOCIAÇÃO"
                            : "BUSCAR CLIENTE EXISTENTE"}
                          variant="outline"
                          size="small"
                          disabled={ocupado || Boolean(envioPendente)}
                          onPress={() => setClienteEmEdicao(nomeNoCsv)}
                          style={{ marginTop: 12, borderColor: bordaNeutra }}
                        />
                      ) : (
                        <Text style={[styles.etapaDescricao, { color: theme.textoSub }]}>
                          Sua permissão não permite procurar clientes existentes.
                        </Text>
                      )}

                      {podeCriar && typeof id === "number" ? (
                        <Button
                          title="CRIAR COMO NOVO CLIENTE"
                          variant="outline"
                          size="small"
                          disabled={ocupado || Boolean(envioPendente)}
                          onPress={() => criarClienteNaImportacao(nomeNoCsv)}
                          style={{ marginTop: 8, borderColor: bordaNeutra }}
                        />
                      ) : null}
                    </>
                  )}
                </View>
              );
            }}
          />

          <View style={[
            styles.rodape,
            { backgroundColor: theme.background, borderColor: bordaNeutra },
          ]}>
            <Button
              title={precisaNovaPrevia ? "ATUALIZAR PRÉVIA" : "VOLTAR À PRÉVIA"}
              loading={ocupado}
              disabled={ocupado}
              onPress={() => {
                if (precisaNovaPrevia) void analisarArquivo();
                else setResolvendoClientes(false);
              }}
              style={{ backgroundColor: fundoSelecionado, borderColor: corAcao }}
            />
          </View>
        </View>
      );
    }

    // tela auxiliar para veículos desconhecidos
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
            data={veiculosVisiveis}
            keyExtractor={(nome) => nome}
            contentContainerStyle={styles.conteudo}
            ListHeaderComponent={
            <View style={{ marginBottom: 18 }}>
                <Text
                weight="Bold"
                style={styles.etapaTitulo}
                >
                Veículos do CSV
                </Text>

                <Text
                style={[
                  styles.etapaDescricao,
                  { color: theme.textoSub },
                ]}
              >
                {previa.pode_criar_veiculos
                  ? "Associe os veículos desconhecidos a cadastros existentes ou deixe-os para criação automática ao importar. Depois, clique para atualizar a prévia."
                  : "Associe os veículos desconhecidos a cadastros existentes ou mantenha o vínculo pendente. Você não tem permissão para criar veículos. Depois, atualize a prévia."}
              </Text>
                <Text style={[styles.etapaDescricao, { color: theme.texto }]}>
                  {quantidadeVeiculosPendentes} veículo(s) não cadastrado(s) na assessoria.
                </Text>

                <Input
                  label="BUSCAR NOME DO CSV"
                  value={buscaVeiculosRevisao}
                  onChangeText={setBuscaVeiculosRevisao}
                  placeholder="Veículo no arquivo"
                  containerStyle={{ marginTop: 14 }}
                  clearable
                />

                {erro ? <Text style={[styles.erroGeral, { color: corErro }]}>{erro}</Text> : null}
            </View>
            }
            ListEmptyComponent={
              <Text style={{ color: theme.textoSub }}>
                Nenhum veículo encontrado nesta busca.
              </Text>
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
                  ? corAviso
                  : corAcao;

                return (
                    <View
                    style={[
                        styles.painel,
                        {
                        backgroundColor: theme.background,
                        borderColor: bordaNeutra,
                        marginTop: 0,
                        marginBottom: 12,
                        },
                    ]}
                    >
                    <Text weight="SemiBold">
                        Nome no CSV: {nomeOriginal}
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
                            style={{ borderColor: bordaNeutra }}
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
                            style={{ marginTop: 12, borderColor: bordaNeutra }}
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
                            style={{ marginTop: 8, borderColor: bordaNeutra }}
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
                borderColor: bordaNeutra,
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
            style={{ backgroundColor: fundoSelecionado, borderColor: corAcao }}
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
        title="Revisar"
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
                3. Revise os registros
            </Text>

            <Text
                style={[
                styles.etapaDescricao,
                { color: theme.textoSub },
                ]}
            >
                {clienteId === null ? "Clientes do CSV" : clienteNome} · ano padrão {ano}
            </Text>
            {erro ? (
                <Text style={[styles.erroGeral, { color: corErro }]}>
                    {erro}
                </Text>
            ) : null}

            <View
                style={[
                styles.arquivoPainel,
                { borderColor: bordaNeutra },
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
                style={[styles.trocarBotao, { borderColor: bordaNeutra }]}
                />
            </View>

            {envioPendente ? (
                <Text style={[styles.avisoLinha, { color: corAviso }]}>
                A resposta da confirmação pode ter se
                perdido. Use o botão abaixo para reenviar
                exatamente a mesma solicitação.
                </Text>
            ) : null}

            {clientesParaRevisao.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Revisar clientes do CSV"
                disabled={ocupado || Boolean(envioPendente)}
                onPress={() => setResolvendoClientes(true)}
                style={[
                  styles.arquivoPainel,
                  {
                    borderColor: bordaNeutra,
                    backgroundColor: theme.background,
                    opacity: ocupado || envioPendente ? 0.5 : 1,
                    marginTop: 0,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text weight="SemiBold">Revisão de clientes</Text>
                  <Text style={[styles.arquivoAjuda, { color: theme.texto, lineHeight: 17 }]}>
                    {precisaNovaPrevia
                      ? "As associações mudaram. Atualize a prévia antes de importar."
                      : `${clientesNovos.length} cliente(s) serão criados pelas linhas marcadas; confira os nomes desconhecidos.`}
                  </Text>
                  <Text style={[styles.arquivoAjuda, { color: corAcao }]}>
                    Conferir associações e cadastros
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textoSub} />
              </TouchableOpacity>
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
                    borderColor: bordaNeutra,
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
                      { color: corAcao },
                    ]}
                  >
                    Clique aqui para ver mais detalhes
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
                <Text style={[styles.avisoLinha, { color: corAviso }]}>
                Você mudou uma associação. A lista
                abaixo ainda mostra a prévia anterior.
                Atualize-a antes de importar.
                </Text>
            ) : null}

            {previa.ignoradas.length > 0 ? (
                <Text style={[styles.avisoLinha, { color: corAviso, marginBottom: 10, marginTop: 0}]}>
                Colunas não utilizadas:{" "}
                {previa.ignoradas.join(", ")}
                </Text>
            ) : null}

            <Input
              label="BUSCAR NA PRÉVIA"
              value={buscaPrevia}
              onChangeText={setBuscaPrevia}
              placeholder="Cliente, veículo, pauta ou linha"
              containerStyle={{ marginBottom: 14 }}
              clearable
            />
            {buscaPrevia.trim() ? (
              <Text style={[styles.etapaDescricao, { color: theme.textoSub, marginTop: 0, marginBottom: 12 }]}>
                {linhasExibidas.length} de {previa.linhas.length} linha(s) encontrada(s).
                A busca não altera as linhas marcadas.
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
                    ? corErro
                    : valor === "avisos"
                      ? corAviso
                      : theme.texto;

                return (
                  <TouchableOpacity
                    key={valor}
                    activeOpacity={0.8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: ativo }}
                    onPress={() => {
                      setFiltroAvisos("todos");
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
                        backgroundColor: ativo
                          ? fundoFiltroAtivo
                          : theme.background,
                        borderColor: ativo
                          ? corAcao
                          : bordaNeutra,
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
                            ? corAcao
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

            {filtrosLinhas.has("avisos") &&
              quantidadeAvisosValidos > 0 ? (
                <View style={{ marginBottom: 14 }}>
                  <Text
                    weight="SemiBold"
                    style={{
                      color: theme.textoSub,
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    MOSTRAR AVISOS
                  </Text>

                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {([
                      {
                        id: "todos",
                        nome: "TODOS",
                        total: quantidadeAvisosValidos,
                      },
                      {
                        id: "repetidos",
                        nome: "LINKS REPETIDOS",
                        total: quantidadeLinksRepetidos,
                      },
                      {
                        id: "demais",
                        nome: "DEMAIS AVISOS",
                        total: quantidadeDemaisAvisos,
                      },
                    ] as const).map((opcao) => {
                      const ativo = filtroAvisos === opcao.id;

                      return (
                        <TouchableOpacity
                          key={opcao.id}
                          activeOpacity={0.8}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: ativo }}
                          onPress={() => {
                            setFiltroAvisos(opcao.id);
                            setFiltrosLinhas(
                              new Set<
                                "validos" | "avisos" | "erros"
                              >(["avisos"])
                            );
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 58,
                            borderWidth: ativo ? 2 : 1,
                            borderColor: ativo ? corAcao : bordaNeutra,
                            borderRadius: 12,
                            backgroundColor: ativo
                              ? fundoFiltroAtivo
                              : theme.background,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 4,
                            paddingVertical: 6,
                          }}
                        >
                          <Text
                            weight="Bold"
                            style={{
                              color: ativo ? corAcao : theme.texto,
                              fontSize: 14,
                            }}
                          >
                            {opcao.total}
                          </Text>

                          <Text
                            weight="SemiBold"
                            style={{
                              color: ativo ? corAcao : theme.textoSub,
                              fontSize: 10,
                              textAlign: "center",
                              marginTop: 2,
                            }}
                          >
                            {opcao.nome}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

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
                    style={{ color: corAcao, fontSize: 12 }}
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
                    style={[styles.acaoSelecao, { borderColor: bordaNeutra }]}
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
                    style={[styles.acaoSelecao, { borderColor: bordaNeutra }]}
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
            borderColor: bordaNeutra,
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
            style={{ backgroundColor: fundoSelecionado, borderColor: corAcao }}
        />  
        </View>

        <FeedbackAlert
        visible={confirmacaoAberta}
        variant="warning"
        title="Confirmar importação?"
        message={
            `${clientesNovos.length} cliente(s) novo(s) serão criados. ` +
            `${veiculosNovos.length} veículo(s) novo(s) serão criados. ` +
            `${vinculosPendentes} clipping(s) ficarão com vínculo pendente. ` +
            `${selecionados.size} registro(s) serão criados para os clientes identificados na prévia. ` +
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

    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  erroGeral: {

    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },

  avisoLinha: {

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