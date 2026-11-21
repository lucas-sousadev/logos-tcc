import type {
  BlocoTemplateRelease,
  DadosEnvioRelease,
} from "@/services/api/release";

interface DadosValidacaoEnvio {
  titulo: string;
  templateDefinido: boolean;
  dadosEnvio: DadosEnvioRelease;
  blocos: readonly BlocoTemplateRelease[];
  destinatarios: readonly {
    email?: string | null;
    elegivel?: boolean;
    status?: string;
  }[];
}

function emailValido(valor: string): boolean {
  return (
    valor.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
  );
}

function linkValido(valor: string): boolean {
  try {
    const url = new URL(valor);

    return (
      valor === valor.trim() &&
      ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function pendenciasEnvioRelease(
  dados: DadosValidacaoEnvio
): string[] {
  const pendencias: string[] = [];

  const {
    titulo,
    dadosEnvio,
    blocos,
    destinatarios,
  } = dados;

  if (!titulo.trim()) {
    pendencias.push("Preencha o título interno.");
  } else if ([...titulo.trim()].length > 150) {
    pendencias.push(
      "Reduza o título interno para até 150 caracteres."
    );
  }

  if (!dadosEnvio.assunto.trim()) {
    pendencias.push("Preencha o assunto do e-mail.");
  }

  if (!dados.templateDefinido) {
    pendencias.push("Selecione um template.");
  }

  const temConteudo = blocos.some((bloco) =>
    ["imagem", "botao", "arquivo"].includes(bloco.tipo)
      ? Boolean(bloco.url?.trim())
      : !["divisor", "espacamento"].includes(bloco.tipo) &&
        Boolean(bloco.texto?.trim())
  );

  if (!temConteudo) {
    pendencias.push("Adicione conteúdo ao release.");
  }

  if (blocos.length > 100) {
    pendencias.push("Use no máximo 100 blocos.");
  }

  for (const [indice, bloco] of blocos.entries()) {
    if (bloco.url && !linkValido(bloco.url)) {
      pendencias.push(
        `Corrija o link do bloco ${indice + 1}.`
      );
    }
  }

  if (!destinatarios.length) {
    pendencias.push(
      "Selecione pelo menos um destinatário."
    );
  }

  const destinatarioInvalido = destinatarios.some(
    (destinatario) =>
      !emailValido((destinatario.email ?? "").trim()) ||
      destinatario.elegivel === false ||
      (
        destinatario.status !== undefined &&
        destinatario.status !== "PENDENTE"
      )
  );

  if (destinatarioInvalido) {
    pendencias.push(
      "Revise os destinatários com e-mail inválido ou indisponíveis."
    );
  }

  const campos = [
    [dadosEnvio.assunto, 255, "assunto"],
    [dadosEnvio.primeira_linha, 150, "primeira linha"],
    [dadosEnvio.nome_remetente, 100, "nome do remetente"],
    [dadosEnvio.responder_para, 254, "Responder para"],
  ] as const;

  for (const [valor, limite, rotulo] of campos) {
    if (
      [...valor.trim()].length > limite ||
      /[\u0000-\u001f\u007f]/.test(valor.trim())
    ) {
      pendencias.push(
        `Revise o campo ${rotulo}: até ${limite} caracteres, em uma única linha.`
      );
    }
  }

  if (
    dadosEnvio.responder_para.trim() &&
    !emailValido(dadosEnvio.responder_para.trim())
  ) {
    pendencias.push(
      "Informe um e-mail válido em Responder para."
    );
  }

  return pendencias;
}