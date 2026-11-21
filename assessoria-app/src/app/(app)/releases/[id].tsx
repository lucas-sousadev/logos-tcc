import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";

import Header from "@/components/layout/Header";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ReleaseBlocosPrevia from "@/components/releases/ReleaseBlocosPrevia";
import ReleaseResumoCard from "@/components/releases/ReleaseResumoCard";

import { pendenciasEnvioRelease,} from "@/utils/validarEnvioRelease";
import { avisoDominiosRelease } from "@/utils/releaseDominios";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { encerrarCopiaRelease } from "@/services/rascunhoRelease";
import { lerReleasePendente, removerReleasePendente } from "@/services/releasePendente";
import {
  buscarRelease,
  consultarEnvioRelease,
  solicitarEnvioRelease,
  ErroApiRelease,
  excluirRelease,
  repetirFalhasRelease,
  type DetalheRelease,
  type SituacaoEnvioRelease,
  type StatusDestinatarioRelease,
} from "@/services/api/release";

const EM_ANDAMENTO = ["NA_FILA", "ENVIANDO"];

const FILTROS = [
  { valor: "TODOS", nome: "Todos" },
  { valor: "ENVIADO", nome: "Aceitos" },
  { valor: "ERRO", nome: "Falhas" },
] as const;

const ROTULOS_DESTINATARIO: Record<
  StatusDestinatarioRelease,
  string
> = {
  PENDENTE: "Na fila",
  ENVIANDO: "Processando",
  ENVIADO: "Aceito para encaminhamento",
  ERRO: "Falha no envio",
};

export default function DetalhesRelease() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();

  const numero =
    typeof id === "string" && /^[1-9]\d*$/.test(id)
      ? Number(id)
      : 0;

  const valido =
    Number.isSafeInteger(numero) && numero > 0;

  return (
    <ConteudoRelease
      key={
        (usuario
          ? usuario.assessoria_id + "-" + usuario.id
          : "") +
        "-" +
        id
      }
      id={valido ? numero : 0}
    />
  );
}

