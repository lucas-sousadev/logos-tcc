import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  buscarClipping,
  Clipping,
} from "@/services/api/clipping";
import ClippingAnexos from "@/components/clipping/ClippingAnexos";

export default function ClippingDetalhes() {
  const router = useRouter();
  const { theme } = useTheme();

  const params = useLocalSearchParams<{
    id: string;
  }>();

  const id = Number(params.id);

  const [clipping, setClipping] =
    useState<Clipping | null>(null);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      if (!id || Number.isNaN(id)) {
        setErro("Clipping inválido.");
        setCarregando(false);
        return;
      }

      try {
        const dados = await buscarClipping(id);
        setClipping(dados);
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o clipping."
        );
      } finally {
        setCarregando(false);
      }
    }

    void carregar();
  }, [id]);

  function formatarData(data: string | null) {
    if (!data) return "Data pendente";

    const partes = data.split("-");

    if (partes.length !== 3) {
      return data;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function formatarDuracao(
    segundos: number | null
  ) {
    if (segundos === null) {
      return "Não informada";
    }

    const minutos = Math.floor(segundos / 60);
    const restante = segundos % 60;

    if (minutos === 0) {
      return `${restante}s`;
    }

    return `${minutos}min ${restante}s`;
  }

  async function abrirLink() {
    if (!clipping?.link) {
      return;
    }

    try {
      await Linking.openURL(clipping.link);
    } catch {
      setErro("Não foi possível abrir o link.");
    }
  }

  if (carregando) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Clipping"
          showBackButton
        />

        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
      </View>
    );
  }

  if (!clipping) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Clipping"
          showBackButton
        />

        <View style={styles.errorBox}>
          <Ionicons
            name="alert-circle-outline"
            size={34}
            color="#EF4444"
          />

          <Text weight="SemiBold" style={styles.errorTitle}>
            Não foi possível carregar
          </Text>

          <Text
            style={[
              styles.errorText,
              { color: theme.textoSub },
            ]}
          >
            {erro || "Clipping não encontrado."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title="Detalhes do clipping"
        showBackButton
        onBackPress={() => router.back()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.summary,
            {
              borderColor: theme.borda,
              backgroundColor: theme.background,
            },
          ]}
        >


          <View style={styles.summaryInfo}>
            <Text weight="Bold" style={styles.summaryTitle}>
              {clipping.pauta || "Pauta pendente"}
            </Text>

            <Text
              style={[
                styles.summaryMeta,
                { color: theme.textoSub },
              ]}
            >
              {clipping.cliente_nome} •{" "}
              {clipping.ano_referencia}
            </Text>
          </View>
        </View>

        <Text weight="Bold" style={styles.sectionTitle}>
          INFORMAÇÕES DA PUBLICAÇÃO
        </Text>

        <InfoRow
          icon="calendar-outline"
          label="DATA DE PUBLICAÇÃO"
          value={formatarData(clipping.data_publicacao)}
          theme={theme}
        />

        <InfoRow
          icon="business-outline"
          label="VEÍCULO"
          value={
            clipping.veiculo_nome ||
            "Nenhum veículo informado"
          }
          theme={theme}
        />

        <InfoRow
          icon="layers-outline"
          label="TIER"
          value={
            clipping.tier
              ? `Tier ${clipping.tier}`
              : "Não definido"
          }
          theme={theme}
        />

        <InfoRow
          icon="pricetags-outline"
          label="CATEGORIAS"
          value={
            clipping.categorias.length > 0
              ? clipping.categorias.join(", ")
              : "Nenhuma categoria"
          }
          theme={theme}
        />

        <InfoRow
          icon="albums-outline"
          label="PROGRAMA / SEÇÃO"
          value={
            clipping.programa_secao ||
            "Não informado"
          }
          theme={theme}
        />

        <InfoRow
          icon="time-outline"
          label="TRECHO"
          value={
            clipping.inicio_segundos !== null &&
            clipping.fim_segundos !== null
              ? `${clipping.inicio_segundos}s até ${clipping.fim_segundos}s`
              : "Não informado"
          }
          theme={theme}
        />

        <InfoRow
          icon="timer-outline"
          label="DURAÇÃO"
          value={formatarDuracao(
            clipping.duracao_segundos
          )}
          theme={theme}
        />

        {clipping.link ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => void abrirLink()}
            style={[
              styles.linkBox,
              {
                borderColor: theme.borda,
                backgroundColor: theme.background,
              },
            ]}
          >
            <View
              style={[
                styles.linkIcon,
                {
                  backgroundColor:
                    theme.backgroundContainer,
                },
              ]}
            >
              <Ionicons
                name="link-outline"
                size={20}
                color={theme.textoContainer}
              />
            </View>

            <View style={styles.linkInfo}>
              <Text weight="SemiBold" style={styles.linkLabel}>
                LINK DA PUBLICAÇÃO
              </Text>

              <Text
                style={[
                  styles.linkText,
                  { color: theme.primaria },
                ]}
                numberOfLines={3}
              >
                {clipping.link}
              </Text>
            </View>

            <Ionicons
              name="open-outline"
              size={20}
              color={theme.primaria}
            />
          </TouchableOpacity>
        ) : null}

        {clipping.observacoes ? (
          <InfoRow
            icon="document-text-outline"
            label="OBSERVAÇÕES"
            value={clipping.observacoes}
            theme={theme}
          />
        ) : null}

        <ClippingAnexos clippingId={clipping.id} />
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        { borderColor: theme.borda },
      ]}
    >
      <View
        style={[
          styles.infoIcon,
          {
            backgroundColor:
              theme.backgroundContainer,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={theme.textoContainer}
        />
      </View>

      <View style={styles.infoContent}>
        <Text weight="SemiBold" style={[styles.infoLabel, {color: theme.textoTerciaria}]}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  summary: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },

  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  summaryInfo: {
    flex: 1,
  },

  summaryTitle: {
    fontSize: 16,
    lineHeight: 22,
  },

  summaryMeta: {
    fontSize: 11,
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 13,
  },

  infoRow: {
    minHeight: 65,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 12,
  },

  infoLabel: {
    fontSize: 10,
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 13,
    lineHeight: 18,
  },

  linkBox: {
    minHeight: 70,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  linkInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  linkLabel: {
    fontSize: 10,
    marginBottom: 4,
  },

  linkText: {
    fontSize: 12,
    lineHeight: 17,
  },

  errorBox: {
    margin: 20,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
  },

  errorTitle: {
    fontSize: 15,
    marginTop: 12,
  },

  errorText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 7,
  },
});