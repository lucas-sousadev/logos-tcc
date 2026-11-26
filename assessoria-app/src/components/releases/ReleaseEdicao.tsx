import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from "react-native";
import SecaoEdicao from "@/components/forms/SecaoEdicao";
import SalvarAlteracoes from "@/components/forms/SalvarAlteracoes";
import { useEffect, useRef, useState } from "react";

import { useNavigation, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  usePreventRemove,
  useIsFocused,
  type NavigationAction,
} from "expo-router/react-navigation";

import Header from "@/components/layout/Header";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";
import { useRascunhoRelease } from "@/hooks/useRascunhoRelease";
import { lerCopiaRelease } from "@/services/rascunhoRelease";
import { lerReleasePendente } from "@/services/releasePendente";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ClippingContexto from "@/components/clipping/ClippingContexto";
import ReleaseEtapas, { type EtapaRelease } from "./ReleaseEtapas";
import ReleaseDestinatariosCampo from "./ReleaseDestinatariosCampo";
import ReleaseDestinatariosModal from "./ReleasesDestinatariosModal";
import ReleaseTemplateEtapa from "./ReleaseTemplateEtapa";
import ReleaseConteudoEditor from "./ReleaseConteudoEditor";
import ReleaseDadosEnvioEtapa from "./ReleaseDadosEnvioEtapa";
import ReleaseRevisaoEtapa from "./ReleaseRevisaoEtapa";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { listarClientes } from "@/services/api/cliente";
import {
  buscarRelease,
  ErroApiRelease,
  type DadosEdicaoRelease,
  type DetalheRelease,
  type DestinatarioRelease,
  type TemplateRelease,
} from "@/services/api/release";

const ETAPAS: EtapaRelease[] = [
  "DESTINO",
  "TEMPLATE",
  "CONTEUDO",
  "ENVIO",
  "REVISAO",
];

const TITULOS_ETAPAS: Record<EtapaRelease, string> = {
  DESTINO: "Destinatários",
  TEMPLATE: "Template",
  CONTEUDO: "Conteúdo",
  ENVIO: "Dados do e-mail",
  REVISAO: "Revisão",
};

