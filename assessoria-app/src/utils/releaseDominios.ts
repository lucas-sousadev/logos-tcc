const SUGESTOES: Record<string, string> = {
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
};

export function avisoDominiosRelease(
  emails: Iterable<string | null | undefined>
): string {
  const avisos: string[] = [];

  const unicos = new Set(
    Array.from(
      emails,
      (valor) => (valor ?? "").trim().toLowerCase()
    )
  );

  for (const email of unicos) {
    const separador = email.lastIndexOf("@");
    if (separador < 1) continue;

    const dominio = email.slice(separador + 1);
    const sugestao = SUGESTOES[dominio];

    if (sugestao) {
      avisos.push(
        email +
          " → " +
          email.slice(0, separador + 1) +
          sugestao
      );
    }
  }

  if (!avisos.length) return "";

  return (
    "Confira possíveis erros de digitação:\n" +
    avisos.slice(0, 3).join("\n") +
    (avisos.length > 3
      ? "\nE mais " + (avisos.length - 3) + " endereço(s)."
      : "") +
    "\nOs endereços serão usados como estão; a sugestão não faz uma correção automática."
  );
}