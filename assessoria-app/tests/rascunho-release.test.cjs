/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");

function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    ...globals,
    module, exports: module.exports,
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error("Dependência inesperada: " + name);
    },
  });
  return module.exports;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const chave = "00000000-0000-4000-8000-000000000001";
function snapshot(titulo = "") {
  return {
    dados: {
      titulo, chave_rascunho: chave, cliente_id: null, jornalistas_ids: [],
      template_id: null, template_codigo: null, template_assinatura: "", blocos: [],
      dados_envio: { assunto: "", primeira_linha: "", nome_remetente: "", responder_para: "" },
    },
    etapa: "DESTINO", cliente: null, template: null, selecionados: [], conteudoEditado: false,
  };
}

function harness(platform = "android") {
  const files = new Map(), calls = [], messages = [];
  let failWrite = false, sequence = 0;
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  function remote(pedido) {
    return {
      id: pedido.id ?? 42, criado_por: 1, criado_por_nome: "Assessor", cliente_nome: null,
      ...clone(pedido.dados), ...clone(pedido.dados.dados_envio),
      chave_rascunho: pedido.chave, status: "RASCUNHO", total_destinatarios: 0, destinatarios: [],
      created_at: "2026-11-20 10:00:00", updated_at: "2026-11-20 10:00:00",
      versao_edicao: (++sequence).toString(16).padStart(64, "0"),
    };
  }
  let respond = async (pedido) => remote(pedido);
  class File {
    constructor(_root, name) { this.name = name; }
    get exists() { return files.has(this.name); }
    async text() { return files.get(this.name); }
    create() { files.set(this.name, ""); }
    write(text) {
      if (typeof failWrite === "function" ? failWrite(this.name, text) : failWrite) throw new Error("Sem espaço");
      files.set(this.name, text);
    }
  }
  const api = {
    ErroApiRelease: ApiError,
    async buscarRelease() { throw new Error("Sem conexão"); },
    async sincronizarRascunhoRelease(pedido) { calls.push(clone(pedido)); return respond(pedido); },
  };
  const core = load("services/rascunhoRelease.ts", {
    "@react-native-async-storage/async-storage": {
      async getItem(key) { return files.get(key) ?? null; },
      async setItem(key, text) {
        if (typeof failWrite === "function" ? failWrite(key, text) : failWrite) throw new Error("Sem espaço");
        files.set(key, text);
      },
    },
    "expo-crypto": {
      CryptoDigestAlgorithm: { SHA256: "sha256" },
      randomUUID: () => crypto.randomUUID(),
      async digestStringAsync(_algorithm, text) { return crypto.createHash("sha256").update(text).digest("hex"); },
    },
    "expo-file-system": { File, Paths: { document: "document" } },
    "react-native": { Platform: { OS: platform } },
    "@/constants/api": { API_URL: "http://test.local" },
    "@/services/api/release": api,
  });
  return {
    ...core, files, calls, messages, ApiError, remote, api,
    respond(fn) { respond = fn; },
    failWrite(value) { failWrite = value; },
    session(value = snapshot(), base = null, conta = "1-1", identidade = "novo") {
      return new core.SessaoRascunhoRelease(conta, identidade, value, base, (...message) => messages.push(message));
    },
  };
}

async function until(condition) {
  for (let i = 0; i < 300 && !condition(); i++) await Promise.resolve();
  assert.ok(condition(), "A operação esperada deve iniciar");
}

for (const platform of ["android", "web"]) {
  test(platform + ": recupera todos os campos e a etapa sem acessar o servidor", async () => {
    const h = harness(platform), s = h.session();
    await s.iniciar();
    const value = snapshot("Matéria");
    value.etapa = "ENVIO";
    value.dados.dados_envio.assunto = "Assunto";
    value.dados.blocos = [{ id: "texto-1", tipo: "texto", texto: "Conteúdo" }];
    await s.registrar(value);
    s.dispose();
    const restored = await h.session().iniciar();
    assert.deepEqual(clone(restored), value);
    assert.equal(h.calls.length, 0);
  });
}

test("falhas sucessivas de gravação preservam a última cópia íntegra", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Preservado"));
  h.failWrite(true);
  for (let i = 0; i < 3; i++) await assert.rejects(s.registrar(snapshot("Novo " + i)));
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Preservado");
  assert.equal(h.calls.length, 0);
});

