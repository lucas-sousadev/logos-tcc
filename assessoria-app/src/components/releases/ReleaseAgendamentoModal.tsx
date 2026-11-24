import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  dataBRParaISO,
  dataISOParaBR,
  mascararData,
} from "@/utils/clippingFormatacao";
import {
  horarioInicialRelease,
  type HorarioRelease,
} from "@/utils/agendamentoRelease";

interface Props {
  visible: boolean;
  inicial?: string | null;
  loading: boolean;
  erro: string;
  onClose: () => void;
  onConfirm: (horario: HorarioRelease) => void;
}

export default function ReleaseAgendamentoModal(props: Props) {
  return props.visible ? <FormularioAgendamento {...props} /> : null;
}

function FormularioAgendamento({
  inicial,
  loading,
  erro,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [sugestao] = useState(() => horarioInicialRelease(inicial));
  const [data, setData] = useState(() => dataISOParaBR(sugestao.data));
  const [hora, setHora] = useState(sugestao.hora);
  const [erroLocal, setErroLocal] = useState("");

  function confirmar() {
    if (loading) return;
    const iso = dataBRParaISO(data);
    if (!iso || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      setErroLocal("Informe uma data válida e um horário entre 00:00 e 23:59.");
      return;
    }
    setErroLocal("");
    onConfirm({ data: iso, hora });
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.overlay,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Fechar agendamento"
          onPress={() => {
            if (!loading) onClose();
          }}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.painel,
            { backgroundColor: theme.background, borderColor: theme.borda },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.conteudo}
          >
            <View style={styles.topo}>
              <Ionicons
                name="calendar-outline"
                size={26}
                color={theme.textoTerciaria}
              />
              <Text weight="Bold" style={{ fontSize: 21 }}>
                {inicial ? "Reagendar release" : "Agendar release"}
              </Text>
            </View>
            <Text style={{ color: theme.textoSub }}>
              Escolha quando o envio deve entrar na fila de processamento.
            </Text>
            <View
              style={[
                styles.fuso,
                { backgroundColor: theme.textoTerciaria + "0D" },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={17}
                color={theme.textoTerciaria}
              />
              <Text weight="SemiBold" style={{ fontSize: 13 }}>
                Horário de Brasília
              </Text>
            </View>
            <Input
              label="DATA"
              placeholder="DD/MM/AAAA"
              value={data}
              maxLength={10}
              keyboardType="number-pad"
              editable={!loading}
              onChangeText={(valor) => {
                setData(mascararData(valor));
                setErroLocal("");
              }}
              containerStyle={{ marginBottom: 0 }}
            />
            <Input
              label="HORÁRIO"
              placeholder="HH:MM"
              value={hora}
              maxLength={5}
              keyboardType="number-pad"
              editable={!loading}
              onChangeText={(valor) => {
                const numeros = valor.replace(/\D/g, "").slice(0, 4);
                setHora(
                  numeros.length > 2
                    ? numeros.slice(0, 2) + ":" + numeros.slice(2)
                    : numeros
                );
                setErroLocal("");
              }}
              containerStyle={{ marginBottom: 0 }}
            />
            <Text style={{ color: theme.textoSub, fontSize: 12 }}>
              Use pelo menos um minuto de antecedência. O processamento começa a
              partir do horário escolhido, conforme a execução da fila no
              servidor.
            </Text>
            {erroLocal || erro ? (
              <Text style={{ color: theme.erro }}>{erroLocal || erro}</Text>
            ) : null}
            <View style={styles.acoes}>
              <Button
                title="VOLTAR"
                variant="outline"
                disabled={loading}
                onPress={onClose}
                style={styles.botao}
              />
              <Button
                title={inicial ? "REAGENDAR" : "AGENDAR"}
                icon="calendar-outline"
                loading={loading}
                onPress={confirmar}
                style={styles.botao}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  painel: {
    borderWidth: 1,
    borderRadius: 22,
    width: "100%",
    maxWidth: 480,
    maxHeight: "100%",
    overflow: "hidden",
  },
  conteudo: { padding: 20, gap: 16 },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  fuso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  acoes: { flexDirection: "row", gap: 8 },
  botao: { flex: 1, minWidth: 0 },
});
