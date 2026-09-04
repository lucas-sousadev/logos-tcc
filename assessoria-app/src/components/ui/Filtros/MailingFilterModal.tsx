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

import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import FiltroStatus from "@/components/ui/Filtros/FiltroStatus";

import {
  listarVeiculos,
  Veiculo,
} from "@/services/api/veiculo";

import { useTheme } from "@/contexts/ThemeContext";

export interface FiltrosMailing {
  estado: string;
  cidade: string;
  cargo: string;
  ativo?: number;
  veiculoId?: number;
  veiculoNome?: string;
}

interface MailingFilterModalProps {
  visible: boolean;
  filtros: FiltrosMailing;
  onClose: () => void;
  onApply: (filtros: FiltrosMailing) => void;
}

export default function MailingFilterModal({
  visible,
  filtros,
  onClose,
  onApply,
}: MailingFilterModalProps) {
  const { theme } = useTheme();

  const [filtrosTemporarios, setFiltrosTemporarios] =
    useState<FiltrosMailing>(filtros);

  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [sugestoes, setSugestoes] = useState<
    Veiculo[]
  >([]);

  const [carregandoVeiculos, setCarregandoVeiculos] =
    useState(false);

  useEffect(() => {
    if (visible) {
      setFiltrosTemporarios(filtros);
      setBuscaVeiculo(
        filtros.veiculoNome ?? ""
      );
      setSugestoes([]);
    }
  }, [visible, filtros]);

  const termoVeiculo = buscaVeiculo.trim();

  useEffect(() => {
    if (
      !visible ||
      termoVeiculo.length < 2 ||
      filtrosTemporarios.veiculoId !== undefined
    ) {
      setSugestoes([]);
      setCarregandoVeiculos(false);
      return;
    }

    let cancelado = false;

    const atraso = setTimeout(async () => {
      try {
        setCarregandoVeiculos(true);

        const resposta = await listarVeiculos({
          busca: termoVeiculo,
          limit: 10,
          ativo: undefined,
        });

        if (!cancelado) {
          setSugestoes(resposta.veiculos);
        }
      } catch {
        if (!cancelado) {
          setSugestoes([]);
        }
      } finally {
        if (!cancelado) {
          setCarregandoVeiculos(false);
        }
      }
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(atraso);
    };
  }, [
    visible,
    termoVeiculo,
    filtrosTemporarios.veiculoId,
  ]);

  function atualizarFiltro(
    campo: keyof FiltrosMailing,
    valor: string | number | undefined
  ) {
    setFiltrosTemporarios((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function atualizarBuscaVeiculo(texto: string) {
    setBuscaVeiculo(texto);

    setFiltrosTemporarios((atual) => ({
      ...atual,
      veiculoId: undefined,
      veiculoNome: undefined,
    }));
  }

  function selecionarVeiculo(veiculo: Veiculo) {
    setFiltrosTemporarios((atual) => ({
      ...atual,
      veiculoId: veiculo.id,
      veiculoNome: veiculo.nome,
    }));

    setBuscaVeiculo(veiculo.nome);
    setSugestoes([]);
  }

  function limparVeiculo() {
    setBuscaVeiculo("");
    setSugestoes([]);

    setFiltrosTemporarios((atual) => ({
      ...atual,
      veiculoId: undefined,
      veiculoNome: undefined,
    }));
  }

  function limparFiltros() {
    setBuscaVeiculo("");
    setSugestoes([]);

    setFiltrosTemporarios({
      estado: "",
      cidade: "",
      cargo: "",
      ativo: 1,
      veiculoId: undefined,
      veiculoNome: undefined,
    });
  }

  const veiculoSelecionado =
    filtrosTemporarios.veiculoId !== undefined;

  return (
    <FiltroModalBase
      visible={visible}
      subtitle="Modifique os contatos exibidos"
      onClose={onClose}
      onClear={limparFiltros}
      onApply={() => onApply(filtrosTemporarios)}
    >
      <FiltroStatus
        ativo={filtrosTemporarios.ativo}
        onChange={(ativo) =>
          atualizarFiltro("ativo", ativo)
        }
        marginBottom={20}
      />

      <View style={styles.fields}>
        <Input
          label="ESTADO"
          value={filtrosTemporarios.estado}
          onChangeText={(texto) =>
            atualizarFiltro("estado", texto)
          }
          placeholder="Ex.: São Paulo"
        />

        <Input
          label="CIDADE"
          value={filtrosTemporarios.cidade}
          onChangeText={(texto) =>
            atualizarFiltro("cidade", texto)
          }
          placeholder="Ex.: Campinas"
        />

        <Input
          label="CARGO"
          value={filtrosTemporarios.cargo}
          onChangeText={(texto) =>
            atualizarFiltro("cargo", texto)
          }
          placeholder="Ex.: Repórter"
        />
      </View>

      <Text
        weight="SemiBold"
        style={styles.sectionTitle}
      >
        VEÍCULO
      </Text>

      <Input
        value={buscaVeiculo}
        onChangeText={atualizarBuscaVeiculo}
        placeholder="Buscar veículo pelo nome"
        autoCapitalize="words"
        containerStyle={styles.vehicleInput}
      />

      {veiculoSelecionado ? (
        <View
          style={[
            styles.selectedVehicle,
            {
              backgroundColor:
                theme.backgroundContainer,
              borderColor: theme.borda,
            },
          ]}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={19}
            color={theme.primaria}
          />

          <Text
            weight="Medium"
            style={[styles.selectedText, { color: theme.textoContainer }]}
          >
            Filtrando por:{" "}
            {filtrosTemporarios.veiculoNome ||
              "veículo selecionado"}
          </Text>

          <TouchableOpacity
            onPress={limparVeiculo}
            activeOpacity={0.8}
            style={styles.clearVehicleButton}
            accessibilityRole="button"
            accessibilityLabel="Remover filtro de veículo"
          >
            <Ionicons
              name="close"
              size={18}
              color={theme.textoContainer}
            />
          </TouchableOpacity>
        </View>
      ) : null}

      {!veiculoSelecionado &&
      termoVeiculo.length > 0 &&
      termoVeiculo.length < 2 ? (
        <Text
          style={[
            styles.helperText,
            { color: theme.textoSub },
          ]}
        >
          Digite pelo menos 2 caracteres.
        </Text>
      ) : null}

      {!veiculoSelecionado &&
      termoVeiculo.length >= 2 ? (
        <View
          style={[
            styles.suggestions,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
            },
          ]}
        >
          {carregandoVeiculos ? (
            <View style={styles.loading}>
              <ActivityIndicator
                size="small"
                color={theme.primaria}
              />

              <Text
                style={[
                  styles.helperText,
                  { color: theme.textoSub },
                ]}
              >
                Buscando veículos...
              </Text>
            </View>
          ) : sugestoes.length === 0 ? (
            <Text
              style={[
                styles.emptySuggestion,
                { color: theme.textoSub },
              ]}
            >
              Nenhum veículo encontrado.
            </Text>
          ) : (
            sugestoes.map((veiculo) => (
              <TouchableOpacity
                key={veiculo.id}
                activeOpacity={0.8}
                onPress={() =>
                  selecionarVeiculo(veiculo)
                }
                style={styles.suggestion}
              >
                <Ionicons
                  name="newspaper-outline"
                  size={19}
                  color={theme.textoTerciaria}
                />

                <View style={styles.suggestionInfo}>
                  <Text
                    weight="SemiBold"
                    style={styles.suggestionName}
                  >
                    {veiculo.nome}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.suggestionMeta,
                      { color: theme.textoSub },
                    ]}
                  >
                    {veiculo.descricao ||
                      "Veículo cadastrado"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}
    </FiltroModalBase>
  );
}

const styles = StyleSheet.create({
  fields: {
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 10,
  },

  vehicleInput: {
    marginBottom: 8,
  },

  selectedVehicle: {
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  selectedText: {
    flex: 1,
    fontSize: 12,
    marginLeft: 8,
  },

  clearVehicleButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  suggestions: {
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
  },

  loading: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  suggestion: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  suggestionInfo: {
    flex: 1,
    marginLeft: 10,
  },

  suggestionName: {
    fontSize: 13,
  },

  suggestionMeta: {
    fontSize: 11,
    marginTop: 2,
  },

  helperText: {
    fontSize: 11,
    marginBottom: 10,
  },

  emptySuggestion: {
    fontSize: 12,
    textAlign: "center",
    padding: 15,
  },
});