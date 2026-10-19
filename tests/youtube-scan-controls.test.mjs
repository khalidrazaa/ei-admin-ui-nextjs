import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const codes = Object.fromEntries(await Promise.all([
  ["settings", "../src/app/(protected)/settings/page.tsx"],
  ["panel", "../src/app/(protected)/settings/components/PopularSettingsPanel.tsx"],
  ["popular", "../src/app/(protected)/youtube-popular/page.tsx"],
  ["niche", "../src/app/(protected)/niches/page.tsx"],
  ["controls", "../src/lib/utils/youtubeScanControls.ts"],
  ["notice", "../src/components/ui/YouTubeScanNotice.tsx"],
  ["service", "../src/lib/services/videos.ts"],
].map(async ([key, path]) => [key, await compile(path)])));
const controls = { exports: {} };
vm.runInNewContext(codes.controls, controls);
const text = node => node == null ? "" : Array.isArray(node) ? node.map(text).join("") : typeof node === "object" ? text(node.props?.children) : String(node);
function* walk(node) {
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); }
  else if (node && typeof node === "object" && node.props) { yield node; yield* walk(node.props.children); }
}
function renderer(code, modules, props = {}, select = component => component) {
  const slots = [];
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
      if (!equal(slots[i]?.deps, deps)) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); }
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
  };
  const jsx = { jsx: (type, props) => ({ type, props: props || {} }), jsxs: (type, props) => ({ type, props: props || {} }) };
  const allModules = {
    react: hooks, "react/jsx-runtime": jsx,
    "@/components/ui/Button": "button", "@/components/ui/ConfirmModal": "confirm",
    "@/components/layout/ProtectedPageShell": "shell", "@/components/ui/Toast": "toast",
    "@/components/ui/YouTubeScanNotice": "scan-notice", "@/components/ui/Sidebar": "sidebar",
    "@/components/ui/VideoCard": "video-card",
    "@/components/ui/VideoFilters": { __esModule: true, default: "filters", CATEGORY_OPTIONS: [], VideoPaginationControls: "pagination" },
    "@/lib/utils/videoFilters": { EMPTY_VIDEO_FILTERS: {}, toVideoListParams: () => ({}) },
    "@/lib/utils/youtubeScanControls": controls.exports,
    ...modules,
  };
  const context = {
    exports: {}, Error, URL, URLSearchParams, JSON, Number, Set,
    console: { error() {}, log() {} },
    window: { addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {} },
    require: name => { assert.ok(name in allModules, name); return allModules[name]; },
  };
  vm.runInNewContext(code, context);
  const Component = select(context.exports.default);
  const render = () => {
    while (dirty) { dirty = false; cursor = 0; effects = []; tree = Component(props); for (const effect of effects) effect(); }
  };
  async function settle() { for (let i = 0; i < 8; i++) { render(); await new Promise(resolve => setImmediate(resolve)); } }
  return { render, settle, find: predicate => [...walk(tree)].find(predicate), get tree() { return tree; } };
}
const config = overrides => ({ youtube_scan_enabled: true, popular_scan_enabled: true, niche_scan_enabled: true, region_codes: ["US"], max_results: 10, available_regions: [{ code: "US", name: "United States" }], ...overrides });

async function mountSettings(options = {}) {
  const state = { settings: config(), calls: [], loadError: null, ...options };
  const page = renderer(codes.settings, {
    "next/navigation": { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams("tab=youtube-popular") },
    "./components/PopularSettingsPanel": "popular-panel", "./components/HostSiteSettingsPanel": "host-panel", "./components/ResearchSourcesSettingsPanel": "research-panel",
    "@/lib/services/videos": {
      async getPopularScanSettings() { if (state.loadError) throw state.loadError; return structuredClone(state.settings); },
      getPopularScanRegions: async () => { if (state.regionError) throw state.regionError; return []; }, refreshPopularScanRegions: async () => [],
      async updatePopularScanSettings(payload) { state.calls.push(structuredClone(payload)); return structuredClone(payload); },
    },
    "@/lib/services/host-sites": {}, "@/lib/services/public-api-keys": {},
  }, {}, component => component().props.children.type);
  await page.settle();
  return { page, state, panel: () => page.find(node => node.type === "popular-panel").props };
}

