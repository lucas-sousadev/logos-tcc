import FeedbackAlert from "@/components/forms/FeedbackAlert";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useVoltarEdicaoRelatorioWeb } from "@/hooks/useVoltarEdicaoRelatorioWeb";
import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import {
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import SecaoEdicao from "@/components/forms/SecaoEdicao";
import SalvarAlteracoes from "@/components/forms/SalvarAlteracoes";
import { useEffect, useRef, useState } from "react";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  atualizarRelatorio,
  type RelatorioDetalhado,
} from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

interface Props {
  relatorio: RelatorioDetalhado;
  onClose: () => void;
  onSaved: (atualizado: RelatorioDetalhado) => void;
}

export default function RelatorioEdicaoModal({
  relatorio,
  onClose,
  onSaved,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [titulo, setTitulo] = useState(relatorio.titulo);
  const [inclusaoAutomatica, setInclusaoAutomatica] = useState(
    relatorio.inclusao_automatica
  );
  const [erroTitulo, setErroTitulo] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");
  const [salvando, setSalvando] = useState(false);

  const quantidadeAlteracoes =
    Number(titulo !== relatorio.titulo) +
    Number(inclusaoAutomatica !== relatorio.inclusao_automatica);
  const saida = useSaidaFormulario(quantidadeAlteracoes > 0, salvando);
  useVoltarEdicaoRelatorioWeb(
    quantidadeAlteracoes > 0,
    salvando,
    saida.confirmarSaida
  );
  const salvamentoEmCurso = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  function fecharEdicao() {
    if (salvamentoEmCurso.current) return;
    saida.confirmarSaida(onClose);
  }

  async function salvar() {
    if (salvamentoEmCurso.current) return;
    const tituloLimpo = titulo.trim();

    if (!tituloLimpo || tituloLimpo.length > 200) {
      setErroTitulo("Informe um título com até 200 caracteres.");
      return;
    }

    setErroTitulo("");
    setErroSalvar("");
    salvamentoEmCurso.current = true;
    setSalvando(true);

    try {
      const resposta = await atualizarRelatorio(relatorio.id, {
        titulo: tituloLimpo,
        inclusao_automatica: inclusaoAutomatica,
      });

      if (montado.current) onSaved(resposta.relatorio);
    } catch (e) {
      if (!montado.current) return;
      setErroSalvar(
        e instanceof Error ? e.message : "Não foi possível salvar o relatório."
      );
    } finally {
      salvamentoEmCurso.current = false;
      if (montado.current) setSalvando(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (saida.alertaProps.visible) saida.alertaProps.onClose();
        else if (!salvando) fecharEdicao();
      }}
    >
      <EdicaoCompacta ativa={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <View
            style={[
              styles.container,
              {
                backgroundColor: theme.background,
                borderColor: theme.borda + "40",
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <ScrollView
              style={{ flexShrink: 1, minHeight: 0 }}
              automaticallyAdjustKeyboardInsets={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.conteudo}
            >
              <Text weight="Bold" style={styles.tituloModal}>
                Editar relatório
              </Text>

              <SecaoEdicao titulo="Dados do relatório">
                <Input
                  label="Título"
                  value={titulo}
                  onChangeText={(valor) => {
                    setTitulo(valor);
                    setErroTitulo("");
                  }}
                  maxLength={200}
                  error={erroTitulo}
                  containerStyle={styles.input}
                  editable={!salvando}
                />
              </SecaoEdicao>

              <View style={[styles.periodo, { borderColor: theme.borda }]}>
                <Text weight="SemiBold">PERÍODO</Text>
                <Text>
                  {dataISOParaBR(relatorio.periodo_inicio)} a{" "}
                  {dataISOParaBR(relatorio.periodo_fim)}
                </Text>
                <Text style={[styles.ajuda, { color: theme.textoSub }]}>
                  Para mudar as datas e escolher novas matérias, use “Alterar
                  período e matérias” nos detalhes do relatório.
                </Text>
              </View>

              <View style={[styles.automatico, { borderColor: theme.borda }]}>
                <View style={styles.automaticoTexto}>
                  <Text weight="SemiBold">Incluir novas matérias</Text>
                  <Text style={[styles.ajuda, { color: theme.textoSub }]}>
                    Novos clippings deste cliente no período entram no relatório
                    para revisão.
                  </Text>
                </View>

                <Switch
                  value={inclusaoAutomatica}
                  onValueChange={setInclusaoAutomatica}
                  trackColor={{
                    false: `${theme.borda}55`,
                    true: `${theme.textoTerciaria}88`,
                  }}
                  thumbColor={theme.backgroundContainer}
                />
              </View>

              {erroSalvar ? (
                <Text style={{ color: theme.erro }}>{erroSalvar}</Text>
              ) : null}
            </ScrollView>
            <SalvarAlteracoes
              alterations={quantidadeAlteracoes}
              saving={salvando}
              error={erroSalvar || erroTitulo}
              onSave={() => void salvar()}
              onDiscard={fecharEdicao}
            />
          </View>
        </KeyboardAvoidingView>
      </EdicaoCompacta>
      <FeedbackAlert
        {...saida.alertaProps}
        inline
        title="Salvar alterações antes de sair?"
        message="Você pode salvar o que editou, continuar a edição ou descartar as alterações."
        primaryLabel="DESCARTAR"
        secondaryLabel="CONTINUAR"
        tertiaryLabel="SALVAR"
        loading={salvando}
        onTertiary={() => {
          saida.alertaProps.onClose();
          void salvar();
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  container: {
    maxHeight: "90%",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    borderWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  conteudo: {
    padding: 18,
    gap: 14,
  },
  tituloModal: {
    fontSize: 19,
  },
  input: {
    marginBottom: 0,
  },
  periodo: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    gap: 6,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
  },
  automatico: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  automaticoTexto: {
    flex: 1,
    gap: 5,
  },
});