test("uma cópia interrompida usa o backup; duas inválidas não são sobrescritas", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Primeiro")); await s.registrar(snapshot("Segundo"));
  const newest = [...h.files].sort((a, b) => JSON.parse(b[1]).seq - JSON.parse(a[1]).seq)[0][0];
  h.files.set(newest, "{interrompido");
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Primeiro");
  for (const key of h.files.keys()) h.files.set(key, "{interrompido");
  await assert.rejects(h.lerCopiaRelease("1-1", "novo"), /preservada/);
});

test("pedido sem confirmação é repetido antes de sincronizar a digitação mais recente", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Primeiro")); s.permitida = true;
  h.respond(async () => { throw new Error("Sem conexão"); });
  await assert.rejects(s.sincronizar());
  await s.registrar(snapshot("Mais recente"));
  h.respond(async (p) => h.remote(p)); await s.sincronizar();
  assert.deepEqual(h.calls[1], h.calls[0]);
  assert.equal(h.calls[2].id, 42);
  assert.equal(h.calls[2].dados.titulo, "Mais recente");
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).pedido, null);
});

test("uma resposta antiga não apaga alterações digitadas durante a sincronização", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Em trânsito")); s.permitida = true;
  let respond;
  h.respond((p) => new Promise((resolve) => { respond = () => resolve(h.remote(p)); }));
  const running = s.sincronizar(); await until(() => respond);
  await s.registrar(snapshot("Digitado depois"));
  h.respond(async (p) => h.remote(p)); respond(); await running;
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Digitado depois");
  assert.equal(h.calls[1].dados.titulo, "Digitado depois");
  assert.equal(h.calls[1].id, 42);
});

test("sair e reabrir aguarda a resposta anterior sem sobrescrever a sessão nova", async () => {
  const h = harness(), old = h.session();
  await old.iniciar(); await old.registrar(snapshot("Anterior")); old.permitida = true;
  let respond;
  h.respond((p) => new Promise((resolve) => { respond = () => resolve(h.remote(p)); }));
  const sending = old.sincronizar(); await until(() => respond); old.dispose();
  const next = h.session(); const loading = next.iniciar();
  respond(); await sending; const value = await loading;
  assert.equal(value.dados.titulo, "Anterior");
  await next.registrar(snapshot("Sessão nova"));
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Sessão nova");
  assert.equal(h.calls.length, 1);
});

test("duas telas ativas não escrevem na mesma cópia local", async () => {
  const h = harness(), first = h.session();
  await first.iniciar(); await first.registrar(snapshot("Aberto"));
  await assert.rejects(h.session().iniciar(), /outra tela/);
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Aberto");
});

test("cadastro intocado não cria rascunho; apagar o preenchimento existente é salvo", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); s.permitida = true;
  await s.registrar(snapshot(), false); await s.sincronizar();
  assert.equal(h.files.size, 0); assert.equal(h.calls.length, 0);
  await s.registrar(snapshot("Preenchido")); await s.sincronizar();
  await s.registrar(snapshot(), false); await s.sincronizar();
  assert.equal(h.calls[1].dados.titulo, "");
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "");
});

test("navegar pelas etapas salva a posição local sem criar um release vazio no servidor", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); s.permitida = true;
  await s.registrar({ ...snapshot(), etapa: "TEMPLATE" }); await s.sincronizar();
  assert.equal(h.calls.length, 0);
  s.dispose(); const next = h.session();
  assert.equal((await next.iniciar()).etapa, "TEMPLATE");
  await next.confirmar(snapshot());
  assert.equal(h.calls.length, 1);
});

test("salvar manualmente verifica o servidor mesmo quando o conteúdo já foi sincronizado", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Salvo")); s.permitida = true;
  await s.sincronizar(); await s.confirmar(snapshot("Salvo"));
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].id, 42);
});

test("conflito preserva os campos e interrompe novas tentativas automáticas", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Local")); s.permitida = true;
  h.respond(async () => { throw new h.ApiError("Alterado", 409); });
  await assert.rejects(s.sincronizar());
  await s.registrar(snapshot("Continuo editando"));
  await assert.rejects(s.sincronizar());
  assert.equal(h.calls.length, 1);
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Continuo editando");
});

