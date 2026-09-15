import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Keyboard
} from "react-native";

import { useEffect, useRef, useState } from "react";
import { useIsFocused, useLocalSearchParams, useNavigation,useRouter,} from "expo-router";

import { CommonActions, usePreventRemove,} from "expo-router/react-navigation";
import { Ionicons } from "@expo/vector-icons";
import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import VeiculoSelector, {
  SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";
import ClippingContexto from "@/components/clipping/ClippingContexto";
import TierSelector from "@/components/forms/TierSelector";
import ClippingDataInput from "@/components/clipping/ClippingDataInput";
import ClippingTrechoInput from "@/components/clipping/ClippingTrechoInput";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ClippingVeiculoCadastro from "@/components/clipping/ClippingVeiculoCadastro";
import AvisoClippingSalvo from "@/components/clipping/avisoClippingSalvo";
import ClippingArquivosInput, {
  type ArquivoRascunho,
} from "@/components/clipping/ClippingArquivosInput";

import { dataBRParaISO,tempoParaSegundos, dataISOParaBR } from "@/utils/clippingFormatacao";
import { type ErrosClipping, identificarCampoErroClipping, normalizarCategorias,obterAnoDaPublicacao, validarFormularioClipping,} from "@/utils/validarClipping";
import { useClippingNovos } from "@/contexts/ClippingNovosContext";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Tier } from "@/constants/tier";

import {
  type DadosClipping,
  type Clipping,
  criarClipping,
  listarPautas,
  ErroApiClipping,
  enviarAnexo,
} from "@/services/api/clipping"; 

const CATEGORIAS_SUGERIDAS = [
  "Site",
  "TV",
  "Rádio",
  "Jornal",
  "Revista",
  "Podcast",
  "Redes sociais",
];

function primeiroParametro(
  valor: string | string[] | undefined
): string {
  return Array.isArray(valor)
    ? valor[0] ?? ""
    : valor ?? "";
}

export default function NovoClipping() {
  const params = useLocalSearchParams<{
    ano?: string | string[];
    clienteId?: string | string[];
    clienteNome?: string | string[];
  }>();

  const anoParametro = primeiroParametro(params.ano);
  const clienteParametro = primeiroParametro(params.clienteId);
  const nomeParametro = primeiroParametro(params.clienteNome);

  const numeroCliente = Number(clienteParametro);

  const clienteInicial =
    Number.isSafeInteger(numeroCliente) && numeroCliente > 0
      ? numeroCliente
      : null;

  const anoInicial = anoParametro
    ? Number(anoParametro)
    : new Date().getFullYear();

  return (
    <FormularioNovoClipping
      key={JSON.stringify([anoParametro, clienteParametro])}
      anoInicial={anoInicial}
      clienteInicial={clienteInicial}
      nomeClienteInicial={nomeParametro.trim()}
    />
  );
}

