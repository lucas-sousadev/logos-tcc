import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
  type TextInput
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useIsFocused, usePreventRemove, type NavigationAction } from "expo-router/react-navigation";
import * as Crypto from "expo-crypto";

import Header from "@/components/layout/Header";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ClippingContexto from "@/components/clipping/ClippingContexto";
import ReleaseDestinatariosModal from "@/components/releases/ReleasesDestinatariosModal";
import ReleaseDadosEnvioEtapa from "@/components/releases/ReleaseDadosEnvioEtapa";
import ReleaseRevisaoEtapa from "@/components/releases/ReleaseRevisaoEtapa";
import ReleaseEdicao from "@/components/releases/ReleaseEdicao";
import { listarClientes } from "@/services/api/cliente";
import ReleaseEtapas, {
  type EtapaRelease,
} from "@/components/releases/ReleaseEtapas";
import ReleaseDestinatariosCampo from "@/components/releases/ReleaseDestinatariosCampo";
import ReleaseTemplateEtapa from "@/components/releases/ReleaseTemplateEtapa";
import ReleaseConteudoEditor from "@/components/releases/ReleaseConteudoEditor";
import ReleaseEnvioTeste from "@/components/releases/ReleaseEnvioTeste";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRascunhoRelease } from "@/hooks/useRascunhoRelease";
import { avisoDominiosRelease } from "@/utils/releaseDominios";
import { ehNavegacaoPelaBarra } from "@/utils/navegacaoModulos";
import { pendenciasEnvioRelease,} from "@/utils/validarEnvioRelease";
import type {
  DestinatarioRelease,
  TemplateRelease,
  BlocoTemplateRelease,
  DadosEnvioRelease,
} from "@/services/api/release";
import {
  criarRelease,
  solicitarEnvioRelease,
  ErroApiRelease,
} from "@/services/api/release";
import { descartarCopiaRelease, encerrarCopiaRelease } from "@/services/rascunhoRelease";

import {
  guardarReleasePendente,
  lerReleasePendente,
  removerReleasePendente,
  type ReleasePendente,
  type AcaoCadastroRelease
} from "@/services/releasePendente";

const ORDEM_CADASTRO: EtapaRelease[] = [
  "DESTINO",
  "TEMPLATE",
  "CONTEUDO",
  "ENVIO",
  "REVISAO",
];

export default function NovoRelease() {
  const { usuario } = useAuth();
  const { editar } = useLocalSearchParams<{ editar?: string }>();

  const conta = usuario
    ? usuario.assessoria_id + "-" + usuario.id
    : null;

  if (editar !== undefined) {
    const numero =
      typeof editar === "string" && /^[1-9]\d*$/.test(editar)
        ? Number(editar)
        : 0;

    return (
      <ReleaseEdicao
        key={conta + "-editar-" + editar}
        id={
          Number.isSafeInteger(numero) && numero > 0
            ? numero
            : 0
        }
      />
    );
  }

  return (
    <CadastroRelease
      key={conta ?? "sem-conta"}
      conta={conta}
    />
  );
}

