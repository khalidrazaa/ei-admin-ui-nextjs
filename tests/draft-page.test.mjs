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
  }
}

function createDraftPage({ search = "" } = {}) {
  let tree;
  const ArticleManager = () => {};
  const ContentWorkspace = () => {};
  const Link = () => {};
  const Suspense = () => {};
  const location = { search };
  // Resolve the local content component while keeping imported UI observable.
  const componentStubs = new Set([ArticleManager, ContentWorkspace, Link, Suspense]);
  const jsx = (type, props, key) => typeof type === "function" && !componentStubs.has(type)
    ? type(props)
    : { type, props, key };
  const modules = {
    react: { Suspense },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol("Fragment") },
    "next/link": { __esModule: true, default: Link },
    "next/navigation": { useSearchParams: () => new URLSearchParams(location.search) },
    "@/components/content/ArticleManager": { __esModule: true, default: ArticleManager },
    "@/components/content/ContentWorkspace": { __esModule: true, default: ContentWorkspace },
  };
  const context = {
    exports: {}, URLSearchParams,
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(compiledPage, context);
  function render() {
    tree = context.exports.default();
  }
  const page = {
    navigate: (nextSearch) => { location.search = nextSearch; render(); },
    find: (predicate) => {
      const node = [...walk(tree)].find(predicate);
      assert.ok(node, "Draft page control not found");
      return node;
    },
    has: (predicate) => [...walk(tree)].some(predicate),
    manager: () => page.find((node) => node.type === ArticleManager),
    workspace: () => page.find((node) => node.type === ContentWorkspace),
    hasManager: () => page.has((node) => node.type === ArticleManager),
    hasWorkspace: () => page.has((node) => node.type === ContentWorkspace),
  };
  render();
  return page;
}

test("Draft route shows the shared article manager without generated-topic sidebar extras", () => {
  const page = createDraftPage();
  assert.equal(page.manager().props.status, "draft");
  assert.equal(page.manager().props.sidebarExtra, undefined);
  assert.equal(page.manager().props.onRefresh, undefined);
  assert.equal(page.has((node) => node.props.href === "/topics"), false);
});

test("Draft topic deep links retain the generated content workspace and a return link", () => {
  const page = createDraftPage({ search: "?topic=topic%2Fselected" });
  assert.equal(page.workspace().props.initialTopic, "topic/selected");
  assert.equal(page.workspace().key, "topic/selected");
  assert.equal(page.hasManager(), false);
  page.find((node) => node.props.href === "/draft" && /Back to drafted articles/.test(textContent(node)));
});

test("Draft query navigation switches from topic workspace to article editor and list without remounting the route", () => {
  const page = createDraftPage({ search: "?topic=generated" });
  assert.equal(page.workspace().props.initialTopic, "generated");
  assert.equal(page.hasManager(), false);

  page.navigate("?article=4");
  assert.equal(page.manager().props.status, "draft");
  assert.equal(page.manager().key, "4");
  assert.equal(page.hasWorkspace(), false);
  assert.equal(page.manager().props.sidebarExtra, undefined);

  page.navigate("");
  assert.equal(page.manager().props.status, "draft");
  assert.equal(page.manager().key, "list");
  assert.equal(page.hasWorkspace(), false);
  assert.equal(page.manager().props.sidebarExtra, undefined);
});