function ConteudoRelease({ id }: { id: number }) {
  const { theme } = useTheme();
  const { temPermissao, usuario } = useAuth();
  const router = useRouter();
  const podeVer = temPermissao("RELEASES", "VISUALIZAR");
  const podeEnviar = temPermissao("RELEASES", "ENVIAR");
  const trava = useRef(false);

  const [release, setRelease] = useState<DetalheRelease | null>(null);
  const [envio, setEnvio] = useState<SituacaoEnvioRelease | null>(null);
  const pendenciasEnvio = release
    ? pendenciasEnvioRelease({
        titulo: release.titulo,

        templateDefinido: Boolean(
          release.template_id ||
          release.template_codigo ||
          release.blocos.length
        ),

        dadosEnvio: {
          assunto: release.assunto,
          primeira_linha: release.primeira_linha,
          nome_remetente: release.nome_remetente,
          responder_para: release.responder_para,
        },

        blocos: release.blocos,
        destinatarios: release.destinatarios,
      })
    : ["Aguarde o carregamento do release."];

  const [consulta, setConsulta] = useState<{
    page: number;
    status: StatusDestinatarioRelease | "TODOS";
  }>({ page: 1, status: "TODOS" });

  const [carregando, setCarregando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroEnvio, setErroEnvio] = useState("");
  const avisoDominios = avisoDominiosRelease(
    (release?.destinatarios ?? []).map((d) => d.email)
  );

  const podeEditar = temPermissao("RELEASES", "EDITAR");
  const podeExcluir = temPermissao("RELEASES", "EXCLUIR");

  const [repetindo, setRepetindo] = useState(false);
  const [confirmarRepeticao, setConfirmarRepeticao] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const saida = useSaidaFormulario(
    false,
    enviando || excluindo || repetindo
  );
    
  useFocusEffect(
    useCallback(() => {
      if (!podeVer || !id) {
        setErro(
          !id
            ? "Release inválido."
            : "Você não possui permissão para visualizar releases."
        );
        setCarregando(false);
        return;
      }

      let ativa = true;
      let snapshotCarregado = false;
      let continuar = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let controller: AbortController | undefined;

      async function atualizar() {
        controller = new AbortController();

        const prazo = setTimeout(
          () => controller?.abort(),
          30_000
        );

        try {
          const [situacao, snapshot] = await Promise.all([
            consultarEnvioRelease(
              id,
              consulta,
              controller.signal
            ),
            snapshotCarregado
              ? Promise.resolve(null)
              : buscarRelease(id, controller.signal),
          ]);

          if (!ativa) return;

          const ultima = Math.max(
            1,
            Math.ceil(situacao.pagination.total / 30)
          );

          if (consulta.page > ultima) {
            setConsulta((atual) => ({
              ...atual,
              page: ultima,
            }));
            return;
          }

          if (snapshot) {
            setRelease(snapshot);
            snapshotCarregado = true;
          }

          setEnvio(situacao);
          setErro("");
          continuar = EM_ANDAMENTO.includes(
            situacao.release.status
          );
        } catch (falha) {
          if (!ativa) return;

          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível consultar o release."
          );

          if (
            falha instanceof ErroApiRelease &&
            [401, 403, 404, 422].includes(falha.status)
          ) {
            continuar = false;
          }
        } finally {
          clearTimeout(prazo);

          if (ativa) {
            setCarregando(false);

            if (continuar) {
              timer = setTimeout(
                () => void atualizar(),
                5000
              );
            }
          }
        }
      }

      setCarregando(true);
      void atualizar();

      return () => {
        ativa = false;
        clearTimeout(timer);
        controller?.abort();
      };
    }, [id, consulta, podeVer])
  );

  async function enviar() {
    if (
      trava.current ||
      !podeEnviar ||
      envio?.release.status !== "RASCUNHO"
    ) {
      return;
    }

    if (pendenciasEnvio.length > 0) {
      setErroEnvio(pendenciasEnvio.join("\n"));
      return;
    }

    trava.current = true;
    setEnviando(true);
    setErroEnvio("");

    try {
      setEnvio(await solicitarEnvioRelease(id, release?.versao_edicao));
      await encerrarRascunhoLocal();
      setConfirmar(false);
    } catch (falha) {
      setErroEnvio(
        falha instanceof Error
          ? falha.message
          : "Não foi possível solicitar o envio."
      );
      setConfirmar(false);
    } finally {
      setConsulta({ page: 1, status: "TODOS" });
      trava.current = false;
      setEnviando(false);
    }
  }

  async function pedirExclusao() {
    if (trava.current || !podeExcluir) return;

    trava.current = true;
    setExcluindo(true);
    setErroExclusao("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const atual = await buscarRelease(id, controller.signal);

      if (
        !["RASCUNHO", "ENVIADO", "PARCIAL", "FALHOU"].includes(
          atual.status
        )
      ) {
        throw new Error(
          "Não é possível excluir um release agendado, na fila ou em processamento."
        );
      }

      setRelease(atual);
      setConfirmarExclusao(true);
    } catch (falha) {
      setErroExclusao(
        falha instanceof Error
          ? falha.message
          : "Não foi possível consultar o release."
      );
    } finally {
      clearTimeout(timer);
      trava.current = false;
      setExcluindo(false);
    }
  }

  async function excluir() {
    if (trava.current || !podeExcluir || !release) return;

    trava.current = true;
    setExcluindo(true);
    setErroExclusao("");

    try {
      await excluirRelease(id, release.versao_edicao);
      await encerrarRascunhoLocal();
      setConfirmarExclusao(false);
      saida.concluirSaida(() => router.dismissTo("/releases"));
    } catch (falha) {
      setErroExclusao(
        falha instanceof Error
          ? falha.message
          : "Não foi possível excluir o release."
      );
    } finally {
      trava.current = false;
      setExcluindo(false);
    }
  }

  async function encerrarRascunhoLocal() {
    if (!usuario) return;
    const conta = usuario.assessoria_id + "-" + usuario.id;
    const chavePropria = release?.criado_por === usuario.id ? release.chave_rascunho ?? undefined : undefined;
    await encerrarCopiaRelease(conta, "editar-" + id, id, chavePropria);
    await encerrarCopiaRelease(conta, "novo", id, chavePropria);
    const pendente = await lerReleasePendente(conta);
    if (pendente && (pendente.release_id === id ||
      pendente.dados.chave_rascunho === chavePropria)) {
      await removerReleasePendente(conta, pendente.dados.chave_rascunho);
    }
  }

  async function repetirFalhas() {
    if (
      trava.current ||
      !podeEnviar ||
      !envio ||
      !["PARCIAL", "FALHOU"].includes(envio.release.status) ||
      envio.totais.repetiveis === 0
    ) {
      return;
    }

    trava.current = true;
    setRepetindo(true);
    setErroEnvio("");

    try {
      const atualizado = await repetirFalhasRelease(id);
      setEnvio(atualizado);
    } catch (falha) {
      setErroEnvio(
        falha instanceof Error
          ? falha.message
          : "Não foi possível solicitar uma nova tentativa."
      );
    } finally {
      setConfirmarRepeticao(false);
      setConsulta({ page: 1, status: "TODOS" });
      trava.current = false;
      setRepetindo(false);
    }
  }

  return (
    <View
      style={[
        styles.tela,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title="Release"
        showBackButton
        backFallback="/releases"
        />

      <ScrollView contentContainerStyle={styles.conteudo}>
        <View style={styles.corpo}>
          {carregando ? (
            <ActivityIndicator color={theme.primaria} />
          ) : null}

          {erro ? (
            <View style={styles.grupo}>
              <Text style={{ color: theme.erro }}>
                {erro}
              </Text>

              {podeVer && id > 0 ? (
                <Button
                  title="ATUALIZAR"
                  variant="outline"
                  onPress={() =>
                    setConsulta((atual) => ({ ...atual }))
                  }
                />
              ) : null}
            </View>
          ) : null}

          {release && envio && podeVer ? (
            <>
            <View style={styles.linha}>
                {podeEditar && envio.release.status === "RASCUNHO" ? (
                  <Button
                    title="EDITAR"
                    icon="create-outline"
                    variant="outline"
                    style={styles.botao}
                    disabled={carregando || enviando || excluindo}
                    onPress={() =>
                      router.push({
                        pathname: "/releases/novo",
                        params: { editar: String(id) },
                      })
                    }
                  />
                ) : null}

                {podeExcluir &&
                ["RASCUNHO", "ENVIADO", "PARCIAL", "FALHOU"].includes(
                  envio.release.status
                ) ? (
                  <Button
                    title="EXCLUIR"
                    variant="danger"
                    style={styles.botao}
                    loading={excluindo}
                    disabled={carregando || enviando}
                    onPress={() => void pedirExclusao()}
                  />
                ) : null}
              </View>

              {erroExclusao ? (
                <Text style={{ color: theme.erro }}>
                  {erroExclusao}
                </Text>
              ) : null}

              <ReleaseResumoCard
                release={release}
                status={envio.release.status}
              />

              <View style={styles.linha}>
                {[
                  [
                    envio.totais.pendentes +
                      envio.totais.processando,
                    "Em aberto",
                  ],
                  [envio.totais.aceitos, "Aceitos"],
                  [envio.totais.falhas, "Falhas"],
                ].map(([numero, nome]) => (
                  <View
                    key={nome}
                    style={[
                      styles.indicador,
                      {
                        borderColor: theme.borda + "40",
                        backgroundColor:
                          theme.backgroundSecundario,
                      },
                    ]}
                  >
                    <Text
                      weight="Bold"
                      style={{ fontSize: 22 }}
                    >
                      {numero}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textoSub,
                      }}
                    >
                      {nome}
                    </Text>
                  </View>
                ))}
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: theme.textoSub,
                }}
              >
                Aceitos são os e-mails recebidos pelo servidor para
                encaminhamento. A entrega ao destinatário ainda não
                está confirmada.
              </Text>
              {envio.totais.aguardando_retentativa > 0 ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.textoSub,
                  }}
                >
                  {envio.totais.aguardando_retentativa} destinatário(s)
                  aguardando uma nova tentativa automática.
                </Text>
              ) : null}

              {envio.totais.incertos > 0 ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.aviso,
                  }}
                >
                  Há envios sem confirmação. Confira esses casos antes
                  de realizar outro envio para os mesmos destinatários.
                </Text>
              ) : null}

              {podeEnviar &&
              ["PARCIAL", "FALHOU"].includes(envio.release.status) &&
              envio.totais.repetiveis > 0 ? (
                <Button
                  title="TENTAR NOVAMENTE"
                  icon="refresh-outline"
                  variant="outline"
                  loading={repetindo}
                  disabled={carregando || enviando || excluindo}
                  onPress={() => {
                    setErroEnvio("");
                    setConfirmarRepeticao(true);
                  }}
                />
              ) : null}

              {erroEnvio ? (
                <Text style={{ color: theme.erro }}>
                  {erroEnvio}
                </Text>
              ) : null}
              {envio.release.status === "RASCUNHO" && pendenciasEnvio.length > 0 ? (
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

              {envio.release.status === "RASCUNHO" &&
              podeEnviar ? (
                <Button
                  title="ENVIAR RELEASE"
                  icon="paper-plane-outline"
                  loading={enviando}
                  disabled={
                    carregando ||
                    excluindo ||
                    repetindo ||
                    envio.totais.total === 0 ||
                    pendenciasEnvio.length > 0
                  }
                  onPress={() => {
                    setErroEnvio("");
                    setConfirmar(true);
                  }}
                />
              ) : null}

              {envio.release.status === "NA_FILA" ? (
                <Text style={{ color: theme.textoSub }}>
                  Aguardando o processamento da fila.
                </Text>
              ) : null}

              <Text weight="Bold">
                Destinatários ({envio.totais.total})
              </Text>

              <View style={styles.linha}>
                {FILTROS.map((filtro) => (
                  <Button
                    key={filtro.valor}
                    title={filtro.nome}
                    size="small"
                    variant={
                      consulta.status === filtro.valor
                        ? "primary"
                        : "outline"
                    }
                    style={styles.botao}
                    onPress={() =>
                      setConsulta({
                        page: 1,
                        status: filtro.valor,
                      })
                    }
                  />
                ))}
              </View>

              {envio.destinatarios.map((d) => (
                <View
                  key={d.id}
                  style={[
                    styles.destinatario,
                    { borderColor: theme.borda + "35" },
                  ]}
                >
                  {d.nome ? (
                    <Text weight="SemiBold">{d.nome}</Text>
                  ) : null}

                  <Text selectable>{d.email}</Text>

                  <Text
                    style={{
                      color:
                        d.status === "ERRO"
                          ? theme.erro
                          : theme.textoSub,
                      fontSize: 12,
                    }}
                  >
                    {d.status === "PENDENTE" && d.proxima_tentativa_em
                      ? "Aguardando nova tentativa"
                      : d.status === "ERRO" && d.erro_tipo === "INCERTA"
                      ? "Envio sem confirmação"
                      : d.status === "ERRO" && d.erro_tipo === "CONFIGURACAO"
                      ? "Aguardando correção"
                      : ROTULOS_DESTINATARIO[d.status]}
                  </Text>

                  {d.tentativas > 0 ? (
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textoSub,
                      }}
                    >
                      {d.tentativas} tentativa(s)
                      {d.smtp_codigo ? ` · Código SMTP ${d.smtp_codigo}` : ""}
                    </Text>
                  ) : null}

                  {d.erro_mensagem ? (
                    <Text
                      style={{
                        color: theme.erro,
                        fontSize: 12,
                      }}
                    >
                      {d.erro_mensagem}
                    </Text>
                  ) : null}
                </View>
              ))}

              {!envio.destinatarios.length ? (
                <Text>
                  Nenhum destinatário neste filtro.
                </Text>
              ) : null}

              <PaginacaoLista
                pagina={consulta.page}
                limite={30}
                total={envio.pagination.total}
                disabled={carregando}
                onChange={(page) =>
                  setConsulta((atual) => ({
                    ...atual,
                    page,
                  }))
                }
              />

              <Text weight="Bold">
                Conteúdo do release
              </Text>

              <ReleaseBlocosPrevia
                blocos={release.blocos}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
        
      <FeedbackAlert
        visible={confirmar}
        variant="warning"
        title="Enviar este release?"
        message={
            'O release "' +
            (release?.titulo ?? "") +
            '" será enviado individualmente para ' +
            (envio?.totais.total ?? 0) +
            " destinatários. Confirme os dados antes de continuar." +
            (avisoDominios ? "\n\n" + avisoDominios : "")
        }
        primaryLabel="ENVIAR"
        secondaryLabel="VOLTAR"
        loading={enviando}
        onPrimary={() => void enviar()}
        onClose={() => {
          if (!trava.current) setConfirmar(false);
        }}
        onSecondary={() => {
          if (!trava.current) setConfirmar(false);
        }}
      />
      <FeedbackAlert
        visible={confirmarExclusao}
        variant="warning"
        title="Excluir este release?"
        message={
          'O release "' +
          (release?.titulo || "Sem título") +
          '" e o histórico de destinatários serão removidos. ' +
          "Esta ação não pode ser desfeita." +
          (release?.status !== "RASCUNHO"
            ? " Os e-mails já enviados não serão cancelados."
            : "") +
          (erroExclusao ? "\n\n" + erroExclusao : "")
        }
        primaryLabel="EXCLUIR"
        secondaryLabel="CANCELAR"
        primaryDanger
        loading={excluindo}
        onPrimary={() => void excluir()}
        onClose={() => {
          if (!trava.current) setConfirmarExclusao(false);
        }}
        onSecondary={() => {
          if (!trava.current) setConfirmarExclusao(false);
        }}
      />

      <FeedbackAlert
        visible={confirmarRepeticao}
        variant="warning"
        title="Tentar novamente?"
        message={
          "Serão colocados na fila " +
          (envio?.totais.repetiveis ?? 0) +
          " destinatário(s) com falhas que permitem uma nova tentativa. " +
          "Os envios já aceitos e os sem confirmação serão preservados. " +
          "Se houve falha de configuração, corrija-a antes de continuar."
        }
        primaryLabel="TENTAR"
        secondaryLabel="CANCELAR"
        loading={repetindo}
        onPrimary={() => void repetirFalhas()}
        onClose={() => {
          if (!trava.current) setConfirmarRepeticao(false);
        }}
        onSecondary={() => {
          if (!trava.current) setConfirmarRepeticao(false);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  conteudo: {
    padding: 16,
    paddingBottom: 30,
  },
  corpo: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    gap: 12,
  },
  grupo: {
    gap: 8,
  },
  linha: {
    flexDirection: "row",
    gap: 8,
  },
  botao: {
    flex: 1,
    width: "auto",
    minWidth: 0,
  },
  indicador: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    gap: 3,
  },
  destinatario: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
});
