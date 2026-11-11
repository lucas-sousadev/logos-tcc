import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  enviarTesteRelease,
  type BlocoTemplateRelease,
  type DadosEnvioRelease,
} from "@/services/api/release";

interface Props {
  emailInicial: string;
  dadosEnvio: DadosEnvioRelease;
  blocos: BlocoTemplateRelease[];
  disabled?: boolean;
}

export default function ReleaseEnvioTeste({
  emailInicial,
  dadosEnvio,
  blocos,
  disabled = false,
}: Props) {
  const { theme } = useTheme();
  const trava = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  function abrir() {
    setEmail(emailInicial);
    setErro("");
    setEnviado(false);
    setAberto(true);
  }

  function fechar() {
    if (!trava.current) setAberto(false);
  }

  async function enviar() {
    const destino = email.trim();
    if (trava.current || enviado || disabled || !destino) return;

    trava.current = true;
    setEnviando(true);
    setErro("");

    try {
      await enviarTesteRelease(destino, dadosEnvio, blocos);
      setEnviado(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível confirmar o envio.");
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <Button
        title="ENVIAR TESTE"
        icon="mail-outline"
        variant="outline"
        disabled={disabled}
        onPress={abrir}
      />

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={fechar}>
        <KeyboardAvoidingView
          style={styles.fundo}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[
            styles.painel,
            { backgroundColor: theme.background, borderColor: theme.borda },
          ]}>
            <Text accessibilityRole="header" weight="Bold" style={styles.titulo}>
              Enviar teste
            </Text>

            {enviado ? (
              <>
                <Text accessibilityLiveRegion="polite">
                  Teste enviado para {email.trim()}.
                </Text>
                <Button title="FECHAR" onPress={fechar} />
              </>
            ) : (
              <>
                <Text style={{ color: theme.textoSub }}>
                  O teste será enviado somente para o endereço abaixo.
                </Text>

                <Input
                  label="E-MAIL DE TESTE"
                  value={email}
                  maxLength={254}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!enviando}
                  containerStyle={styles.campo}
                  onChangeText={(texto) => {
                    setEmail(texto);
                    setErro("");
                  }}
                />

                {erro ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: theme.erro }}>
                    {erro}
                  </Text>
                ) : null}

                <View style={styles.acoes}>
                  <Button
                    title="CANCELAR"
                    variant="outline"
                    style={styles.botao}
                    disabled={enviando}
                    onPress={fechar}
                  />
                  <Button
                    title="ENVIAR"
                    style={styles.botao}
                    loading={enviando}
                    disabled={disabled || !email.trim()}
                    onPress={() => void enviar()}
                  />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  painel: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  titulo: { 
    fontSize: 18 
},
  campo: {
    marginBottom: 0 
},
  acoes: { 
    flexDirection: "row", 
    gap: 8 
},
  botao: { 
    width: "auto", 
    flex: 1 
},
});