for (const status of [400, 413, 422]) {
  test("corrigir os campos permite tentar novamente após HTTP " + status, async () => {
    const h = harness(), s = h.session();
    await s.iniciar(); await s.registrar(snapshot("Incompleto")); s.permitida = true;
    h.respond(async () => { throw new h.ApiError("Revise os campos", status); });
    await assert.rejects(s.sincronizar());
    await s.registrar(snapshot("Corrigido")); h.respond(async (p) => h.remote(p)); await s.sincronizar();
    assert.equal(h.calls.length, 2);
    assert.equal((await h.lerCopiaRelease("1-1", "novo")).bloqueio, null);
  });
}

test("uma falha ao finalizar pode ser repetida; um rascunho finalizado não reaparece", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.confirmar(snapshot("Final"));
  h.failWrite(true); await assert.rejects(s.concluir()); h.failWrite(false);
  await s.confirmar(snapshot("Final atualizado")); await s.concluir(); s.dispose();
  const next = h.session(); assert.equal(await next.iniciar(), null);
  await next.registrar(snapshot("Novo"));
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Novo");
});

test("contas e formulários diferentes mantêm cópias independentes", async () => {
  const h = harness(), first = h.session(), second = h.session(snapshot(), null, "1-2");
  await first.iniciar(); await second.iniciar();
  await first.registrar(snapshot("A")); await second.registrar(snapshot("B"));
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "A");
  assert.equal((await h.lerCopiaRelease("1-2", "novo")).valor.dados.titulo, "B");
  assert.equal(await h.lerCopiaRelease("1-1", "editar-42"), null);
});

test("envio ou exclusão confirmados encerram também uma criação cuja primeira resposta foi perdida", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Sem confirmação")); s.permitida = true;
  h.respond(async () => { throw new Error("Resposta perdida"); });
  await assert.rejects(s.sincronizar());
  await h.encerrarCopiaRelease("1-1", "novo", 42, chave);
  s.dispose();
  assert.equal(await h.session().iniciar(), null);
});

test("cópia sincronizada acompanha o servidor; cópia com alterações pendentes mantém sua versão", async () => {
  const h = harness(), first = h.session();
  await first.iniciar(); const base = await first.confirmar(snapshot("Original")); first.dispose();
  const fresh = { ...base, titulo: "Servidor", versao_edicao: "a".repeat(64) };
  const next = h.session(snapshot("Servidor"), fresh); const restored = await next.iniciar();
  assert.equal(restored.dados.titulo, "Servidor");
  await next.registrar(snapshot("Local pendente")); next.dispose();
  const other = h.session(snapshot("Outro servidor"), { ...fresh, titulo: "Outro servidor", versao_edicao: "b".repeat(64) });
  assert.equal((await other.iniciar()).dados.titulo, "Local pendente");
});

test("recarregar a versão do servidor mantém a cópia local até a gravação ter sucesso", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); const base = await s.confirmar(snapshot("Local"));
  const fresh = { ...base, titulo: "Servidor", versao_edicao: "a".repeat(64) };
  h.failWrite(true); await assert.rejects(s.usarServidor(fresh, true)); h.failWrite(false);
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Local");
  const value = await s.usarServidor(fresh, true);
  assert.equal(value.dados.titulo, "Servidor");
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Servidor");
  await assert.rejects(s.usarServidor({ ...fresh, status: "NA_FILA" }, true), /preservada/);
});

