import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useEffect, useState, useRef } from "react";
import type { ComponentProps } from "react";
import {
  useIsFocused,
  useLocalSearchParams,
  useRouter,
  useNavigation
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  CommonActions,
  usePreventRemove,
} from "expo-router/react-navigation";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import ClippingAnexos from "@/components/clipping/ClippingAnexos";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import FormularioClipping from "@/components/clipping/FormularioClipping";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useClippingNovos } from "@/contexts/ClippingNovosContext";
import { useConsultaClipping } from "@/hooks/useConsultaClipping";
import { buscarClipping, excluirClipping, type Clipping,} from "@/services/api/clipping";
import { segundosParaTempo } from "@/utils/clippingFormatacao";

type NomeIcone = ComponentProps<typeof Ionicons>["name"];

function formatarData(data: string | null) {
  if (!data) return "Sem data";

  const partes = data.split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function Marcador({
  icone,
  texto,
  pendente = false,
}: {
  icone: NomeIcone;
  texto: string;
  pendente?: boolean;
}) {
  const { theme, mode } = useTheme();
  const cor = pendente
    ? mode === "dark"
      ? "#F2A7A7"
      : "#A94E58"
    : theme.texto;

  return (
    <View
      style={[
        styles.marcador,
        {
          backgroundColor: pendente
            ? mode === "dark"
              ? "#F2A7A712"
              : "#A94E580A"
            : `${theme.primaria}10`,
        },
      ]}
    >
      <Ionicons name={icone} size={14} color={cor} />

      <Text
        weight="Medium"
        style={[styles.marcadorTexto, { color: cor }]}
      >
        {texto}
      </Text>
    </View>
  );
}

function Campo({
  rotulo,
  valor,
  pendente = false,
}: {
  rotulo: string;
  valor: string;
  pendente?: boolean;
}) {
  const { theme, mode } = useTheme();

  return (
    <View style={styles.campo}>
      <Text
        weight="Medium"
        style={[styles.rotulo, { color: theme.textoSub }]}
      >
        {rotulo}
      </Text>

      <Text
        selectable
        style={[
          styles.valor,
          {
            color: pendente
              ? mode === "dark"
                ? "#F2A7A7"
                : "#A94E58"
              : theme.texto,
          },
        ]}
      >
        {valor}
      </Text>
    </View>
  );
}

export default function ClippingDetalhes() {
  const router = useRouter();
  const focado = useIsFocused();
  const { theme, mode } = useTheme();
  const { marcarVisualizado } = useClippingNovos();
  const { temPermissao } = useAuth();

  const params = useLocalSearchParams<{
    id: string;
  }>();

  const id = Number(params.id);

  const [erroLink, setErroLink] = useState("");
  const [mostrarSobreVeiculo, setMostrarSobreVeiculo] =
    useState(false);
  const navigation = useNavigation();

  const [editando, setEditando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [anexosOcupados, setAnexosOcupados] = useState(false);
  const travaExcluir = useRef(false);

  const [feedbackAcao, setFeedbackAcao] = useState<{
    titulo: string;
    mensagem: string;
    excluido?: Clipping;
  } | null>(null);

  const ocupado = excluindo || anexosOcupados;

  usePreventRemove(ocupado, () => {});

  const cores = {
    cartao: mode === "dark" ? "#172238" : "#FFFFFF",
    borda: `${theme.borda}30`,
    destaque: `${theme.primaria}10`,
    pendencia: mode === "dark" ? "#F2A7A7" : "#A94E58",
  };
  const [edicaoSalva, setEdicaoSalva] = useState(false);

  const consultarClipping = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("Clipping inválido.");
    }

    return buscarClipping(id);
  }, [id]);

  const {
    dados: clipping,
    carregando,
    atualizando,
    erro,
    recarregar,
    atualizarDados,
  } = useConsultaClipping(consultarClipping, String(id));

  useEffect(() => {
    setErroLink("");
    setMostrarSobreVeiculo(false);
  }, [id]);
  
  useEffect(() => {
    if (focado && clipping) {
      marcarVisualizado(clipping.id);
    }
  }, [focado, clipping, marcarVisualizado]);
  
  function voltar() {
    if (ocupado || travaExcluir.current) return;

    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (clipping) {
      router.replace({
        pathname: "/clipping/cliente/[id]",
        params: {
          id: String(clipping.cliente_id),
          ano: String(clipping.ano_referencia),
          clienteNome: clipping.cliente_nome,
        },
      });
      return;
    }

    router.replace("/clipping");
  }

  async function abrirLink() {
    const link = clipping?.link?.trim();

    if (!link) return;

    setErroLink("");

    try {
      await Linking.openURL(link);
    } catch {
      setErroLink("Não foi possível abrir o link da publicação.");
    }
  }

  function atualizarContextoDeRetorno(registro: Clipping) {
  const estado = navigation.getState();

  if (!estado) return;

  const anteriores = estado.routes.slice(0, estado.index);

  const rotaAno = [...anteriores]
    .reverse()
    .find((rota) => rota.name === "ano");

  const rotaLista = [...anteriores]
    .reverse()
    .find(
      (rota) =>
        rota.name === "cliente/[id]" ||
        rota.name === "cliente/[id]/index"
    );

  if (rotaAno) {
    navigation.dispatch({
      ...CommonActions.setParams({
        ano: String(registro.ano_referencia),
      }),
      source: rotaAno.key,
      target: estado.key,
    });
  }

  if (rotaLista) {
    navigation.dispatch({
      ...CommonActions.setParams({
        id: String(registro.cliente_id),
        ano: String(registro.ano_referencia),
        clienteNome: registro.cliente_nome,
      }),
      source: rotaLista.key,
      target: estado.key,
    });
  }
}

