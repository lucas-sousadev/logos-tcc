export interface HorarioRelease {
  data: string;
  hora: string;
}

export function horarioInicialRelease(valor?: string | null): HorarioRelease {
  if (valor && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(valor)) {
    return { data: valor.slice(0, 10), hora: valor.slice(11, 16) };
  }
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + 60 * 60 * 1000));
  const valorDe = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    data: `${valorDe("year")}-${valorDe("month")}-${valorDe("day")}`,
    hora: `${valorDe("hour")}:${valorDe("minute")}`,
  };
}

export function formatarAgendamentoRelease(valor: string): string {
  const { data, hora } = horarioInicialRelease(valor);
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)} às ${hora}`;
}
