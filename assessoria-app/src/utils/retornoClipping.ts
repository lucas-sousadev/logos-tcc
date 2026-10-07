export function rotaOrigemClipping(
  tipo?: string,
  id?: string
) {
  const numero = Number(id);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    return null;
  }

  if (tipo === "cliente") {
    return {
      pathname: "/clientes/[id]" as const,
      params: { id: String(numero) },
    };
  }

  if (tipo === "veiculo") {
    return {
      pathname: "/veiculos/[id]" as const,
      params: { id: String(numero) },
    };
  }

  return null;
}