function FormularioNovoClipping({
  anoInicial,
  clienteInicial,
  nomeClienteInicial,
}: {
  anoInicial: number;
  clienteInicial: number | null;
  nomeClienteInicial: string;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const focado = useIsFocused();

  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const { marcarNovo } = useClippingNovos();

  const [anoReferencia, setAnoReferencia] = useState(anoInicial);

  const [clienteId, setClienteId] = useState<number | null>(
    clienteInicial
  );

  const [clienteNome, setClienteNome] = useState(
    clienteInicial !== null ? nomeClienteInicial : ""
  );

  const [dataPublicacao, setDataPublicacao] = useState("");

  const anoDaData = obterAnoDaPublicacao(dataPublicacao);
  const ano = anoDaData ?? anoReferencia;
  const [pauta, setPauta] = useState("");
  const [programaSecao, setProgramaSecao] = useState("");
  const [categoriasTexto, setCategoriasTexto] = useState("");
  const [link, setLink] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [inicioSegundos, setInicioSegundos] = useState("");
  const [fimSegundos, setFimSegundos] = useState("");

  const [veiculo, setVeiculo] =
    useState<SelecaoVeiculo>({
      id: null,
      nome: "",
    });

  const [tier, setTier] = useState<Tier | null>(null);

  const [pautasSugeridas, setPautasSugeridas] =
    useState<string[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<ErrosClipping>({});
  const [erroGeral, setErroGeral] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const travaSalvar = useRef(false);
  const [nomeCadastroVeiculo, setNomeCadastroVeiculo] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState("");
  const [falha, setFalha] = useState<string | null>(null);

  const podeAnexar = temPermissao("CLIPPING", "ANEXAR");
  const [arquivos, setArquivos] = useState<ArquivoRascunho[]>([]);
  const [selecionandoArquivos, setSelecionandoArquivos] = useState(false);
  const [mensagemEnvio, setMensagemEnvio] = useState("");
  const [conclusaoComFalhas, setConclusaoComFalhas] =
    useState<{
      clipping: Clipping;
      adicionarOutro: boolean;
      falhas: string[];
    } | null>(null);

  const [ultimoCriado, setUltimoCriado] =
  useState<Clipping | null>(null);
    
  const [destinoAposSalvar, setDestinoAposSalvar] =
    useState<Clipping | null>(null);

  const navegacaoIniciada = useRef(false);

  const bloqueado =
    salvando ||
    selecionandoArquivos ||
    destinoAposSalvar !== null ||
    conclusaoComFalhas !== null;

  // evita remover o cadastro enquanto a API está salvando
  usePreventRemove(
    salvando || selecionandoArquivos,
    () => {}
  );

  useEffect(() => {
    if (
      !destinoAposSalvar ||
      salvando ||
      !focado ||
      navegacaoIniciada.current
    ) {
      return;
    }

    navegacaoIniciada.current = true;

    const clipping = destinoAposSalvar;
    const estado = navigation.getState();

    const anterior = estado
      ? estado.routes[estado.index - 1]
      : undefined;

    const parametrosAnteriores = anterior?.params as
      | {
          id?: string | number;
          ano?: string | number;
        }
      | undefined;

    const anteriorEhListagem =
      anterior?.name === "cliente/[id]/index" ||
      anterior?.name === "cliente/[id]";

    const mesmaListagem =
      anteriorEhListagem &&
      Number(parametrosAnteriores?.id) === clipping.cliente_id &&
      Number(parametrosAnteriores?.ano) === clipping.ano_referencia;

    if (mesmaListagem && anterior && estado) {
      navigation.dispatch({
        ...CommonActions.setParams({
          clienteNome: clipping.cliente_nome,
        }),
        source: anterior.key,
        target: estado.key,
      });

      router.back();
      return;
    }

    router.replace({
      pathname: "/clipping/cliente/[id]",
      params: {
        id: String(clipping.cliente_id),
        ano: String(clipping.ano_referencia),
        clienteNome: clipping.cliente_nome,
      },
    });
  }, [
    destinoAposSalvar,
    salvando,
    focado,
    navigation,
    router,
  ]);

  const podeCriarVeiculo = temPermissao("VEICULOS", "CRIAR");

  useEffect(() => {
    if (!clienteId || pauta.trim().length < 2) {
        return;
    }

    let cancelado = false;

    const atraso = setTimeout(async () => {
        try {
        const resposta = await listarPautas(
            clienteId,
            pauta
        );

        if (!cancelado) {
            setPautasSugeridas(resposta.pautas);
        }
        } catch {
        if (!cancelado) {
            setPautasSugeridas([]);
        }
        }
    }, 300);

    return () => {
        cancelado = true;
        clearTimeout(atraso);
    };
    }, [clienteId, pauta]);

  function adicionarCategoria(categoria: string) {
    if (travaSalvar.current) return;

    setCategoriasTexto((atual) =>
      normalizarCategorias(
        atual ? `${atual}, ${categoria}` : categoria
      ).join(", ")
    );

    limparErro("categorias");
  }

  function limparErro(
    ...campos: (keyof ErrosClipping)[]
  ) {
    setErros((atual) => {
      const novos = { ...atual };

      campos.forEach((campo) => {
        delete novos[campo];
      });

      return novos;
    });

    setErroGeral("");
    setSucesso("");
  }

  function alterarVeiculo(selecao: SelecaoVeiculo) {
    const mudouVeiculo = selecao.id !== veiculo.id;
    const limpouCampo = !selecao.nome.trim();

    setVeiculo(selecao);

    if (mudouVeiculo || limpouCampo) {
      setTier(
        selecao.id === null
          ? null
          : selecao.tier ?? null
      );
    }

    limparErro("veiculo", "tier");
  }

  function exibirErroDaApi(error: unknown) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar o clipping.";

    const campo =
      error instanceof ErroApiClipping &&
      error.status === 422
        ? identificarCampoErroClipping(mensagem)
        : null;

    if (campo) {
      setErros((atual) => ({
        ...atual,
        [campo]: mensagem,
      }));

      setErroGeral("Revise o campo destacado antes de salvar.");
      return;
    }

    setErroGeral(mensagem);
    setFalha(mensagem);
  }

  function limparCamposParaOutro() {
    setPauta("");
    setProgramaSecao("");
    setCategoriasTexto("");
    setLink("");
    setObservacoes("");
    setInicioSegundos("");
    setFimSegundos("");
    setVeiculo({
      id: null,
      nome: "",
    });
    setTier(null);
    setPautasSugeridas([]);
  }

  function cancelarCadastro() {
    if (travaSalvar.current || bloqueado) {
      return;
    }

    Keyboard.dismiss();

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/clipping");
  }

  function visualizarUltimoCriado() {
    if (!ultimoCriado || travaSalvar.current || bloqueado) {
      return;
    }

    Keyboard.dismiss();

    router.push({
      pathname: "/clipping/[id]",
      params: {
        id: String(ultimoCriado.id),
      },
    });
  }

  function finalizarCadastro(
    clipping: Clipping,
    adicionarOutro: boolean
  ) {
    setClienteId(clipping.cliente_id);
    setClienteNome(clipping.cliente_nome);
    setAnoReferencia(clipping.ano_referencia);
    setDataPublicacao(
      dataISOParaBR(clipping.data_publicacao)
    );

    setArquivos([]);
    setConclusaoComFalhas(null);
    setMensagemEnvio("");
    setErros({});
    setErroGeral("");
    setSucesso("");

    if (adicionarOutro) {
      limparCamposParaOutro();
      setUltimoCriado(clipping);

      travaSalvar.current = false;
      setSalvando(false);

      scrollRef.current?.scrollTo({
        y: 0,
        animated: true,
      });

      return;
    }

    travaSalvar.current = true;
    setDestinoAposSalvar(clipping);
    setSalvando(false);
  }

  async function salvar(adicionarOutro: boolean) {
    if (
      travaSalvar.current ||
      bloqueado ||
      nomeCadastroVeiculo !== null
    ) {
      return;
    }

    setSucesso("");
    setErroGeral("");

    if (!temPermissao("CLIPPING", "CRIAR")) {
      setFalha(
        "Você não possui permissão para criar clippings."
      );
      return;
    }

    if (arquivos.length > 0 && !podeAnexar) {
      setFalha(
        "Você não possui permissão para enviar anexos. Remova os arquivos selecionados para salvar sem anexos."
      );
      return;
    }

    const errosValidacao = validarFormularioClipping({
      clienteId,
      anoReferencia: ano,
      dataPublicacao,
      categorias: categoriasTexto,
      programaSecao,
      pauta,
      veiculoId: veiculo.id,
      veiculoNome: veiculo.nome,
      tier,
      inicioSegundos,
      fimSegundos,
      link,
      observacoes,
    });

    setErros(errosValidacao);

    if (Object.keys(errosValidacao).length > 0) {
      setErroGeral(
        "Revise os campos destacados antes de salvar."
      );
      return;
    }

    const dados: DadosClipping = {
      cliente_id: clienteId as number,
      ano_referencia: ano,
      data_publicacao: dataBRParaISO(dataPublicacao),
      veiculo_id: veiculo.id,

      // envia tambem null, preservando "Não definido"
      tier,

      categorias: normalizarCategorias(categoriasTexto),
      programa_secao: programaSecao.trim() || null,
      pauta: pauta.trim() || null,
      link: link.trim() || null,
      observacoes: observacoes.trim() || null,
      inicio_segundos: tempoParaSegundos(inicioSegundos),
      fim_segundos: tempoParaSegundos(fimSegundos),
    };

        travaSalvar.current = true;
    setSalvando(true);
    setFalha(null);
    setMensagemEnvio("Salvando clipping...");
    Keyboard.dismiss();

    let clipping: Clipping;

    try {
      clipping = await criarClipping(dados);
    } catch (error) {
      exibirErroDaApi(error);

      setMensagemEnvio("");
      travaSalvar.current = false;
      setSalvando(false);
      return;
    }

    // A criação foi confirmada. Este registro já existe.
    marcarNovo(clipping.id);

    const falhas: string[] = [];

    for (let indice = 0; indice < arquivos.length; indice += 1) {
      const arquivo = arquivos[indice];

      setMensagemEnvio(
        `Enviando arquivo ${indice + 1} de ${arquivos.length}...`
      );

      try {
        await enviarAnexo(clipping.id, arquivo);
      } catch (error) {
        const motivo =
          error instanceof Error
            ? error.message
            : "Não foi possível confirmar o envio.";

        falhas.push(`${arquivo.nome}: ${motivo}`);
      }
    }

    setMensagemEnvio("");

    if (falhas.length > 0) {
      setConclusaoComFalhas({
        clipping,
        adicionarOutro,
        falhas,
      });

      travaSalvar.current = false;
      setSalvando(false);
      return;
    }

    finalizarCadastro(clipping, adicionarOutro);
  }

  if (conclusaoComFalhas) {
    const conclusao = conclusaoComFalhas;

    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Clipping cadastrado"
          showBackButton
          onBackPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/clipping");
            }
          }}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text
            weight="SemiBold"
            style={{ fontSize: 16, marginBottom: 10 }}
          >
            O clipping foi salvo
          </Text>

          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              marginBottom: 16,
            }}
          >
            Ocorreram falhas no envio inicial de alguns arquivos e eles não foram enviados.
            Confira nos detalhes quais anexos chegaram antes
            de enviá-los novamente.
          </Text>

          {conclusao.falhas.map((falha, indice) => (
            <Text
              key={`${indice}-${falha}`}
              style={{
                fontSize: 12,
                lineHeight: 18,
                color: "#DC2626",
                marginBottom: 10,
              }}
            >
              {falha}
            </Text>
          ))}

          <Button
            title="VER DETALHES"
            onPress={() => {
              router.push({
                pathname: "/clipping/[id]",
                params: {
                  id: String(conclusao.clipping.id),
                },
              });
            }}
            style={{ marginTop: 12 }}
          />

          <Text
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: theme.textoSub,
              marginVertical: 14,
            }}
          >
            Você também pode continuar cadastrando e adicionar os arquivos
            posteriormente. Esse clipping não será cadastrado novamente.
          </Text>

          <Button
            title={
              conclusao.adicionarOutro
                ? "ADICIONAR OUTRO"
                : "VOLTAR À LISTA"
            }
            variant="outline"
            onPress={() => {
              finalizarCadastro(
                conclusao.clipping,
                conclusao.adicionarOutro
              );
            }}
          />
        </ScrollView>
      </View>
    );
  }

  if (!temPermissao("CLIPPING", "CRIAR")) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Novo clipping"
          showBackButton
          onBackPress={cancelarCadastro}
        />

        <View style={styles.permissionBox}>
          <Ionicons
            name="lock-closed-outline"
            size={36}
            color={theme.primaria}
          />

          <Text
            weight="SemiBold"
            style={styles.permissionTitle}
          >
            Acesso restrito
          </Text>

          <Text
            style={[
              styles.permissionText,
              { color: theme.textoSub },
            ]}
          >
            Você não possui permissão para criar clippings.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title="Novo clipping"
        showBackButton
        onBackPress={cancelarCadastro}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {ultimoCriado && !bloqueado ? (
          <AvisoClippingSalvo
            mensagem="Clipping cadastrado. Cliente, ano e data mantidos para o próximo cadastro."
            onVisualizar={visualizarUltimoCriado}
            onFechar={() => setUltimoCriado(null)}
          />
        ) : null} 
        {sucesso ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.feedbackSucesso,
              { borderColor: theme.borda },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={21}
              color="#22C55E"
            />

            <Text
              style={{
                flex: 1,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {sucesso}
            </Text>
          </View>
        ) : null}
        <ClippingContexto
          clienteId={clienteId}
          clienteNome={clienteNome}
          ano={ano}
          anoPelaData={anoDaData !== null}
          erroCliente={erros.cliente}
          erroAno={erros.anoReferencia}
          disabled={bloqueado}
          onCliente={(cliente) => {
            if (cliente.id !== clienteId) {
              setPautasSugeridas([]);
            }

            setClienteId(cliente.id);
            setClienteNome(cliente.nome);
            limparErro("cliente");
          }}
          onAno={(novoAno) =>  {
            setAnoReferencia(novoAno);
            limparErro("anoReferencia");
          }}
        />

        <Text weight="Bold" style={styles.sectionTitle}>
          DADOS DA PUBLICAÇÃO
        </Text>

        <ClippingDataInput
          value={dataPublicacao}
          anoReferencia={ano}
          onChangeText={(texto) => {
            setDataPublicacao(texto);

            const novoAno = obterAnoDaPublicacao(texto);

            if (novoAno !== null) {
              setAnoReferencia(novoAno);
              limparErro("anoReferencia");
            }

            limparErro("dataPublicacao");
          }}
          error={erros.dataPublicacao}
          disabled={bloqueado}
        />

        <Input
          label="PAUTA"
          value={pauta}
          onChangeText={(texto) => {
            setPauta(texto);

            if (texto.trim().length < 2) {
              setPautasSugeridas([]);
            }

            limparErro("pauta");
          }}
          error={erros.pauta}
          placeholder="Assunto ou título da matéria"
          autoCapitalize="sentences"
          editable={!bloqueado}
        />

        {pautasSugeridas.length > 0 ? (
          <View
            style={[
              styles.suggestions,
              { borderColor: theme.borda },
            ]}
          >
            {pautasSugeridas.map((sugestao) => (
              <TouchableOpacity
                key={sugestao}
                onPress={() => {
                  setPauta(sugestao);
                  setPautasSugeridas([]);
                }}
                style={styles.suggestion}
                disabled={bloqueado}
              >
                <Ionicons
                  name="return-down-forward-outline"
                  size={16}
                  color={theme.primaria}
                />

                <Text
                  style={[
                    styles.suggestionText,
                    { color: theme.texto },
                  ]}
                >
                  {sugestao}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Input
          label="PROGRAMA / SEÇÃO"
          value={programaSecao}
          onChangeText={(texto) => {
            setProgramaSecao(texto);
            limparErro("programaSecao");
          }}
          placeholder="Ex.: Jornal da manhã"
          error={erros.programaSecao}
          editable={!bloqueado}
        />

        <Input
          label="CATEGORIAS"
          value={categoriasTexto}
          onChangeText={(texto) => {
            setCategoriasTexto(texto);
            limparErro("categorias");
          }}
          placeholder="Separe as categorias por vírgula"
          error={erros.categorias}
          editable={!bloqueado}
        />

        <View style={styles.chips}>
          {CATEGORIAS_SUGERIDAS.map((categoria) => (
            <TouchableOpacity
              key={categoria}
              onPress={() =>
                adicionarCategoria(categoria)
              }
              style={[
                styles.chip,
                { borderColor: theme.borda },
              ]}
              disabled={bloqueado}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: theme.texto },
                ]}
              >
                + {categoria}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <VeiculoSelector
          value={veiculo}
          onChange={alterarVeiculo}
          error={erros.veiculo}
          disabled={bloqueado}
          mostrarResumo
          criacaoAoSalvar={false}
          onCadastrar={
            podeCriarVeiculo
              ? (nome) => {
                  Keyboard.dismiss();
                  setNomeCadastroVeiculo(nome);
                }
              : undefined
          }
        />

        <TierSelector
          value={tier}
          onChange={(valor) => {
            setTier(valor);
            limparErro("tier");
          }}
          disabled={bloqueado}
        />
        {erros.tier ? (
          <Text style={styles.fieldError}>
            {erros.tier}
          </Text>
        ) : null}
        {veiculo.id !== null ? (
          <Text
            style={[
              styles.tierHint,
              { color: theme.textoSub },
            ]}
          >
            O Tier selecionado será registrado neste clipping.
            Você pode ajustá-lo para esta publicação.
          </Text>
        ) : null}

        <ClippingTrechoInput
          inicio={inicioSegundos}
          fim={fimSegundos}
          onInicioChange={(texto) => {
            setInicioSegundos(texto);
            limparErro("inicioSegundos");
            limparErro("fimSegundos");
          }}
          onFimChange={(texto) => {
            setFimSegundos(texto);
            limparErro("inicioSegundos");
            limparErro("fimSegundos");
          }}
          erroInicio={erros.inicioSegundos}
          erroFim={erros.fimSegundos}
          disabled={bloqueado}
        />

        <Input
          label="LINK"
          value={link}
          onChangeText={(texto) => {
            setLink(texto);
            limparErro("link");
          }}
          placeholder="https://..."
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={erros.link}
          editable={!bloqueado}
        />
        <ClippingArquivosInput
          arquivos={arquivos}
          disabled={bloqueado}
          podeSelecionar={podeAnexar}
          onChange={setArquivos}
          onOcupadoChange={setSelecionandoArquivos}
        />
        <Input
          label="OBSERVAÇÕES"
          value={observacoes}
          onChangeText={(texto) => {
            setObservacoes(texto);
            limparErro("observacoes");
          }}
          placeholder="Informações adicionais"
          multiline
          textAlignVertical="top"
          style={styles.textArea}
          error={erros.observacoes}
          editable={!bloqueado}
        />  
        {erroGeral ? (
          <Text style={styles.generalError}>
            {erroGeral}
          </Text>
        ) : null}

        {mensagemEnvio ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontSize: 12,
              color: theme.textoSub,
              marginBottom: 12,
            }}
          >
            {mensagemEnvio}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="CANCELAR"
            variant="outline"
            disabled={bloqueado}
            onPress={cancelarCadastro}
            style={styles.actionButton}
          />

          <Button
            title="SALVAR"
            loading={salvando}
            disabled={bloqueado}
            onPress={() => void salvar(false)}
            style={styles.actionButton}
          />
        </View>

        <Button
          title="SALVAR E ADICIONAR OUTRO"
          variant="outline"
          loading={salvando}
          disabled={bloqueado}
          onPress={() => void salvar(true)}
          style={styles.addAnotherButton}
        />
      </ScrollView>
      {nomeCadastroVeiculo !== null ? (
        <ClippingVeiculoCadastro
          nomeInicial={nomeCadastroVeiculo}
          onClose={() => setNomeCadastroVeiculo(null)}
          onCriado={(criado) => {
            alterarVeiculo(criado);
            setNomeCadastroVeiculo(null);

            setSucesso(
              "Veículo cadastrado e selecionado. Salve o clipping para concluir."
            );
          }}
        />
      ) : null}

      <FeedbackAlert
        visible={falha !== null}
        variant="error"
        title="Não foi possível salvar"
        message={falha ?? ""}
        onClose={() => setFalha(null)}
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
    paddingBottom: 45,
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 13,
    marginTop: 4,
  },

  fieldLabel: {
    fontSize: 12,
    marginBottom: 8,
  },

  suggestions: {
    borderWidth: 1.5,
    borderRadius: 13,
    marginTop: -12,
    marginBottom: 18,
    overflow: "hidden",
  },

  suggestion: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  suggestionText: {
    flex: 1,
    fontSize: 12,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: -10,
    marginBottom: 20,
  },

  chip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  chipText: {
    fontSize: 11,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  half: {
    flex: 1,
  },

  textArea: {
    height: 105,
    paddingTop: 14,
  },
  feedbackSucesso: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  tierHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  actionButton: {
    flex: 1,
  },

  addAnotherButton: {
    marginTop: 10,
  },

  permissionBox: {
    margin: 20,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
  },

  permissionTitle: {
    fontSize: 16,
    marginTop: 12,
  },

  permissionText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 7,
  },

  fieldError: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: -12,
    marginBottom: 14,
  },

  generalError: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
});