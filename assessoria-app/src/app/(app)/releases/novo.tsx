import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
  type TextInput
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove, type NavigationAction } from "expo-router/react-navigation";
import * as Crypto from "expo-crypto";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ClippingContexto from "@/components/clipping/ClippingContexto";
import ReleaseDestinatariosModal from "@/components/releases/ReleasesDestinatariosModal";
import ReleaseDadosEnvioEtapa from "@/components/releases/ReleaseDadosEnvioEtapa";
import ReleaseRevisaoEtapa from "@/components/releases/ReleaseRevisaoEtapa";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { listarClientes } from "@/services/api/cliente";
import ReleaseEtapas, {
  type EtapaRelease,
} from "@/components/releases/ReleaseEtapas";
import ReleaseDestinatariosCampo from "@/components/releases/ReleaseDestinatariosCampo";
import ReleaseTemplateEtapa from "@/components/releases/ReleaseTemplateEtapa";
import ReleaseConteudoEditor from "@/components/releases/ReleaseConteudoEditor";
import ReleaseEnvioTeste from "@/components/releases/ReleaseEnvioTeste";

import { avisoDominiosRelease } from "@/utils/releaseDominios";
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
  const conta = usuario ? usuario.assessoria_id + "-" + usuario.id : null;

  return <CadastroRelease key={conta ?? "sem-conta"} conta={conta} />;
}

