/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const internal = path.join(root, "node_modules/expo-router/build/react-navigation");
const { TabRouter } = require(path.join(internal, "routers/TabRouter.js"));
const { StackRouter } = require(path.join(internal, "routers/StackRouter.js"));
const CommonActions = require(path.join(internal, "routers/CommonActions.js"));
const { shouldPreventRemove } = require(path.join(internal, "core/useOnPreventRemove.js"));

function load(file, mocks) {
  const source = fs.readFileSync(path.join(root, "src", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error(`Dependência inesperada: ${name}`);
    },
  });
  return module.exports;
}

const policy = load("utils/navegacaoModulos.ts", {
  "expo-router/react-navigation": { CommonActions },
});
const options = {
  routeNames: Array.from(policy.MODULOS_APP), routeParamList: {}, routeGetIdList: {},
};
const tabs = TabRouter({ backBehavior: "initialRoute", initialRouteName: "index" });
const initial = () => tabs.getInitialState(options);
const focused = (state) => state.routes[state.index];
const enter = (state, ...args) => tabs.getStateForAction(
  state, CommonActions.reset(policy.criarEntradaModulo(state, ...args)), options
);

test("trocar de módulo não registra as abas visitadas no voltar", () => {
  let state = initial();
  for (const module of ["mailing", "releases", "mais", "clipping"]) state = enter(state, module);
  assert.equal(focused(state).name, "clipping");
  assert.deepEqual(Array.from(state.history, (item) => state.routes.find((r) => r.key === item.key).name), ["index", "clipping"]);
  assert.equal(focused(tabs.getStateForAction(state, { type: "GO_BACK" }, options)).name, "index");
});

test("sair de Novo contato encerra o cadastro e a barra reabre a listagem", () => {
  let state = enter(initial(), "mailing", "inicio", "novo");
  const oldKey = focused(state).key;
  state = enter(state, "releases");
  const mailing = state.routes.find((r) => r.name === "mailing");
  assert.notEqual(mailing.key, oldKey);
  assert.equal(mailing.state.routes.length, 1);
  assert.equal(mailing.state.routes[0].name, "index");
  state = enter(state, "mailing");
  assert.equal(focused(state).state.routes[0].name, "index");
  const stack = StackRouter({}).getRehydratedState(focused(state).state, {
    routeNames: ["index", "novo", "[id]/index"], routeParamList: {}, routeGetIdList: {},
  });
  assert.equal(stack.routes[stack.index].name, "index");
});

test("tocar na aba atual também encerra o detalhe ou formulário", () => {
  let state = enter(initial(), "releases", "inicio", "novo", { editar: "7" });
  state = enter(state, "releases");
  assert.equal(focused(state).state.routes[0].name, "index");
  assert.equal(focused(state).state.routes[0].params.editar, undefined);
});

test("entrada pelo Mais registra somente a origem explícita", () => {
  const state = enter(initial(), "clientes", "mais");
  assert.equal(focused(state).state.routes[0].params.origemModulo, "mais");
  assert.equal(focused(tabs.getStateForAction(state, { type: "GO_BACK" }, options)).name, "mais");
  const key = state.routes.find((r) => r.name === "funcionarios").key;
  const next = enter(state, "mailing");
  assert.equal(next.routes.find((r) => r.name === "funcionarios").key, key);
});

test("voltar de Veículos para Clipping não cria um retorno circular entre abas", () => {
  let state = enter(initial(), "clipping", "inicio", "[id]/index", { id: "4" });
  state = tabs.getStateForAction(state, { type: "NAVIGATE", payload: { name: "veiculos" } }, options);
  state = tabs.getStateForAction(state, { type: "NAVIGATE", payload: { name: "clipping" } }, options);
  assert.equal(focused(tabs.getStateForAction(state, { type: "GO_BACK" }, options)).name, "index");
  state = enter(state, "veiculos");
  assert.equal(focused(state).state.routes[0].name, "index");
});

test("beforeRemove dos formulários filhos pode impedir a troca de módulo", () => {
  const state = enter(initial(), "releases", "inicio", "novo");
  const route = focused(state);
  const next = policy.criarEntradaModulo(state, "clipping");
  let requested = 0;
  const childEmitter = { emit(event) { requested++; return { ...event, defaultPrevented: true }; } };
  const emitter = { emit(event) { return { ...event, defaultPrevented: false }; } };
  const listeners = {
    [route.key]: (action) => shouldPreventRemove(childEmitter, {}, [{ key: "rascunho", name: "novo" }], [], action),
  };
  assert.equal(shouldPreventRemove(emitter, listeners, state.routes, next.routes, CommonActions.reset(next)), true);
  assert.equal(requested, 1);
  assert.equal(focused(state).name, "releases");
});

