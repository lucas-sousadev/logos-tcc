import { useEffect, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

export interface FiltrosRelatorios {
  ano: string;
  inclusao: "todas" | "ativa" | "pausada";
  pendencias: "todas" | "com" | "sem";
  ordem: "recentes" | "antigos" | "mais_materias";
}

export function novosFiltrosRelatorios(): FiltrosRelatorios {
  return {
    ano: "",
    inclusao: "todas",
    pendencias: "todas",
    ordem: "recentes",
  };
}

export function possuiFiltrosRelatorios(
  filtros: FiltrosRelatorios
): boolean {
  return (
    filtros.ano !== "" ||
    filtros.inclusao !== "todas" ||
    filtros.pendencias !== "todas" ||
    filtros.ordem !== "recentes"
  );
}

interface Props {
  visible: boolean;
  filtros: FiltrosRelatorios;
  onClose: () => void;
  onApply: (filtros: FiltrosRelatorios) => void;
}

function Opcao({
  label,
  selecionada,
  onPress,
}: {
  label: string;
  selecionada: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionada }}
      onPress={onPress}
      style={[
        styles.opcao,
        {
          borderColor: theme.borda,
          backgroundColor: selecionada
            ? theme.backgroundContainer
            : theme.background,
        },
      ]}
    >
      <Text
        weight="SemiBold"
        style={{
          color: selecionada
            ? theme.textoContainer
            : theme.texto,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function RelatorioFilterModal({
  visible,
  filtros,
  onClose,
  onApply,
}: Props) {
  const { theme } = useTheme();
  const [atual, setAtual] = useState<FiltrosRelatorios>(filtros);
  const [erroAno, setErroAno] = useState("");

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      setAtual(filtros);
      setErroAno("");
    }, 0);

    return () => clearTimeout(timer);
  }, [visible, filtros]);

  function aplicar() {
    const ano = atual.ano.trim();
    const numero = Number(ano);

    if (
      ano !== "" &&
      (!/^\d{4}$/.test(ano) ||
        numero < 1000 ||
        numero > 9999)
    ) {
      setErroAno("Informe um ano válido com quatro dígitos.");
      return;
    }

    onApply({ ...atual, ano });
  }

  return (
    <FiltroModalBase
      visible={visible}
      subtitle="Refine os relatórios exibidos"
      onClose={onClose}
      onClear={() => {
        setAtual(novosFiltrosRelatorios());
        setErroAno("");
      }}
      onApply={aplicar}
    >
      <Text style={{ color: theme.textoSub, marginBottom: 16 }}>
        A busca da listagem já encontra títulos e clientes.
      </Text>

      <Input
        label="ANO DO PERÍODO"
        value={atual.ano}
        onChangeText={(valor) => {
          setAtual((anterior) => ({
            ...anterior,
            ano: valor.replace(/\D/g, "").slice(0, 4),
          }));
          setErroAno("");
        }}
        placeholder="Todos os anos"
        keyboardType="number-pad"
        maxLength={4}
        error={erroAno}
        clearable
      />

      <Text weight="SemiBold" style={styles.secao}>
        INCLUSÃO AUTOMÁTICA
      </Text>

      <View style={styles.opcoes}>
        <Opcao
          label="TODOS"
          selecionada={atual.inclusao === "todas"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              inclusao: "todas",
            }))
          }
        />
        <Opcao
          label="ATIVA"
          selecionada={atual.inclusao === "ativa"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              inclusao: "ativa",
            }))
          }
        />
        <Opcao
          label="PAUSADA"
          selecionada={atual.inclusao === "pausada"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              inclusao: "pausada",
            }))
          }
        />
      </View>

      <Text weight="SemiBold" style={styles.secao}>
        SLIDES NOVOS
      </Text>

      <View style={styles.opcoes}>
        <Opcao
          label="TODOS"
          selecionada={atual.pendencias === "todas"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              pendencias: "todas",
            }))
          }
        />
        <Opcao
          label="A REVISAR"
          selecionada={atual.pendencias === "com"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              pendencias: "com",
            }))
          }
        />
        <Opcao
          label="SEM NOVOS"
          selecionada={atual.pendencias === "sem"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              pendencias: "sem",
            }))
          }
        />
      </View>

      <Text weight="SemiBold" style={styles.secao}>
        ORDENAÇÃO
      </Text>

      <View style={styles.opcoes}>
        <Opcao
          label="MAIS RECENTES"
          selecionada={atual.ordem === "recentes"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              ordem: "recentes",
            }))
          }
        />
        <Opcao
          label="MAIS ANTIGOS"
          selecionada={atual.ordem === "antigos"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              ordem: "antigos",
            }))
          }
        />
      </View>

      <View style={styles.opcoes}>
        <Opcao
          label="MAIS MATÉRIAS"
          selecionada={atual.ordem === "mais_materias"}
          onPress={() =>
            setAtual((anterior) => ({
              ...anterior,
              ordem: "mais_materias",
            }))
          }
        />
      </View>
    </FiltroModalBase>
  );
}

const styles = StyleSheet.create({
  secao: {
    fontSize: 13,
    marginTop: 20,
    marginBottom: 9,
  },
  opcoes: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  opcao: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1.5,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});