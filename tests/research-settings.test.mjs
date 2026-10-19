import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const panelCode = await compile("../src/app/(protected)/settings/components/ResearchSourcesSettingsPanel.tsx");
const pageCode = await compile("../src/app/(protected)/settings/page.tsx");
const serviceCode = await compile("../src/lib/services/content-research-settings.ts");
const text = node => node == null ? "" : Array.isArray(node) ? node.map(text).join("") : typeof node === "object" ? text(node.props?.children) : String(node);
function* walk(node) {
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); }
  else if (node && typeof node === "object" && node.props) { yield node; yield* walk(node.props.children); yield* walk(node.props.sidebar); }
}

function renderer(code, modules, props = {}, selectComponent = component => component) {
  const slots = [];
  const events = new Map();
  let cursor = 0, dirty = true, effects = [], tree;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = {
    Suspense: "suspense",
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, next => {
        const value = typeof next === "function" ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) {
        slots[i]?.cleanup?.();
        slots[i] = { deps };
        effects.push(() => { slots[i].cleanup = fn(); });
      }
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
  };
  const jsx = { jsx: (type, props) => ({ type, props: props || {} }), jsxs: (type, props) => ({ type, props: props || {} }) };
  const allModules = { react: hooks, "react/jsx-runtime": jsx, "@/components/ui/Button": "button", "@/components/ui/ConfirmModal": "confirm", ...modules };
  const context = {
    exports: {}, Error, URL, URLSearchParams, JSON, Number, Set,
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name, fn) => { if (events.get(name) === fn) events.delete(name); }, setTimeout, clearTimeout },
    require: name => { assert.ok(name in allModules, name); return allModules[name]; },
  };
  vm.runInNewContext(code, context);
  const Component = selectComponent(context.exports.default);
  async function settle() {
    for (let i = 0; i < 8; i++) {
      while (dirty) { dirty = false; cursor = 0; effects = []; tree = Component(props); for (const effect of effects) effect(); }
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  const find = predicate => [...walk(tree)].find(predicate);
  const button = label => find(node => node.type === "button" && text(node) === label);
  return {
    settle, events, find, button, rerender() { dirty = true; },
    get tree() { return tree; },
    async click(label) { const node = button(label); assert.ok(node, `Missing ${label}`); assert.ok(!node.props.disabled, `${label} is disabled`); node.props.onClick(); await settle(); },
    async change(id, value) { const node = find(node => node.props.id === id); assert.ok(node, `Missing ${id}`); node.props.onChange({ target: { value } }); await settle(); },
    async submit() { const form = find(node => node.type === "form"); assert.ok(form); form.props.onSubmit({ preventDefault() {} }); await settle(); },
    async confirm() { find(node => node.type === "confirm").props.onConfirm(); await settle(); },
    async cancel() { find(node => node.type === "confirm").props.onCancel(); await settle(); },
  };
}

async function mountPanel(overrides = {}) {
  const state = {
    settings: { version: 4, instructions: "Use primary evidence and explain practical tradeoffs.", source_groups: [{ name: "Official documentation", urls: ["https://docs.example.com/"] }, { name: "Research", urls: ["https://papers.example.com/"] }] },
    loadError: null, saveError: null, calls: [], dirty: [],
  };
  Object.assign(state, overrides);
  const view = renderer(panelCode, {
    "@/lib/services/content-research-settings": {
      async getContentResearchSettings() {
        state.calls.push({ method: "GET" });
        if (state.loadError) throw state.loadError;
        return structuredClone(state.settings);
      },
      async updateContentResearchSettings(payload) {
        state.calls.push({ method: "PUT", payload: structuredClone(payload) });
        if (state.saveError) throw state.saveError;
        state.settings = { ...structuredClone(payload), version: state.settings.version + 1 };
        delete state.settings.expected_version;
        return structuredClone(state.settings);
      },
    },
  }, { onDirtyChange: dirty => state.dirty.push(dirty) });
  await view.settle();
  return { ...view, state, get tree() { return view.tree; } };
}

test("research settings service uses the protected versioned API contract", async () => {
  const calls = [];
  const context = { exports: {}, require: name => {
    assert.equal(name, "@/lib/api");
    return { apiFetch: async (path, options) => { calls.push({ path, options }); return { version: 2 }; } };
  } };
  vm.runInNewContext(serviceCode, context);
  await context.exports.getContentResearchSettings();
  const payload = { expected_version: 1, instructions: "Use evidence", source_groups: [] };
  await context.exports.updateContentResearchSettings(payload);
  assert.equal(calls[0].path, "/admin/content-research-settings");
  assert.equal(calls[1].path, "/admin/content-research-settings");
  assert.equal(calls[1].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].options.body), payload);
});

test("shared settings come from the backend and save only after an explicit submission", async () => {
  const page = await mountPanel();
  assert.equal(page.find(node => node.props.id === "research-instructions").props.value, page.state.settings.instructions);
  assert.equal(page.find(node => node.props.id === "research-urls-0").props.value, "https://docs.example.com/");
  assert.equal(page.button("Save research settings").props.disabled, true);
  await page.change("research-instructions", " Use current primary evidence. ");
  await page.change("research-urls-0", " https://new.example.com/ \n\nhttps://second.example.com/");
  assert.equal(page.state.calls.filter(call => call.method === "PUT").length, 0);
  assert.match(text(page.tree), /unsaved changes/);
  await page.submit();
  const save = page.state.calls.find(call => call.method === "PUT");
  assert.equal(save.payload.expected_version, 4);
  assert.equal(save.payload.instructions, "Use current primary evidence.");
  assert.deepEqual(save.payload.source_groups[0].urls, ["https://new.example.com/", "https://second.example.com/"]);
  assert.match(text(page.tree), /Research settings saved/);
  assert.equal(page.button("Save research settings").props.disabled, true);
  assert.equal(page.state.dirty.at(-1), false);
});

