import { useState } from "react";
import {
  Linking,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { rotuloTier } from "@/constants/tier";
import type { Clipping } from "@/services/api/clipping";

interface ClippingCardProps {
  clipping: Clipping;
  expandido: boolean;
  onAlternarExpansao: () => void;
  onAbrirDetalhes: () => void;
}

function formatarData(
  data: string | null,
  completa = false
): string {
  if (!data) return "Não informada";

  const partes = data.split("-");
  if (partes.length !== 3) return data;

  const [ano, mes, dia] = partes;

  return completa
    ? dia + "/" + mes + "/" + ano
    : dia + "/" + mes;
}

function formatarTempo(segundos: number | null): string {
  if (segundos === null) return "Pendente";

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const restante = segundos % 60;

  const partes = [
    String(minutos).padStart(2, "0"),
    String(restante).padStart(2, "0"),
  ];

  if (horas > 0) {
    partes.unshift(String(horas).padStart(2, "0"));
  }

  return partes.join(":");
}

export default function ClippingCard({
  clipping,
  expandido,
  onAlternarExpansao,
  onAbrirDetalhes,
}: ClippingCardProps) {
  const { theme, mode } = useTheme();
  const { fontScale } = useWindowDimensions();

  const [erroLink, setErroLink] = useState("");

  const fonteAmpliada = fontScale > 1.2;

  const corPendente =
  mode === "dark" ? "#E79A9A" : "#B45353";

  const pendencias = {
    data: !clipping.data_publicacao,
    veiculo: !clipping.veiculo_nome?.trim(),
    pauta: !clipping.pauta?.trim(),
    categorias: clipping.categorias.length === 0,
    tier: clipping.tier === null,
    arquivos: clipping.total_anexos === 0,
    trecho:
      clipping.inicio_segundos === null ||
      clipping.fim_segundos === null ||
      clipping.duracao_segundos === null,
    link: !clipping.link?.trim(),
  };

  const veiculo =
    clipping.veiculo_nome?.trim() || "Não informado";

  const pauta =
    clipping.pauta?.trim() ||
    "Clipping #" + clipping.id + " — pauta pendente";

  const categorias = clipping.categorias;
  const resumoCategorias = categorias.slice(0, 2).join(", ");
  const categoriasExtras = Math.max(0, categorias.length - 2);
  const programaSecao = clipping.programa_secao?.trim() || "";
  const temDuracao = clipping.duracao_segundos !== null;

  const temPosicoes =
    clipping.inicio_segundos !== null ||
    clipping.fim_segundos !== null;

  const detalhes = [
    {
      rotulo: "Publicação",
      valor: formatarData(clipping.data_publicacao, true),
      pendente: pendencias.data,
    },
        {
      rotulo: "Categorias",
      valor: categorias.join(", ") || "Não informadas",
      pendente: pendencias.categorias,
    },
    {
      rotulo: "Veículo",
      valor: veiculo,
      pendente: pendencias.veiculo,
    },
    {
      rotulo: "Programa/seção",
      valor: clipping.programa_secao,
    },
    {
      rotulo: "Tier",
      valor: rotuloTier(clipping.tier),
      pendente: pendencias.tier,
    },
    {
      rotulo: "Trecho",
      valor: temPosicoes
        ? "Início " +
          formatarTempo(clipping.inicio_segundos) +
          " · Fim " +
          formatarTempo(clipping.fim_segundos) +
          " (" + formatarTempo(clipping.duracao_segundos) + ")"
        : null,
        pendente: pendencias.trecho,
    },
    {
      rotulo: "Observações",
      valor: clipping.observacoes,
    },
    {
      rotulo: "Link",
      valor: clipping.link?.trim() || "Não informado",
      pendente: pendencias.link,
    },
    {
      rotulo: "Arquivos",
      valor:
        clipping.total_anexos > 0
          ? clipping.total_anexos +
            (clipping.total_anexos === 1
              ? " arquivo nos detalhes"
              : " arquivos nos detalhes")
          : "Nenhum arquivo anexado",
        pendente: pendencias.arquivos,
    },
  ];

  async function abrirLink() {
    if (!clipping.link) return;

    setErroLink("");

    try {
      await Linking.openURL(clipping.link);
    } catch {
      setErroLink(
        "Não foi possível abrir o link. Tente novamente."
      );
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background,
          borderColor: theme.borda
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: expandido }}
        accessibilityHint={
          expandido
            ? "Recolher informações do clipping"
            : "Expandir informações do clipping"
        }
        onPress={() => {
          setErroLink("");
          onAlternarExpansao();
        }}
        style={styles.resumo}
      >
        <View style={styles.topo}>
          <Text
            weight="SemiBold"
            style={[
                styles.data,
                {
                color: pendencias.data
                ? corPendente
                : theme.textoTerciaria,
                backgroundColor: theme.borda + "18",
                },
            ]}
            >
                {formatarData(clipping.data_publicacao)}
            </Text>

          {fonteAmpliada ? (
            <View style={styles.espaco} />
          ) : (
            <Text
              weight="SemiBold"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
              styles.veiculo,
              styles.veiculoNaLinha,
              {
                color: pendencias.veiculo
                  ? corPendente
                  : theme.texto,
              },
            ]}
            >
              {veiculo}
            </Text>
          )}

          <Text
            weight="SemiBold"
            accessibilityLabel={rotuloTier(clipping.tier)}
            style={[
              styles.tier,
              {
                color: pendencias.tier
                  ? corPendente
                  : theme.textoContainer,
                backgroundColor:
                  clipping.tier === null
                    ? theme.background
                    : theme.backgroundContainer,
                borderColor: theme.borda,
              },
            ]}
          >
            {clipping.tier === null
              ? "Tier —"
              : "Tier " + clipping.tier}
          </Text>
        </View>

        {fonteAmpliada ? (
          <Text
            weight="SemiBold"
            style={[
              styles.veiculo,
              {
                color: pendencias.veiculo
                  ? corPendente
                  : theme.texto,
              },
            ]}
          >
            {veiculo}
          </Text>
        ) : null}

        <Text
            weight="SemiBold"
            numberOfLines={expandido ? undefined : 2}
            ellipsizeMode="tail"
            style={[
              styles.pauta,
              {
                color: pendencias.pauta
                  ? corPendente
                  : theme.texto,
              },
            ]}
            >
            {pauta}
        </Text>

        <View style={styles.rodape}>
          <View style={styles.informacoesRodape}>
            <View
                style={[
                styles.categorias,
                programaSecao
                    ? styles.categoriasComPrograma
                    : undefined,
                ]}
            >
                <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.categoriaTexto,
                  {
                    color: pendencias.categorias
                      ? corPendente
                      : theme.textoSub,
                  },
                ]}
                >
                {resumoCategorias || "Sem categoria"}
                </Text>

                {categoriasExtras > 0 ? (
                <Text
                    weight="SemiBold"
                    style={[
                    styles.extra,
                    { color: theme.textoSub },
                    ]}
                >
                    +{categoriasExtras}
                </Text>
                ) : null}
            </View>

            {programaSecao ? (
                <>
                <Text
                    accessible={false}
                    style={[
                    styles.separador,
                    { color: theme.textoSub },
                    ]}
                >
                    •
                </Text>

                <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                    styles.programa,
                    { color: theme.textoSub },
                    ]}
                >
                    {programaSecao}
                </Text>
                </>
            ) : null}
            </View>

          <View style={styles.indicadores}>
            {temDuracao ? (
              <Text
                weight="SemiBold"
                style={[
                  styles.duracao,
                  { color: theme.texto },
                ]}
              >
                Trecho:{" "}
                {formatarTempo(clipping.duracao_segundos)}
              </Text>
            ) : null}

            <Ionicons
              name={
                expandido
                  ? "chevron-up"
                  : "chevron-down"
              }
              size={17}
              color={theme.textoSub}
              accessible={false}
            />
          </View>
        </View>
      </TouchableOpacity>

      {expandido ? (
        <View
          style={[
            styles.expansao,
            { borderTopColor: theme.borda + "66" },
          ]}
        >
          {detalhes.map(({ rotulo, valor, pendente }) =>
            valor?.trim() ? (
              <Text
                key={rotulo}
                selectable
                style={styles.detalhe}
              >
                <Text weight="SemiBold">
                  {rotulo}:{" "}
                </Text>

                <Text
                  style={{
                    color: pendente
                      ? corPendente
                      : theme.texto,
                  }}
                >
                  {valor}
                </Text>
              </Text>
            ) : null
          )}

          {erroLink ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.erro}
            >
              {erroLink}
            </Text>
          ) : null}

          <View style={styles.acoes}>
            {clipping.link ? (
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Abrir link da publicação"
                onPress={() => void abrirLink()}
                style={[
                  styles.acao,
                  { borderColor: theme.borda },
                ]}
              >
                <Ionicons
                  name="open-outline"
                  size={17}
                  color={theme.texto}
                />

                <Text
                  weight="SemiBold"
                  style={styles.acaoTexto}
                >
                  Abrir link
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                "Ver detalhes e arquivos do clipping " +
                clipping.id
              }
              onPress={onAbrirDetalhes}
              style={[
                styles.acao,
                {
                  borderColor: theme.backgroundContainer,
                  backgroundColor:
                    theme.backgroundContainer,
                },
              ]}
            >
              <Text
                weight="SemiBold"
                style={[
                  styles.acaoTexto,
                  { color: theme.textoContainer },
                ]}
              >
                Ver detalhes
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color={theme.textoContainer}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 8,
    },

  resumo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },

  topo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

