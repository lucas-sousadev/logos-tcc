import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listarVeiculos,
  Veiculo,
} from "@/services/api/veiculo";

export interface SelecaoVeiculo {
  id: number | null;
  nome: string;
}

interface VeiculoSelectorProps {
  value: SelecaoVeiculo;
  onChange: (selecao: SelecaoVeiculo) => void;
  showChanged?: boolean;
  error?: string;
}

export default function VeiculoSelector({
  value,
  onChange,
  showChanged = false,
  error,
}: VeiculoSelectorProps) {
  const { theme } = useTheme();
  const [sugestoes, setSugestoes] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(false);

  const termo = value.nome.trim();
  const mostrarSugestoes = termo.length >= 2 && value.id === null;
  const existeCorrespondenciaExata = sugestoes.some(
    (veiculo) =>
      veiculo.nome.trim().toLocaleLowerCase() ===
      termo.toLocaleLowerCase()
  );

  useEffect(() => {
    if (!mostrarSugestoes) {
      setSugestoes([]);
      setCarregando(false);
      return;
    }

    let cancelado = false;
    const atraso = setTimeout(async () => {
      try {
        setCarregando(true);
        const resposta = await listarVeiculos({
          busca: termo,
          limit: 8,
        });

        if (!cancelado) {
          setSugestoes(resposta.veiculos);
        }
      } catch {
        if (!cancelado) setSugestoes([]);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(atraso);
    };
  }, [mostrarSugestoes, termo]);

  return (
    <View style={styles.container}>
      <Input
        label="VEÍCULO"
        value={value.nome}
        onChangeText={(nome) => onChange({ id: null, nome })}
        placeholder="Digite o nome do veículo"
        autoCapitalize="words"
        showChanged={showChanged}
        error={error}
      />

      {value.id !== null ? (
        <View
          style={[
            styles.selected,
            {
              borderColor: theme.borda,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={theme.primaria}
          />
          <Text weight="Medium" style={styles.selectedText}>
            Veículo existente selecionado
          </Text>
        </View>
      ) : null}

      {mostrarSugestoes ? (
        <View
          style={[
            styles.suggestions,
            {
              borderColor: theme.borda,
              backgroundColor: theme.background,
            },
          ]}
        >
          {carregando ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={theme.primaria} />
              <Text style={[styles.helperText, { color: theme.textoSub }]}>
                Buscando veículos...
              </Text>
            </View>
          ) : (
            <>
              {sugestoes.map((veiculo) => (
                <TouchableOpacity
                  key={veiculo.id}
                  activeOpacity={0.8}
                  onPress={() =>
                    onChange({ id: veiculo.id, nome: veiculo.nome })
                  }
                  style={styles.suggestion}
                >
                  <Ionicons
                    name="newspaper-outline"
                    size={19}
                    color={theme.primaria}
                  />
                  <View style={styles.suggestionInfo}>
                    <Text weight="SemiBold" style={styles.suggestionName}>
                      {veiculo.nome}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.suggestionMeta, { color: theme.textoSub }]}
                    >
                      {veiculo.alcance || "Veículo cadastrado"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {!existeCorrespondenciaExata ? (
                <View style={styles.createHint}>
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={theme.primaria}
                  />
                  <Text style={[styles.helperText, { color: theme.textoSub }]}>
                    “{termo}” será criado ao salvar o contato.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  selected: {
    minHeight: 42,
    borderWidth: 1.5,
    borderRadius: 12,
    marginTop: -12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedText: { fontSize: 12, marginLeft: 8 },
  suggestions: {
    borderWidth: 1.5,
    borderRadius: 12,
    marginTop: -12,
    overflow: "hidden",
  },
  loading: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  suggestion: {
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionInfo: { flex: 1, marginLeft: 10 },
  suggestionName: { fontSize: 13 },
  suggestionMeta: { fontSize: 11, marginTop: 2 },
  createHint: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D1D5DB",
  },
  helperText: { fontSize: 11, marginLeft: 8, flex: 1 },
});
