export const ALTURA_CAPTURA = 1200;
export const PASSO_CAPTURA = 250;
export const TOTAL_TRECHOS = 200;
export const MAX_TRECHO = TOTAL_TRECHOS - 1;

export function alcanceCaptura(alturaPagina, inicio, altura, trecho) {
  const restante = alturaPagina > inicio + altura + 50;

  return {
    temProxima: restante && trecho < MAX_TRECHO,
    limiteTrechos: restante && trecho >= MAX_TRECHO,
  };
}
