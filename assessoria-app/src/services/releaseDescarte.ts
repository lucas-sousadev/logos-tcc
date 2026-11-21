import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { API_URL } from "@/constants/api";
import { descartarRascunhoRelease } from "@/services/api/release";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const prefixos = new Map<string, Promise<string>>();
const processamentos = new Map<string, Promise<void>>();
const registros = new Map<string, Promise<void>>();

async function prefixo(conta: string) {
  const chave = JSON.stringify([API_URL, conta]);
  let valor = prefixos.get(chave);
  if (!valor) {
    valor = Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, chave)
      .then((hash) => "logos-release-descarte-v1-" + hash + "-");
    prefixos.set(chave, valor);
    void valor.catch(() => prefixos.delete(chave));
  }
  return valor;
}

async function ler(nome: string) {
  if (Platform.OS === "web") return AsyncStorage.getItem(nome);
  const arquivo = new File(Paths.document, nome);
  return arquivo.exists ? arquivo.text() : null;
}

async function gravar(nome: string, texto: string) {
  if (Platform.OS === "web") return AsyncStorage.setItem(nome, texto);
  const temporario = new File(Paths.document, nome + ".tmp-" + Crypto.randomUUID());
  let movido = false;
  try {
    temporario.create();
    temporario.write(texto);
    temporario.move(new File(Paths.document, nome));
    movido = true;
  } finally { if (!movido && temporario.exists) temporario.delete(); }
}

async function remover(nome: string) {
  if (Platform.OS === "web") return AsyncStorage.removeItem(nome);
  const arquivo = new File(Paths.document, nome);
  if (arquivo.exists) arquivo.delete();
}

async function marca(conta: string, chave: string, sufixo: string) {
  if (!UUID.test(chave)) throw new Error("Chave de descarte inválida.");
  const texto = await ler(await prefixo(conta) + chave + sufixo);
  if (texto === null) return null;
  let valor: { api?: string; conta?: string; chave?: string };
  try { valor = JSON.parse(texto); }
  catch { throw new Error("Não foi possível verificar o descarte salvo neste aparelho."); }
  if (valor?.api !== API_URL || valor.conta !== conta || valor.chave !== chave) {
    throw new Error("O descarte salvo neste aparelho está incompleto.");
  }
  return texto;
}

export async function descarteRegistrado(conta: string, chave: string) {
  return (await marca(conta, chave, ".done")) !== null ||
    (await marca(conta, chave, ".json")) !== null;
}

export async function registrarDescarteRelease(conta: string, chave: string) {
  const identificador = JSON.stringify([API_URL, conta, chave]);
  const anterior = registros.get(identificador);
  if (anterior) return anterior;
  const operacao = (async () => {
    if (await descarteRegistrado(conta, chave)) return;
    await gravar(await prefixo(conta) + chave + ".json", JSON.stringify({ api: API_URL, conta, chave }));
  })();
  registros.set(identificador, operacao);
  try { await operacao; }
  finally { if (registros.get(identificador) === operacao) registros.delete(identificador); }
}

export async function processarDescartesRelease(conta: string) {
  const identificador = JSON.stringify([API_URL, conta]);
  const anterior = processamentos.get(identificador);
  if (anterior) return anterior;
  const operacao = (async () => {
    const inicio = await prefixo(conta);
    const nomes = Platform.OS === "web" ? await AsyncStorage.getAllKeys()
      : Paths.document.list().filter((item) => item instanceof File).map((item) => item.name);
    const pendentes = nomes.filter((nome) => nome.startsWith(inicio) && nome.endsWith(".json")).slice(0, 20);
    for (const nome of pendentes) {
      const chave = nome.slice(inicio.length, -5);
      if (!UUID.test(chave)) continue;
      if (await marca(conta, chave, ".done")) { await remover(nome); continue; }
      const texto = await marca(conta, chave, ".json");
      if (texto === null) continue;
      await descartarRascunhoRelease(chave, conta);
      // A confirmação permanece como uma marca pequena, mesmo se uma cópia antiga reaparecer.
      await gravar(inicio + chave + ".done", texto);
      await remover(nome);
    }
  })();
  processamentos.set(identificador, operacao);
  try { await operacao; }
  finally { if (processamentos.get(identificador) === operacao) processamentos.delete(identificador); }
}

export async function aguardarDescartesRelease(conta: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      processarDescartesRelease(conta).catch(() => {}),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, 1000); }),
    ]);
  } finally { clearTimeout(timer); }
}