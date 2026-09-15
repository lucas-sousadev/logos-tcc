const MAX_POSICAO_SEGUNDOS = 4294967295;

export function dataBRParaISO(valor: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
    valor.trim()
  );

  if (!partes) return null;

  const [, dia, mes, ano] = partes;

  const d = Number(dia);
  const m = Number(mes);
  const a = Number(ano);

  const data = new Date(Date.UTC(a, m - 1, d));

  if (
    a < 1000 ||
    a > 9999 ||
    data.getUTCFullYear() !== a ||
    data.getUTCMonth() !== m - 1 ||
    data.getUTCDate() !== d
  ) {
    return null;
  }

  return `${ano}-${mes}-${dia}`;
}

export function dataISOParaBR(
  valor: string | null
): string {
  if (!valor) return "";

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    valor.trim()
  );

  if (!partes) return "";

  const [, ano, mes, dia] = partes;
  const brasileira = `${dia}/${mes}/${ano}`;

  return dataBRParaISO(brasileira) ? brasileira : "";
}

export function mascararData(valor: string): string {
  // Também permite colar uma data recebida no formato da API.
  const dataColada = dataISOParaBR(valor);

  if (dataColada) return dataColada;

  const numeros = valor.replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 2) return numeros;

  if (numeros.length <= 4) {
    return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  }

  return (
    `${numeros.slice(0, 2)}/` +
    `${numeros.slice(2, 4)}/` +
    numeros.slice(4)
  );
}

export function tempoParaSegundos(
  valor: string
): number | null {
  const texto = valor.trim();

  // Exemplos: 2:10, 02:10, 65:30 ou 01:05:30.
  if (!/^\d{1,8}:\d{2}(?::\d{2})?$/.test(texto)) {
    return null;
  }

  const partes = texto.split(":").map(Number);
  const segundos = partes[partes.length - 1];

  if (segundos > 59) return null;

  if (partes.length === 3 && partes[1] > 59) {
    return null;
  }

  const total =
    partes.length === 3
      ? partes[0] * 3600 + partes[1] * 60 + segundos
      : partes[0] * 60 + segundos;

  return Number.isSafeInteger(total) &&
    total <= MAX_POSICAO_SEGUNDOS
    ? total
    : null;
}

export function segundosParaTempo(
  valor: number | null
): string {
  if (valor === null) return "";

  const horas = Math.floor(valor / 3600);
  const minutos = Math.floor((valor % 3600) / 60);
  const segundos = valor % 60;

  const minutosSegundos =
    String(minutos).padStart(2, "0") +
    ":" +
    String(segundos).padStart(2, "0");

  return horas > 0
    ? String(horas).padStart(2, "0") + ":" + minutosSegundos
    : minutosSegundos;
}

export function validarTrecho(
  inicioTexto: string,
  fimTexto: string
): {
  inicioSegundos?: string;
  fimSegundos?: string;
} {
  const erros: {
    inicioSegundos?: string;
    fimSegundos?: string;
  } = {};

  const inicio = tempoParaSegundos(inicioTexto);
  const fim = tempoParaSegundos(fimTexto);

  if (inicioTexto.trim() && inicio === null) {
    erros.inicioSegundos =
      "Informe uma posição válida em mm:ss ou hh:mm:ss.";
  }

  if (fimTexto.trim() && fim === null) {
    erros.fimSegundos =
      "Informe uma posição válida em mm:ss ou hh:mm:ss.";
  }

  if (
    inicio !== null &&
    fim !== null &&
    fim <= inicio
  ) {
    erros.fimSegundos =
      "O fim do trecho deve ser maior que o início.";
  }

  return erros;
}