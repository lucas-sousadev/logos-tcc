import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AtalhosBarra } from "@/constants/modulosNavegacao";

const gravacoes = new Map<string, Promise<void>>();

function chaveConta(conta: string) {
  return "@logos_navegacao_v1:" + conta;
}

export async function lerPreferenciasNavegacao(conta: string) {
  const chave = chaveConta(conta);
  const pendente = gravacoes.get(chave);
  if (pendente) await pendente.catch(() => {});
  const valor = await AsyncStorage.getItem(chave);
  return valor ? JSON.parse(valor) : null;
}

export function salvarPreferenciasNavegacao(
  conta: string,
  atalhos: AtalhosBarra
) {
  const chave = chaveConta(conta);
  const anterior = gravacoes.get(chave) ?? Promise.resolve();
  const valor = JSON.stringify(atalhos);
  const gravacao = anterior
    .catch(() => {})
    .then(() => AsyncStorage.setItem(chave, valor));

  gravacoes.set(chave, gravacao);
  void gravacao
    .finally(() => {
      if (gravacoes.get(chave) === gravacao) gravacoes.delete(chave);
    })
    .catch(() => {});

  return gravacao;
}
