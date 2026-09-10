import {
  useEffect,
  useState,
} from "react";

import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";

import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import FiltroStatus from "@/components/ui/Filtros/FiltroStatus";

import { useTheme } from "@/contexts/ThemeContext";

export interface FiltrosVeiculos {
  ativo?: number;
  ordem: "nome" | "vinculos";
  direcao: "ASC" | "DESC";
  minContatos: string;
  maxContatos: string;
}

interface VeiculoFilterModalProps {
  visible: boolean;
  filtros: FiltrosVeiculos;
  onClose: () => void;
  onApply: (filtros: FiltrosVeiculos) => void;
}

export default function VeiculoFilterModal({
  visible,
  filtros,
  onClose,
  onApply,
}: VeiculoFilterModalProps) {
  const { theme } = useTheme();

  const [
    filtrosTemporarios,
    setFiltrosTemporarios,
  ] = useState<FiltrosVeiculos>(filtros);

  const [
    erroMinContatos,
    setErroMinContatos,
  ] = useState("");

  const [
    erroMaxContatos,
    setErroMaxContatos,
  ] = useState("");

  useEffect(() => {
    if (visible) {
      setFiltrosTemporarios(filtros);
      setErroMinContatos("");
      setErroMaxContatos("");
    }
  }, [visible, filtros]);

  function definirOrdenacao(
    ordem: "nome" | "vinculos",
    direcao: "ASC" | "DESC"
  ) {
    setFiltrosTemporarios((atual) => ({
      ...atual,
      ordem,
      direcao,
    }));
  }

  function limparFiltros() {
    setFiltrosTemporarios({
      ativo: undefined,
      ordem: "nome",
      direcao: "ASC",
      minContatos: "",
      maxContatos: "",
    });

    setErroMinContatos("");
    setErroMaxContatos("");
  }

  function aplicarFiltros() {
  const minimo =
    filtrosTemporarios.minContatos.trim();

  const maximo =
    filtrosTemporarios.maxContatos.trim();

  if (minimo !== "" && !/^\d+$/.test(minimo)) {
    setErroMinContatos(
      "Informe uma quantidade inteira igual ou maior que zero."
    );
    return;
  }

  if (maximo !== "" && !/^\d+$/.test(maximo)) {
    setErroMaxContatos(
      "Informe uma quantidade inteira igual ou maior que zero."
    );
    return;
  }

  if (
    minimo !== "" &&
    maximo !== "" &&
    Number(maximo) < Number(minimo)
  ) {
    setErroMaxContatos(
      "A quantidade máxima não pode ser menor que a mínima."
    );
    return;
  }

  onApply({
    ...filtrosTemporarios,
    minContatos: minimo,
    maxContatos: maximo,
  });
}

  return (
    <FiltroModalBase
      visible={visible}
      subtitle="Refine os veículos exibidos"
      onClose={onClose}
      onClear={limparFiltros}
      onApply={aplicarFiltros}
    >
      <FiltroStatus
        ativo={filtrosTemporarios.ativo}
        onChange={(ativo) =>
          setFiltrosTemporarios((atual) => ({
            ...atual,
            ativo,
          }))
        }
        marginBottom={20}
      />

      <Text
        weight="SemiBold"
        style={styles.sectionTitle}
      >
        ORDENAÇÃO
      </Text>

      <View style={styles.options}>
        <OpcaoOrdenacao
          label="ORDEM ALFABÉTICA"
          selecionada={
            filtrosTemporarios.ordem === "nome" &&
            filtrosTemporarios.direcao === "ASC"
          }
          onPress={() =>
            definirOrdenacao("nome", "ASC")
          }
        />

        <OpcaoOrdenacao
          label="MAIS VÍNCULOS"
          selecionada={
            filtrosTemporarios.ordem ===
              "vinculos" &&
            filtrosTemporarios.direcao === "DESC"
          }
          onPress={() =>
            definirOrdenacao("vinculos", "DESC")
          }
        />

        <OpcaoOrdenacao
          label="MENOS VÍNCULOS"
          selecionada={
            filtrosTemporarios.ordem ===
              "vinculos" &&
            filtrosTemporarios.direcao === "ASC"
          }
          onPress={() =>
            definirOrdenacao("vinculos", "ASC")
          }
        />
      </View>

      <Input
        label="MÍNIMO DE CONTATOS VINCULADOS"
        value={filtrosTemporarios.minContatos}
        onChangeText={(texto) => {
          setFiltrosTemporarios((atual) => ({
            ...atual,
            minContatos: texto,
          }));

          if (erroMinContatos) {
            setErroMinContatos("");
          }
        }}
        placeholder="Ex.: 5"
        keyboardType="number-pad"
        clearable
        error={erroMinContatos}
      />

      <Input
        label="MÁXIMO DE CONTATOS VINCULADOS"
        value={filtrosTemporarios.maxContatos}
        onChangeText={(texto) => {
          setFiltrosTemporarios((atual) => ({
            ...atual,
            maxContatos: texto,
          }));

          if (erroMaxContatos) {
            setErroMaxContatos("");
          }
        }}
        placeholder="Ex.: 20"
        keyboardType="number-pad"
        clearable
        error={erroMaxContatos}
      />
      <Text
        style={[
          styles.helper,
          { color: theme.textoSub },
        ]}
      >
        Defina a quantidade mínima e/ou máxima de vínculos.
      </Text>
      
    </FiltroModalBase>
  );
}

function OpcaoOrdenacao({
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
      onPress={onPress}
      style={[
        styles.option,
        {
          borderColor: selecionada
            ? theme.primaria
            : theme.borda,
          backgroundColor: selecionada
            ? theme.backgroundContainer
            : theme.background,
        },
      ]}
    >
      <Text
        weight="Medium"
        style={[
          styles.optionText,
          {
            color: selecionada
              ? theme.textoContainer
              : theme.texto,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    marginBottom: 10,
  },

  options: {
    gap: 8,
    marginBottom: 20,
  },

  option: {
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  optionText: {
    fontSize: 12,
  },

  helper: {
    fontSize: 11,
    marginTop: -12,
  },
});