function navigationHarness(pathname, params = {}, index = 0) {
  const actions = [], replacements = [], backs = [];
  const parent = { getState: initial, getParent: () => undefined, dispatch: (a) => actions.push(a) };
  const nav = {
    isFocused: () => true,
    getState: () => ({ type: "stack", index, routes: [{ name: "index" }, { name: "novo" }] }),
    getParent: () => parent, dispatch: (a) => actions.push(a), goBack: () => backs.push(true),
  };
  const hooks = load("hooks/useNavegacaoModulos.ts", {
    react: { useCallback: (fn) => fn },
    "expo-router": {
      useNavigation: () => nav, useRouter: () => ({ replace: (to) => replacements.push(to) }),
      usePathname: () => pathname, useLocalSearchParams: () => params,
    },
    "@/utils/navegacaoModulos": policy,
  });
  return { hooks, nav, actions, replacements, backs };
}

test("o voltar da listagem aberta pelo Mais retorna ao Mais", () => {
  const h = navigationHarness("/clientes", { origemModulo: "mais" });
  h.hooks.useRetornoSeguro()();
  assert.equal(focused(h.actions[0].payload).name, "mais");
  assert.equal(h.backs.length, 0);
});

test("detalhes usam a pilha local e acesso direto tem destino seguro", () => {
  let h = navigationHarness("/clientes/7", {}, 1);
  h.hooks.useRetornoSeguro("/clientes")();
  assert.equal(h.backs.length, 1);
  assert.equal(h.actions.length, 0);
  h = navigationHarness("/clientes/7");
  h.hooks.useRetornoSeguro("/clientes")();
  assert.deepEqual(h.replacements, ["/clientes"]);
});

test("atalhos diretos voltam ao Início e telas sem foco não redirecionam", () => {
  const h = navigationHarness("/mailing/novo", { origemNavegacao: "inicio" }, 1);
  h.hooks.useRetornoSeguro("/mailing")();
  assert.equal(focused(h.actions[0].payload).name, "index");
  h.nav.isFocused = () => false;
  h.hooks.useRetornoSeguro("/mailing")();
  assert.equal(h.actions.length, 1);
});

test("atalho de entidade cria uma entrada nova com ID e origem corretos", () => {
  const h = navigationHarness("/");
  h.hooks.useAbrirTelaInicial()({ pathname: "/relatorios/[id]", params: { id: "8" } });
  const route = focused(h.actions[0].payload).state.routes[0];
  assert.equal(route.name, "[id]/index");
  assert.equal(route.params.id, "8");
  assert.equal(route.params.origemNavegacao, "inicio");
});

function exitHarness() {
  const cells = [], actions = [];
  let cursor = 0, effects = [], focused = true, guard;
  const react = {
    useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; },
    useState(value) {
      const i = cursor++; cells[i] ??= { value };
      return [cells[i].value, (next) => { cells[i].value = typeof next === "function" ? next(cells[i].value) : next; }];
    },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i];
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) effects.push(fn);
      cells[i] = { deps };
    },
  };
  const { useSaidaFormulario: runHook } = load("hooks/useSaidaFormulario.ts", {
    react,
    "expo-router": { useNavigation: () => ({ dispatch: (a) => actions.push(a) }), useIsFocused: () => focused },
    "expo-router/react-navigation": { usePreventRemove: (block, callback) => { guard = { block, callback }; } },
  });
  return {
    actions,
    focus(value) { focused = value; },
    blocked() { return guard.block; },
    leave(action) { if (guard.block) guard.callback({ data: { action } }); },
    render(dirty, busy) {
      cursor = 0; effects = [];
      const result = runHook(dirty, busy);
      effects.forEach((effect) => effect());
      return result;
    },
  };
}

test("cancelar a saída mantém o formulário e confirmar executa a ação uma vez", () => {
  const h = exitHarness(), action = { type: "RESET", target: "abas" };
  h.render(true, false); h.leave(action);
  let out = h.render(true, false);
  assert.equal(out.alertaProps.visible, true);
  out.alertaProps.onSecondary(); out = h.render(true, false);
  assert.equal(out.alertaProps.visible, false);
  assert.equal(h.actions.length, 0);
  h.leave(action); out = h.render(true, false); out.alertaProps.onPrimary();
  h.render(true, false); h.render(true, false);
  assert.deepEqual(h.actions, [action]);
});

test("salvamento impede a saída e sua conclusão espera a tela voltar ao foco", () => {
  const h = exitHarness();
  let out = h.render(true, true); h.leave({ type: "RESET" });
  out = h.render(true, true);
  assert.equal(h.blocked(), true);
  assert.equal(out.alertaProps.visible, false);
  let completed = 0;
  h.focus(false); out.concluirSaida(() => completed++); h.render(true, false);
  assert.equal(completed, 0);
  h.focus(true); h.render(true, false); h.render(true, false);
  assert.equal(completed, 1);
});

test("descartar uma edição local não desativa a proteção das próximas edições", () => {
  const h = exitHarness();
  let discarded = 0, out = h.render(true, false);
  out.confirmarSaida(() => discarded++); out = h.render(true, false);
  out.alertaProps.onPrimary(); h.render(true, false);
  assert.equal(discarded, 1);
  assert.equal(h.blocked(), true);
});
