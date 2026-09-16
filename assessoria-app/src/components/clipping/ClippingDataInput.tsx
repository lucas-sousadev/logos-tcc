import { useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { Fonts } from "@/constants/fonts";
import { useTheme } from "@/contexts/ThemeContext";
import {
  dataBRParaISO,
  dataISOParaBR,
  mascararData,
} from "@/utils/clippingFormatacao";

LocaleConfig.locales["pt-br"] = {
  monthNames: [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro",
  ],
  monthNamesShort: [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ],
  dayNames: [
    "Domingo", "Segunda-feira", "Terça-feira",
    "Quarta-feira", "Quinta-feira", "Sexta-feira",
    "Sábado",
  ],
  dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  today: "Hoje",
};

LocaleConfig.defaultLocale = "pt-br";

interface ClippingDataInputProps {
  value: string;
  anoReferencia: number;
  onChangeText: (valor: string) => void;
  error?: string;
  disabled?: boolean;
  showChanged?: boolean;
  label?: string;
}

export default function ClippingDataInput({
  value,
  anoReferencia,
  onChangeText,
  showChanged = false,
  error,
  disabled = false,
  label = "DATA DE PUBLICAÇÃO",
}: ClippingDataInputProps) {
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();

  const [aberto, setAberto] = useState(false);
  const [tocou, setTocou] = useState(false);
  const [mesInicial, setMesInicial] = useState("");
  const [mesVisivel, setMesVisivel] = useState("");

  const dataSelecionada = dataBRParaISO(value);

  const erroExibido =
    error ||
    (tocou && value.trim() && !dataSelecionada
      ? "Informe uma data válida em DD/MM/AAAA."
      : undefined);

  function abrirCalendario() {
    if (disabled) return;

    Keyboard.dismiss();

    const hoje = new Date();

    const ano =
      Number.isInteger(anoReferencia) &&
      anoReferencia >= 1000 &&
      anoReferencia <= 9999
        ? anoReferencia
        : hoje.getFullYear();

    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const inicial = dataSelecionada || `${ano}-${mes}-01`;

    setMesInicial(inicial);
    setMesVisivel(inicial.slice(0, 7));
    setAberto(true);
  }

  function selecionarData(iso: string) {
    if (disabled) return;

    const brasileira = dataISOParaBR(iso);

    if (!brasileira) return;

    onChangeText(brasileira);
    setTocou(true);
    setAberto(false);
  }

  function selecionarHoje() {
    const hoje = new Date();

    selecionarData(
      `${hoje.getFullYear()}-` +
      `${String(hoje.getMonth() + 1).padStart(2, "0")}-` +
      String(hoje.getDate()).padStart(2, "0")
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <Text
          weight="Medium"
          style={[styles.label, { marginBottom: 0 }]}
        >
          {label}
        </Text>

        {showChanged ? (
          <Ionicons
            name="create-outline"
            size={15}
            color={theme.primaria}
            accessibilityLabel="Data alterada"
          />
        ) : null}
      </View>

      <View style={styles.linha}>
        <Input
          accessibilityLabel={label}
          value={value}
          onChangeText={(texto) => {
            if (!disabled) {
              onChangeText(mascararData(texto));
            }
          }}
          onBlur={() => setTocou(true)}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          autoCorrect={false}
          editable={!disabled}
          clearable={!disabled}
          error={erroExibido}
          containerStyle={styles.input}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Abrir calendário"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={abrirCalendario}
          style={[
            styles.botao,
            {
              borderColor: theme.borda,
              backgroundColor: theme.background,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={22}
            color={theme.textoTerciaria}
          />
        </TouchableOpacity>
      </View>

      {aberto ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setAberto(false)}
        >
          <View
            style={[
              styles.overlay,
              {
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setAberto(false)}
              accessibilityRole="button"
              accessibilityLabel="Fechar calendário"
            />

            <View
              accessibilityViewIsModal
              style={[
                styles.painel,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.borda,
                },
              ]}
            >
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.conteudo}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.cabecalho}>
                  <Text weight="Bold" style={styles.titulo}>
                    Data de publicação
                  </Text>

                  <TouchableOpacity
                    onPress={() => setAberto(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Fechar calendário"
                    style={styles.fechar}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={theme.texto}
                    />
                  </TouchableOpacity>
                </View>

                <Calendar
                  key={mode}
                  initialDate={mesInicial}
                  minDate="1000-01-01"
                  maxDate="9999-12-31"
                  firstDay={0}
                  hideExtraDays
                  disableAllTouchEventsForDisabledDays
                  disableArrowLeft={mesVisivel === "1000-01"}
                  disableArrowRight={mesVisivel === "9999-12"}
                  onMonthChange={(mes) =>
                    setMesVisivel(mes.dateString.slice(0, 7))
                  }
                  onDayPress={(dia) =>
                    selecionarData(dia.dateString)
                  }
                  markedDates={
                    dataSelecionada
                      ? {
                          [dataSelecionada]: {
                            selected: true,
                          },
                        }
                      : {}
                  }
                  theme={{
                    calendarBackground: theme.background,
                    dayTextColor: theme.texto,
                    monthTextColor: theme.texto,
                    textSectionTitleColor: theme.textoSub,
                    textDisabledColor: theme.textoSub,
                    todayTextColor: theme.textoTerciaria,
                    arrowColor: theme.textoTerciaria,
                    selectedDayBackgroundColor:
                      theme.backgroundContainer,
                    selectedDayTextColor: theme.textoContainer,
                    textDayFontFamily: Fonts.MontserratRegular,
                    textMonthFontFamily: Fonts.MontserratSemiBold,
                    textDayHeaderFontFamily: Fonts.MontserratRegular,
                  }}
                />

                <View style={styles.rodape}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                      if (disabled) return;
                      onChangeText("");
                      setAberto(false);
                    }}
                    style={styles.atalho}
                  >
                    <Text style={{ color: theme.textoSub }}>
                      Deixar sem data
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={selecionarHoje}
                    style={styles.atalho}
                  >
                    <Text
                      weight="SemiBold"
                      style={{ color: theme.textoTerciaria }}
                    >
                      Usar hoje
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    marginBottom: 8,
  },
  linha: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  input: {
    flex: 1,
    width: undefined,
    marginBottom: 0,
  },
  botao: {
    width: 48,
    height: 50,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  painel: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    borderWidth: 1.5,
    borderRadius: 18,
    overflow: "hidden",
  },
  scroll: {
    flexGrow: 0,
  },
  conteudo: {
    padding: 12,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titulo: {
    flex: 1,
    fontSize: 16,
  },
  fechar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  rodape: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  atalho: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
});