function concluirEdicao(registro: Clipping) {
  atualizarDados(registro);
  atualizarContextoDeRetorno(registro);

  setErroLink("");
  setEditando(false);
  setEdicaoSalva(true);
}

  function irParaLista(registro: Clipping) {
  const estado = navigation.getState();

  const anteriores = estado
    ? estado.routes.slice(0, estado.index)
    : [];

  const anterior = anteriores[anteriores.length - 1];

  const parametros = {
    id: String(registro.cliente_id),
    ano: String(registro.ano_referencia),
    clienteNome: registro.cliente_nome,
  };

  // Mantém a tela de clientes do ano coerente com o novo contexto.
  const rotaAno = [...anteriores]
    .reverse()
    .find((rota) => rota.name === "ano");

  if (rotaAno && estado) {
    navigation.dispatch({
      ...CommonActions.setParams({
        ano: String(registro.ano_referencia),
      }),
      source: rotaAno.key,
      target: estado.key,
    });
  }

  const anteriorEhLista =
    anterior?.name === "cliente/[id]" ||
    anterior?.name === "cliente/[id]/index";

  if (anteriorEhLista && anterior && estado) {
    navigation.dispatch({
      ...CommonActions.setParams(parametros),
      source: anterior.key,
      target: estado.key,
    });

    router.back();
    return;
  }

  router.replace({
    pathname: "/clipping/cliente/[id]",
    params: parametros,
  });
}

  async function removerClipping() {
    if (
      !clipping ||
      travaExcluir.current ||
      anexosOcupados ||
      !temPermissao("CLIPPING", "EXCLUIR")
    ) {
      return;
    }

    const registro = clipping;

    travaExcluir.current = true;
    setExcluindo(true);

    try {
      const resposta = await excluirClipping(registro.id);

      marcarVisualizado(registro.id);
      setConfirmarExclusao(false);

      setFeedbackAcao({
        titulo: "Clipping excluído",
        mensagem: resposta.message,
        excluido: registro,
      });
    } catch (error) {
      setConfirmarExclusao(false);

      setFeedbackAcao({
        titulo: "Não foi possível excluir",
        mensagem:
          error instanceof Error
            ? error.message
            : "Tente novamente.",
      });
    } finally {
      travaExcluir.current = false;
      setExcluindo(false);
    }
  }

  function fecharFeedbackAcao() {
    const excluido = feedbackAcao?.excluido;

    setFeedbackAcao(null);

    if (excluido) {
      irParaLista(excluido);
    }
  }

  if (editando && clipping) {
    return (
      <FormularioClipping
        key={`editar-${clipping.id}`}
        anoInicial={clipping.ano_referencia}
        clienteInicial={clipping.cliente_id}
        nomeClienteInicial={clipping.cliente_nome}
        clippingInicial={clipping}
        onCancelar={() => setEditando(false)}
        onSalvo={concluirEdicao}
      />
    );
  }

  if (carregando || !clipping) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Detalhes"
          showBackButton
          onBackPress={voltar}
        />

        <View style={styles.estadoContainer}>
          {carregando ? (
            <ActivityIndicator
              size="large"
              color={theme.primaria}
            />
          ) : (
            <View
              style={[
                styles.estadoCartao,
                {
                  backgroundColor: cores.cartao,
                  borderColor: cores.borda,
                },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={cores.pendencia}
              />

              <Text weight="SemiBold" style={styles.estadoTitulo}>
                Não foi possível carregar
              </Text>

              <Text
                style={[
                  styles.estadoTexto,
                  { color: theme.textoSub },
                ]}
              >
                {erro || "Clipping não encontrado."}
              </Text>

              <Button
                title="TENTAR NOVAMENTE"
                size="small"
                onPress={() => void recarregar()}
                style={styles.botaoTentar}
              />
            </View>
          )}
        </View>
      </View>
    );
  }

  const pauta = clipping.pauta?.trim();
  const veiculo = clipping.veiculo_nome?.trim();
  const link = clipping.link?.trim();
  const programa = clipping.programa_secao?.trim();
  const observacoes = clipping.observacoes?.trim();

  const categorias = clipping.categorias ?? [];

  const temTrecho =
    clipping.inicio_segundos !== null ||
    clipping.fim_segundos !== null ||
    clipping.duracao_segundos !== null;

  const inicio = segundosParaTempo(clipping.inicio_segundos);
  const fim = segundosParaTempo(clipping.fim_segundos);
  const duracao = segundosParaTempo(clipping.duracao_segundos);

  const estiloCartao = {
    backgroundColor: cores.cartao,
    borderColor: cores.borda,
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title="Detalhes"
        showBackButton
        onBackPress={voltar}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => void recarregar()}
            tintColor={theme.primaria}
            colors={[theme.primaria]}
          />
        }
      >
        {erro ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.aviso,
              {
                backgroundColor: `${cores.pendencia}0D`,
                borderColor: `${cores.pendencia}35`,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color={cores.pendencia}
            />

            <View style={styles.flexivel}>
              <Text
                style={[
                  styles.textoAuxiliar,
                  { color: cores.pendencia },
                ]}
              >
                {erro}
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => void recarregar()}
                style={styles.tentarNovamente}
              >
                <Text
                  weight="SemiBold"
                  style={[
                    styles.textoAuxiliar,
                    { color: theme.texto },
                  ]}
                >
                  Tentar novamente
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {edicaoSalva ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color={theme.textoTerciaria}
            />

            <Text
              style={[
                styles.textoAuxiliar,
                { color: theme.textoTerciaria },
              ]}
            >
              Alterações salvas com sucesso
            </Text>
          </View>
        ) : null}

        {temPermissao("CLIPPING", "EDITAR") ||
        temPermissao("CLIPPING", "EXCLUIR") ? (
          <View style={styles.acoesClipping}>
            {temPermissao("CLIPPING", "EDITAR") ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={
                  ocupado ||
                  clipping.arquivado_em !== null ||
                  feedbackAcao?.excluido !== undefined
                }
                onPress={() => {
                  setEdicaoSalva(false);
                  setEditando(true);
                }}
                style={[
                  styles.acaoClipping,
                  {
                    borderColor: cores.borda,
                    backgroundColor: cores.cartao,
                    opacity:
                      ocupado || clipping.arquivado_em !== null
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={17}
                  color={theme.textoTerciaria}
                />

                <Text
                  weight="SemiBold"
                  style={[
                    styles.textoAuxiliar,
                    { color: theme.textoTerciaria },
                  ]}
                >
                  Editar
                </Text>
              </TouchableOpacity>
            ) : null}

            {temPermissao("CLIPPING", "EXCLUIR") ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={ocupado || feedbackAcao?.excluido !== undefined}
                onPress={() => setConfirmarExclusao(true)}
                style={[
                  styles.acaoClipping,
                  {
                    borderColor: `${cores.pendencia}35`,
                    opacity: ocupado ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  color={cores.pendencia}
                />

                <Text
                  weight="SemiBold"
                  style={[
                    styles.textoAuxiliar,
                    { color: cores.pendencia },
                  ]}
                >
                  Excluir
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* identificação principal do clipping */}
        <View
          style={[
            styles.cartao,
            styles.resumo,
            estiloCartao,
            { borderTopColor: theme.borda },
          ]}
        >
          <View style={styles.contexto}>
            <Text
              weight="SemiBold"
              style={[
                styles.cliente,
                { color: theme.textoTerciaria },
              ]}
            >
              {clipping.cliente_nome}
            </Text>

            <View
              style={[
                styles.ano,
                { backgroundColor: cores.destaque },
              ]}
            >
              <Text
                weight="SemiBold"
                style={[
                  styles.anoTexto,
                  { color: theme.textoTerciaria },
                ]}
              >
                {clipping.ano_referencia}
              </Text>
            </View>
          </View>

          <Text
            selectable
            weight="Bold"
            style={[
              styles.pauta,
              !pauta && { color: cores.pendencia },
            ]}
          >
            {pauta || "Pauta não informada"}
          </Text>

          <View style={styles.marcadores}>
            <Marcador
              icone="calendar-outline"
              texto={formatarData(clipping.data_publicacao)}
              pendente={!clipping.data_publicacao}
            />

          </View>
        </View>

        {/* Veículo */}
        <View style={[styles.cartao, estiloCartao]}>
          <View style={styles.tituloLinha}>
            <Ionicons
              name="newspaper-outline"
              size={18}
              color={theme.textoTerciaria}
            />

            <Text weight="SemiBold" style={styles.tituloSecao}>
              Veículo
            </Text>
          </View>

          <Text
            selectable
            weight="Medium"
            style={[
              styles.nomeVeiculo,
              styles.espacoSuperior,
              !veiculo && { color: cores.pendencia },
            ]}
          >
            {veiculo || "Sem veículo"}
          </Text>

          <View style={styles.programaVeiculo}>
            <Campo
              rotulo="Programa / seção"
              valor={programa || "Não informado"}
            />
          </View>

          <View style={styles.classificacaoVeiculo}>
            <View style={styles.colunaCategorias}>
              <Text
                weight="Medium"
                style={[styles.rotulo, { color: theme.textoSub }]}
              >
                Categorias
              </Text>

              {categorias.length > 0 ? (
                <View style={styles.categorias}>
                  {categorias.map((categoria, indice) => (
                    <View
                      key={`${categoria}-${indice}`}
                      style={[
                        styles.categoria,
                        {
                          backgroundColor: cores.destaque,
                          borderColor: cores.borda,
                        },
                      ]}
                    >
                      <Text
                        weight="Medium"
                        style={[
                          styles.categoriaTexto,
                          { color: theme.textoTerciaria },
                        ]}
                      >
                        {categoria}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.valor, { color: cores.pendencia }]}>
                  Sem categoria
                </Text>
              )}
            </View>

            <View style={styles.colunaTier}>
              <Text
                weight="Medium"
                style={[styles.rotulo, { color: theme.textoSub }]}
              >
                Tier
              </Text>

              <Marcador
                icone="podium-outline"
                texto={
                  clipping.tier === null
                    ? "Sem Tier"
                    : `Tier ${clipping.tier}`
                }
                pendente={clipping.tier === null}
              />
            </View>
          </View>

          {clipping.veiculo_id !== null ? (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Informações sobre o veículo"
                accessibilityState={{
                  expanded: mostrarSobreVeiculo,
                }}
                onPress={() =>
                  setMostrarSobreVeiculo((anterior) => !anterior)
                }
                style={[
                  styles.expandir,
                  { borderTopColor: cores.borda },
                ]}
              >
                <Text
                  weight="SemiBold"
                  style={[
                    styles.textoAuxiliar,
                    { color: theme.textoTerciaria },
                  ]}
                >
                  Sobre o veículo
                </Text>

                <Ionicons
                  name={
                    mostrarSobreVeiculo
                      ? "chevron-up"
                      : "chevron-down"
                  }
                  size={17}
                  color={theme.textoTerciaria}
                />
              </TouchableOpacity>

              {mostrarSobreVeiculo ? (
                <View style={styles.sobreVeiculo}>
                  <Campo
                    rotulo="Descrição"
                    valor={
                      clipping.veiculo_descricao?.trim() ||
                      "Não informada no cadastro do veículo."
                    }
                  />

                  <Campo
                    rotulo="Alcance"
                    valor={
                      clipping.veiculo_alcance?.trim() ||
                      "Não informado no cadastro do veículo."
                    }
                  />
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {/* trechos */}
        <View style={[styles.cartao, estiloCartao]}>
          <View style={styles.tituloLinha}>
            <Ionicons
              name="time-outline"
              size={18}
              color={theme.textoTerciaria}
            />

            <Text weight="SemiBold" style={styles.tituloSecao}>
              Trecho
            </Text>
          </View>

          {temTrecho ? (
            <View style={styles.intervalo}>
              <Text
                selectable
                weight="SemiBold"
                style={styles.intervaloTexto}
              >
                <Text
                  style={!inicio ? { color: cores.pendencia } : undefined}
                >
                  {inicio || "Início pendente"}
                </Text>

                {" → "}

                <Text
                  style={!fim ? { color: cores.pendencia } : undefined}
                >
                  {fim || "Fim pendente"}
                </Text>

                {duracao ? (
                  <Text style={{ color: theme.textoSub }}>
                    {` (${duracao})`}
                  </Text>
                ) : null}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.valor,
                styles.espacoSuperior,
                { color: theme.textoSub },
              ]}
            >
              Não informado
            </Text>
          )}
        </View>

        {/* link da publicaçao*/}
        <View style={[styles.cartao, estiloCartao]}>
          <View style={styles.tituloLinha}>
            <Ionicons
              name="link-outline"
              size={18}
              color={theme.textoTerciaria}
            />

            <Text weight="SemiBold" style={styles.tituloSecao}>
              Link da publicação
            </Text>
          </View>

          <Text
            selectable
            style={[
              styles.link,
              {
                color: link
                  ? theme.textoTerciaria
                  : cores.pendencia,
              },
            ]}
          >
            {link || "Sem link informado"}
          </Text>

          {link ? (
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Abrir link da publicação"
              onPress={() => void abrirLink()}
              style={[
                styles.abrirLink,
                {
                  backgroundColor: cores.destaque,
                  borderColor: cores.borda,
                },
              ]}
            >
              <Text
                weight="SemiBold"
                style={[
                  styles.textoAuxiliar,
                  { color: theme.textoTerciaria },
                ]}
              >
                Abrir publicação
              </Text>

              <Ionicons
                name="open-outline"
                size={16}
                color={theme.textoTerciaria}
              />
            </TouchableOpacity>
          ) : (
            <Text
              style={[styles.nota, { color: theme.textoSub }]}
            >
              A publicação também pode ser registrada pelos arquivos
              anexados abaixo.
            </Text>
          )}

          {erroLink ? (
            <Text
              accessibilityRole="alert"
              style={[
                styles.textoAuxiliar,
                styles.espacoSuperior,
                { color: cores.pendencia },
              ]}
            >
              {erroLink}
            </Text>
          ) : null}
        </View>

        <View style={[styles.cartao, estiloCartao]}>
          <View style={styles.tituloLinha}>
            <Ionicons
              name="reader-outline"
              size={18}
              color={theme.textoTerciaria}
            />

            <Text weight="SemiBold" style={styles.tituloSecao}>
              Observações
            </Text>
          </View>

          <Text
            selectable
            style={[
              styles.valor,
              styles.espacoSuperior,
              !observacoes && { color: theme.textoSub },
            ]}
          >
            {observacoes || "Nenhuma observação adicionada."}
          </Text>
        </View>

        <ClippingAnexos
          key={clipping.id}
          clippingId={clipping.id}
          disabled={excluindo || feedbackAcao?.excluido !== undefined}
          onOcupadoChange={setAnexosOcupados}
        />
      </ScrollView>
      <FeedbackAlert
        visible={confirmarExclusao}
        variant="warning"
        title="Excluir clipping?"
        message={
          `A publicação "${pauta || `Clipping #${clipping.id}`}" ` +
          "e seus anexos serão removidos. Esta ação não pode ser desfeita. " +
          "Clippings vinculados a relatórios permanecem protegidos."
        }
        primaryLabel="EXCLUIR"
        secondaryLabel="CANCELAR"
        primaryDanger
        loading={excluindo}
        onPrimary={() => void removerClipping()}
        onSecondary={() => setConfirmarExclusao(false)}
        onClose={() => setConfirmarExclusao(false)}
      />

      <FeedbackAlert
        visible={feedbackAcao !== null}
        variant={feedbackAcao?.excluido ? "success" : "error"}
        title={feedbackAcao?.titulo ?? ""}
        message={feedbackAcao?.mensagem ?? ""}
        primaryLabel={
          feedbackAcao?.excluido ? "VOLTAR À LISTA" : "ENTENDI"
        }
        onClose={fecharFeedbackAcao}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  conteudo: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 44,
  },

  flexivel: {
    flex: 1,
    minWidth: 0,
  },

  cartao: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  resumo: {
    borderTopWidth: 3,
    paddingTop: 15,
    paddingBottom: 17,
  },

  contexto: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  cliente: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 20,
  },

  ano: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  anoTexto: {
    fontSize: 11,
    lineHeight: 16,
  },

  pauta: {
    fontSize: 19,
    lineHeight: 28,
    marginTop: 12,
    marginBottom: 16,
  },

  marcadores: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  marcador: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  marcadorTexto: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 16,
  },

  programaVeiculo: {
    marginTop: 14,
  },

  classificacaoVeiculo: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 14,
    marginTop: 15,
  },

  colunaCategorias: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 0,
  },

  colunaTier: {
    flexShrink: 0,
  },
  nomeVeiculo: {
    fontSize: 14,
    lineHeight: 20,
  },

  rotulo: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },

  valor: {
    fontSize: 13,
    lineHeight: 20,
  },

  categorias: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },

  categoria: {
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  categoriaTexto: {
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
  },

  campo: {
    minWidth: 0,
  },

  expandir: {
    minHeight: 44,
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sobreVeiculo: {
    gap: 13,
    paddingTop: 8,
  },

  tituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  tituloSecao: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  intervalo: {
    marginTop: 10,
  },

  intervaloTexto: {
    fontSize: 15,
    lineHeight: 23,
  },

  espacoSuperior: {
    marginTop: 9,
  },

  link: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },

  abrirLink: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  textoAuxiliar: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  nota: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },

  aviso: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  tentarNovamente: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingRight: 12,
  },

  estadoContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },

  estadoCartao: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },

  estadoTitulo: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 12,
  },

  estadoTexto: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  botaoTentar: {
    marginTop: 16,
  },

  acoesClipping: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },

  acaoClipping: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

});