export default function ReleaseEdicao({ id }: { id: number }) {
  const { theme } = useTheme();
  const { temPermissao, usuario } = useAuth();
  const router = useRouter();
  const conta = usuario ? usuario.assessoria_id + "-" + usuario.id : null;

  const podeEditar =
    temPermissao("RELEASES", "EDITAR") &&
    temPermissao("RELEASES", "VISUALIZAR");

  const [release, setRelease] = useState<DetalheRelease | null>(null);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [identidade, setIdentidade] = useState("editar-" + id);
  const [possuiTentativaPendente, setPossuiTentativaPendente] = useState(false);

  useEffect(() => {
    if (!id || !podeEditar || !conta) return;

    const controller = new AbortController();
    let ativo = true;
    const timer = setTimeout(() => controller.abort(), 30_000);

    (async () => {
      let origem = "editar-" + id;
      let copia = await lerCopiaRelease(conta, origem);
      let nova: Awaited<ReturnType<typeof lerCopiaRelease>> = null;
      if (!copia || copia.encerrado) {
        nova = await lerCopiaRelease(conta, "novo");
        if (nova && !nova.encerrado && nova.remoto?.id === id) {
          copia = nova;
          origem = "novo";
        }
      }

      const pendente = await lerReleasePendente(conta);
      let dados: DetalheRelease;
      try {
        dados = await buscarRelease(id, controller.signal);
      } catch (falha) {
        if (
          (falha instanceof ErroApiRelease &&
            [401, 403, 404].includes(falha.status)) ||
          !copia ||
          copia.encerrado ||
          copia.remoto?.id !== id
        )
          throw falha;
        dados = copia.remoto;
      }

      if (
        nova &&
        !nova.encerrado &&
        dados.criado_por === usuario?.id &&
        nova.valor.dados.chave_rascunho === dados.chave_rascunho
      ) {
        copia = nova;
        origem = "novo";
      }

      if (
        pendente &&
        (pendente.release_id === id ||
          (dados.criado_por === usuario?.id &&
            pendente.dados.chave_rascunho === dados.chave_rascunho) ||
          pendente.dados.chave_rascunho === copia?.valor.dados.chave_rascunho)
      ) {
        if (ativo) setPossuiTentativaPendente(true);
        throw new Error(
          "Há uma tentativa de salvamento ou envio aguardando confirmação. Abra Novo release para concluí-la antes de editar."
        );
      }

      if (ativo) {
        setIdentidade(origem);
        setRelease(dados);
      }
    })()
      .catch((falha) => {
        if (ativo) {
          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível abrir o rascunho."
          );
        }
      })
      .finally(() => clearTimeout(timer));

    return () => {
      ativo = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [id, podeEditar, tentativa, conta, usuario?.id]);

  if (podeEditar && release?.status === "RASCUNHO") {
    return (
      <FormularioEdicao
        key={conta + "-" + release.id}
        release={release}
        conta={conta}
        identidade={identidade}
      />
    );
  }

  const mensagem = !id
    ? "Release inválido."
    : !podeEditar
      ? "Você não possui permissão para editar releases."
      : release
        ? "Somente rascunhos podem ser editados."
        : erro;

  return (
    <View style={[styles.tela, { backgroundColor: theme.background }]}>
      <Header title="Editar release" showBackButton backFallback="/releases" />

      <View style={styles.conteudo}>
        {mensagem ? (
          <Text style={{ color: theme.erro }}>{mensagem}</Text>
        ) : (
          <ActivityIndicator color={theme.primaria} />
        )}

        {erro && !release ? (
          <Button
            title={
              possuiTentativaPendente
                ? "CONFIRMAR TENTATIVA"
                : "TENTAR NOVAMENTE"
            }
            onPress={() => {
              if (possuiTentativaPendente) {
                router.replace("/releases/novo");
                return;
              }
              setErro("");
              setTentativa((atual) => atual + 1);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function FormularioEdicao({
  release,
  conta,
  identidade,
}: {
  release: DetalheRelease;
  conta: string | null;
  identidade: string;
}) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const retornar = useRetornoSeguro("/releases");

  const scroll = useRef<ScrollView>(null);
  const corpo = useRef<View>(null);
  const trava = useRef(false);
  const acaoSaida = useRef<NavigationAction | null>(null);

  const podeMailing = temPermissao("MAILING", "VISUALIZAR");
  const podeClientes = temPermissao("CLIENTES", "VISUALIZAR");

  const [etapa, setEtapa] = useState<EtapaRelease>("DESTINO");
  const [chave, setChave] = useState(() => Crypto.randomUUID());

  const [dados, setDados] = useState<DadosEdicaoRelease>({
    versao_edicao: release.versao_edicao,
    titulo: release.titulo,
    cliente_id: release.cliente_id,
    jornalistas_ids: release.destinatarios.flatMap((d) =>
      d.jornalista_id === null ? [] : [d.jornalista_id]
    ),
    template_id: release.template_id,
    template_codigo: release.template_codigo,
    template_assinatura: "",
    blocos: release.blocos,
    dados_envio: {
      assunto: release.assunto,
      primeira_linha: release.primeira_linha,
      nome_remetente: release.nome_remetente,
      responder_para: release.responder_para,
    },
  });

  const [cliente, setCliente] = useState<{
    id: number;
    nome: string;
  } | null>(
    release.cliente_id === null
      ? null
      : {
          id: release.cliente_id,
          nome: release.cliente_nome ?? "Cliente vinculado",
        }
  );

  const [selecionados, setSelecionados] = useState<DestinatarioRelease[]>(
    release.destinatarios.flatMap((d) =>
      d.jornalista_id === null
        ? []
        : [
            {
              id: d.jornalista_id,
              nome: d.jornalista_nome ?? d.email,
              email: podeMailing ? (d.jornalista_email ?? d.email) : d.email,
              veiculo_nome: d.veiculo_nome,
              ativo: Number(d.jornalista_ativo ?? 0),
              elegivel:
                Number(d.jornalista_ativo) === 1 &&
                Boolean(d.jornalista_email?.trim()),
            },
          ]
    )
  );

  const [template, setTemplate] = useState<TemplateRelease | null>(
    release.template_id !== null ||
      release.template_codigo !== null ||
      release.blocos.length > 0
      ? {
          id: release.template_id,
          codigo: release.template_codigo,
          nome: "Conteúdo salvo do release",
          origem: release.template_codigo ? "LOGOS" : "ASSESSORIA",
          assinatura: "",
          disponivel: true,
          blocos: release.blocos,
        }
      : null
  );

  const [troca, setTroca] = useState<{
    modelo: TemplateRelease;
    editar: boolean;
  } | null>(null);

  const [seletor, setSeletor] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [imagemOcupada, setImagemOcupada] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [idSalvo, setIdSalvo] = useState(release.id);
  const [erro, setErro] = useState("");
  const [avisoSaida, setAvisoSaida] = useState(false);
  const [confirmarRecuperacao, setConfirmarRecuperacao] = useState(false);
  const [transferido, setTransferido] = useState(false);
  const focada = useIsFocused();

  const copiaAtual = {
    dados: {
      titulo: dados.titulo,
      cliente_id: dados.cliente_id,
      jornalistas_ids: dados.jornalistas_ids,
      chave_rascunho: chave,
      template_id: dados.template_id,
      template_codigo: dados.template_codigo,
      template_assinatura: dados.template_assinatura ?? "",
      blocos: dados.blocos,
      dados_envio: dados.dados_envio,
    },
    etapa,
    cliente,
    selecionados,
    conteudoEditado: alterado,
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

  const automatico = useRascunhoRelease({
    conta,
    identidade,
    valor: copiaAtual,
    base: release,
    habilitado: !salvando && !salvo && !transferido,
    ocupado: imagemOcupada,
    podeMailing,
    onRecuperar: (registro) => {
      const d = registro.dados;
      setChave(d.chave_rascunho);
      setDados({
        versao_edicao: release.versao_edicao,
        titulo: d.titulo,
        cliente_id: d.cliente_id,
        jornalistas_ids: d.jornalistas_ids,
        template_id: d.template_id ?? null,
        template_codigo: d.template_codigo ?? null,
        template_assinatura: d.template_assinatura ?? "",
        blocos: d.blocos ?? [],
        dados_envio: d.dados_envio,
      });
      setCliente(registro.cliente);
      setSelecionados(registro.selecionados);
      setTemplate(
        registro.template
          ? { ...registro.template, blocos: d.blocos ?? [] }
          : null
      );
      setEtapa(registro.etapa);
      setAlterado(registro.conteudoEditado);
    },
  });
  const bloqueado =
    salvando ||
    imagemOcupada ||
    salvo ||
    transferido ||
    confirmarRecuperacao ||
    !automatico.pronto;
  const disponiveis = template ? ETAPAS : ETAPAS.slice(0, 2);
  const indice = ETAPAS.indexOf(etapa);
  const etapaAnterior: EtapaRelease | undefined = ETAPAS[indice - 1];
  const proximaEtapa: EtapaRelease | undefined = ETAPAS[indice + 1];

  usePreventRemove(
    !salvo && !transferido && (alterado || salvando || imagemOcupada),
    ({ data }) => {
      if (trava.current || imagemOcupada || acaoSaida.current) return;

      acaoSaida.current = data.action;
      setAvisoSaida(true);
    }
  );

  useEffect(() => {
    if (transferido && !salvando && focada) router.replace("/releases/novo");
  }, [transferido, salvando, focada, router]);

  function alterar(
    patch:
      | Partial<DadosEdicaoRelease>
      | ((atual: DadosEdicaoRelease) => Partial<DadosEdicaoRelease>)
  ) {
    if (bloqueado) return;

    setDados((atual) => ({
      ...atual,
      ...(typeof patch === "function" ? patch(atual) : patch),
    }));

    setAlterado(true);
    setErro("");
  }

  function voltar() {
    if (trava.current || imagemOcupada || confirmarRecuperacao) return;

    retornar();
  }

  function mudarEtapa(nova: EtapaRelease) {
    if (bloqueado || !disponiveis.includes(nova)) return;

    setEtapa(nova);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function aplicarTemplate(modelo: TemplateRelease, editar: boolean) {
    if (bloqueado) return;

    setTemplate(modelo);

    alterar({
      template_id: modelo.id,
      template_codigo: modelo.codigo,
      template_assinatura: modelo.assinatura,
      blocos: modelo.blocos.map((b) => ({ ...b })),
    });

    setTroca(null);

    if (editar) {
      setEtapa("CONTEUDO");
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  }

  function escolherTemplate(modelo: TemplateRelease, editar = false) {
    if (bloqueado || !modelo.disponivel) return;

    if (
      template?.id === modelo.id &&
      template?.codigo === modelo.codigo &&
      template?.assinatura === modelo.assinatura
    ) {
      if (editar) mudarEtapa("CONTEUDO");
      return;
    }

    if (dados.blocos.length) setTroca({ modelo, editar });
    else aplicarTemplate(modelo, editar);
  }

  function atualizarSelecionados(contatos: DestinatarioRelease[]) {
    if (bloqueado) return;

    setSelecionados(contatos);
    alterar({ jornalistas_ids: contatos.map((d) => d.id) });
  }

  function mostrarCampo(campo: TextInput) {
    if (!corpo.current) return;

    campo.measureLayout(
      corpo.current,
      (_x, y) =>
        scroll.current?.scrollTo({
          y: Math.max(0, y - 48),
          animated: false,
        }),
      () => {}
    );
  }

  async function sairComCopia() {
    if (trava.current) return;
    trava.current = true;
    setSalvando(true);
    try {
      await automatico.guardarLocal();
      const acao = acaoSaida.current;
      acaoSaida.current = null;
      setAvisoSaida(false);
      if (acao) navigation.dispatch(acao);
    } catch {
      acaoSaida.current = null;
      setAvisoSaida(false);
      setErro("Não foi possível guardar a cópia local. Salve antes de sair.");
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  async function salvar() {
    if (trava.current || bloqueado || !alterado) return;

    trava.current = true;
    setSalvando(true);
    setErro("");

    try {
      const confirmado = await automatico.confirmar();
      await automatico.concluir();
      setIdSalvo(confirmado.id);
      setAlterado(false);
      setSalvo(true);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível atualizar o rascunho."
      );
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  async function usarVersaoServidor() {
    if (trava.current || imagemOcupada) return;
    trava.current = true;
    setSalvando(true);
    setErro("");
    try {
      if (automatico.remotoAusente) {
        if (!temPermissao("RELEASES", "CRIAR"))
          throw new Error(
            "Você precisa da permissão de criar releases para recuperar este conteúdo."
          );
        await automatico.recuperarComoNovo();
        setAlterado(false);
        setTransferido(true);
      } else {
        await automatico.recarregarDoServidor();
      }
      setConfirmarRecuperacao(false);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível carregar a versão do servidor."
      );
      setConfirmarRecuperacao(false);
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  if (!automatico.pronto || transferido) {
    return (
      <View style={[styles.tela, { backgroundColor: theme.background }]}>
        <Header title="Editar release" showBackButton onBackPress={voltar} />
        <View style={styles.conteudo}>
          <Text>
            {transferido
              ? "Abrindo o rascunho recuperado…"
              : automatico.mensagem || "Recuperando o preenchimento…"}
          </Text>
          {automatico.erro && !transferido ? (
            <Button
              title="TENTAR NOVAMENTE"
              onPress={automatico.tentarRecuperar}
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <EdicaoCompacta ativa={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.tela, { backgroundColor: theme.background }]}
      >
        <Header title="Editar release" showBackButton onBackPress={voltar} />

        <View style={styles.etapas}>
          <ReleaseEtapas
            atual={etapa}
            disponiveis={disponiveis}
            disabled={bloqueado}
            onSelecionar={mudarEtapa}
          />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
          keyboardDismissMode="on-drag"
        >
          <View ref={corpo} collapsable={false} style={styles.conteudo}>
            <View style={styles.cabecalho}>
              <Text weight="Bold" style={styles.titulo}>
                {TITULOS_ETAPAS[etapa]}
              </Text>

              <Text style={{ color: theme.textoSub, fontSize: 12 }}>
                Etapa {indice + 1} de {ETAPAS.length}
              </Text>
            </View>

            {etapa === "DESTINO" ? (
              <SecaoEdicao titulo="Destino do release">
                <Input
                  label="TÍTULO INTERNO"
                  value={dados.titulo}
                  maxLength={150}
                  editable={!bloqueado}
                  onChangeText={(titulo) => alterar({ titulo })}
                  placeholder="Identifique esse release"
                  containerStyle={styles.campo}
                  clearable
                />

                <ClippingContexto
                  apenasCliente
                  clienteId={cliente?.id ?? null}
                  clienteNome={cliente?.nome ?? ""}
                  ano={new Date().getFullYear()}
                  anoPelaData={false}
                  buscarClientes={listarClientes}
                  disabled={bloqueado || !podeClientes}
                  onCliente={(valor) => {
                    setCliente({ id: valor.id, nome: valor.nome });
                    alterar({ cliente_id: valor.id });
                  }}
                  style={styles.campo}
                />

                {cliente && podeClientes ? (
                  <Button
                    title="REMOVER CLIENTE"
                    size="small"
                    variant="outline"
                    disabled={bloqueado}
                    onPress={() => {
                      setCliente(null);
                      alterar({ cliente_id: null });
                    }}
                  />
                ) : null}

                <ReleaseDestinatariosCampo
                  selecionados={selecionados}
                  disabled={bloqueado || !podeMailing}
                  onPress={() => setSeletor(true)}
                />

                {!podeMailing ? (
                  <Text style={{ color: theme.textoSub }}>
                    Solicite acesso ao Mailing para escolher destinatários.
                  </Text>
                ) : null}
              </SecaoEdicao>
            ) : etapa === "TEMPLATE" ? (
              <>
                {template ? (
                  <Text style={{ color: theme.textoSub, fontSize: 12 }}>
                    Atual: {template.nome}
                  </Text>
                ) : null}

                <ReleaseTemplateEtapa
                  selecionado={template}
                  disabled={bloqueado}
                  onSelecionar={(modelo) => escolherTemplate(modelo)}
                  onEditar={(modelo) => escolherTemplate(modelo, true)}
                />
              </>
            ) : etapa === "CONTEUDO" ? (
              <ReleaseConteudoEditor
                blocos={dados.blocos}
                nomeTemplate={template?.nome ?? ""}
                disabled={bloqueado}
                imagemOcupada={imagemOcupada}
                onImagemOcupadaChange={setImagemOcupada}
                onMostrarCampo={mostrarCampo}
                onChange={(fn) =>
                  alterar((atual) => ({ blocos: fn(atual.blocos) }))
                }
              />
            ) : etapa === "ENVIO" ? (
              <ReleaseDadosEnvioEtapa
                dados={dados.dados_envio}
                disabled={bloqueado}
                onChange={(campo, valor) =>
                  alterar((atual) => ({
                    dados_envio: {
                      ...atual.dados_envio,
                      [campo]: valor,
                    },
                  }))
                }
              />
            ) : (
              <ReleaseRevisaoEtapa
                titulo={dados.titulo}
                clienteNome={cliente?.nome ?? null}
                templateNome={template?.nome ?? ""}
                dadosEnvio={dados.dados_envio}
                blocos={dados.blocos}
                selecionados={selecionados}
                disabled={bloqueado}
                podeSelecionarDestinatarios={podeMailing}
                onEditar={mudarEtapa}
                onVerDestinatarios={() => setSeletor(true)}
              />
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
                disabled={bloqueado || !disponiveis.includes(proximaEtapa)}
                onPress={() => mudarEtapa(proximaEtapa)}
              />
            ) : null}

            <View style={styles.acoes}>
              {etapaAnterior ? (
                <Button
                  title="VOLTAR"
                  variant="outline"
                  style={styles.botao}
                  disabled={bloqueado}
                  onPress={() => mudarEtapa(etapaAnterior)}
                />
              ) : null}

              {!etapaAnterior && proximaEtapa ? (
                <Button
                  title="PRÓXIMO"
                  style={styles.botao}
                  disabled={bloqueado || !disponiveis.includes(proximaEtapa)}
                  onPress={() => mudarEtapa(proximaEtapa)}
                />
              ) : null}
            </View>

            <Text
              accessibilityLiveRegion="polite"
              style={{ color: automatico.erro ? theme.aviso : theme.textoSub }}
            >
              {automatico.mensagem ||
                "O preenchimento será salvo automaticamente, mesmo incompleto."}
            </Text>

            {automatico.conflito && automatico.idRemoto ? (
              <Button
                title="CONFERIR"
                variant="outline"
                disabled={bloqueado}
                onPress={() => setConfirmarRecuperacao(true)}
              />
            ) : null}

            {automatico.remotoAusente && temPermissao("RELEASES", "CRIAR") ? (
              <Button
                title="RECUPERAR"
                variant="outline"
                disabled={bloqueado}
                onPress={() => setConfirmarRecuperacao(true)}
              />
            ) : null}

            {erro ? (
              <Text accessibilityRole="alert" style={{ color: theme.erro }}>
                {erro}
              </Text>
            ) : null}
          </View>
        </ScrollView>
        <SalvarAlteracoes
          changed={alterado}
          saving={salvando}
          busy={imagemOcupada}
          disabled={bloqueado}
          error={erro}
          onSave={() => void salvar()}
          onDiscard={voltar}
        />

        {seletor ? (
          <ReleaseDestinatariosModal
            selecionados={selecionados}
            onClose={() => setSeletor(false)}
            onAlternar={(contato) =>
              atualizarSelecionados(
                selecionados.some((d) => d.id === contato.id)
                  ? selecionados.filter((d) => d.id !== contato.id)
                  : [...selecionados, contato]
              )
            }
            onAdicionar={(contatos) =>
              atualizarSelecionados([
                ...new Map(
                  [...selecionados, ...contatos].map((d) => [d.id, d])
                ).values(),
              ])
            }
          />
        ) : null}

        <FeedbackAlert
          inline
          visible={troca !== null}
          variant="warning"
          title="Trocar o template?"
          message="O conteúdo atual do rascunho será substituído pelo conteúdo do modelo selecionado."
          primaryLabel="TROCAR"
          secondaryLabel="CANCELAR"
          onPrimary={() => {
            if (troca) aplicarTemplate(troca.modelo, troca.editar);
          }}
          onClose={() => setTroca(null)}
          onSecondary={() => setTroca(null)}
        />

        <FeedbackAlert
          inline
          visible={confirmarRecuperacao}
          variant="warning"
          title={
            automatico.remotoAusente
              ? "Recuperar este rascunho?"
              : "Usar a versão do servidor?"
          }
          message={
            automatico.remotoAusente
              ? "O release não está mais disponível no servidor. Seu conteúdo local será recuperado em um novo cadastro, mantendo os campos preenchidos."
              : "O preenchimento desta tela será substituído pela versão salva no servidor. Suas alterações locais só serão substituídas depois que essa versão for carregada com sucesso."
          }
          primaryLabel={automatico.remotoAusente ? "RECUPERAR" : "USAR"}
          secondaryLabel="MANTER"
          primaryDanger
          loading={salvando}
          onPrimary={() => void usarVersaoServidor()}
          onClose={() => setConfirmarRecuperacao(false)}
          onSecondary={() => setConfirmarRecuperacao(false)}
        />

        <FeedbackAlert
          inline
          visible={avisoSaida}
          variant="warning"
          title="Sair da edição?"
          message="Seu preenchimento será guardado neste aparelho para continuar depois. Se a sincronização estiver pendente, ele ainda não estará atualizado em outros dispositivos."
          loading={salvando}
          primaryLabel="SAIR"
          secondaryLabel="CONTINUAR"
          primaryDanger
          onClose={() => {
            acaoSaida.current = null;
            setAvisoSaida(false);
          }}
          onSecondary={() => {
            acaoSaida.current = null;
            setAvisoSaida(false);
          }}
          onPrimary={() => void sairComCopia()}
        />

        <FeedbackAlert
          inline
          visible={salvo}
          variant="success"
          title="Rascunho atualizado"
          message="As alterações foram salvas. Confira o release antes de enviar."
          primaryLabel="VER RELEASE"
          onPrimary={() =>
            router.dismissTo({
              pathname: "/releases/[id]",
              params: { id: String(idSalvo) },
            })
          }
          onClose={() =>
            router.dismissTo({
              pathname: "/releases/[id]",
              params: { id: String(idSalvo) },
            })
          }
        />
      </KeyboardAvoidingView>
    </EdicaoCompacta>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  etapas: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  conteudo: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  cabecalho: {
    gap: 2,
  },
  titulo: {
    fontSize: 20,
  },
  campo: {
    marginBottom: 0,
  },
  acoes: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  botao: {
    flex: 1,
    width: "auto",
    minWidth: 0,
    paddingHorizontal: 8,
  },
});
