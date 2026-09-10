export const MINIMO_CARACTERES_SENHA = 8;

export function validarSenha(
  senha: string
): string | null {
  if (Array.from(senha).length < MINIMO_CARACTERES_SENHA) {
    return "A senha deve possuir pelo menos 8 caracteres.";
  }

  return null;
}