test("conflicts and failed reloads preserve edits until a successful explicit reload", async () => {
  const page = await mountPanel();
  await page.change("research-instructions", "My unsaved policy");
  await page.change("research-urls-0", "https://my-source.example.com/");
  page.state.saveError = new Error("Research settings changed. Reload before saving.");
  await page.submit();
  assert.match(text(page.tree), /Research settings changed.*Your edits are kept/);
  assert.equal(page.find(node => node.props.id === "research-instructions").props.value, "My unsaved policy");
  await page.click("Reload settings");
  assert.equal(page.find(node => node.type === "confirm").props.open, true);
  await page.cancel();
  assert.equal(page.state.calls.filter(call => call.method === "GET").length, 1);
  await page.click("Reload settings");
  page.state.loadError = new Error("Research settings temporarily unavailable");
  await page.confirm();
  assert.match(text(page.tree), /temporarily unavailable/);
  assert.equal(page.find(node => node.props.id === "research-urls-0").props.value, "https://my-source.example.com/");
  assert.equal(page.state.dirty.at(-1), true);
  page.state.loadError = null;
  page.state.settings = { version: 8, instructions: "A colleague's newer policy", source_groups: [] };
  await page.click("Reload settings");
  await page.confirm();
  assert.equal(page.find(node => node.props.id === "research-instructions").props.value, "A colleague's newer policy");
  assert.equal(page.state.dirty.at(-1), false);
  await page.change("research-instructions", "Merged policy");
  page.state.saveError = null;
  await page.submit();
  assert.equal(page.state.calls.filter(call => call.method === "PUT").at(-1).payload.expected_version, 8);
});

test("source groups are editable and invalid URLs do not send a save request", async () => {
  const page = await mountPanel();
  await page.click("Add source group");
  await page.change("research-group-2", "Topic resources");
  await page.change("research-urls-2", "http://insecure.example.com/");
  await page.submit();
  assert.match(text(page.tree), /public HTTPS URLs/);
  assert.equal(page.state.calls.filter(call => call.method === "PUT").length, 0);
  const remove = page.find(node => node.props["aria-label"] === "Remove source group 3");
  remove.props.onClick(); await page.settle();
  assert.equal(page.find(node => node.props.id === "research-group-2"), undefined);
});

test("research settings protect dirty drafts from browser unload", async () => {
  const page = await mountPanel();
  await page.change("research-instructions", "Unsaved policy");
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  page.events.get("beforeunload")(event);
  assert.equal(prevented, true);
  await page.submit();
  prevented = false;
  page.events.get("beforeunload")(event);
  assert.equal(prevented, false);
});

test("Research Sources deep link loads its panel and protects edits on tab switches", async () => {
  const calls = [];
  let params = new URLSearchParams("tab=research-sources");
  let page;
  const router = { replace(url) { calls.push({ route: url }); params = new URLSearchParams(url.split("?")[1]); page.rerender(); } };
  page = renderer(pageCode, {
    "next/navigation": { useRouter: () => router, useSearchParams: () => params },
    "@/components/layout/ProtectedPageShell": "shell", "@/components/ui/Toast": "toast",
    "./components/ResearchSourcesSettingsPanel": "research-panel", "./components/HostSiteSettingsPanel": "host-panel", "./components/PopularSettingsPanel": "popular-panel",
    "@/lib/services/videos": { getPopularScanSettings: async () => { calls.push({ api: "popular" }); return { region_codes: ["US"], max_results: 10, available_regions: [{ code: "US", name: "US" }] }; }, getPopularScanRegions: async () => [], refreshPopularScanRegions: async () => [], updatePopularScanSettings: async value => value },
    "@/lib/services/host-sites": { getHostSites: async () => { calls.push({ api: "hosts" }); return []; }, createHostSite() {}, deleteHostSite() {}, updateHostSite() {} },
    "@/lib/services/public-api-keys": { getPublicApiKeys: async () => { calls.push({ api: "keys" }); return []; }, generatePublicApiKey() {}, revokePublicApiKey() {} },
  }, {}, component => component().props.children.type);
  await page.settle();
  const panel = page.find(node => node.type === "research-panel");
  assert.ok(panel);
  assert.equal(calls.length, 0);
  panel.props.onDirtyChange(true); await page.settle();
  await page.click("Host SitesTab");
  assert.equal(page.find(node => node.type === "confirm").props.open, true);
  assert.equal(calls.length, 0);
  await page.cancel();
  assert.ok(page.find(node => node.type === "research-panel"));
  await page.click("Host SitesTab");
  await page.confirm();
  assert.deepEqual(calls, [{ route: "/settings?tab=host-sites" }, { api: "hosts" }, { api: "keys" }]);
});

test("an initial loading failure offers an explicit retry without inventing defaults", async () => {
  const page = await mountPanel({ loadError: new Error("Research settings unavailable") });
  assert.match(text(page.tree), /Research settings unavailable/);
  assert.equal(page.find(node => node.type === "form"), undefined);
  page.state.loadError = null;
  await page.click("Reload settings");
  assert.equal(page.find(node => node.props.id === "research-instructions").props.value, page.state.settings.instructions);
});