function hookHarness(h, initial = {}) {
  const slots = [], effects = [], timers = new Map();
  let cursor = 0, dirty = true, output, pending = [], nextTimer = 0;
  const recovered = [];
  let props = {
    conta: "1-1", identidade: "novo", valor: snapshot(), habilitado: false,
    iniciar: false, temAlteracoes: false,
    onRecuperar(value) { recovered.push(clone(value)); props = { ...props, valor: value }; dirty = true; },
    ...initial,
  };
  const react = {
    useRef(value) { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; },
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof value === "function" ? value() : value;
      return [slots[index], (next) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(slots[index], value)) { slots[index] = value; dirty = true; }
      }];
    },
    useEffect(callback, deps) {
      const index = cursor++, previous = effects[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        pending.push({ index, callback, deps });
      }
    },
  };
  const { useRascunhoRelease: renderHook } = load("hooks/useRascunhoRelease.ts", {
    react,
    "react-native": { AppState: { addEventListener() { return { remove() {} }; } } },
    "expo-router/react-navigation": { useIsFocused: () => true },
    "@/services/rascunhoRelease": h,
    "@/services/api/release": h.api,
  }, {
    AbortController,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    setInterval(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }, clearInterval(id) { timers.delete(id); },
  });
  return {
    recovered, timers,
    get output() { return output; },
    update(patch) { props = { ...props, ...patch }; dirty = true; },
    async flush() {
      for (let iteration = 0; iteration < 40; iteration++) {
        if (dirty) {
          dirty = false; cursor = 0; pending = []; output = renderHook(props);
          if (dirty) continue;
          for (const effect of pending) {
            effects[effect.index]?.cleanup?.();
            effects[effect.index] = { deps: effect.deps, cleanup: effect.callback() };
          }
        }
        await new Promise(setImmediate);
        if (!dirty) return output;
      }
      throw new Error("O hook não deve entrar em um ciclo de renderização.");
    },
    dispose() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

test("o hook aguarda a recuperação anterior antes de salvar e mantém a sessão ao pausar", async () => {
  const h = harness(), hook = hookHarness(h);
  await hook.flush(); assert.equal(hook.output.pronto, false); assert.equal(hook.timers.size, 0);
  hook.update({ iniciar: true, habilitado: true }); await hook.flush();
  assert.equal(hook.output.pronto, true); assert.equal(h.files.size, 0);
  hook.update({ valor: snapshot("Preenchido"), temAlteracoes: true }); await hook.flush();
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Preenchido");
  hook.update({ iniciar: false, habilitado: false }); await hook.flush();
  assert.equal(hook.output.pronto, true);
  assert.equal((await hook.output.confirmar()).id, 42);
  hook.dispose();
});

test("o hook restaura a cópia uma vez e não reaplica campos antigos ao digitar", async () => {
  const h = harness(), first = h.session();
  await first.iniciar(); await first.registrar(snapshot("Recuperado")); first.dispose();
  const hook = hookHarness(h, { iniciar: true, habilitado: true, temAlteracoes: true });
  await hook.flush(); assert.equal(hook.recovered.length, 1);
  hook.update({ valor: snapshot("Digitado agora") }); await hook.flush();
  assert.equal(hook.recovered.length, 1);
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Digitado agora");
  hook.dispose();
});

test("404 ao carregar a versão salva oferece recuperação e conserva os campos locais", async () => {
  const h = harness(), first = h.session();
  await first.iniciar(); await first.confirmar(snapshot("Conteúdo local")); first.dispose();
  h.api.buscarRelease = async () => { throw new h.ApiError("Release não encontrado nesta assessoria.", 404); };
  const hook = hookHarness(h, { iniciar: true, habilitado: false }); await hook.flush();
  assert.equal(await hook.output.recarregarDoServidor(), false); await hook.flush();
  assert.equal(hook.output.remotoAusente, true);
  assert.equal(hook.output.conflito, false);
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Conteúdo local");
  await hook.output.recuperarComoNovo(); await hook.flush();
  const copy = await h.lerCopiaRelease("1-1", "novo");
  assert.equal(copy.valor.dados.titulo, "Conteúdo local");
  assert.notEqual(copy.valor.dados.chave_rascunho, chave);
  assert.equal(copy.remoto, null);
  assert.equal(hook.output.remotoAusente, false);
  await hook.output.confirmar();
  assert.equal(h.calls.at(-1).id, null);
  assert.equal(h.calls.at(-1).chave, copy.valor.dados.chave_rascunho);
  hook.dispose();
});

test("falhas de permissão ou conexão ao recarregar não autorizam recriar o release", async () => {
  const h = harness(), first = h.session();
  await first.iniciar(); await first.confirmar(snapshot("Preservado")); first.dispose();
  const hook = hookHarness(h, { iniciar: true, habilitado: false }); await hook.flush();
  for (const status of [403, 500]) {
    h.api.buscarRelease = async () => { throw new h.ApiError("Falha", status); };
    await assert.rejects(hook.output.recarregarDoServidor()); await hook.flush();
    assert.equal(hook.output.remotoAusente, false);
    await assert.rejects(hook.output.recuperarComoNovo());
    assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.chave_rascunho, chave);
  }
  hook.dispose();
});

