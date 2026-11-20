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
} from "expo-router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ReleaseBlocosPrevia from "@/components/releases/ReleaseBlocosPrevia";
import ReleaseResumoCard from "@/components/releases/ReleaseResumoCard";

import { avisoDominiosRelease } from "@/utils/releaseDominios";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  buscarRelease,
  consultarEnvioRelease,
  solicitarEnvioRelease,
  ErroApiRelease,
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
  ERRO: "Falha ou envio sem confirmação",
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
  const { temPermissao } = useAuth();

  const podeVer = temPermissao("RELEASES", "VISUALIZAR");
  const podeEnviar = temPermissao("RELEASES", "ENVIAR");
  const trava = useRef(false);

  const [release, setRelease] =
    useState<DetalheRelease | null>(null);
  const [envio, setEnvio] =
    useState<SituacaoEnvioRelease | null>(null);

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

    trava.current = true;
    setEnviando(true);
    setErroEnvio("");

    try {
      setEnvio(await solicitarEnvioRelease(id));
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

              {erroEnvio ? (
                <Text style={{ color: theme.erro }}>
                  {erroEnvio}
                </Text>
              ) : null}

              {envio.release.status === "RASCUNHO" &&
              podeEnviar ? (
                <Button
                  title="ENVIAR RELEASE"
                  icon="paper-plane-outline"
                  loading={enviando}
                  disabled={
                    carregando ||
                    envio.totais.total === 0
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
                    {ROTULOS_DESTINATARIO[d.status]}
                  </Text>

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