function CadastroRelease({ conta }: { conta: string | null }) {
  const router = useRouter();
  const navigation = useNavigation();
  const retornar = useRetornoSeguro("/releases");
  const focada = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const conteudoScrollRef = useRef<View>(null);
  const { theme } = useTheme();
  const { temPermissao, usuario } = useAuth();
  const [
    chaveRascunho,
    setChaveRascunho,
  ] = useState(() => Crypto.randomUUID());

  const [etapa, setEtapa] = useState<EtapaRelease>("DESTINO");

  // etapa 1
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState<{
    id: number;
    nome: string;
  } | null>(null);

  // etapa 2
  const [template, setTemplate] = useState<TemplateRelease | null>(null);
  const [blocos, setBlocos] = useState<
    BlocoTemplateRelease[]
  >([]);
  const [conteudoEditado, setConteudoEditado] = useState(false);
  const [trocaTemplate, setTrocaTemplate] = useState<{
    modelo: TemplateRelease;
    editar: boolean;
  } | null>(null);

  // etapa 3
  const [dadosEnvioIniciais] = useState<DadosEnvioRelease>({
    assunto: "",
    primeira_linha: "",
    nome_remetente: (usuario?.nome ?? "").slice(0, 100),
    responder_para: usuario?.email ?? "",
  });
  const [dadosEnvio, setDadosEnvio] = useState(dadosEnvioIniciais);

  const [selecionados, setSelecionados] = useState<
    DestinatarioRelease[]
  >([]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [imagemOcupada, setImagemOcupada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pendente, setPendente] = useState<ReleasePendente | null>(null);
  const [recuperacao, setRecuperacao] = useState<
    "carregando" | "pronta" | "falhou"
  >(conta ? "carregando" : "pronta");
  const [tentativasRecuperacao, setTentativasRecuperacao] = useState(0);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoSaidaAberto, setAvisoSaidaAberto] = useState(false);
  const [confirmarRecuperacao, setConfirmarRecuperacao] = useState(false);
  const [saidaAposSalvar, setSaidaAposSalvar] = useState<NavigationAction | null>(null);

  // resultados
  const [resultado, setResultado] = useState<{
    acao: AcaoCadastroRelease;
    id: number;
  } | null>(null);
  const [confirmacaoEnvio, setConfirmacaoEnvio] =
    useState(false);

  const trava = useRef(false);
  const acaoSaida = useRef<NavigationAction | null>(null);
  const fechamentoExplicito = useRef(false);
  const confirmando = pendente !== null;
  const podeCriar = temPermissao("RELEASES", "CRIAR");
  const podeEnviar =
    temPermissao("RELEASES", "ENVIAR") &&
    temPermissao("RELEASES", "VISUALIZAR");
  const envioPendente = pendente?.acao === "ENVIAR";
  const avisoDominios = avisoDominiosRelease(
    selecionados.map((contato) => contato.email)
  );
  const totalEnvio = new Set(
    selecionados
      .map((contato) =>
        (contato.email ?? "").trim().toLowerCase()
      )
      .filter(Boolean)
  ).size;

  const temAlteracoesNaoSalvas =
    !confirmando &&
    !sucesso &&
    Boolean(
      titulo ||
      cliente ||
      template ||
      selecionados.length ||
      dadosEnvio.assunto ||
      dadosEnvio.primeira_linha ||
      dadosEnvio.nome_remetente !== dadosEnvioIniciais.nome_remetente ||
      dadosEnvio.responder_para !== dadosEnvioIniciais.responder_para
    );

  const restaurarFormulario = useCallback(
    (registro: ReleasePendente) => {
      const { dados } = registro;
      const salvos = dados.blocos ?? [];

      setChaveRascunho(
        dados.chave_rascunho
      );

      setTitulo(dados.titulo);
      setCliente(registro.cliente);

      setTemplate(
        registro.template
          ? {
              ...registro.template,
              blocos: salvos,
            }
          : null
      );

      setBlocos(salvos);
      setDadosEnvio(dados.dados_envio);
      setSelecionados(registro.selecionados);
      setConteudoEditado(
        registro.conteudoEditado
      );
      setEtapa(registro.etapa);
    },
    []
  );

  const copiaAtual: ReleasePendente = {
    dados: {
      titulo,
      cliente_id: cliente?.id ?? null,
      jornalistas_ids: selecionados.map(
        (contato) => contato.id
      ),
      chave_rascunho: chaveRascunho,
      template_id: template?.id ?? null,
      template_codigo:
        template?.codigo ?? null,
      template_assinatura:
        template?.assinatura ?? "",
      blocos: template ? blocos : [],
      dados_envio: dadosEnvio,
    },
    etapa,
    cliente,
    selecionados,
    conteudoEditado,
    template: template
      ? {
          id: template.id,
          codigo: template.codigo,
          nome: template.nome,
          origem: template.origem,
          assinatura: template.assinatura,
          disponivel: template.disponivel,
        }
      : null,
  };

  const pendenciasEnvio = pendenciasEnvioRelease({
    titulo,
    templateDefinido: Boolean(template),
    dadosEnvio,
    blocos,
    destinatarios: selecionados,
  });

  const automatico = useRascunhoRelease({
    conta,
    identidade: "novo",
    valor: copiaAtual,
    iniciar: recuperacao === "pronta" && !confirmando && !sucesso,
    temAlteracoes: temAlteracoesNaoSalvas || etapa !== "DESTINO",
    podeMailing: temPermissao("MAILING", "VISUALIZAR"),
    habilitado:
      recuperacao === "pronta" &&
      !confirmando &&
      !sucesso &&
      !salvando &&
      podeCriar,
    ocupado:
      imagemOcupada || confirmacaoEnvio || avisoSaidaAberto,
    onRecuperar: (registro) => {
      if (!pendente) {
        restaurarFormulario(registro);
      }
    },
  });

  const bloqueado =
    salvando ||
    confirmando ||
    sucesso ||
    imagemOcupada ||
    confirmacaoEnvio ||
    confirmarRecuperacao ||
    avisoSaidaAberto ||
    (
      !confirmando &&
      !automatico.pronto
    );
  function continuarEditando() {
    acaoSaida.current = null;
    fechamentoExplicito.current = false;
    setAvisoSaidaAberto(false);
  }

  async function preservarESair() {
    if (trava.current) return;
    trava.current = true;
    setSalvando(true);
    try {
      if (automatico.pronto) {
        if (temAlteracoesNaoSalvas || automatico.temRascunho || etapa !== "DESTINO") {
          await automatico.guardarLocal();
        }
      } else if (!confirmando) {
        throw new Error("Aguarde a recuperação do rascunho antes de sair.");
      }
      const acao = acaoSaida.current;
      continuarEditando();
      if (acao && navigation.isFocused()) navigation.dispatch(acao);
    } catch (falha) {
      continuarEditando();
      setErro(falha instanceof Error ? falha.message : "Não foi possível preservar o rascunho neste aparelho.");
    } finally { trava.current = false; setSalvando(false); }
  }

  const contaAtual = usuario ? usuario.assessoria_id + "-" + usuario.id : null;
  usePreventRemove(Boolean(conta && contaAtual === conta && focada && !sucesso && (
    salvando || imagemOcupada || temAlteracoesNaoSalvas || automatico.temRascunho ||
    confirmando || etapa !== "DESTINO" || automatico.pronto
  )), ({ data }) => {
    if (trava.current || acaoSaida.current) return;
    const pelaBarra = ehNavegacaoPelaBarra(data.action);
    if (imagemOcupada && !pelaBarra) return;

    acaoSaida.current = data.action;
    Keyboard.dismiss();
    if (pelaBarra || (fechamentoExplicito.current && (
      temAlteracoesNaoSalvas || automatico.temRascunho || confirmando || etapa !== "DESTINO"
    ))) {
      setSeletorAberto(false);
      setTrocaTemplate(null);
      setConfirmacaoEnvio(false);
      setConfirmarRecuperacao(false);
      setAvisoSaidaAberto(true);
    } else void preservarESair();
  });

  useEffect(() => {
    if (sucesso && saidaAposSalvar && !salvando && focada) navigation.dispatch(saidaAposSalvar);
  }, [sucesso, saidaAposSalvar, salvando, focada, navigation]);

  useEffect(() => {
    if (!conta) return;

    let ativa = true;

    lerReleasePendente(conta).then((registro) => {
      if (!ativa) return;

      if (registro) {
        restaurarFormulario(registro);
        setPendente(registro);
      }

      setRecuperacao("pronta");
    }).catch(() => {
      if (ativa) setRecuperacao("falhou");
    });

    return () => { ativa = false; };
  }, [
    conta,
    tentativasRecuperacao,
    restaurarFormulario,
  ]);

  const etapasDisponiveis = template
  ? ORDEM_CADASTRO
  : ORDEM_CADASTRO.slice(0, 2);

  const indiceEtapa = ORDEM_CADASTRO.indexOf(etapa);

  const etapaAnterior: EtapaRelease | undefined =
    ORDEM_CADASTRO[indiceEtapa - 1];

  const proximaEtapa: EtapaRelease | undefined =
    ORDEM_CADASTRO[indiceEtapa + 1];

  async function salvar(
    acao: AcaoCadastroRelease = "RASCUNHO"
  ): Promise<boolean> {
    if (
      !conta ||
      trava.current ||
      !podeCriar ||
      imagemOcupada ||
      sucesso ||
      recuperacao !== "pronta"
    ) {
      return false;
    }

    if (
      acao === "ENVIAR" &&
      !podeEnviar
    ) {
      return false;
    }

    if (
      pendente &&
      (pendente.acao ?? "RASCUNHO") !== acao
    ) {
      setErro(
        "Conclua a tentativa pendente antes de iniciar outra ação."
      );

      return false;
    }

    trava.current = true;
    setSalvando(true);
    setErro("");

    let registro = pendente;

    let fase:
      | "GUARDAR"
      | "CRIAR"
      | "ENVIAR"
      | "LIMPAR" = "GUARDAR";

    try {
      if (!registro) {
        const remoto =
          await automatico.confirmar();

        registro = {
          ...copiaAtual,
          acao,
          release_id: remoto.id,
          versao_envio: remoto.versao_edicao,
        };

        await guardarReleasePendente(
          conta,
          registro
        );

        setPendente(registro);
      }

      // Recupera tentativas criadas pela versão anterior.
      if (!registro.release_id) {
        fase = "CRIAR";

        const criado = await criarRelease(
          registro.dados
        );

        registro = {
          ...registro,
          release_id: criado.id,
          versao_envio: criado.versao_edicao,
        };

        await guardarReleasePendente(
          conta,
          registro
        );

        setPendente(registro);
      }

      const id = registro.release_id;

      if (
        typeof id !== "number" ||
        !Number.isSafeInteger(id) ||
        id < 1
      ) {
        throw new Error(
          "O servidor não confirmou o rascunho."
        );
      }

      if (acao === "ENVIAR") {
        fase = "ENVIAR";
        await solicitarEnvioRelease(id, registro.versao_envio);
      }

      fase = "LIMPAR";

      await encerrarCopiaRelease(
        conta,
        "novo",
        id
      );

      await removerReleasePendente(
        conta,
        registro.dados.chave_rascunho
      );

      setPendente(null);
      setResultado({ acao, id });
      setSucesso(true);
      return true;
    } catch (falha) {
      if (
        fase === "CRIAR" &&
        registro &&
        falha instanceof ErroApiRelease &&
        (
          [
            400,
            404,
            409,
            413,
            422,
          ].includes(falha.status) ||
          (
            !pendente &&
            falha.status === 403
          )
        )
      ) {
        try {
          await removerReleasePendente(
            conta,
            registro.dados.chave_rascunho
          );

          setPendente(null);
        } catch {
          setErro(
            "Não foi possível atualizar a tentativa salva neste aparelho."
          );

          return false;
        }
      }

      const mensagem =
        falha instanceof Error
          ? falha.message
          : "Não foi possível concluir a operação.";

      setErro(
        fase === "ENVIAR"
          ? "O rascunho está salvo, mas o envio " +
              "ainda não foi confirmado. " +
              mensagem
          : mensagem
      );
      return false;
    } finally {
      trava.current = false;
      setSalvando(false);
      setConfirmacaoEnvio(false);
    }
  }

  function pedirEnvio() {
    if (
      !conta ||
      trava.current ||
      !podeCriar ||
      !podeEnviar ||
      imagemOcupada ||
      sucesso
    ) {
      return;
    }

    if (pendente && pendente.acao !== "ENVIAR") {
      setErro(
        "Confirme primeiro o salvamento pendente."
      );
      return;
    }

    if (pendenciasEnvio.length > 0) {
      setErro(pendenciasEnvio.join("\n"));
      return;
    }

    Keyboard.dismiss();
    setErro("");
    setConfirmacaoEnvio(true);
  }

  function abrirResultado() {
    if (resultado?.acao === "ENVIAR") {
      router.replace({
        pathname: "/releases/[id]",
        params: {
          id: String(resultado.id),
        },
      });
    } else {
      voltarParaLista();
    }
  }

  function alternarContato(
    contato: DestinatarioRelease
  ) {
    setSelecionados((atuais) => {
        const existe = atuais.some(
        (item) => item.id === contato.id
        );

        return existe
        ? atuais.filter((item) => item.id !== contato.id)
        : [...atuais, contato];
    });
  }

  function adicionarContatos(
    contatos: DestinatarioRelease[]
  ) {
    setSelecionados((atuais) => {
        const porId = new Map(
        atuais.map((contato) => [contato.id, contato])
        );

        for (const contato of contatos) {
        porId.set(contato.id, contato);
        }

        return [...porId.values()];
    });
  }

  function mudarEtapa(nova: EtapaRelease) {
    if (bloqueado || !etapasDisponiveis.includes(nova)) return;

    setEtapa(nova);

    scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
    });
  }

  function aplicarTemplate(
    modelo: TemplateRelease,
    editar: boolean
  ) {
    setTemplate(modelo);

    setBlocos(
        modelo.blocos.map((bloco) => ({ ...bloco }))
    );

    setConteudoEditado(false);
    setErro("");

    if (editar) {
        setEtapa("CONTEUDO");

        scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
        });
    }
  }

    function selecionarTemplate(
    modelo: TemplateRelease,
    editar = false
    ) {
    if (bloqueado || !modelo.disponivel) return;

    const mesmo =
        template?.id === modelo.id &&
        template?.codigo === modelo.codigo &&
        template?.assinatura === modelo.assinatura;

    if (mesmo) {
        if (editar) mudarEtapa("CONTEUDO");
        return;
    }

    if (conteudoEditado) {
        setTrocaTemplate({ modelo, editar });
        return;
    }

    aplicarTemplate(modelo, editar);
}

  function mostrarCampo(campo: TextInput) {
    const conteudo = conteudoScrollRef.current;

    if (!conteudo || bloqueado) return;

    campo.measureLayout(
        conteudo,
        (_x, y) => {
        scrollRef.current?.scrollTo({
            y: Math.max(0, y - 48),
            animated: false,
        });
        },
        () => {}
    );
  }

  async function salvarRascunhoESair() {
    if (trava.current || envioPendente || !acaoSaida.current) return;
    const acao = acaoSaida.current;
    continuarEditando();
    setSaidaAposSalvar(acao);
    if (!await salvar()) setSaidaAposSalvar(null);
  }

  async function descartarESair() {
    if (trava.current) return;

    trava.current = true;
    setSalvando(true);

    try {
      if (!conta) throw new Error("Não foi possível identificar a conta deste rascunho.");
      if (automatico.pronto) await automatico.descartar();
      else if (pendente) await descartarCopiaRelease(conta, "novo", pendente.dados.chave_rascunho);
      else throw new Error("Aguarde a recuperação do rascunho antes de descartar.");
      if (pendente) await removerReleasePendente(conta, pendente.dados.chave_rascunho).catch(() => {});

      const acao = acaoSaida.current;
      continuarEditando();

      if (acao && navigation.isFocused()) {
        navigation.dispatch(acao);
      }
    } catch (falha) {
      continuarEditando();

      setErro(
        falha instanceof Error ? falha.message : "Não foi possível confirmar o descarte. Seu preenchimento foi mantido."
      );
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  function voltarParaLista() {
    router.dismissTo("/releases");
  }

  async function usarVersaoServidor() {
    if (trava.current || imagemOcupada || confirmando) return;
    trava.current = true;
    setSalvando(true);
    setErro("");
    try {
      if (automatico.remotoAusente) {
        if (!podeCriar) throw new Error("Você precisa da permissão de criar releases para recuperar este conteúdo.");
        await automatico.recuperarComoNovo();
      } else {
        await automatico.recarregarDoServidor();
      }
      setConfirmarRecuperacao(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar a versão do servidor.");
      setConfirmarRecuperacao(false);
    } finally { trava.current = false; setSalvando(false); }
  }

  function voltar() {
    if (trava.current || sucesso || imagemOcupada || confirmarRecuperacao || avisoSaidaAberto) return;

    if (!confirmando && recuperacao === "pronta" && etapaAnterior) {
      mudarEtapa(etapaAnterior);
      return;
    }

    fechamentoExplicito.current = true;
    retornar();
  }

  if (
    recuperacao !== "pronta" ||
    (
      !confirmando &&
      !automatico.pronto
    )
  ) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Novo release" showBackButton onBackPress={voltar} />
        <View style={styles.content}>
          {(
            recuperacao === "carregando" ||
            (recuperacao === "pronta" && !automatico.pronto && !automatico.erro)
          ) ? (
            <Text>Verificando rascunhos neste dispositivo…</Text>
          ) : (
            <>
              <Text style={{ color: theme.erro }}>
                {automatico.mensagem ||
               "Não foi possível recuperar o rascunho salvo neste dispositivo."}
              </Text>
              <Button
                title="TENTAR NOVAMENTE"
                onPress={() => {
                  if (!automatico.pronto) {
                    automatico.tentarRecuperar();
                  }

                  setRecuperacao("carregando");

                  setTentativasRecuperacao(
                    (atual) => atual + 1
                  );
                }}
              />
            </>
          )}
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
        title="Novo release"
        showBackButton
        onBackPress={voltar}
      />
      
      <View style={styles.etapas}>
        <ReleaseEtapas
            atual={etapa}
            disponiveis={etapasDisponiveis}
            disabled={bloqueado}
            onSelecionar={mudarEtapa}
        />
      </View>

    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
    >   
        <View
          ref={conteudoScrollRef}
          collapsable={false}
          style={styles.content}
        >
            {etapa === "DESTINO" ? (
            <>
                <View style={styles.cabecalho}>
                    <Text weight="Bold" style={styles.titulo}>
                        Destinatários
                    </Text>

                    <Text
                        style={{
                        color: theme.textoSub,
                        fontSize: 12,
                        }}
                    >
                        Etapa 1 de 5
                    </Text>
                </View>

                <Input
                    label="TÍTULO INTERNO"
                    value={titulo}
                    onChangeText={setTitulo}
                    maxLength={150}
                    editable={!bloqueado}
                    placeholder="Identifique esse release"
                    containerStyle={styles.campo}
                    clearable
                />

                {temPermissao("CLIENTES", "VISUALIZAR") ? (
                <ClippingContexto
                    apenasCliente
                    clienteId={cliente?.id ?? null}
                    clienteNome={cliente?.nome ?? ""}
                    ano={new Date().getFullYear()}
                    anoPelaData={false}
                    disabled={bloqueado}
                    buscarClientes={listarClientes}
                    onCliente={(valor) =>
                    setCliente({
                        id: valor.id,
                        nome: valor.nome,
                    })
                    }
                    style={styles.campo}
                />
                ) : (
                <Text>
                    Solicite acesso a Clientes para escolher o
                    cliente.
                </Text>
                )}

                {cliente ? (
                <Button
                    title="REMOVER CLIENTE"
                    size="small"
                    variant="outline"
                    disabled={bloqueado}
                    onPress={() => setCliente(null)}
                />
                ) : null}

                <ReleaseDestinatariosCampo
                    selecionados={selecionados}
                    disabled={
                        bloqueado ||
                        !temPermissao("MAILING", "VISUALIZAR")
                    }
                    onPress={() => setSeletorAberto(true)}
                />

                {!temPermissao("MAILING", "VISUALIZAR") ? (
                    <Text style={{ color: theme.textoSub }}>
                        Solicite acesso ao Mailing para escolher destinatários.
                    </Text>
                ) : null}
            </>
            ) : etapa === "TEMPLATE" ? (
            <>
                <View style={styles.cabecalho}>
                    <Text weight="Bold" style={styles.titulo}>
                        Template
                    </Text>

                    <Text
                        style={{
                        color: theme.textoSub,
                        fontSize: 12,
                        }}
                    >
                        Etapa 2 de 5
                    </Text>
                    </View>

                    <ReleaseTemplateEtapa
                        selecionado={template}
                        disabled={bloqueado}
                        onSelecionar={(modelo) =>
                            selecionarTemplate(modelo)
                        }
                        onEditar={(modelo) =>
                            selecionarTemplate(modelo, true)
                        }
                    />
                </>
            ) : etapa === "CONTEUDO" ? (
                <>
                    <View style={styles.cabecalho}>
                    <Text
                        weight="Bold"
                        style={styles.titulo}
                    >
                        Conteúdo
                    </Text>

                    <Text
                        style={{
                        color: theme.textoSub,
                        fontSize: 12,
                        }}
                    >
                        Etapa 3 de 5
                    </Text>
                    </View>

                    <ReleaseConteudoEditor
                      blocos={blocos}
                      nomeTemplate={template?.nome ?? ""}
                      disabled={bloqueado}
                      imagemOcupada={imagemOcupada}
                      onImagemOcupadaChange={setImagemOcupada}
                      onChange={(alterar) => {
                        if (salvando || confirmando || sucesso) return;

                        setBlocos(alterar);
                        setConteudoEditado(true);
                        setErro("");
                      }}
                      onMostrarCampo={mostrarCampo}
                    />
                  </>
            ) : etapa === "ENVIO" ? (
            <>
                <View style={styles.cabecalho}>
                <Text weight="Bold" style={styles.titulo}>
                    Dados do e-mail
                </Text>

                <Text style={{ color: theme.textoSub, fontSize: 12 }}>
                    Etapa 4 de 5
                </Text>
                </View>

                <ReleaseDadosEnvioEtapa
                dados={dadosEnvio}
                disabled={bloqueado}
                onChange={(campo, valor) => {
                    if (bloqueado) return;

                    setDadosEnvio((atuais) => ({
                    ...atuais,
                    [campo]: valor,
                    }));

                    setErro("");
                }}
                />
            </>
            ) : (
              <>
                <View style={styles.cabecalho}>
                  <Text weight="Bold" style={styles.titulo}>Revisão</Text>
                  <Text style={{ color: theme.textoSub, fontSize: 12 }}>
                    Etapa 5 de 5
                  </Text>
                </View>

                <ReleaseRevisaoEtapa
                  titulo={titulo}
                  clienteNome={cliente?.nome ?? null}
                  templateNome={template?.nome ?? ""}
                  dadosEnvio={dadosEnvio}
                  blocos={blocos}
                  selecionados={selecionados}
                  disabled={bloqueado}
                  podeSelecionarDestinatarios={temPermissao("MAILING", "VISUALIZAR")}
                  onEditar={mudarEtapa}
                  onVerDestinatarios={() => setSeletorAberto(true)}
                />

                {temPermissao("RELEASES", "ENVIAR") ? (
                  <ReleaseEnvioTeste
                    emailInicial={usuario?.email ?? ""}
                    dadosEnvio={dadosEnvio}
                    blocos={blocos}
                    disabled={bloqueado}
                  />
                ) : null}
              </>
            )}

            {etapaAnterior && proximaEtapa ? (
                <Button
                    title={
                    proximaEtapa === "REVISAO"
                        ? "AVANÇAR PARA REVISÃO"
                        : proximaEtapa === "ENVIO"
                        ? "AVANÇAR PARA DADOS DO E-MAIL"
                        : proximaEtapa === "CONTEUDO"
                        ? "AVANÇAR PARA EDITAR CONTEÚDO"
                        : "PRÓXIMO"
                    }
                    disabled={
                    bloqueado ||
                    (proximaEtapa === "CONTEUDO" && !template)
                    }
                    onPress={() => mudarEtapa(proximaEtapa)}
                />
            ) : null} 
            
            {etapa === "REVISAO" &&
              !confirmando &&
              pendenciasEnvio.length > 0 ? (
                <View style={{ gap: 4 }}>
                  <Text weight="SemiBold">
                    Para enviar, falta:
                  </Text>

                  {pendenciasEnvio.map((item) => (
                    <Text
                      key={item}
                      style={{
                        color: theme.textoSub,
                        fontSize: 12,
                      }}
                    >
                      {"• " + item}
                    </Text>
                  ))}
                </View>
              ) : null}

            {etapa === "REVISAO" &&
              !confirmando &&
              podeEnviar ? (
                <Button
                  title="ENVIAR RELEASE"
                  icon="paper-plane-outline"
                  disabled={
                    bloqueado ||
                    !podeCriar ||
                    pendenciasEnvio.length > 0
                  }
                  onPress={pedirEnvio}
                />
              ) : null}

            <View style={styles.acoesRodape}>
              {etapaAnterior || confirmando ? (
                <Button
                  title={confirmando ? "SAIR" : "VOLTAR"}
                  variant="outline"
                  style={styles.botaoRodape}
                  disabled={salvando || sucesso || imagemOcupada}
                  onPress={voltar}
                />
              ) : null}

              <Button
                title={
                  confirmando
                    ? envioPendente
                      ? "CONFIRMAR ENVIO"
                      : "CONFIRMAR SALVAMENTO"
                    : "SALVAR RASCUNHO"
                }
                style={styles.botaoRodape}
                loading={salvando}
                disabled={
                  !conta ||
                  !podeCriar ||
                  sucesso ||
                  imagemOcupada ||
                  (envioPendente && !podeEnviar)
                }
                onPress={
                  envioPendente
                    ? pedirEnvio
                    : () => void salvar()
                }
                variant={envioPendente ? "primary" : "outline"}
              />

              {!etapaAnterior && !confirmando && proximaEtapa ? (
                <Button
                  title="PRÓXIMO"
                  style={styles.botaoRodape}
                  disabled={bloqueado}
                  onPress={() => mudarEtapa(proximaEtapa)}
                />
              ) : null}
            </View>

                <Text
                  accessibilityLiveRegion="polite"
                  style={{
                    color: automatico.erro
                      ? theme.aviso
                      : theme.textoSub,
                  }}
                >
                  {automatico.mensagem ||
                    "O preenchimento será salvo automaticamente, mesmo incompleto."}
                </Text>

                {automatico.conflito && automatico.idRemoto && !confirmando ? (
                  <Button title="CONFERIR" variant="outline" disabled={bloqueado}
                    onPress={() => setConfirmarRecuperacao(true)} />
                ) : null}

                {automatico.remotoAusente && podeCriar && !confirmando ? (
                  <Button title="RECUPERAR" variant="outline" disabled={bloqueado}
                    onPress={() => setConfirmarRecuperacao(true)} />
                ) : null}

                {erro ? (
                    <Text style={{ color: theme.erro }}>{erro}</Text>
                ) : null}

                {confirmando ? (
                  <Text style={{ color: theme.aviso }}>
                    {envioPendente
                      ? "A tentativa está guardada. Confirme novamente para consultar ou concluir o mesmo envio."
                      : "A tentativa está guardada. Confirme o salvamento agora ou reabra Novo release para tentar depois."}
                  </Text>
                ) : null}

                {!podeCriar ? (
                    <Text style={{ color: theme.erro }}>
                        Você precisa da permissão de criar releases.
                    </Text>
                ) : null}
        </View>
    </ScrollView>

      {seletorAberto ? (
        <ReleaseDestinatariosModal
          selecionados={selecionados}
          iniciarComSelecionados={etapa === "REVISAO" && selecionados.length > 0}
          onAlternar={alternarContato}
          onClose={() => setSeletorAberto(false)}
          onAdicionar={adicionarContatos}
        />
      ) : null}

      <FeedbackAlert
        inline
        visible={trocaTemplate !== null}
        variant="warning"
        title="Trocar o template?"
        message="O conteúdo editado será perdido e substituído pelos blocos do novo modelo."
        primaryLabel="TROCAR"
        secondaryLabel="MANTER"
        primaryDanger
        onClose={() => setTrocaTemplate(null)}
        onSecondary={() => setTrocaTemplate(null)}
        onPrimary={() => {
            if (bloqueado || !trocaTemplate) return;

            aplicarTemplate(
            trocaTemplate.modelo,
            trocaTemplate.editar
            );

            setTrocaTemplate(null);
        }}
      />

      <FeedbackAlert
        visible={confirmarRecuperacao}
        variant="warning"
        title={automatico.remotoAusente ? "Recuperar este rascunho?" : "Usar a versão do servidor?"}
        message={automatico.remotoAusente
          ? "O release não está mais disponível no servidor. Seu conteúdo local será recuperado como um novo rascunho, mantendo os campos preenchidos."
          : "O preenchimento desta tela será substituído pela versão salva no servidor. Suas alterações locais só serão substituídas depois que essa versão for carregada com sucesso."}
        primaryLabel={automatico.remotoAusente ? "RECUPERAR" : "USAR"}
        secondaryLabel="MANTER"
        primaryDanger
        loading={salvando}
        onPrimary={() => void usarVersaoServidor()}
        onClose={() => setConfirmarRecuperacao(false)}
        onSecondary={() => setConfirmarRecuperacao(false)}
      />

      <FeedbackAlert
        visible={avisoSaidaAberto}
        variant="warning"
        title="Sair do novo release?"
        loading={salvando || imagemOcupada}
        message={
          envioPendente
            ? "Sair descarta o cadastro pendente. Se o envio já tiver começado, ele não será cancelado."
            : "Se sair, o progresso deste novo release será descartado. Para continuar depois, escolha Salvar Rascunho."
        }
        primaryLabel="SAIR"
        secondaryLabel="CONTINUAR"
        tertiaryLabel={!envioPendente && podeCriar ? "SALVAR RASCUNHO" : undefined}
        primaryDanger
        onPrimary={() => void descartarESair()}
        onSecondary={continuarEditando}
        onTertiary={() => void salvarRascunhoESair()}
        onClose={continuarEditando}
      />

      <FeedbackAlert
        inline
        visible={confirmacaoEnvio}
        variant="warning"
        title="Enviar este release?"
        message={
          'O release "' +
          titulo +
          '" será salvo e enviado para ' +
          totalEnvio +
          " endereço(s). Confirme o conteúdo e os destinatários." +
          (avisoDominios ? "\n\n" + avisoDominios : "")
        }
        primaryLabel="CONFIRMAR"
        secondaryLabel="REVISAR"
        loading={salvando}
        onPrimary={() => void salvar("ENVIAR")}
        onClose={() => {
          if (!trava.current) setConfirmacaoEnvio(false);
        }}
        onSecondary={() => {
          if (!trava.current) setConfirmacaoEnvio(false);
        }}
      />

      <FeedbackAlert
        visible={sucesso && !saidaAposSalvar}
        variant="success"
        title={
          resultado?.acao === "ENVIAR"
            ? "Solicitação registrada"
            : "Rascunho salvo"
        }
        message={
          resultado?.acao === "ENVIAR"
            ? "A solicitação de envio foi registrada. Acompanhe o processamento na tela do release."
            : "O release foi cadastrado e está disponível na listagem."
        }
        primaryLabel={
          resultado?.acao === "ENVIAR"
            ? "ACOMPANHAR ENVIO"
            : "VER RELEASES"
        }
        onPrimary={abrirResultado}
        onClose={abrirResultado}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  etapas: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  cabecalho: {
    gap: 2,
  },
  campo: {
    marginBottom: 0,
  },
  destinatarios: {
    gap: 6,
  },
  titulo: {
    fontSize: 20,
  },
  acoesRodape: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
    botaoRodape: {
    flex: 1,
    width: "auto",
    minWidth: 0,
    paddingHorizontal: 8,
  },
});
