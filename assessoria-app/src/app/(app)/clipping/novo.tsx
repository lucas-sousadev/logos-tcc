import { useLocalSearchParams } from "expo-router";

import FormularioClipping from "@/components/clipping/FormularioClipping";

function primeiroParametro(
  valor: string | string[] | undefined
): string {
  return Array.isArray(valor)
    ? valor[0] ?? ""
    : valor ?? "";
}

export default function NovoClipping() {
  const params = useLocalSearchParams<{
    ano?: string | string[];
    clienteId?: string | string[];
    clienteNome?: string | string[];
  }>();

  const anoParametro = primeiroParametro(params.ano);
  const clienteParametro = primeiroParametro(params.clienteId);
  const nomeParametro = primeiroParametro(params.clienteNome);

  const numeroCliente = Number(clienteParametro);

  const clienteInicial =
    Number.isSafeInteger(numeroCliente) && numeroCliente > 0
      ? numeroCliente
      : null;

  const anoInicial = anoParametro
    ? Number(anoParametro)
    : new Date().getFullYear();

  return (
    <FormularioClipping
      key={JSON.stringify([anoParametro, clienteParametro])}
      anoInicial={anoInicial}
      clienteInicial={clienteInicial}
      nomeClienteInicial={nomeParametro.trim()}
    />
  );
}