function CadastroRelease({ conta }: { conta: string | null }) {
  const router = useRouter();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const conteudoScrollRef = useRef<View>(null);
  const { theme } = useTheme();
  const { temPermissao, usuario } = useAuth();

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
  const dadosEnvioIniciais = useRef<DadosEnvioRelease>({
    assunto: "",
    primeira_linha: "",
    nome_remetente: (usuario?.nome ?? "").slice(0, 100),
    responder_para: usuario?.email ?? "",
  });
  const [dadosEnvio, setDadosEnvio] = useState(dadosEnvioIniciais.current);

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

  // resultados
  const [resultado, setResultado] = useState<{
    acao: AcaoCadastroRelease;
    id: number;
  } | null>(null);
  const [confirmacaoEnvio, setConfirmacaoEnvio] =
    useState(false);

  const trava = useRef(false);
  const acaoSaida = useRef<NavigationAction | null>(null);
  const confirmando = pendente !== null;
  const bloqueado = salvando || confirmando || sucesso || imagemOcupada || confirmacaoEnvio;
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
      dadosEnvio.nome_remetente !== dadosEnvioIniciais.current.nome_remetente ||
      dadosEnvio.responder_para !== dadosEnvioIniciais.current.responder_para
    );

  usePreventRemove(salvando || imagemOcupada || temAlteracoesNaoSalvas, ({ data }) => {
    if (trava.current || imagemOcupada || acaoSaida.current) return;

    acaoSaida.current = data.action;
    Keyboard.dismiss();
    setAvisoSaidaAberto(true);
  });

  useEffect(() => {
    if (!conta) return;

    let ativa = true;

    lerReleasePendente(conta).then((registro) => {
      if (!ativa) return;

      if (registro) {
        const { dados } = registro;
        const blocosSalvos = dados.blocos ?? [];

        setTitulo(dados.titulo);
        setCliente(registro.cliente);
        setTemplate(registro.template ? { ...registro.template, blocos: blocosSalvos } : null);
        setBlocos(blocosSalvos);
        setDadosEnvio(dados.dados_envio);
        setSelecionados(registro.selecionados);
        setConteudoEditado(registro.conteudoEditado);
        setEtapa(registro.etapa);
        setPendente(registro);
      }

      setRecuperacao("pronta");
    }).catch(() => {
      if (ativa) setRecuperacao("falhou");
    });

    return () => { ativa = false; };
  }, [conta, tentativasRecuperacao]);

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
  ) {
    if (
      !conta ||
      trava.current ||
      !podeCriar ||
      imagemOcupada ||
      sucesso ||
      recuperacao !== "pronta"
    ) {
      return;
    }

    if (acao === "ENVIAR" && !podeEnviar) return;

    if (
      pendente &&
      (pendente.acao ?? "RASCUNHO") !== acao
    ) {
      setErro(
        "Conclua a tentativa pendente antes de iniciar outra ação."
      );
      return;
    }

    trava.current = true;
    setSalvando(true);
    setErro("");

    let registro = pendente;
    let fase: "CRIAR" | "ENVIAR" | "LIMPAR" = "CRIAR";

    try {
      if (!registro) {
        const novo: ReleasePendente = {
          acao,
          dados: {
            titulo,
            cliente_id: cliente?.id ?? null,
            jornalistas_ids: selecionados.map(
              (contato) => contato.id
            ),
            template_id: template?.id ?? null,
            template_codigo: template?.codigo ?? null,
            template_assinatura: template?.assinatura ?? null,
            blocos: template ? blocos : undefined,
            chave_rascunho: Crypto.randomUUID(),
            dados_envio: dadosEnvio,
          },
          etapa,
          cliente,
          template: template && {
            id: template.id,
            codigo: template.codigo,
            nome: template.nome,
            origem: template.origem,
            assinatura: template.assinatura,
            disponivel: template.disponivel,
          },
          selecionados,
          conteudoEditado,
        };

        await guardarReleasePendente(conta, novo);
        registro = novo;
        setPendente(novo);
      }

      // a mesma chave recupera o mesmo cadastro em uma repetição
      const criado = await criarRelease(registro.dados);

      registro = {
        ...registro,
        release_id: criado.id,
      };

      await guardarReleasePendente(conta, registro);
      setPendente(registro);

      if (acao === "ENVIAR") {
        fase = "ENVIAR";
        await solicitarEnvioRelease(criado.id);
      }

      fase = "LIMPAR";

      await removerReleasePendente(
        conta,
        registro.dados.chave_rascunho
      );

      setPendente(null);
      setResultado({ acao, id: criado.id });
      setSucesso(true);
    } catch (falha) {
      if (!registro) {
        setErro(
          "Não foi possível guardar a tentativa neste dispositivo. Tente novamente."
        );
        return;
      }

      if (
        fase === "CRIAR" &&
        falha instanceof ErroApiRelease &&
        (
          [400, 404, 409, 413, 422].includes(falha.status) ||
          (!pendente && falha.status === 403)
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
            "Não foi possível atualizar a tentativa salva neste dispositivo."
          );
          return;
        }
      }

      const mensagem =
        falha instanceof Error
          ? falha.message
          : "Não foi possível concluir a operação.";

      setErro(
        fase === "ENVIAR"
          ? "O release foi salvo, mas o envio ainda não foi confirmado. " +
              mensagem
          : mensagem
      );
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

    const temConteudo = blocos.some((bloco) => {
      if (
        ["imagem", "botao", "arquivo"].includes(bloco.tipo)
      ) {
        return Boolean(bloco.url?.trim());
      }

      return (
        !["divisor", "espacamento"].includes(bloco.tipo) &&
        Boolean(bloco.texto?.trim())
      );
    });

    const temDestinatarioIndisponivel =
      selecionados.some(
        (contato) =>
          !contato.email?.trim() ||
          contato.elegivel === false
      );

    if (
      !titulo.trim() ||
      !dadosEnvio.assunto.trim() ||
      !template ||
      !selecionados.length ||
      temDestinatarioIndisponivel ||
      !temConteudo
    ) {
      setErro(
        "Para enviar, preencha o título, o assunto, o conteúdo e os destinatários."
      );
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

  function continuarEditando() {
    acaoSaida.current = null;
    setAvisoSaidaAberto(false);
  }

  function descartarESair() {
    const acao = acaoSaida.current;
    continuarEditando();
    if (acao) navigation.dispatch(acao);
  }

  function voltarParaLista() {
    router.dismissTo("/releases");
  }

  function voltar() {
    if (trava.current || sucesso || imagemOcupada) return;

    if (!confirmando && recuperacao === "pronta" && etapaAnterior) {
      mudarEtapa(etapaAnterior);
      return;
    }

    if (router.canGoBack()) router.back();
    else voltarParaLista();
  }

  if (recuperacao !== "pronta") {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Novo release" showBackButton onBackPress={voltar} />
        <View style={styles.content}>
          {recuperacao === "carregando" ? (
            <Text>Verificando rascunhos neste dispositivo…</Text>
          ) : (
            <>
              <Text style={{ color: theme.erro }}>
                Não foi possível recuperar o rascunho salvo neste dispositivo.
              </Text>
              <Button
                title="TENTAR NOVAMENTE"
                onPress={() => {
                  setRecuperacao("carregando");
                  setTentativasRecuperacao((atual) => atual + 1);
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
              podeEnviar ? (
                <Button
                  title="ENVIAR RELEASE"
                  icon="paper-plane-outline"
                  disabled={bloqueado || !podeCriar}
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

                <Text style={{ color: theme.textoSub }}>
                    Você pode salvar o rascunho com o preenchimento incompleto.
                </Text>

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
        visible={avisoSaidaAberto}
        variant="warning"
        title="Sair do novo release?"
        message="Se sair agora, você perderá tudo o que preencheu neste release."
        primaryLabel="SAIR"
        secondaryLabel="CONTINUAR"
        primaryDanger
        onPrimary={descartarESair}
        onSecondary={continuarEditando}
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
        visible={sucesso}
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