test("settings load and save every scan flag, preserving child preferences when the master changes", async () => {
  const { page, state, panel } = await mountSettings({ settings: config({ niche_scan_enabled: false }) });
  assert.equal(panel().scanSettings.niche_scan_enabled, false);
  panel().onScanControlChange("youtube_scan_enabled", false);
  await page.settle();
  panel().onSave(); await page.settle();
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].youtube_scan_enabled, false);
  assert.equal(state.calls[0].popular_scan_enabled, true);
  assert.equal(state.calls[0].niche_scan_enabled, false);
  panel().onScanControlChange("youtube_scan_enabled", true); await page.settle();
  panel().onSave(); await page.settle();
  assert.equal(state.calls[1].popular_scan_enabled, true);
  assert.equal(state.calls[1].niche_scan_enabled, false);
});

test("failed initial settings load prevents saves until an explicit successful retry", async () => {
  const { page, state, panel } = await mountSettings({ loadError: new Error("Settings unavailable") });
  assert.equal(panel().settingsLoaded, false);
  assert.equal(panel().settingsLoadError, "Settings unavailable");
  panel().onSave(); await page.settle();
  assert.equal(state.calls.length, 0);
  state.loadError = null;
  panel().onRetry(); await page.settle();
  assert.equal(panel().settingsLoaded, true);
  assert.equal(panel().settingsLoadError, null);
  panel().onSave(); await page.settle();
  assert.equal(state.calls.length, 1);
});

function mountSwitchPanel(scanSettings, onScanControlChange = () => {}, overrides = {}) {
  const panel = renderer(codes.panel, {}, {
    availableRegions: [], filteredAvailableRegions: [], regionSearch: "", scanSettings,
    settingsLoading: false, settingsLoaded: true, settingsSaving: false, settingsLoadError: null, regionsRefreshing: false,
    onScanControlChange, ...overrides,
  });
  panel.render();
  return { panel, switches: [...walk(panel.tree)].filter(node => node.props.role === "switch") };
}

test("settings expose three native button slider switches with disable labels in the requested order", () => {
  const { panel, switches } = mountSwitchPanel(config());
  assert.deepEqual(switches.map(node => node.props["aria-label"]), [
    "Disable popular YouTube scan", "Disable all niche scans", "Disable all YouTube video scans",
  ]);
  assert.match(text(panel.tree), /Switch on to disable scanning/);
  for (const control of switches) {
    assert.equal(control.type, "button");
    assert.equal(control.props.type, "button");
    assert.equal(control.props["aria-checked"], false);
    assert.equal(control.props.disabled, false);
    assert.equal(control.props["aria-describedby"], "youtube-scan-switch-help");
    // Native buttons retain Enter/Space activation and keyboard focus without custom handlers.
    assert.equal(control.props.onKeyDown, undefined);
    assert.equal(control.props.tabIndex, undefined);
    assert.match(control.props.className, /focus-visible:ring/);
  }
});

test("disable switches invert enabled values in both directions", () => {
  const calls = [];
  const enabled = mountSwitchPanel(config(), (key, value) => calls.push([key, value]));
  for (const control of enabled.switches) control.props.onClick();
  assert.deepEqual(calls, [["popular_scan_enabled", false], ["niche_scan_enabled", false], ["youtube_scan_enabled", false]]);
  calls.length = 0;
  const childrenDisabled = mountSwitchPanel(config({ popular_scan_enabled: false, niche_scan_enabled: false }), (key, value) => calls.push([key, value]));
  for (const control of childrenDisabled.switches.slice(0, 2)) {
    assert.equal(control.props["aria-checked"], true);
    assert.match(control.props.className, /bg-red-600/);
    control.props.onClick();
  }
  const masterDisabled = mountSwitchPanel(config({ youtube_scan_enabled: false }), (key, value) => calls.push([key, value]));
  masterDisabled.switches[2].props.onClick();
  assert.deepEqual(calls, [["popular_scan_enabled", true], ["niche_scan_enabled", true], ["youtube_scan_enabled", true]]);
});

test("all-video disable switch overrides and preserves the individual slider preferences", () => {
  const { panel, switches } = mountSwitchPanel(config({ youtube_scan_enabled: false, niche_scan_enabled: false }));
  assert.equal(switches[0].props["aria-checked"], false);
  assert.equal(switches[1].props["aria-checked"], true);
  assert.equal(switches[2].props["aria-checked"], true);
  assert.equal(switches[0].props.disabled, true);
  assert.equal(switches[1].props.disabled, true);
  assert.equal(switches[2].props.disabled, false);
  assert.match(text(panel.tree), /All YouTube video scans are disabled/);
});

