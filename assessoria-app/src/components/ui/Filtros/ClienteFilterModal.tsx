import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import FiltroStatus from "@/components/ui/Filtros/FiltroStatus";

export interface FiltrosClientes {
  minClippings?: string;
  maxClippings?: string;
  ordem?: "nome" | "clippings";
  direcao?: "ASC" | "DESC";
  estado: string;
  cidade: string;
  segmento: string;
  ativo?: number;
}

interface ClienteFilterModalProps {
  filtrarClippings?: boolean;
  visible: boolean;
  filtros: FiltrosClientes;
  onClose: () => void;
  onApply: (filtros: FiltrosClientes) => void;
}

export default function ClienteFilterModal({
  visible,
  filtros,
  onClose,
  onApply,
  filtrarClippings = false,
}: ClienteFilterModalProps) {
  const { theme } = useTheme();
  const [erroMinClippings, setErroMinClippings] = useState("");
  const [erroMaxClippings, setErroMaxClippings] = useState("");
  const [filtrosTemporarios, setFiltrosTemporarios] =
    useState<FiltrosClientes>(filtros);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = setTimeout(() => {
      setFiltrosTemporarios(filtros);
      setErroMinClippings("");
      setErroMaxClippings("");
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [visible, filtros]);

  function atualizarFiltro(
    campo: keyof FiltrosClientes,
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
      segmento: "",
      ativo: undefined,
      ...(filtrarClippings
        ? ({
            minClippings: "",
            maxClippings: "",
            ordem: "nome",
            direcao: "ASC",
          } as const)
        : {}),
    });
    setErroMinClippings("");
    setErroMaxClippings("");
  }

  function aplicarFiltros() {
    if (!filtrarClippings) {
      onApply(filtrosTemporarios);
      return;
    }
    const min = filtrosTemporarios.minClippings?.trim() ?? "";
    const max = filtrosTemporarios.maxClippings?.trim() ?? "";
    const valida = (valor: string) =>
      valor === "" ||
      (/^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)));
    if (!valida(min)) {
      setErroMinClippings(
        "Informe uma quantidade inteira igual ou maior que zero."
      );
      return;
    }
    if (!valida(max)) {
      setErroMaxClippings(
        "Informe uma quantidade inteira igual ou maior que zero."
      );
      return;
    }
    if (min !== "" && max !== "" && Number(max) < Number(min)) {
      setErroMaxClippings(
        "A quantidade máxima não pode ser menor que a mínima."
      );
      return;
    }
    onApply({ ...filtrosTemporarios, minClippings: min, maxClippings: max });
  }

  function definirVinculo(minClippings: string, maxClippings: string) {
    setFiltrosTemporarios((atual) => ({
      ...atual,
      minClippings,
      maxClippings,
    }));
    setErroMinClippings("");
    setErroMaxClippings("");
  }

  return (
    <FiltroModalBase
      visible={visible}
      subtitle="Refine os clientes exibidos"
      onClose={onClose}
      onClear={limparFiltros}
      onApply={aplicarFiltros}
    >
      <FiltroStatus
        ativo={filtrosTemporarios.ativo}
        onChange={(ativo) => atualizarFiltro("ativo", ativo)}
        marginBottom={20}
      />

      {filtrarClippings ? (
        <View style={styles.secao}>
          <Text weight="SemiBold" style={styles.titulo}>
            CLIPPINGS VINCULADOS
          </Text>
          <Text style={[styles.ajuda, { color: theme.textoSub }]}>
            Todos os anos, incluindo clippings arquivados.
          </Text>
          <View style={styles.opcoes}>
            {[
              { titulo: "Todos", min: "", max: "" },
              { titulo: "Com clippings", min: "1", max: "" },
              { titulo: "Sem clippings", min: "", max: "0" },
            ].map((opcao) => (
              <Button
                key={opcao.titulo}
                title={opcao.titulo}
                size="small"
                variant={
                  (filtrosTemporarios.minClippings ?? "") === opcao.min &&
                  (filtrosTemporarios.maxClippings ?? "") === opcao.max
                    ? "primary"
                    : "outline"
                }
                onPress={() => definirVinculo(opcao.min, opcao.max)}
                style={styles.opcao}
              />
            ))}
          </View>
          <Input
            label="MÍNIMO DE CLIPPINGS VINCULADOS"
            value={filtrosTemporarios.minClippings ?? ""}
            onChangeText={(texto) => {
              atualizarFiltro("minClippings", texto);
              setErroMinClippings("");
              setErroMaxClippings("");
            }}
            keyboardType="number-pad"
            placeholder="Ex.: 1"
            clearable
            error={erroMinClippings}
          />
          <Input
            label="MÁXIMO DE CLIPPINGS VINCULADOS"
            value={filtrosTemporarios.maxClippings ?? ""}
            onChangeText={(texto) => {
              atualizarFiltro("maxClippings", texto);
              setErroMaxClippings("");
            }}
            keyboardType="number-pad"
            placeholder="Ex.: 10"
            clearable
            error={erroMaxClippings}
          />
          <Text weight="SemiBold" style={styles.titulo}>
            ORDENAÇÃO
          </Text>
          <View style={styles.opcoes}>
            {[
              { titulo: "Nome A–Z", ordem: "nome", direcao: "ASC" },
              { titulo: "Mais clippings", ordem: "clippings", direcao: "DESC" },
              { titulo: "Menos clippings", ordem: "clippings", direcao: "ASC" },
            ].map((opcao) => (
              <Button
                key={opcao.titulo}
                title={opcao.titulo}
                size="small"
                variant={
                  (filtrosTemporarios.ordem ?? "nome") === opcao.ordem &&
                  (filtrosTemporarios.direcao ?? "ASC") === opcao.direcao
                    ? "primary"
                    : "outline"
                }
                onPress={() =>
                  setFiltrosTemporarios((atual) => ({
                    ...atual,
                    ordem: opcao.ordem as FiltrosClientes["ordem"],
                    direcao: opcao.direcao as FiltrosClientes["direcao"],
                  }))
                }
                style={styles.opcao}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Input
        label="ESTADO"
        value={filtrosTemporarios.estado}
        onChangeText={(texto) => atualizarFiltro("estado", texto)}
        placeholder="Ex.: São Paulo"
        autoCapitalize="words"
        clearable
      />

      <Input
        label="CIDADE"
        value={filtrosTemporarios.cidade}
        onChangeText={(texto) => atualizarFiltro("cidade", texto)}
        placeholder="Ex.: Campinas"
        autoCapitalize="words"
        clearable
      />

      <Input
        label="SEGMENTO"
        value={filtrosTemporarios.segmento}
        onChangeText={(texto) => atualizarFiltro("segmento", texto)}
        placeholder="Ex.: Tecnologia, Saúde, Varejo"
        autoCapitalize="words"
        clearable
      />
    </FiltroModalBase>
  );
}

const styles = StyleSheet.create({
  secao: {
    marginBottom: 20,
  },
  titulo: {
    fontSize: 13,
    marginBottom: 10,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  opcoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  opcao: {
    width: "auto",
    flexGrow: 1,
    flexBasis: 100,
  },
});
