// src/components/ui/FilterModal.tsx

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

import { useTheme } from "@/contexts/ThemeContext";

export interface FiltrosMailing {
  estado: string;
  cidade: string;
  cargo: string;
  veiculoId?: number;
  ativo?: number;
}

interface Veiculo {
  id: number;
  nome: string;
}

interface FilterModalProps {
  visible: boolean;
  filtros: FiltrosMailing;
  veiculos?: Veiculo[];
  onClose: () => void;
  onApply: (filtros: FiltrosMailing) => void;
}

export default function FilterModal({
  visible,
  filtros,
  veiculos = [],
  onClose,
  onApply,
}: FilterModalProps) {
  const { theme } = useTheme();

  const [filtrosTemporarios, setFiltrosTemporarios] =
    useState<FiltrosMailing>(filtros);

  useEffect(() => {
    if (visible) {
      setFiltrosTemporarios(filtros);
    }
  }, [visible, filtros]);

  function atualizarFiltro(
    campo: keyof FiltrosMailing,
    valor: string | number | undefined
  ) {
    setFiltrosTemporarios((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function limparFiltros() {
    setFiltrosTemporarios({
      estado: "",
      cidade: "",
      cargo: "",
      ativo: 1,
    });
  }

  function aplicarFiltros() {
    onApply(filtrosTemporarios);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text
                weight="Bold"
                style={styles.title}
              >
                FILTROS
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  {
                    color: theme.textoSub,
                  },
                ]}
              >
                Refine os jornalistas exibidos
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor:
                    theme.backgroundContainer,
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name="close"
                size={22}
                color={theme.textoContainer}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              styles.content
            }
          >
            <Text
              weight="SemiBold"
              style={styles.sectionTitle}
            >
              STATUS
            </Text>

            <View style={styles.optionsRow}>
              <TouchableOpacity
                onPress={() =>
                  atualizarFiltro("ativo", 1)
                }
                style={[
                  styles.option,
                  {
                    borderColor:
                      filtrosTemporarios.ativo === 1
                        ? theme.primaria
                        : theme.borda,
                    backgroundColor:
                      filtrosTemporarios.ativo === 1
                        ? theme.backgroundContainer
                        : theme.background,
                  },
                ]}
              >
                <Text
                  weight="Medium"
                  style={{
                    color:
                      filtrosTemporarios.ativo === 1
                        ? theme.textoContainer
                        : theme.texto,
                  }}
                >
                  Ativos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  atualizarFiltro("ativo", 0)
                }
                style={[
                  styles.option,
                  {
                    borderColor:
                      filtrosTemporarios.ativo === 0
                        ? theme.primaria
                        : theme.borda,
                    backgroundColor:
                      filtrosTemporarios.ativo === 0
                        ? theme.backgroundContainer
                        : theme.background,
                  },
                ]}
              >
                <Text
                  weight="Medium"
                  style={{
                    color:
                      filtrosTemporarios.ativo === 0
                        ? theme.textoContainer
                        : theme.texto,
                  }}
                >
                  Inativos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  atualizarFiltro(
                    "ativo",
                    undefined
                  )
                }
                style={[
                  styles.option,
                  {
                    borderColor:
                      filtrosTemporarios.ativo ===
                      undefined
                        ? theme.primaria
                        : theme.borda,
                    backgroundColor:
                      filtrosTemporarios.ativo ===
                      undefined
                        ? theme.backgroundContainer
                        : theme.background,
                  },
                ]}
              >
                <Text
                  weight="Medium"
                  style={{
                    color:
                      filtrosTemporarios.ativo ===
                      undefined
                        ? theme.textoContainer
                        : theme.texto,
                  }}
                >
                  Todos
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fields}>
              <Input
                label="ESTADO"
                value={filtrosTemporarios.estado}
                onChangeText={(texto) =>
                  atualizarFiltro(
                    "estado",
                    texto
                  )
                }
                placeholder="Ex.: São Paulo"
              />

              <Input
                label="CIDADE"
                value={filtrosTemporarios.cidade}
                onChangeText={(texto) =>
                  atualizarFiltro(
                    "cidade",
                    texto
                  )
                }
                placeholder="Ex.: Campinas"
              />

              <Input
                label="CARGO"
                value={filtrosTemporarios.cargo}
                onChangeText={(texto) =>
                  atualizarFiltro(
                    "cargo",
                    texto
                  )
                }
                placeholder="Ex.: Repórter"
              />
            </View>

            {veiculos.length > 0 && (
              <>
                <Text
                  weight="SemiBold"
                  style={styles.sectionTitle}
                >
                  VEÍCULO
                </Text>

                <View style={styles.vehicleList}>
                  <TouchableOpacity
                    onPress={() =>
                      atualizarFiltro(
                        "veiculoId",
                        undefined
                      )
                    }
                    style={[
                      styles.vehicleOption,
                      {
                        borderColor:
                          filtrosTemporarios.veiculoId ===
                          undefined
                            ? theme.primaria
                            : theme.borda,
                        backgroundColor:
                          filtrosTemporarios.veiculoId ===
                          undefined
                            ? theme.backgroundContainer
                            : theme.background,
                      },
                    ]}
                  >
                    <Text
                      weight="Medium"
                      style={{
                        color:
                          filtrosTemporarios.veiculoId ===
                          undefined
                            ? theme.textoContainer
                            : theme.texto,
                      }}
                    >
                      Todos os veículos
                    </Text>
                  </TouchableOpacity>

                  {veiculos.map((veiculo) => {
                    const selecionado =
                      filtrosTemporarios.veiculoId ===
                      veiculo.id;

                    return (
                      <TouchableOpacity
                        key={veiculo.id}
                        onPress={() =>
                          atualizarFiltro(
                            "veiculoId",
                            veiculo.id
                          )
                        }
                        style={[
                          styles.vehicleOption,
                          {
                            borderColor:
                              selecionado
                                ? theme.primaria
                                : theme.borda,
                            backgroundColor:
                              selecionado
                                ? theme.backgroundContainer
                                : theme.background,
                          },
                        ]}
                      >
                        <Text
                          weight="Medium"
                          style={{
                            color: selecionado
                              ? theme.textoContainer
                              : theme.texto,
                          }}
                        >
                          {veiculo.nome}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                borderTopColor: theme.borda,
              },
            ]}
          >
            <Button
              title="LIMPAR"
              variant="outline"
              onPress={limparFiltros}
              style={styles.footerButton}
            />

            <Button
              title="APLICAR"
              onPress={aplicarFiltros}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  container: {
    maxHeight: "90%",
    borderTopWidth: 1.5,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },

  title: {
    fontSize: 18,
  },

  subtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 10,
  },

  optionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },

  option: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  fields: {
    gap: 0,
  },

  vehicleList: {
    gap: 8,
    marginBottom: 10,
  },

  vehicleOption: {
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: 11,
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
  },

  footerButton: {
    flex: 1,
  },
});