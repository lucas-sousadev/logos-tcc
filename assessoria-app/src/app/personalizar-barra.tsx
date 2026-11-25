import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavegacao } from "@/contexts/NavegacaoContext";
import {
  normalizarAtalhos,
  trocarAtalho,
  type AtalhosBarra,
} from "@/constants/modulosNavegacao";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";

export default function PersonalizarBarra() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { conta, atalhos, disponiveis, pronto, erro, salvar, recarregar } =
    useNavegacao();
  const [edicao, setEdicao] = useState<{
    conta: string | null;
    valor: AtalhosBarra;
  } | null>(null);
  const [vaga, setVaga] = useState<0 | 1>(0);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{
    sucesso: boolean;
    mensagem: string;
  } | null>(null);
  const trava = useRef(false);
  const escolha = normalizarAtalhos(
    edicao?.conta === conta ? edicao.valor : atalhos,
    disponiveis
  );
  const alterado = JSON.stringify(escolha) !== JSON.stringify(atalhos);
  const podeSalvar = alterado || Boolean(erro);
  const saida = useSaidaFormulario(alterado, salvando);

  async function confirmar() {
    if (trava.current || !pronto || !podeSalvar) return;
    trava.current = true;
    setSalvando(true);
    try {
      await salvar(escolha);
      setEdicao(null);
      setFeedback({
        sucesso: true,
        mensagem: "Seus atalhos foram atualizados neste dispositivo.",
      });
    } catch (falha) {
      setFeedback({
        sucesso: false,
        mensagem:
          falha instanceof Error
            ? falha.message
            : "Não foi possível salvar os atalhos.",
      });
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Barra de navegação" showBackButton showSettings={false} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          },
        ]}
      >
        <View style={styles.conteudo}>
          <View style={styles.introducao}>
            <Text weight="Bold" style={styles.titulo}>
              Seus atalhos, do seu jeito
            </Text>
            <Text style={[styles.descricao, { color: theme.textoSub }]}>
              Início, Novo e Mais são fixos. Escolha os módulos das outras duas
              vagas.
            </Text>
          </View>

          {!pronto ? (
            <ActivityIndicator
              color={theme.primaria}
              accessibilityLabel="Carregando seus atalhos"
            />
          ) : (
            <>
              {erro ? (
                <View style={styles.introducao}>
                  <Text style={[styles.descricao, { color: theme.erro }]}>
                    {erro}
                  </Text>
                  <Button
                    title="TENTAR NOVAMENTE"
                    variant="outline"
                    disabled={salvando}
                    onPress={recarregar}
                  />
                </View>
              ) : null}

              <View
                style={[
                  styles.previa,
                  {
                    borderColor: theme.borda + "40",
                    backgroundColor: theme.backgroundSecundario,
                  },
                ]}
              >
                {["index", escolha[0], "novo", escolha[1], "mais"].map(
                  (id, indice) => {
                    const modulo = disponiveis.find((item) => item.id === id);
                    const rotulo =
                      id === "index"
                        ? "Início"
                        : id === "novo"
                          ? "Novo"
                          : id === "mais"
                            ? "Mais"
                            : (modulo?.rotulo ?? "Atalho");
                    const icone =
                      id === "index"
                        ? "home-outline"
                        : id === "novo"
                          ? "add"
                          : id === "mais"
                            ? "grid-outline"
                            : (modulo?.icone ?? "remove-outline");
                    const selecionado = indice === (vaga === 0 ? 1 : 3);
                    return (
                      <View key={indice} style={styles.itemPrevia}>
                        <View
                          style={[
                            styles.iconePrevia,
                            {
                              backgroundColor:
                                id === "novo"
                                  ? theme.primaria
                                  : selecionado
                                    ? theme.primaria + "12"
                                    : "transparent",
                            },
                          ]}
                        >
                          <Ionicons
                            name={icone}
                            size={id === "novo" ? 25 : 21}
                            color={
                              id === "novo"
                                ? theme.branco
                                : selecionado
                                  ? theme.textoTerciaria
                                  : theme.textoSub
                            }
                          />
                        </View>
                        <Text
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.3}
                          style={[
                            styles.textoPrevia,
                            {
                              color: selecionado
                                ? theme.textoTerciaria
                                : theme.textoSub,
                            },
                          ]}
                        >
                          {rotulo}
                        </Text>
                      </View>
                    );
                  }
                )}
              </View>

              <View style={styles.vagas}>
                {([0, 1] as const).map((indice) => (
                  <Pressable
                    key={indice}
                    accessibilityRole="button"
                    accessibilityLabel={"Escolher vaga " + (indice + 1)}
                    accessibilityState={{
                      selected: vaga === indice,
                      disabled: salvando,
                    }}
                    disabled={salvando}
                    onPress={() => setVaga(indice)}
                    style={[
                      styles.vaga,
                      {
                        borderColor:
                          vaga === indice ? theme.primaria : theme.borda + "40",
                        backgroundColor:
                          vaga === indice
                            ? theme.primaria + "0D"
                            : theme.backgroundSecundario,
                      },
                    ]}
                  >
                    <Text style={[styles.rotulo, { color: theme.textoSub }]}>
                      VAGA {indice + 1}
                    </Text>
                    <Text
                      weight="SemiBold"
                      numberOfLines={1}
                      style={styles.nomeVaga}
                    >
                      {disponiveis.find(
                        (modulo) => modulo.id === escolha[indice]
                      )?.titulo ?? "Sem módulo disponível"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.introducao}>
                <Text weight="SemiBold" style={styles.subtitulo}>
                  Escolha o atalho da vaga {vaga + 1}
                </Text>
                <Text style={[styles.ajuda, { color: theme.textoSub }]}>
                  Se o módulo já estiver na outra vaga, os dois trocam de lugar.
                </Text>
              </View>
              <View
                style={[
                  styles.lista,
                  {
                    borderColor: theme.borda + "40",
                    backgroundColor: theme.backgroundSecundario,
                  },
                ]}
              >
                {disponiveis.map((modulo, indice) => {
                  const selecionado = escolha[vaga] === modulo.id;
                  const outra = escolha[vaga === 0 ? 1 : 0] === modulo.id;
                  return (
                    <Pressable
                      key={modulo.id}
                      accessibilityRole="radio"
                      aria-checked={selecionado}
                      aria-disabled={salvando}
                      accessibilityLabel={
                        modulo.titulo +
                        (outra ? ", trocar com a outra vaga" : "")
                      }
                      accessibilityState={{
                        checked: selecionado,
                        disabled: salvando,
                      }}
                      disabled={salvando}
                      onPress={() =>
                        setEdicao({
                          conta,
                          valor: trocarAtalho(escolha, vaga, modulo.id),
                        })
                      }
                      style={({ pressed }) => [
                        styles.item,
                        {
                          borderTopWidth: indice ? 1 : 0,
                          borderTopColor: theme.borda + "20",
                          backgroundColor:
                            pressed || selecionado
                              ? theme.primaria + "08"
                              : "transparent",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.icone,
                          { backgroundColor: theme.primaria + "0D" },
                        ]}
                      >
                        <Ionicons
                          name={modulo.icone}
                          size={21}
                          color={theme.textoTerciaria}
                        />
                      </View>
                      <View style={styles.textos}>
                        <Text weight="SemiBold" style={styles.nomeItem}>
                          {modulo.titulo}
                        </Text>
                        <Text style={[styles.ajuda, { color: theme.textoSub }]}>
                          {outra
                            ? "Na vaga " + (vaga === 0 ? 2 : 1)
                            : modulo.descricao}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          selecionado ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={22}
                        color={
                          selecionado
                            ? theme.textoTerciaria
                            : theme.borda + "70"
                        }
                      />
                    </Pressable>
                  );
                })}
                {!disponiveis.length ? (
                  <Text style={[styles.vazio, { color: theme.textoSub }]}>
                    Não há módulos disponíveis para personalizar. Os atalhos
                    aparecem conforme suas permissões.
                  </Text>
                ) : null}
              </View>

              <Text style={[styles.ajuda, { color: theme.textoSub }]}>
                Os módulos fora da barra ficam em Mais. Sua escolha é salva para
                esta conta neste dispositivo.
              </Text>
              <View style={styles.botoes}>
                <Button
                  title="RESTAURAR"
                  variant="outline"
                  disabled={salvando || !disponiveis.length}
                  onPress={() =>
                    setEdicao({
                      conta,
                      valor: normalizarAtalhos(null, disponiveis),
                    })
                  }
                  style={styles.botao}
                />
                <Button
                  title="SALVAR"
                  icon="checkmark-outline"
                  loading={salvando}
                  disabled={!podeSalvar}
                  onPress={() => void confirmar()}
                  style={styles.botao}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <FeedbackAlert {...saida.alertaProps} />
      {feedback ? (
        <FeedbackAlert
          visible
          variant={feedback.sucesso ? "success" : "error"}
          title={
            feedback.sucesso ? "Barra atualizada" : "Não foi possível salvar"
          }
          message={feedback.mensagem}
          onClose={() => setFeedback(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingTop: 20,
  },
  conteudo: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    gap: 18,
  },
  introducao: {
    gap: 5,
  },
  titulo: {
    fontSize: 21,
    lineHeight: 28,
  },
  descricao: {
    fontSize: 13,
    lineHeight: 20,
  },
  previa: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  itemPrevia: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 5,
  },
  iconePrevia: {
    width: 38,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textoPrevia: {
    fontSize: 9,
    lineHeight: 14,
  },
  vagas: {
    flexDirection: "row",
    gap: 10,
  },
  vaga: {
    flex: 1,
    minWidth: 0,
    gap: 5,
    padding: 12,
    borderWidth: 1,
    borderRadius: 13,
  },
  rotulo: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  nomeVaga: {
    fontSize: 13,
    lineHeight: 19,
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  ajuda: {
    fontSize: 11,
    lineHeight: 18,
  },
  lista: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    minHeight: 72,
  },
  icone: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nomeItem: {
    fontSize: 13,
    lineHeight: 19,
  },
  vazio: {
    padding: 16,
    fontSize: 12,
    lineHeight: 19,
  },
  botoes: {
    flexDirection: "row",
    gap: 10,
  },
  botao: {
    flex: 1,
    minWidth: 0,
    width: "auto",
  },
});
