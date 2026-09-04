import { useEffect, useState } from "react";

import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import FiltroStatus from "@/components/ui/Filtros/FiltroStatus";

export interface FiltrosFuncionarios {
  ativo?: number;
}

interface FuncionarioFilterModalProps {
  visible: boolean;
  filtros: FiltrosFuncionarios;
  onClose: () => void;
  onApply: (
    filtros: FiltrosFuncionarios
  ) => void;
}

export default function FuncionarioFilterModal({
  visible,
  filtros,
  onClose,
  onApply,
}: FuncionarioFilterModalProps) {
  const [ativo, setAtivo] = useState<number | undefined>(
    filtros.ativo
  );

  useEffect(() => {
    if (visible) {
      setAtivo(filtros.ativo);
    }
  }, [visible, filtros.ativo]);

  return (
    <FiltroModalBase
      visible={visible}
      subtitle="Refine os funcionários exibidos"
      onClose={onClose}
      onClear={() => setAtivo(undefined)}
      onApply={() => onApply({ ativo })}
    >
      <FiltroStatus
        ativo={ativo}
        onChange={setAtivo}
      />
    </FiltroModalBase>
  );
}