test("slider switches stay disabled while loading or saving and after a failed settings load", () => {
  for (const state of [{ settingsLoading: true }, { settingsSaving: true }, { settingsLoaded: false }]) {
    const { switches } = mountSwitchPanel(config(), undefined, state);
    assert.ok(switches.every(control => control.props.disabled));
  }
});

test("region catalog failure still allows saving loaded scan controls", async () => {
  const { page, state, panel } = await mountSettings({ settings: config({ available_regions: [] }), regionError: new Error("YouTube region lookup unavailable") });
  assert.equal(panel().settingsLoaded, true);
  assert.equal(panel().availableRegions[0].code, "US");
  panel().onScanControlChange("youtube_scan_enabled", false); await page.settle();
  panel().onSave(); await page.settle();
  assert.equal(state.calls[0].youtube_scan_enabled, false);
});

test("disabled scan notice links to the existing YouTube settings URL", () => {
  const notice = renderer(codes.notice, { "next/link": "link" }, { reason: "All YouTube video scanning is disabled in settings." });
  notice.render();
  assert.equal(notice.find(node => node.type === "link").props.href, "/settings?tab=youtube-popular");
  assert.equal(notice.find(node => node.type === "p").props.role, "status");
});

async function mountScanPage(kind, settings, loadError = null) {
  const calls = [];
  const emptyVideos = { items: [], pagination: { page: 1, size: 20, pages: 1, total: 0 } };
  const services = {
    async getPopularScanSettings() { if (loadError) throw loadError; return settings; },
    getPopularVideos: async () => emptyVideos, getVideosByNiche: async () => emptyVideos,
    scanPopularVideos: async () => { calls.push("popular"); return { regions: ["US"], max_results: 10, total_processed: 0 }; },
  };
  const page = renderer(codes[kind], {
    "@/lib/services/videos": services,
    "next/navigation": { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams("niche=1"), usePathname: () => "/niches" },
    "@/lib/services/niche": { getNiches: async () => [{ id: 1, display_name: "Testing", is_active: true, keywords: [] }], scanNicheYouTube: async () => { calls.push("niche"); return { videos_saved: 0 }; } },
  }, {}, kind === "niche" ? component => component().props.children.type : undefined);
  page.render();
  if (kind === "popular") assert.equal(page.find(node => node.type === "button" && text(node) === "Scan Now").props.disabled, true);
  await page.settle();
  return { page, calls, button: () => page.find(node => node.type === "button" && text(node) === "Scan Now") };
}

for (const kind of ["popular", "niche"]) {
  for (const scenario of [
    { name: "master disabled", settings: config({ youtube_scan_enabled: false }) },
    { name: "scan type disabled", settings: config({ [`${kind}_scan_enabled`]: false }) },
    { name: "settings unavailable", settings: null, error: new Error("Cannot load scan settings") },
  ]) {
    test(`${kind} Scan Now is blocked with an explanation when ${scenario.name}`, async () => {
      const { page, calls, button } = await mountScanPage(kind, scenario.settings, scenario.error);
      assert.equal(button().props.disabled, true);
      assert.ok(page.find(node => node.type === "scan-notice").props.reason);
      button().props.onClick(); await page.settle();
      assert.equal(calls.length, 0);
    });
  }
  test(`${kind} Scan Now runs when its saved setting and master are enabled`, async () => {
    const { page, calls, button } = await mountScanPage(kind, config());
    assert.equal(button().props.disabled, false);
    button().props.onClick(); await page.settle();
    assert.deepEqual(calls, [kind]);
  });
}

test("services save scan controls but strip enable flags and region metadata from per-run payloads", async () => {
  const calls = [];
  const context = { exports: {}, require: name => {
    assert.equal(name, "@/lib/api");
    return { apiFetch: async (path, options) => { calls.push({ path, options }); return {}; } };
  } };
  vm.runInNewContext(codes.service, context);
  await context.exports.updatePopularScanSettings(config({ youtube_scan_enabled: false }));
  await context.exports.scanPopularVideos(config());
  assert.deepEqual(JSON.parse(calls[0].options.body), { youtube_scan_enabled: false, popular_scan_enabled: true, niche_scan_enabled: true, region_codes: ["US"], max_results: 10 });
  assert.deepEqual(JSON.parse(calls[1].options.body), { region_codes: ["US"], max_results: 10 });
});
