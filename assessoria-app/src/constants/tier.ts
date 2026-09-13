export type Tier = 1 | 2 | 3;

export const DESCRICOES_TIER: Record<Tier, string> = {
  1: "Mais conhecidos",
  2: "Reconhecimento intermediário",
  3: "Menos conhecidos",
};

export function rotuloTier(tier: Tier | null): string {
  return tier == null ? "Tier não definido" : `Tier ${tier}`;
}