data: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
},

  veiculo: {
    fontSize: 13,
    lineHeight: 18,
  },

  veiculoNaLinha: {
    flex: 1,
    minWidth: 0,
  },

  espaco: {
    flex: 1,
  },

  tier: {
    fontSize: 11,
    lineHeight: 16,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },

  pauta: {
    fontSize: 14,
    lineHeight: 20,
  },

  rodape: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 8,
    rowGap: 4,
  },

  informacoesRodape: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 150,
  minWidth: 120,
},

categorias: {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  flexShrink: 1,
  minWidth: 0,
},

categoriasComPrograma: {
  maxWidth: "52%",
},

separador: {
  fontSize: 12,
  lineHeight: 18,
  flexShrink: 0,
},

programa: {
  flex: 1,
  minWidth: 0,
  fontSize: 12,
  lineHeight: 18,
},

  categoriaTexto: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
    minWidth: 0,
  },

  extra: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 0,
  },

  indicadores: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    maxWidth: "100%",
    marginLeft: "auto",
  },

  duracao: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },

  expansao: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },

  detalhe: {
    fontSize: 13,
    lineHeight: 19,
  },

  acoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },

  acao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
  },

  acaoTexto: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    flexShrink: 1,
  },

  erro: {
    color: "#EF4444",
    fontSize: 12,
    lineHeight: 18,
  },
});