import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { API_URL } from "@/constants/api";
import type { EtapaRelease } from "@/components/releases/ReleaseEtapas";
import type {
  DadosEnvioRelease,
  DadosNovoRelease,
  DestinatarioRelease,
  TemplateRelease,
} from "@/services/api/release";

export interface ReleasePendente {
  dados: DadosNovoRelease & { dados_envio: DadosEnvioRelease };
  etapa: EtapaRelease;
  cliente: { id: number; nome: string } | null;
  template: Omit<TemplateRelease, "blocos"> | null;
  selecionados: DestinatarioRelease[];
  conteudoEditado: boolean;
}

function prefixo(conta: string) {
  return "logos-release-pendente-v1-" + conta + "-";
}

function nomeTentativa(conta: string, chave: string) {
  return prefixo(conta) + chave + ".json";
}

export async function guardarReleasePendente(
  conta: string,
  tentativa: ReleasePendente
) {
  const nome = nomeTentativa(conta, tentativa.dados.chave_rascunho);
  const conteudo = JSON.stringify({ api: API_URL, tentativa });

  if (Platform.OS === "web") {
    await AsyncStorage.setItem(nome, conteudo);
    return;
  }

  const temporario = new File(Paths.document, nome + ".tmp");
  temporario.create({ overwrite: true });
  temporario.write(conteudo);
  await temporario.move(new File(Paths.document, nome));
}

export async function lerReleasePendente(conta: string): Promise<ReleasePendente | null> {
  const web = Platform.OS === "web";
  const nomes = web
    ? await AsyncStorage.getAllKeys()
    : Paths.document.list().filter((item) => item instanceof File).map((item) => item.name);

  for (const nome of nomes.filter(
    (item) => item.startsWith(prefixo(conta)) && item.endsWith(".json")
  ).sort()) {
    const conteudo = web
      ? await AsyncStorage.getItem(nome)
      : await new File(Paths.document, nome).text();

    if (conteudo === null) continue;

    const { api, tentativa } = JSON.parse(conteudo) as {
      api: string;
      tentativa: ReleasePendente;
    };

    if (api !== API_URL) continue;

    if (
      nome !== nomeTentativa(conta, tentativa?.dados?.chave_rascunho) ||
      !Array.isArray(tentativa.selecionados) ||
      !tentativa.dados.dados_envio
    ) {
      throw new Error("O rascunho salvo neste dispositivo está incompleto.");
    }

    return tentativa;
  }

  return null;
}

export async function removerReleasePendente(conta: string, chave: string) {
  const nome = nomeTentativa(conta, chave);

  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(nome);
    return;
  }

  const arquivo = new File(Paths.document, nome);
  if (arquivo.exists) arquivo.delete();
}
