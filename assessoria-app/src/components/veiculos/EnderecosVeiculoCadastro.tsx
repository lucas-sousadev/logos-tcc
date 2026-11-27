import EnderecosVeiculoRascunho from "@/components/veiculos/EnderecosVeiculoRascunho";

import type { NovoEnderecoVeiculo } from "@/services/api/veiculo";

interface Props {
  value: NovoEnderecoVeiculo[];
  onChange: (enderecos: NovoEnderecoVeiculo[]) => void;
  disabled?: boolean;
}

export function prepararEnderecosCadastro(
  linhas: NovoEnderecoVeiculo[]
): NovoEnderecoVeiculo[] {
  const resultado: NovoEnderecoVeiculo[] = [];

  for (const linha of linhas) {
    const host = linha.host.trim();
    const caminho = linha.caminho_prefixo.trim();

    if (!host && (caminho || linha.incluir_subdominios)) {
      throw new Error("Informe o domínio do endereço preenchido.");
    }

    if (!host && linha.id !== undefined) {
      throw new Error(
        "Informe o domínio ou use REMOVER para excluir o endereço."
      );
    }
    if (!host) {
      continue;
    }

    resultado.push({
      ...(linha.id !== undefined ? { id: linha.id } : {}),
      host,
      caminho_prefixo: caminho,
      incluir_subdominios: linha.incluir_subdominios,
    });
  }

  if (resultado.length > 20) {
    throw new Error("Cadastre no máximo 20 endereços.");
  }

  return resultado;
}

export default function EnderecosVeiculoCadastro({
  value,
  onChange,
  disabled = false,
}: Props) {
  return (
    <EnderecosVeiculoRascunho
      value={value}
      onChange={onChange}
      disabled={disabled}
      abrirPrimeiro
    />
  );
}