test("recuperar uma edição mantém blocos e etapa e abre uma nova criação local", async () => {
  const h = harness();
  const value = snapshot("Recuperado"); value.etapa = "CONTEUDO";
  value.dados.blocos = [{ id: "texto", tipo: "texto", texto: "Não perder" }];
  value.dados.template_codigo = "modelo-removido";
  const base = h.remote({ id: 42, chave, dados: value.dados });
  const s = h.session(value, base, "1-1", "editar-42");
  await s.iniciar(); await s.registrar(value); await s.marcarRemotoAusente();
  const restored = await s.recuperarComoNovo();
  assert.equal(restored.etapa, "CONTEUDO");
  assert.deepEqual(clone(restored.dados.blocos), value.dados.blocos);
  assert.equal(restored.dados.template_codigo, null);
  assert.equal((await h.lerCopiaRelease("1-1", "editar-42")).encerrado, true);
  const next = h.session(); const loaded = await next.iniciar();
  assert.equal(loaded.dados.titulo, "Recuperado");
  assert.equal(loaded.dados.chave_rascunho, restored.dados.chave_rascunho);
  assert.equal(h.calls.length, 0);
  next.dispose(); s.dispose();
});

test("recuperar uma edição não substitui outro cadastro em andamento", async () => {
  const h = harness(), other = h.session();
  await other.iniciar(); await other.registrar(snapshot("Outro cadastro")); other.dispose();
  const value = snapshot("Minha cópia"), base = h.remote({ id: 42, chave, dados: value.dados });
  const s = h.session(value, base, "1-1", "editar-42");
  await s.iniciar(); await s.registrar(value); await s.marcarRemotoAusente();
  await assert.rejects(s.recuperarComoNovo(), /outro rascunho/);
  assert.equal((await h.lerCopiaRelease("1-1", "novo")).valor.dados.titulo, "Outro cadastro");
  assert.equal((await h.lerCopiaRelease("1-1", "editar-42")).valor.dados.titulo, "Minha cópia");
  s.dispose();
});

test("repetir uma recuperação interrompida reutiliza a cópia que já foi gravada", async () => {
  const h = harness(), value = snapshot("Minha cópia");
  const base = h.remote({ id: 42, chave, dados: value.dados });
  const s = h.session(value, base, "1-1", "editar-42");
  await s.iniciar(); await s.registrar(value); await s.marcarRemotoAusente();
  h.failWrite((_name, text) => JSON.parse(text).encerrado);
  await assert.rejects(s.recuperarComoNovo());
  const created = await h.lerCopiaRelease("1-1", "novo");
  h.failWrite(false); const restored = await s.recuperarComoNovo();
  assert.equal(restored.dados.chave_rascunho, created.valor.dados.chave_rascunho);
  assert.equal((await h.lerCopiaRelease("1-1", "editar-42")).encerrado, true);
  s.dispose();
});

test("falha ao gravar a recuperação conserva o rascunho original", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.confirmar(snapshot("Original")); await s.marcarRemotoAusente();
  h.failWrite(true); await assert.rejects(s.recuperarComoNovo()); h.failWrite(false);
  const copy = await h.lerCopiaRelease("1-1", "novo");
  assert.equal(copy.valor.dados.titulo, "Original");
  assert.equal(copy.valor.dados.chave_rascunho, chave);
  assert.equal(copy.remoto.id, 42);
  s.dispose();
});

test("404 de vínculo em um cadastro novo permite corrigir os dados sem perder a cópia", async () => {
  const h = harness(), s = h.session();
  await s.iniciar(); await s.registrar(snapshot("Revisar vínculo")); s.permitida = true;
  h.respond(async () => { throw new h.ApiError("Cliente não encontrado", 404); });
  await assert.rejects(s.sincronizar());
  assert.equal(s.remotoAusente, false);
  await s.registrar(snapshot("Vínculo corrigido")); h.respond(async (p) => h.remote(p));
  await s.sincronizar();
  assert.equal(h.calls.at(-1).dados.titulo, "Vínculo corrigido");
  s.dispose();
});
