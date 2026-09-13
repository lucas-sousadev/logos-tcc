import {
  useEffect,
  useState,
} from "react";

import Input from "@/components/ui/Input";

import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import FiltroStatus from "@/components/ui/Filtros/FiltroStatus";

export interface FiltrosClientes {
  estado: string;
  cidade: string;
  segmento: string;
  ativo?: number;
}

interface ClienteFilterModalProps {
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
}: ClienteFilterModalProps) {
  const [
    filtrosTemporarios,
    setFiltrosTemporarios,
  ] = useState<FiltrosClientes>(filtros);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = setTimeout(() => {
      setFiltrosTemporarios(filtros);
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
    });
  }

  return (
    <FiltroModalBase
      visible={visible}
      subtitle="Refine os clientes exibidos"
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

      <Input
        label="ESTADO"
        value={filtrosTemporarios.estado}
        onChangeText={(texto) =>
          atualizarFiltro("estado", texto)
        }
        placeholder="Ex.: São Paulo"
        autoCapitalize="words"
        clearable
      />

      <Input
        label="CIDADE"
        value={filtrosTemporarios.cidade}
        onChangeText={(texto) =>
          atualizarFiltro("cidade", texto)
        }
        placeholder="Ex.: Campinas"
        autoCapitalize="words"
        clearable
      />

      <Input
        label="SEGMENTO"
        value={filtrosTemporarios.segmento}
        onChangeText={(texto) =>
          atualizarFiltro("segmento", texto)
        }
        placeholder="Ex.: Tecnologia, Saúde, Varejo"
        autoCapitalize="words"
        clearable
      />
    </FiltroModalBase>
  );
}