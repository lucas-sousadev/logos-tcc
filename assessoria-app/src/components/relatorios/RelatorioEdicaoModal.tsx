import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
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
  const [inclusaoAutomatica, setInclusaoAutomatica] =
    useState(relatorio.inclusao_automatica);
  const [erroTitulo, setErroTitulo] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const tituloLimpo = titulo.trim();

    if (!tituloLimpo || tituloLimpo.length > 200) {
      setErroTitulo("Informe um título com até 200 caracteres.");
      return;
    }

    setErroTitulo("");
    setErroSalvar("");
    setSalvando(true);

    try {
      const resposta = await atualizarRelatorio(
        relatorio.id,
        {
          titulo: tituloLimpo,
          inclusao_automatica: inclusaoAutomatica,
        }
      );

      onSaved(resposta.relatorio);
    } catch (e) {
      setErroSalvar(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar o relatório."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!salvando) onClose();
      }}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.conteudo}
          >
            <Text weight="Bold" style={styles.tituloModal}>
              Editar relatório
            </Text>

            <Input
              label="TÍTULO"
              value={titulo}
              onChangeText={(valor) => {
                setTitulo(valor);
                setErroTitulo("");
              }}
              maxLength={200}
              error={erroTitulo}
              containerStyle={styles.input}
            />

            <View
              style={[
                styles.periodo,
                { borderColor: theme.borda },
              ]}
            >
              <Text weight="SemiBold">PERÍODO</Text>
              <Text>
                {dataISOParaBR(relatorio.periodo_inicio)} a{" "}
                {dataISOParaBR(relatorio.periodo_fim)}
              </Text>
              <Text
                style={[
                  styles.ajuda,
                  { color: theme.textoSub },
                ]}
              >
                Para mudar as datas e escolher novas matérias, use
                “Alterar período e matérias” nos detalhes do relatório.
              </Text>
            </View>

            <View
              style={[
                styles.automatico,
                { borderColor: theme.borda },
              ]}
            >
              <View style={styles.automaticoTexto}>
                <Text weight="SemiBold">
                  Incluir novas matérias
                </Text>
                <Text
                  style={[
                    styles.ajuda,
                    { color: theme.textoSub },
                  ]}
                >
                  Novos clippings deste cliente no período entram
                  no relatório para revisão.
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
              <Text style={{ color: theme.erro }}>
                {erroSalvar}
              </Text>
            ) : null}

            <View style={styles.acoes}>
              <Button
                title="CANCELAR"
                variant="outline"
                size="small"
                disabled={salvando}
                onPress={onClose}
                style={styles.botao}
              />
              <Button
                title="SALVAR"
                size="small"
                loading={salvando}
                onPress={() => void salvar()}
                style={styles.botao}
              />
            </View>
          </ScrollView>
        </View>
      </View>
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
    borderWidth: 1.5,
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
  acoes: {
    flexDirection: "row",
    gap: 8,
    marginTop: 5,
  },
  botao: {
    flex: 1,
    width: "auto",
    paddingHorizontal: 8,
  },
});