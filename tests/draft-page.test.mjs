import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiledPage = ts.transpileModule(
  readFileSync(new URL("../src/app/(protected)/draft/page.tsx", import.meta.url), "utf8"),
  { compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } },
).outputText;

function textContent(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node !== "object") return String(node);
  return textContent(node.props?.children);
}

function* walk(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
  } else if (node && typeof node === "object" && node.props) {
    yield node;
    yield* walk(node.props.children);
    yield* walk(node.props.sidebarExtra);
  }
}

async function createDraftPage({ search = "", topicFailures = [] } = {}) {
  const topics = [
    { topic_id: "generated", title: "Generated topic", has_generated: true, status: "Draft" },
    { topic_id: "saved", title: "Saved topic", article_id: 4, status: "Draft" },
    { topic_id: "published", title: "Published topic", has_generated: true, article_id: 7, status: "Published" },
    { topic_id: "empty", title: "Ungenerated topic", has_generated: false, status: "New" },
  ];
  const slots = [];
  const calls = [];
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  const ArticleManager = () => {};
  const ContentWorkspace = () => {};
  const Sidebar = () => {};
  const Button = () => {};
  const Link = () => {};
  const Suspense = () => {};
  const location = { search };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (update) => {
        const next = typeof update === "function" ? update(slots[index].value) : update;
        if (!Object.is(next, slots[index].value)) {
          slots[index].value = next;
          dirty = true;
        }
      }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies?.[i]))) {
        slots[index] = { dependencies };
        effects.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = effect();
        });
      }
    },
  };
  // Resolve the route's local content component inside Suspense while keeping
  // imported UI components as observable module boundaries.
  const componentStubs = new Set([ArticleManager, ContentWorkspace, Sidebar, Button, Link, Suspense]);
  const jsx = (type, props, key) => typeof type === "function" && !componentStubs.has(type)
    ? type(props)
    : { type, props, key };
  const modules = {
    react: { ...hooks, Suspense },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol("Fragment") },
    "next/link": { __esModule: true, default: Link },
    "next/navigation": { useSearchParams: () => new URLSearchParams(location.search) },
    "@/components/content/ArticleManager": { __esModule: true, default: ArticleManager },
    "@/components/content/ContentWorkspace": { __esModule: true, default: ContentWorkspace },
    "@/components/ui/Sidebar": { __esModule: true, default: Sidebar },
    "@/components/ui/Button": { __esModule: true, default: Button },
    "@/lib/services/content-workflow": { call: async (path) => {
      calls.push(path);
      assert.equal(path, "content-topics");
      const failure = topicFailures.shift();
      if (failure) throw failure;
      return topics;
    } },
  };
  const context = {
    exports: {}, Error, URLSearchParams,
    console: { error: () => {} },
    window: { location },
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(compiledPage, context);
  function render() {
    for (let iteration = 0; dirty; iteration += 1) {
      assert.ok(iteration < 20, "Draft page did not settle");
      dirty = false;
      cursor = 0;
      effects = [];
      tree = context.exports.default();
      for (const effect of effects) effect();
    }
  }
  async function settle() {
    render();
    await new Promise((resolve) => setImmediate(resolve));
    render();
  }
  const page = {
    calls, settle,
    navigate: async (nextSearch) => {
      location.search = nextSearch;
      dirty = true;
      await settle();
    },
    find: (predicate) => {
      const node = [...walk(tree)].find(predicate);
      assert.ok(node, "Draft page control not found");
      return node;
    },
    manager: () => page.find((node) => node.type === ArticleManager),
    workspace: () => page.find((node) => node.type === ContentWorkspace),
    sidebar: () => page.find((node) => node.type === Sidebar),
    hasManager: () => [...walk(tree)].some((node) => node.type === ArticleManager),
    hasWorkspace: () => [...walk(tree)].some((node) => node.type === ContentWorkspace),
  };
  await settle();
  return page;
}

test("Draft route uses the shared manager in draft mode and preserves generated topic navigation", async () => {
  const page = await createDraftPage();
  assert.equal(page.manager().props.status, "draft");
  assert.deepEqual(Array.from(page.sidebar().props.items, (item) => item.id), ["generated", "saved"]);
  page.find((node) => node.props.href === "/topics");
  assert.deepEqual(page.calls, ["content-topics"]);
});

test("topic inventory failures leave the draft article manager mounted and can be retried", async () => {
  const page = await createDraftPage({ topicFailures: [new Error("Topics unavailable")] });
  assert.equal(page.manager().props.status, "draft");
  assert.match(textContent(page.find((node) => node.props.role === "alert")), /Topics unavailable/);
  page.find((node) => typeof node.props.onClick === "function" && /Retry/.test(textContent(node))).props.onClick();
  await page.settle();
  assert.equal(page.manager().props.status, "draft");
  assert.deepEqual(page.calls, ["content-topics", "content-topics"]);
  assert.equal(page.sidebar().props.items.length, 2);
});

test("refreshing drafted articles also refreshes the generated topic sidebar", async () => {
  const page = await createDraftPage();
  assert.deepEqual(page.calls, ["content-topics"]);
  page.manager().props.onRefresh();
  await page.settle();
  assert.deepEqual(page.calls, ["content-topics", "content-topics"]);
  assert.equal(page.manager().props.status, "draft");
  assert.equal(page.sidebar().props.items.length, 2);
});

test("Draft topic deep links retain the generated content workspace and a return link", async () => {
  const page = await createDraftPage({ search: "?topic=topic%2Fselected" });
  assert.equal(page.workspace().props.initialTopic, "topic/selected");
  assert.equal(page.workspace().key, "topic/selected");
  assert.equal(page.hasManager(), false);
  page.find((node) => node.props.href === "/draft" && /Back to drafted articles/.test(textContent(node)));
});

test("Draft query navigation switches from topic workspace to article editor and list without remounting the route", async () => {
  const page = await createDraftPage({ search: "?topic=generated" });
  assert.equal(page.workspace().props.initialTopic, "generated");
  assert.equal(page.hasManager(), false);
  assert.deepEqual(page.calls, []);

  await page.navigate("?article=4");
  assert.equal(page.manager().props.status, "draft");
  assert.equal(page.manager().key, "4");
  assert.equal(page.hasWorkspace(), false);
  assert.deepEqual(page.calls, ["content-topics"]);
  assert.equal(page.sidebar().props.items.length, 2);

  await page.navigate("");
  assert.equal(page.manager().props.status, "draft");
  assert.equal(page.manager().key, "list");
  assert.equal(page.hasWorkspace(), false);
  assert.deepEqual(page.calls, ["content-topics"]);
  assert.equal(page.sidebar().props.items.length, 2);
});
