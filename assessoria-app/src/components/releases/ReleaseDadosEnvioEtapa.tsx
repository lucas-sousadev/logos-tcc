import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { DadosEnvioRelease } from "@/services/api/release";

interface Props {
  dados: DadosEnvioRelease;
  disabled?: boolean;
  onChange: (
    campo: keyof DadosEnvioRelease,
    valor: string
  ) => void;
}

export default function ReleaseDadosEnvioEtapa({
  dados,
  disabled = false,
  onChange,
}: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Input
        label="ASSUNTO DO E-MAIL"
        value={dados.assunto}
        onChangeText={(valor) => onChange("assunto", valor)}
        editable={!disabled}
        maxLength={255}
        placeholder="O assunto que o jornalista receberá"
        containerStyle={styles.campo}
        clearable
      />

      <View style={styles.grupo}>
        <Input
          label="PRIMEIRA LINHA"
          value={dados.primeira_linha}
          onChangeText={(valor) => onChange("primeira_linha", valor)}
          editable={!disabled}
          maxLength={150}
          placeholder="Um resumo que complemente o assunto"
          containerStyle={styles.campo}
          clearable
        />
        <Text style={{ color: theme.textoSub, fontSize: 12 }}>
          Texto exibido junto ao assunto na prévia da caixa de entrada.
        </Text>
      </View>

      <Input
        label="NOME DO REMETENTE"
        value={dados.nome_remetente}
        onChangeText={(valor) => onChange("nome_remetente", valor)}
        editable={!disabled}
        maxLength={100}
        autoCapitalize="words"
        placeholder="Nome da assessoria ou do assessor"
        containerStyle={styles.campo}
        clearable
      />

      <View
        style={[
          styles.remetente,
          {
            borderColor: theme.borda + "55",
            backgroundColor: theme.primaria + "08",
          },
        ]}
      >
        <Ionicons
          name="mail-outline"
          size={21}
          color={theme.textoTerciaria}
        />

        <View style={{ flex: 1, gap: 3 }}>
          <Text weight="SemiBold" style={{ fontSize: 13 }}>
            Remetente padrão do LOGOS
          </Text>
          <Text style={{ color: theme.textoSub, fontSize: 12 }}>
            O release será enviado pelo endereço padrão do sistema.
          </Text>
        </View>
      </View>

      <View style={styles.grupo}>
        <Input
          label="RESPONDER PARA"
          value={dados.responder_para}
          onChangeText={(valor) => onChange("responder_para", valor)}
          editable={!disabled}
          maxLength={254}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="E-mail para receber as respostas"
          containerStyle={styles.campo}
          clearable
        />
        <Text style={{ color: theme.textoSub, fontSize: 12 }}>
          As respostas dos contatos serão direcionadas a este endereço.
        </Text>
      </View>

      <View
        style={[
          styles.previa,
          {
            borderColor: theme.borda + "45",
            backgroundColor: theme.backgroundSecundario,
          },
        ]}
      >
        <Text style={{ fontSize: 11, color: theme.textoSub }}>
          PRÉVIA DA CAIXA DE ENTRADA
        </Text>
        <Text weight="Bold" style={{ fontSize: 13 }} numberOfLines={1}>
          {dados.nome_remetente.trim() || "Nome do remetente"}
        </Text>
        <Text weight="SemiBold" style={{ fontSize: 13 }} numberOfLines={2}>
          {dados.assunto.trim() || "Assunto do e-mail"}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textoSub }} numberOfLines={2}>
          {dados.primeira_linha.trim() || "A primeira linha aparecerá aqui"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  grupo: {
    gap: 5,
  },
  campo: {
    marginBottom: 0,
  },
  remetente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  previa: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    gap: 5,
  },
});