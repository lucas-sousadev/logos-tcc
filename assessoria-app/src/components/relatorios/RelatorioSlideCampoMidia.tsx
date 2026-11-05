import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { ArquivoMidiaSlide } from "@/services/api/relatorio";

export type EstadoMidia = "manter" | "remover" | "trocar";

interface Props {
  tipo: "imagem" | "logo";
  estado: EstadoMidia;
  temOriginal: boolean;
  arquivo: ArquivoMidiaSlide | null;
  disabled?: boolean;
  onEscolher: () => void;
  onRemover: () => void;
  onDesfazer: () => void;
  onCapturar?: () => void;
  onAmpliar?: () => void;
  capturaDisponivel?: boolean;
}

export default function RelatorioSlideCampoMidia({
  tipo,
  estado,
  temOriginal,
  arquivo,
  disabled = false,
  onEscolher,
  onRemover,
  onDesfazer,
  onCapturar,
  onAmpliar,
  capturaDisponivel = true,
}: Props) {
  const { theme } = useTheme();
  const imagem = tipo === "imagem";
  const rotulo = imagem ? "Imagem do slide" : "Logo do veículo";
  const novoArquivo = estado === "trocar" ? arquivo : null;
  const definida =
    novoArquivo !== null || (estado === "manter" && temOriginal);

  const nomeAtual = novoArquivo?.nome ?? (
    estado === "remover"
      ? "Remoção pendente"
      : definida
        ? imagem ? "Imagem atual" : "Logo atual"
        : imagem ? "Sem imagem" : "Sem logo"
  );

  const acao = definida ? "Trocar arquivo" : "Escolher arquivo";
  const capturaBloqueada = disabled || !capturaDisponivel;

  return (
    <View style={styles.campo}>
      <View style={styles.rotulo}>
        <Text weight="Medium" style={styles.titulo}>
          {rotulo.toUpperCase()}
        </Text>

        {estado !== "manter" ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={"Desfazer alteração de " + rotulo.toLowerCase()}
            disabled={disabled}
            onPress={onDesfazer}
            style={styles.acao}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={14}
              color={theme.textoTerciaria}
            />
            <Text
              weight="SemiBold"
              style={[styles.legenda, { color: theme.textoTerciaria }]}
            >
              Desfazer
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={[
          styles.cartao,
          {
            borderColor: theme.borda,
            backgroundColor: theme.backgroundSecundario,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={rotulo + ". " + nomeAtual + ". " + acao}
          activeOpacity={0.75}
          disabled={disabled}
          onPress={onEscolher}
          style={styles.seletor}
        >
          <View
            style={[
              styles.miniatura,
              { backgroundColor: theme.primaria + "18" },
            ]}
          >
            {novoArquivo ? (
              <Image
                source={{ uri: novoArquivo.uri }}
                resizeMode={imagem ? "cover" : "contain"}
                style={styles.imagem}
              />
            ) : (
              <Ionicons
                name={imagem ? "image-outline" : "business-outline"}
                size={19}
                color={theme.textoTerciaria}
              />
            )}
          </View>

          <View style={styles.textos}>
            <Text weight="SemiBold" numberOfLines={1} style={styles.nome}>
              {nomeAtual}
            </Text>
            <Text style={[styles.legenda, { color: theme.textoTerciaria }]}>
              {acao}
            </Text>
          </View>

          {!definida ? (
            <Ionicons name="chevron-forward" size={16} color={theme.textoSub} />
          ) : null}
        </TouchableOpacity>

        {definida ? (
            <View
                style={[
                styles.ferramentas,
                {
                    borderLeftColor: theme.borda + "55",
                    backgroundColor: theme.primaria + "0F",
                },
                ]}
            >
                {onAmpliar ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={"Ampliar " + rotulo.toLowerCase()}
                    disabled={disabled}
                    onPress={onAmpliar}
                    style={styles.iconeCartao}
                >
                    <Ionicons
                    name="expand-outline"
                    size={18}
                    color={theme.textoTerciaria}
                    />
                </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={"Remover " + rotulo.toLowerCase()}
                    disabled={disabled}
                    onPress={onRemover}
                    style={styles.iconeCartao}
                >
                <Ionicons name="trash-outline" size={18} color={theme.erro} />
                </TouchableOpacity>
            </View>
            ) : null}
      </View>

      {onCapturar ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: capturaBloqueada }}
          disabled={capturaBloqueada}
          onPress={onCapturar}
          style={[
            styles.acao,
            styles.capturar,
            { opacity: capturaBloqueada ? 0.5 : 1 },
          ]}
        >
          <Ionicons name="link-outline" size={15} color={theme.textoTerciaria} />
          <Text
            weight="SemiBold"
            style={[styles.legenda, { color: theme.textoTerciaria }]}
          >
            Capturar imagem do link
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { 
    gap: 4 
  },
  rotulo: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
    cartao: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
    ferramentas: {
    flexDirection: "row",
    alignSelf: "stretch",
    alignItems: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
    iconeCartao: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { 
    flexShrink: 1,
    fontSize: 14 
    },

  seletor: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  miniatura: {
    width: 34,
    height: 34,
    borderRadius: 7,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  imagem: { 
    width: "100%", 
    height: "100%" 
  },
  textos: { 
    flex: 1, 
    minWidth: 0, 
    gap: 2 
  } ,
  nome: { 
    fontSize: 12 
  },
  legenda: { 
    fontSize: 11 
  },
  remover: {
    width: 44,
    minHeight: 44,
    borderLeftWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  acao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 30,
  },
  capturar: { alignSelf: "flex-start", paddingHorizontal: 2 },
});