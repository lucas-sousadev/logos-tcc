import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useCallback, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { TouchableOpacity } from "react-native";
import * as Clipboard from "expo-clipboard";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { ConviteHistorico } from "@/services/api/auth";

const LIMITE_PAGINA = 20;

function formatarData(data: string | null): string {
  if (!data) return "Data não informada";

  const partes = data.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/
  );

  if (!partes) return data;

  return `${partes[3]}/${partes[2]}/${partes[1]} às ${partes[4]}:${partes[5]}`;
}

export default function Convites() {
  const router = useRouter();
  const { theme } = useTheme();
  const { origem } = useLocalSearchParams<{ origem?: string }>();
  const { criarConvite, listarConvites, temPermissao } = useAuth();

  const podeVisualizar = temPermissao("CONVITES", "VISUALIZAR");
  const podeCriar = temPermissao("CONVITES", "CRIAR");

  const [historico, setHistorico] = useState<ConviteHistorico[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [atualizacao, setAtualizacao] = useState(0);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");
  const [erroCriacao, setErroCriacao] = useState("");

  const [conviteCriado, setConviteCriado] = useState<{
    codigo: string;
    expira_em: string;
  } | null>(null);
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  const requisicaoAtual = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  function voltar() {
    if (origem === "funcionarios") {
      router.replace("/funcionarios");
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  }

  useFocusEffect(
    useCallback(() => {
      if (!podeVisualizar) return;

      const requisicao = ++requisicaoAtual.current;
      setCarregandoHistorico(true);
      setErroHistorico("");

      void listarConvites(pagina, LIMITE_PAGINA)
        .then((resposta) => {
          if (requisicao !== requisicaoAtual.current) return;

          setHistorico(resposta.convites ?? []);
          setTotal(resposta.pagination?.total ?? 0);
        })
        .catch((error) => {
          if (requisicao !== requisicaoAtual.current) return;

          setHistorico([]);
          setTotal(0);
          setErroHistorico(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os convites."
          );
        })
        .finally(() => {
          if (requisicao === requisicaoAtual.current) {
            setCarregandoHistorico(false);
          }
        });

      return () => {
        requisicaoAtual.current++;
      };
    }, [podeVisualizar, listarConvites, pagina, atualizacao])
  );

  async function gerarConvite() {
    if (criando) return;

    setCriando(true);
    setErroCriacao("");
    setConviteCriado(null);
    setCodigoCopiado(false);

    try {
      const resposta = await criarConvite();

      if (!resposta.convite) {
        throw new Error("A API não retornou os dados do convite.");
      }

      setConviteCriado({
        codigo: resposta.convite.codigo,
        expira_em: resposta.convite.expira_em,
      });

      setPagina(1);
      setAtualizacao((valor) => valor + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      setErroCriacao(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o convite."
      );
    } finally {
      setCriando(false);
    }
  }

  async function copiarConvite() {
    if (!conviteCriado) return;

    try {
      const copiou = await Clipboard.setStringAsync(conviteCriado.codigo);
      if (!copiou) throw new Error("A cópia não foi concluída.");

      setCodigoCopiado(true);
      setErroCriacao("");
    } catch {
      setCodigoCopiado(false);
      setErroCriacao("Não foi possível copiar o código. Tente selecioná-lo manualmente.");
    }
  }

  async function compartilharConvite() {
    if (!conviteCriado) return;

    try {
      await Share.share({
        message:
          `Código de convite para cadastro na assessoria: ` +
          `${conviteCriado.codigo}\n` +
          `Válido até: ${formatarData(conviteCriado.expira_em)}`,
      });
    } catch {
      setErroCriacao(
        "Não foi possível abrir o compartilhamento. Selecione o código para copiá-lo."
      );
    }
  }

  if (!podeVisualizar) {
    return (
      <View
        style={[
          styles.screen,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Convites"
          showBackButton
          onBackPress={voltar}
        />

        <View style={styles.restrito}>
          <Ionicons
            name="lock-closed-outline"
            size={30}
            color={theme.textoSub}
          />

          <Text weight="Bold" style={styles.restritoTitulo}>
            Acesso restrito
          </Text>

          <Text style={{ color: theme.textoSub, textAlign: "center" }}>
            Você não tem permissão para visualizar convites.
          </Text>

          <Button
            title="VOLTAR"
            variant="outline"
            onPress={voltar}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title="Convites"
        showBackButton
        onBackPress={voltar}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
      >
        <View style={styles.linhaSuperior}>
          <Text
            weight="Medium"
            style={[styles.contagem, { color: theme.textoSub }]}
          >
            {total} {total === 1 ? "convite" : "convites"}
          </Text>

          {podeCriar ? (
            <Button
              title="GERAR CONVITE"
              size="small"
              loading={criando}
              onPress={() => void gerarConvite()}
              style={styles.botaoGerar}
            />
          ) : null}
        </View>

        <View
          style={[
            styles.introducao,
            {
              backgroundColor: theme.backgroundSecundario,
              borderColor: theme.borda,
            },
          ]}
        >
          <View
            style={[
              styles.iconeIntroducao,
              {
                backgroundColor: `${theme.textoTerciaria}18`,
              },
            ]}
          >
            <Ionicons
              name="person-add-outline"
              size={21}
              color={theme.textoTerciaria}
            />
          </View>

          <View style={styles.textosIntroducao}>
            <Text weight="Bold" style={styles.tituloIntroducao}>
              Convide alguém para a equipe
            </Text>

            <Text
              style={[
                styles.descricaoIntroducao,
                { color: theme.textoSub },
              ]}
            >
              Gere um código para o funcionário se cadastrar. Ele
              é válido por 7 dias e pode ser usado uma vez.
            </Text>
          </View>
        </View>

        {erroCriacao ? (
          <View
            style={[
              styles.mensagem,
              { borderColor: theme.erro },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={theme.erro}
            />
            <Text style={{ color: theme.erro, flex: 1 }}>
              {erroCriacao}
            </Text>
          </View>
        ) : null}

        {conviteCriado ? (
          <View
            style={[
              styles.conviteCriado,
              {
                backgroundColor: theme.backgroundSecundario,
                borderColor: theme.textoTerciaria,
              },
            ]}
          >
            <View style={styles.tituloResultado}>
              <Ionicons
                name="checkmark-circle-outline"
                size={21}
                color={theme.textoTerciaria}
              />
              <Text weight="Bold" style={styles.tituloConviteCriado}>
                Convite pronto
              </Text>
            </View>

            <Text style={{ color: theme.textoSub, fontSize: 12 }}>
              Compartilhe este código com o funcionário:
            </Text>

            <View
              style={[
                styles.caixaCodigo,
                { borderColor: theme.borda },
              ]}
            >
              <Text
                selectable
                weight="ExtraBold"
                style={[
                  styles.codigoCriado,
                  { color: theme.textoTerciaria },
                ]}
              >
                {conviteCriado.codigo}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={codigoCopiado ? "Código copiado" : "Copiar código do convite"}
                onPress={() => void copiarConvite()}
                style={[
                  styles.botaoCopiar,
                  { backgroundColor: theme.background, borderColor: theme.borda },
                ]}
              >
                <Ionicons
                  name={codigoCopiado ? "checkmark-outline" : "copy-outline"}
                  size={19}
                  color={theme.textoTerciaria}
                />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.textoSub, fontSize: 12 }}>
              Válido até {formatarData(conviteCriado.expira_em)}
            </Text>

            {codigoCopiado ? (
              <Text style={{ color: theme.textoTerciaria, fontSize: 12 }}>
                Código copiado!
              </Text>
            ) : null}

            {Platform.OS !== "web" ? (
              <Button
                title="COMPARTILHAR CÓDIGO"
                variant="outline"
                size="small"
                onPress={() => void compartilharConvite()}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.cabecalhoHistorico}>
          <Text weight="Bold" style={styles.tituloHistorico}>
            Histórico de convites
          </Text>
          <Text style={{ color: theme.textoSub, fontSize: 12 }}>
            Mais recentes primeiro
          </Text>
        </View>

        {erroHistorico ? (
          <View
            style={[
              styles.estado,
              {
                borderColor: theme.borda,
                backgroundColor: theme.backgroundSecundario,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={theme.erro}
            />
            <Text style={{ color: theme.erro, textAlign: "center" }}>
              {erroHistorico}
            </Text>
            <Button
              title="TENTAR NOVAMENTE"
              size="small"
              onPress={() =>
                setAtualizacao((valor) => valor + 1)
              }
            />
          </View>
        ) : carregandoHistorico ? (
          <ActivityIndicator
            size="large"
            color={theme.textoTerciaria}
            style={styles.carregando}
          />
        ) : historico.length === 0 ? (
          <View
            style={[
              styles.estado,
              {
                borderColor: theme.borda,
                backgroundColor: theme.backgroundSecundario,
              },
            ]}
          >
            <Ionicons
              name="ticket-outline"
              size={28}
              color={theme.textoSub}
            />
            <Text weight="SemiBold">
              Nenhum convite criado
            </Text>
            <Text
              style={{
                color: theme.textoSub,
                textAlign: "center",
                fontSize: 12,
              }}
            >
              Os convites gerados aparecerão aqui.
            </Text>
          </View>
        ) : (
          <>
            {historico.map((item) => {
              const corStatus =
                item.status === "ATIVO"
                  ? theme.textoTerciaria
                  : item.status === "EXPIRADO"
                    ? theme.erro
                    : theme.textoSub;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.cartao,
                    {
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda,
                    },
                  ]}
                >
                  <View style={styles.cartaoTopo}>
                    <View
                      style={[
                        styles.iconeCartao,
                        {
                          backgroundColor:
                            `${theme.textoTerciaria}18`,
                        },
                      ]}
                    >
                      <Ionicons
                        name="ticket-outline"
                        size={19}
                        color={theme.textoTerciaria}
                      />
                    </View>

                    <View style={styles.identificacaoCartao}>
                      <Text
                        selectable
                        weight="Bold"
                        style={styles.codigoCartao}
                      >
                        {item.codigo}
                      </Text>
                      <Text
                        style={{
                          color: theme.textoSub,
                          fontSize: 11,
                        }}
                      >
                        Gerado por {item.criado_por}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.seloStatus,
                        {
                          backgroundColor: `${corStatus}18`,
                          borderColor: `${corStatus}70`,
                        },
                      ]}
                    >
                      <Text
                        weight="Bold"
                        style={[
                          styles.textoStatus,
                          { color: corStatus },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.divisor,
                      { backgroundColor: theme.borda },
                    ]}
                  />

                  <View style={styles.detalhe}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={theme.textoSub}
                    />
                    <Text
                      style={[
                        styles.textoDetalhe,
                        { color: theme.textoSub },
                      ]}
                    >
                      Criado em {formatarData(item.created_at)}
                    </Text>
                  </View>

                  <View style={styles.detalhe}>
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={theme.textoSub}
                    />
                    <Text
                      style={[
                        styles.textoDetalhe,
                        { color: theme.textoSub },
                      ]}
                    >
                      Expira em {formatarData(item.expira_em)}
                    </Text>
                  </View>

                  {item.utilizado_por ? (
                    <View style={styles.detalhe}>
                      <Ionicons
                        name="person-outline"
                        size={15}
                        color={theme.textoSub}
                      />
                      <Text
                        style={[
                          styles.textoDetalhe,
                          { color: theme.textoSub },
                        ]}
                      >
                        Utilizado por {item.utilizado_por}
                      </Text>
                    </View>
                  ) : null}

                  {item.utilizado_em ? (
                    <View style={styles.detalhe}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={15}
                        color={theme.textoSub}
                      />
                      <Text
                        style={[
                          styles.textoDetalhe,
                          { color: theme.textoSub },
                        ]}
                      >
                        Utilizado em{" "}
                        {formatarData(item.utilizado_em)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            <Text
              style={[
                styles.faixaResultados,
                { color: theme.textoSub },
              ]}
            >
              Exibindo {(pagina - 1) * LIMITE_PAGINA + 1}–
              {Math.min(pagina * LIMITE_PAGINA, total)} de{" "}
              {total}
            </Text>

            <PaginacaoLista
              pagina={pagina}
              limite={LIMITE_PAGINA}
              total={total}
              disabled={carregandoHistorico || criando}
              onChange={(novaPagina) => {
                setPagina(novaPagina);
                scrollRef.current?.scrollTo({
                  y: 0,
                  animated: true,
                });
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  conteudo: {
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  linhaSuperior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  contagem: {
    flex: 1,
    fontSize: 13,
  },
  botaoGerar: {
    width: "auto",
    paddingHorizontal: 12,
  },
  introducao: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 11,
  },
  iconeIntroducao: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textosIntroducao: {
    flex: 1,
    gap: 4,
  },
  tituloIntroducao: {
    fontSize: 14,
  },
  descricaoIntroducao: {
    fontSize: 12,
    lineHeight: 18,
  },
  mensagem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  conviteCriado: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 15,
    gap: 10,
  },
  tituloResultado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  tituloConviteCriado: {
    fontSize: 16,
  },
  caixaCodigo: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codigoCriado: {
    flex: 1,
    fontSize: 18,
    letterSpacing: 1,
    textAlign: "center",
  },
  botaoCopiar: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cabecalhoHistorico: {
    gap: 3,
    marginTop: 5,
  },
  tituloHistorico: {
    fontSize: 18,
  },
  estado: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  carregando: {
    marginVertical: 32,
  },
  cartao: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 9,
  },
  cartaoTopo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  iconeCartao: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  identificacaoCartao: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  codigoCartao: {
    fontSize: 13,
  },
  seloStatus: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  textoStatus: {
    fontSize: 9,
  },
  divisor: {
    height: 1,
    opacity: 0.45,
  },
  detalhe: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  textoDetalhe: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  faixaResultados: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 4,
  },
  restrito: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  restritoTitulo: {
    fontSize: 20,
  },
});