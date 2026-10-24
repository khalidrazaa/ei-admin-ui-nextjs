import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as yaml from "js-yaml";

function compile(relativePath) {
  return ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    { compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    } },
  ).outputText;
}

const compiledService = compile("../src/lib/services/articles.ts");
const compiledPage = compile("../src/app/(protected)/articles/page.tsx");
const compiledManager = compile("../src/components/content/ArticleManager.tsx");
const compiledConfirmModal = compile("../src/components/ui/ConfirmModal.tsx");
const compiledButton = compile("../src/components/ui/Button.tsx");
const compiledTable = compile("../src/components/ui/Table.tsx");
const compiledPagination = compile("../src/components/ui/VideoFilters.tsx");
const compiledMarkdownDraft = compile("../src/lib/utils/markdownDraft.ts");
const compiledCsvList = compile("../src/lib/utils/csvList.ts");

function loadUtility(source, modules = {}) {
  const context = { exports: {}, Error, require: (name) => {
    assert.ok(name in modules, `Unexpected utility dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(source, context);
  return context.exports;
}

const csvList = loadUtility(compiledCsvList);
const markdownDraft = loadUtility(compiledMarkdownDraft, { "js-yaml": yaml, "./csvList": csvList });

function loadButton(jsxRuntime) {
  const context = {
    exports: {},
    require: (name) => {
      if (name === "react") return {};
      assert.equal(name, "react/jsx-runtime");
      return jsxRuntime;
    },
  };
  vm.runInNewContext(compiledButton, context);
  return context.exports;
}

function loadTable(jsxRuntime) {
  const context = {
    exports: {},
    require: (name) => {
      if (name === "react") return {};
      assert.equal(name, "react/jsx-runtime");
      return jsxRuntime;
    },
  };
  vm.runInNewContext(compiledTable, context);
  return context.exports;
}

test("Articles route renders the shared article manager with published defaults", () => {
  const ArticleManager = () => {};
  const context = {
    exports: {},
    require: (name) => {
      if (name === "@/components/content/ArticleManager") return { __esModule: true, default: ArticleManager };
      assert.equal(name, "react/jsx-runtime");
      return { jsx: (type, props) => ({ type, props }) };
    },
  };
  vm.runInNewContext(compiledPage, context);
  const tree = context.exports.default();
  assert.equal(tree.type, ArticleManager);
  assert.equal(tree.props.status ?? "published", "published");
});

test("article deletion services send single and bulk requests and return server results", async () => {
  const calls = [];
  const result = { deleted_ids: [11, 12], deleted_count: 2 };
  const context = { exports: {}, require: (name) => {
    assert.equal(name, "@/lib/api");
    return { apiFetch: async (endpoint, options) => {
      calls.push({ endpoint, options });
      return result;
    } };
  } };
  vm.runInNewContext(compiledService, context);

  assert.equal(await context.exports.deleteArticle(11), result);
  assert.equal(await context.exports.deleteArticles([11, 12]), result);
  assert.equal(calls[0].endpoint, "/admin/articles/11");
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[1].endpoint, "/admin/articles/bulk-delete");
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { article_ids: [11, 12] });
});

test("article list service preserves its route and accepts published or draft query filters", async () => {
  const calls = [];
  const context = { exports: {}, URLSearchParams, require: (name) => {
    assert.equal(name, "@/lib/api");
    return { apiFetch: async (endpoint, options) => {
      calls.push({ endpoint, method: options.method });
      return [];
    } };
  } };
  vm.runInNewContext(compiledService, context);

  await context.exports.getArticles("published");
  await context.exports.getArticles("draft");
  await context.exports.getArticles();
  assert.deepEqual(calls, [
    { endpoint: "/admin/articles?status=published", method: "GET" },
    { endpoint: "/admin/articles?status=draft", method: "GET" },
    { endpoint: "/admin/articles", method: "GET" },
  ]);
});

test("paginated article service sends bounded pages and encoded server filters", async () => {
  const calls = [];
  const result = { items: [], page: 3, size: 50, total: 0, total_pages: 0 };
  const context = { exports: {}, URLSearchParams, require: (name) => {
    assert.equal(name, "@/lib/api");
    return { apiFetch: async (endpoint, options) => { calls.push({ endpoint, options }); return result; } };
  } };
  vm.runInNewContext(compiledService, context);
  assert.equal(await context.exports.getArticlePage({ status: "draft", page: 3, size: 50, category: "AI & Tools", search: "  machine learning  " }), result);
  const url = new URL(calls[0].endpoint, "http://admin.test");
  assert.deepEqual(Object.fromEntries(url.searchParams), { page: "3", size: "50", status: "draft", category: "AI & Tools", search: "machine learning" });
  assert.equal(calls[0].options.method, "GET");
  await context.exports.getArticlePage();
  assert.equal(calls[1].endpoint, "/admin/articles?page=1&size=20");
});

test("article category service loads the authenticated category options without article bodies", async () => {
  const calls = [];
  const result = ["Culture", "Draft Only", "Tech"];
  const context = { exports: {}, require: (name) => {
    assert.equal(name, "@/lib/api");
    return { apiFetch: async (endpoint, options) => { calls.push({ endpoint, options }); return result; } };
  } };
  vm.runInNewContext(compiledService, context);
  assert.equal(await context.exports.getArticleCategories(), result);
  assert.equal(calls[0].endpoint, "/admin/articles/categories");
  assert.equal(calls[0].options.method, "GET");
});

test("manual draft creation posts its fields and always requests draft status", async () => {
  const calls = [];
  const result = { id: 15, title: "Manual draft", slug: "manual-draft", status: "draft" };
  const context = { exports: {}, require: (name) => {
    assert.equal(name, "@/lib/api");
    return { apiFetch: async (endpoint, options) => {
      calls.push({ endpoint, options });
      return result;
    } };
  } };
  vm.runInNewContext(compiledService, context);
  const payload = { title: "Manual draft", slug: "manual-draft", host_site: "example.com", content: "", category: "Manual", status: "published" };
  assert.equal(await context.exports.createDraft(payload), result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, "/admin/articles");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), { ...payload, status: "draft" });
});

const articles = [
  { id: 1, title: "Alpha", slug: "alpha", category: "Tech", status: "published" },
  { id: 2, title: "Beta", slug: "beta", category: "Tech", status: "published" },
  { id: 3, title: "Gamma", slug: "gamma", category: "Culture", status: "published" },
  { id: 4, title: "Draft Delta", slug: "draft-delta", category: "Draft Only", status: "draft" },
].map((article) => ({ ...article, host_site: "example.com", created_at: null, content: "Body", tags: [], keywords: [], is_featured: false }));

function textContent(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node !== "object") return String(node);
  return textContent(node.props?.children);
}

function* walk(node, ancestors = []) {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child, ancestors);
  } else if (node && typeof node === "object" && node.props) {
    yield { node, ancestors };
    yield* walk(node.props.children, [...ancestors, node]);
    yield* walk(node.props.sidebar, [...ancestors, node]);
  }
}

// Run the real page with deterministic hooks and JSX nodes. Dependencies are
// mocked at module boundaries; assertions use rendered controls and events.
async function createPage({ deleteResult, deleteFailures = [], deletePromise, updatePromise, createFailures = [], createPromise, editorDocument, listFailures = [], articleFailures = [], categoryFailures = [], search = "", status = "published", sidebarExtra, onRefresh, initialArticles = articles, unfilteredList = false } = {}) {
  const slots = [];
  const calls = { single: [], bulk: [], edited: [], updated: [], created: [], listed: 0, listStatuses: [], listParams: [], filePickers: 0, categoryLoads: 0 };
  const storedArticles = initialArticles.map((article) => ({ ...article }));
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  const Shell = () => {};
  const Toast = () => {};
  const ConfirmModal = () => {};
  let Button;
  let Table;
  let PaginationControls;
  const searchTimers = new Map();
  let timerId = 0;
  const dependenciesEqual = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
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
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || !dependenciesEqual(slots[index].dependencies, dependencies)) {
        slots[index] = { value: factory(), dependencies };
      }
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!slots[index] || !dependenciesEqual(slots[index].dependencies, dependencies)) {
        const previousCleanup = slots[index]?.cleanup;
        slots[index] = { dependencies };
        effects.push(() => {
          previousCleanup?.();
          slots[index].cleanup = effect();
        });
      }
    },
  };
  const jsx = (type, props, key) => {
    if (type === Button || type === Table || type === PaginationControls) return type(props);
    if (props.ref && !props.ref.current) props.ref.current = {
      indeterminate: false, innerHTML: "",
      click: () => { calls.filePickers += 1; },
    };
    return { type, props, key };
  };
  const jsxRuntime = { jsx, jsxs: jsx, Fragment: Symbol("Fragment") };
  const buttonModule = loadButton(jsxRuntime);
  Button = buttonModule.default;
  const tableModule = loadTable(jsxRuntime);
  Table = tableModule.default;
  const paginationModule = loadUtility(compiledPagination, { "@/components/ui/Button": buttonModule, "react/jsx-runtime": jsxRuntime });
  PaginationControls = paginationModule.VideoPaginationControls;
  async function remove(ids) {
    const failure = deleteFailures.shift();
    if (failure) throw failure;
    const result = deletePromise ? await deletePromise : deleteResult ?? { deleted_ids: ids, deleted_count: ids.length };
    for (let index = storedArticles.length - 1; index >= 0; index -= 1) {
      if (result.deleted_ids.includes(storedArticles[index].id)) storedArticles.splice(index, 1);
    }
    return result;
  }
  const modules = {
    "@/components/content/ArticleEvidence": { __esModule: true, default: () => null },
    "@/components/content/ArticleMarkdown": { __esModule: true, default: () => null },
    react: hooks,
    "react/jsx-runtime": jsxRuntime,
    "@/components/layout/ProtectedPageShell": { __esModule: true, default: Shell },
    "@/components/ui/Toast": { __esModule: true, default: Toast },
    "@/components/ui/ConfirmModal": { __esModule: true, default: ConfirmModal },
    "@/components/ui/Button": buttonModule,
    "@/components/ui/Table": tableModule,
    "@/components/ui/VideoFilters": paginationModule,
    "@/lib/services/host-sites": { getHostSites: async () => [] },
    "@/lib/utils/markdownDraft": markdownDraft,
    "@/lib/utils/csvList": csvList,
    "@/lib/services/articles": {
      getArticleCategories: async () => {
        calls.categoryLoads += 1;
        const failure = categoryFailures.shift();
        if (failure) throw failure;
        return [...new Set(storedArticles.map((article) => article.category?.trim()).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right));
      },
      getArticlePage: async ({ status, page, size, category, search }) => {
        calls.listed += 1;
        calls.listStatuses.push(status);
        calls.listParams.push({ status, page, size, category, search });
        const failure = listFailures.shift();
        if (failure) throw failure;
        const scoped = storedArticles.filter((article) => !status || article.status === status);
        const counts = new Map();
        for (const article of scoped) {
          const name = article.category?.trim() || "Uncategorized";
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        const matches = storedArticles.filter((article) => (unfilteredList || !status || article.status === status) &&
          (!category || (article.category?.trim() || "Uncategorized") === category) &&
          (!search || `${article.title} ${article.slug} ${article.category || ""}`.toLowerCase().includes(search.toLowerCase())));
        const total_pages = Math.ceil(matches.length / size);
        return { items: matches.slice((page - 1) * size, page * size).map((article) => ({ ...article })),
          total: matches.length, page, size, total_pages, has_next: page < total_pages, has_previous: page > 1,
          categories: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count })),
          category_total: scoped.length };
      },
      getArticle: async (id) => {
        calls.edited.push(id);
        const failure = articleFailures.shift();
        if (failure) throw failure;
        return storedArticles.find((article) => article.id === id);
      },
      createDraft: async (payload) => {
        calls.created.push(payload);
        const failure = createFailures.shift();
        if (failure) throw failure;
        const created = createPromise ? await createPromise : {
          ...payload,
          id: Math.max(0, ...storedArticles.map((article) => article.id)) + 1,
          status: "draft",
          created_at: "2026-10-18T10:00:00Z",
          updated_at: "2026-10-18T10:00:00Z",
        };
        storedArticles.push({ ...created });
        return { ...created };
      },
      updateArticle: async (id, payload) => {
        calls.updated.push({ id, payload });
        const index = storedArticles.findIndex((article) => article.id === id);
        storedArticles[index] = updatePromise ? await updatePromise : { ...storedArticles[index], ...payload };
        return { ...storedArticles[index] };
      },
      deleteArticle: async (id) => { calls.single.push(id); return remove([id]); },
      deleteArticles: async (ids) => { calls.bulk.push(Array.from(ids)); return remove(Array.from(ids)); },
    },
  };
  const location = { search, pathname: status === "draft" ? "/draft" : "/articles" };
  Object.defineProperty(location, "href", {
    get: () => `${location.pathname}${location.search}`,
    set: () => { assert.fail("Opening or closing an article must stay inside its current page"); },
  });
  const context = {
    exports: {}, Error, URLSearchParams, TextDecoder,
    document: editorDocument,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    console: { error: () => {} },
    window: {
      location,
      confirm: () => { assert.fail("Article deletion must use the shared ConfirmModal"); },
      setTimeout: (callback, delay) => { const id = ++timerId; if (delay === 300) searchTimers.set(id, callback); return id; },
      clearTimeout: (id) => { searchTimers.delete(id); },
    },
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(compiledManager, context);
  function render() {
    for (let iteration = 0; dirty; iteration += 1) {
      assert.ok(iteration < 20, "Page did not settle after state updates");
      dirty = false;
      cursor = 0;
      effects = [];
      tree = context.exports.default({ status, sidebarExtra, onRefresh });
      for (const effect of effects) effect();
    }
  }
  async function settle() {
    for (let iteration = 0; iteration < 6; iteration += 1) {
      render();
      await new Promise((resolve) => setImmediate(resolve));
    }
    render();
  }
  function find(predicate, root = tree) {
    const match = Array.from(walk(root)).find(({ node }) => predicate(node));
    assert.ok(match, "Rendered control not found");
    return match.node;
  }
  function click(node) {
    const match = Array.from(walk(tree)).find((entry) => entry.node === node);
    assert.ok(match, "Clicked control is not mounted");
    if (node.props.disabled) return;
    let stopped = false;
    const event = { stopPropagation: () => { stopped = true; } };
    for (const entry of [node, ...match.ancestors.slice().reverse()]) {
      entry.props.onClick?.(event);
      if (stopped) break;
    }
  }
  function key(node, pressedKey) {
    const match = Array.from(walk(tree)).find((entry) => entry.node === node);
    assert.ok(match, "Keyboard control is not mounted");
    let stopped = false;
    let prevented = false;
    const event = {
      key: pressedKey,
      target: node,
      currentTarget: node,
      stopPropagation: () => { stopped = true; },
      preventDefault: () => { prevented = true; },
    };
    for (const entry of [node, ...match.ancestors.slice().reverse()]) {
      event.currentTarget = entry;
      entry.props.onKeyDown?.(event);
      if (stopped) break;
    }
    return { stopped, prevented };
  }
  const page = {
    calls, render, settle, find, click, key, location,
    flushSearch: async () => {
      render();
      const callbacks = [...searchTimers.values()];
      searchTimers.clear();
      for (const callback of callbacks) callback();
      await settle();
    },
    has: (predicate) => Array.from(walk(tree)).some(({ node }) => predicate(node)),
    button: (label) => find((node) => node.type === "button" && (typeof label === "string" ? textContent(node) === label : label.test(textContent(node)))),
    field: (label) => {
      const wrapper = find((node) => node.type === "label" && textContent(node.props.children?.[0]).trim() === label);
      return find((node) => ["input", "select", "textarea"].includes(node.type), wrapper);
    },
    fill: (node, value) => {
      const match = Array.from(walk(tree)).find((entry) => entry.node === node);
      assert.ok(match, "Changed control is not mounted");
      if (node.props.disabled || match.ancestors.some((ancestor) => ancestor.type === "fieldset" && ancestor.props.disabled)) return;
      node.props.onChange({ target: { value, checked: value } });
      render();
    },
    customCategory: (value) => {
      page.fill(page.field("Category"), "custom");
      page.fill(page.field("Custom category"), value);
    },
    disabled: (node) => {
      const match = Array.from(walk(tree)).find((entry) => entry.node === node);
      assert.ok(match, "Control is not mounted");
      return Boolean(node.props.disabled || match.ancestors.some((ancestor) => ancestor.type === "fieldset" && ancestor.props.disabled));
    },
    shell: () => find((node) => node.type === Shell).props,
    table: () => find((node) => node.type === "table"),
    checkbox: (label) => find((node) => node.type === "input" && node.props["aria-label"] === label, page.table()),
    deleteButton: (title) => find((node) => node.type === "button" && node.props["aria-label"] === `Delete ${title}`, page.table()),
    bulkButton: () => find((node) => node.type === "button" && /^(Delete selected|Deleting\.\.\.)$/.test(textContent(node))),
    category: (name) => find((node) => node.type === "button" && textContent(node.props.children?.[0]) === name),
    categories: () => Array.from(walk(tree)).filter(({ node }) => node.type === "button" && node.props.children?.[0]?.type === "span").map(({ node }) => textContent(node.props.children[0])),
    rows: () => Array.from(walk(page.table())).filter(({ node }) => node.type === "tr" && node.props.onClick).map(({ node }) => node),
    toast: () => find((node) => node.type === Toast).props,
    modal: () => Array.from(walk(tree)).find(({ node }) => node.type === ConfirmModal)?.node.props ?? { open: false },
    confirm: () => {
      assert.equal(page.modal().open, true);
      page.modal().onConfirm();
      render();
    },
    cancel: () => {
      assert.equal(page.modal().open, true);
      page.modal().onCancel();
      render();
    },
    change: (node) => { if (!node.props.disabled) node.props.onChange(); render(); },
  };
  await settle();
  return page;
}

function markdownFile(source, name = "imported-draft.md", overrides = {}) {
  const bytes = Buffer.from(source, "utf8");
  return {
    name, size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ...overrides,
  };
}

function chooseMarkdownFile(page, file, onChange) {
  const input = { files: file ? [file] : [], value: file?.name ?? "" };
  (onChange ?? page.find((node) => node.props["aria-label"] === "Upload Markdown draft").props.onChange)({ currentTarget: input });
  return input;
}

test("Articles table requests published articles and excludes drafts from rows, selection, and category counts", async () => {
  const page = await createPage();
  assert.deepEqual(page.calls.listStatuses, ["published"]);
  assert.equal(page.rows().length, 3);
  assert.doesNotMatch(textContent(page.table()), /Draft Delta/);
  assert.equal(textContent(page.category("All Categories")), "All Categories3");
  assert.equal(textContent(page.category("Tech")), "Tech2");
  assert.equal(textContent(page.category("Culture")), "Culture1");
  assert.equal(page.categories().includes("Draft Only"), false);
  page.change(page.checkbox("Select all articles on this page"));
  page.click(page.bulkButton());
  page.render();
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.bulk, [[1, 2, 3]]);
});

test("Articles and Drafts tables and mobile cards show category with an uncategorized fallback", async () => {
  for (const status of ["published", "draft"]) {
    const page = await createPage({ status, initialArticles: [
      { ...articles[0], status, category: "  Reference  " },
      { ...articles[1], status, category: "  " },
      { ...articles[2], status, category: null },
    ] });
    const headings = Array.from(walk(page.table())).filter(({ node }) => node.type === "th").map(({ node }) => textContent(node));
    const categoryIndex = headings.indexOf("Category");
    assert.equal(categoryIndex, headings.indexOf("Title") + 1);
    assert.deepEqual(page.rows().map((row) => Array.from(walk(row))
      .filter(({ node }) => node.type === "td").map(({ node }) => textContent(node))[categoryIndex]),
    ["Reference", "Uncategorized", "Uncategorized"]);
    const mobileCards = page.find((node) => node.type === "div" && node.props.className === "divide-y divide-gray-200 lg:hidden");
    assert.match(textContent(mobileCards), /Reference/);
    assert.match(textContent(mobileCards), /Uncategorized/);
  }
});

test("editor category dropdown includes off-page categories and categories from the other status", async () => {
  const inventory = [...largeInventory(25), { ...articles[3], id: 99 }];
  inventory[24].category = "Off-page category";
  const page = await createPage({ initialArticles: inventory });
  assert.equal(page.rows().length, 20);
  assert.doesNotMatch(textContent(page.table()), /Off-page category|Draft Only/);
  assert.equal(page.calls.categoryLoads, 1);
  page.click(page.rows()[0]);
  await page.settle();
  page.click(page.button("Next Step"));
  page.render();
  const category = page.field("Category");
  assert.equal(category.type, "select");
  assert.equal(category.props.value, "existing:First page");
  const options = Array.from(walk(category)).filter(({ node }) => node.type === "option").map(({ node }) => node.props.value);
  assert.ok(options.includes("existing:Off-page category"));
  assert.ok(options.includes("existing:Draft Only"));
  assert.ok(options.includes("custom"));
  assert.ok(options.includes("none"));
});

test("existing category selections save and can be cleared in either article editor", async () => {
  for (const status of ["published", "draft"]) {
    const page = await createPage({ status });
    page.click(page.rows()[0]);
    await page.settle();
    page.click(page.button("Next Step"));
    page.render();
    page.fill(page.field("Category"), "existing:Culture");
    assert.equal(page.has((node) => node.type === "label" && textContent(node.props.children?.[0]).trim() === "Custom category"), false);
    page.click(page.button(status === "published" ? "Publish Changes" : "Save Changes"));
    await page.settle();
    assert.equal(page.calls.updated[0].payload.category, "Culture");
    assert.equal(page.field("Category").props.value, "existing:Culture");
    page.fill(page.field("Category"), "none");
    page.click(page.button(status === "published" ? "Publish Changes" : "Save Changes"));
    await page.settle();
    assert.equal(page.calls.updated[1].payload.category, null);
    assert.equal(page.field("Category").props.value, "none");
    page.click(page.button("Back To Table"));
    await page.settle();
    assert.match(textContent(page.rows()[0]), /Uncategorized/);
  }
});

test("custom category input survives editor steps and becomes reusable after saving a draft", async () => {
  const page = await createPage({ status: "draft", initialArticles: [] });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "A new category");
  page.click(page.button("Next Step"));
  page.render();
  page.customCategory("  Custom research  ");
  page.click(page.button("Previous Step"));
  page.render();
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Custom category").props.value, "  Custom research  ");
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created[0].category, "Custom research");
  assert.equal(page.field("Category").props.value, "existing:Custom research");
  page.click(page.button("Back To Table"));
  await page.settle();
  assert.match(textContent(page.rows()[0]), /Custom research/);
  page.click(page.rows()[0]);
  await page.settle();
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Category").props.value, "existing:Custom research");
});

test("imported unknown categories are prefilled as custom categories and preserved on save", async () => {
  const page = await createPage({ status: "draft" });
  chooseMarkdownFile(page, markdownFile("---\ntitle: An imported article\ncategory: Imported research\n---\nPreserved content"));
  await page.settle();
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Category").props.value, "custom");
  assert.equal(page.field("Custom category").props.value, "Imported research");
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created[0].category, "Imported research");
  assert.equal(page.calls.created[0].content, "Preserved content");
});

test("typing an existing name in custom mode keeps the input available for the rest of the category", async () => {
  const page = await createPage({ status: "draft" });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "A category with a shared prefix");
  page.click(page.button("Next Step"));
  page.render();
  page.customCategory("Tech");
  assert.equal(page.field("Category").props.value, "custom");
  assert.equal(page.field("Custom category").props.value, "Tech");
  page.fill(page.field("Custom category"), "Tech Guides");
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created[0].category, "Tech Guides");
});

test("a category-options failure keeps custom editing usable and can be retried without losing text", async () => {
  const page = await createPage({ status: "draft", categoryFailures: [new Error("Categories unavailable")] });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "Offline category options");
  page.click(page.button("Next Step"));
  page.render();
  page.find((node) => node.props.role === "alert" && /Categories unavailable/.test(textContent(node)));
  page.customCategory("Preserved custom value");
  page.click(page.button("Retry categories"));
  await page.settle();
  assert.equal(page.calls.categoryLoads, 2);
  assert.equal(page.field("Custom category").props.value, "Preserved custom value");
  assert.equal(page.has((node) => node.props.role === "alert" && /Categories unavailable/.test(textContent(node))), false);
  assert.ok(Array.from(walk(page.field("Category"))).some(({ node }) => node.type === "option" && node.props.value === "existing:Tech"));
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created[0].category, "Preserved custom value");
});

function largeInventory(count = 521) {
  return Array.from({ length: count }, (_, index) => ({ ...articles[0], id: index + 1,
    title: `Archive article ${index + 1}`, slug: `archive-${index + 1}`,
    category: index < 20 ? "First page" : "Archive" }));
}

test("large article collections load bounded pages with global category counts and page-scoped selection", async () => {
  const page = await createPage({ initialArticles: largeInventory() });
  assert.equal(page.rows().length, 20);
  assert.equal(textContent(page.category("All Categories")), "All Categories521");
  assert.equal(textContent(page.category("Archive")), "Archive501");
  assert.deepEqual(page.calls.listParams.map(({ page, size }) => ({ page, size })), [{ page: 1, size: 20 }]);
  page.change(page.checkbox("Select all articles on this page"));
  page.click(page.bulkButton());
  page.render();
  assert.match(page.modal().message, /20 selected articles/);
  page.cancel();
  page.click(page.button("Next"));
  await page.settle();
  assert.equal(page.calls.listParams.at(-1).page, 2);
  assert.equal(page.rows().length, 20);
  assert.match(textContent(page.rows()[0]), /Archive article 21/);
  assert.equal(page.checkbox("Select all articles on this page").props.checked, false);
  assert.equal(page.bulkButton().props.disabled, true);
  assert.equal(textContent(page.category("Archive")), "Archive501");
});

test("category and page-size changes query the full collection and reset the current page and selection", async () => {
  const page = await createPage({ initialArticles: largeInventory(61) });
  page.click(page.button("Next"));
  await page.settle();
  page.change(page.checkbox("Select Archive article 21"));
  const sizeControl = page.find((node) => node.type === "select" && node.props.value === 20);
  sizeControl.props.onChange({ target: { value: "50" } });
  await page.settle();
  assert.equal(page.calls.listParams.at(-1).page, 1);
  assert.equal(page.calls.listParams.at(-1).size, 50);
  assert.equal(page.rows().length, 50);
  assert.equal(page.bulkButton().props.disabled, true);
  page.click(page.button("Next"));
  await page.settle();
  page.click(page.category("First page"));
  await page.settle();
  assert.equal(page.calls.listParams.at(-1).page, 1);
  assert.equal(page.calls.listParams.at(-1).category, "First page");
  assert.equal(page.rows().length, 20);
  assert.equal(textContent(page.category("All Categories")), "All Categories61");
});

test("page size is a maximum and fifteen drafts can be browsed in smaller pages", async () => {
  const page = await createPage({ status: "draft", initialArticles: largeInventory(15).map((article) => ({ ...article, status: "draft" })) });
  page.fill(page.field("Per page"), "50");
  await page.settle();
  assert.equal(page.calls.listParams.at(-1).size, 50);
  assert.equal(page.rows().length, 15);
  page.find((node) => node.type === "p" && textContent(node) === "All 15 articles fit on this page.");
  assert.equal(page.button("Previous").props.disabled, true);
  assert.equal(page.button("Next").props.disabled, true);
  const requests = page.calls.listed;
  page.click(page.button("Previous"));
  page.click(page.button("Next"));
  await page.settle();
  assert.equal(page.calls.listed, requests);

  page.fill(page.field("Per page"), "10");
  await page.settle();
  assert.equal(page.rows().length, 10);
  assert.equal(page.has((node) => node.type === "p" && textContent(node) === "All 15 articles fit on this page."), false);
  assert.equal(page.button("Previous").props.disabled, true);
  assert.equal(page.button("Next").props.disabled, false);
  page.click(page.button("Next"));
  await page.settle();
  assert.equal(page.calls.listParams.at(-1).page, 2);
  assert.equal(page.rows().length, 5);
  assert.match(textContent(page.rows()[0]), /Archive article 11/);
  assert.equal(page.button("Previous").props.disabled, false);
  assert.equal(page.button("Next").props.disabled, true);
  page.click(page.button("Previous"));
  await page.settle();
  assert.equal(page.calls.listParams.at(-1).page, 1);
  assert.equal(page.rows().length, 10);
  assert.match(textContent(page.rows()[0]), /Archive article 1/);
});

test("debounced search finds articles outside loaded pages and clears selection before requesting", async () => {
  const page = await createPage({ initialArticles: largeInventory() });
  page.click(page.button("Next"));
  await page.settle();
  page.change(page.checkbox("Select Archive article 21"));
  const beforeSearch = page.calls.listed;
  page.fill(page.find((node) => node.props["aria-label"] === "Search published articles"), "Archive article 52");
  page.fill(page.find((node) => node.props["aria-label"] === "Search published articles"), "Archive article 521");
  assert.equal(page.calls.listed, beforeSearch);
  assert.equal(page.bulkButton().props.disabled, true);
  await page.flushSearch();
  assert.equal(page.calls.listed, beforeSearch + 1);
  assert.equal(page.calls.listParams.at(-1).page, 1);
  assert.equal(page.calls.listParams.at(-1).search, "Archive article 521");
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Archive article 521/);
  assert.equal(textContent(page.category("All Categories")), "All Categories521");
});

test("deleting the final article on the last page returns to the last available page", async () => {
  const page = await createPage({ initialArticles: largeInventory(21) });
  page.click(page.button("Next"));
  await page.settle();
  page.click(page.deleteButton("Archive article 21"));
  page.render();
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.single, [21]);
  assert.deepEqual(page.calls.listParams.map(({ page }) => page), [1, 2, 2, 1]);
  assert.equal(page.rows().length, 20);
  assert.equal(textContent(page.category("All Categories")), "All Categories20");
  assert.equal(page.button("Next").props.disabled, true);
});

test("article deep links load details independently of the current list page", async () => {
  const page = await createPage({ initialArticles: largeInventory(), search: "?article=521" });
  assert.deepEqual(page.calls.edited, [521]);
  page.find((node) => node.type === "input" && node.props.value === "Archive article 521");
  page.click(page.button("Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 20);
  assert.doesNotMatch(textContent(page.table()), /Archive article 521/);
  assert.equal(page.calls.listParams.at(-1).page, 1);
});

test("saving a published article as draft removes its row and resets its emptied category", async () => {
  const page = await createPage();
  page.click(page.category("Culture"));
  await page.settle();
  page.click(page.rows()[0]);
  await page.settle();
  // Empty content keeps this status transition test independent of DOM parsing.
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Next Step"));
  page.render();
  page.find((node) => node.type === "select" && node.props.value === "published").props.onChange({ target: { value: "draft" } });
  page.render();
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Save Changes"));
  await page.settle();
  assert.equal(page.calls.updated[0].id, 3);
  assert.equal(page.calls.updated[0].payload.status, "draft");
  assert.equal(page.toast().message, "Article updated successfully.");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 2);
  assert.doesNotMatch(textContent(page.table()), /Gamma|draft/);
  assert.equal(textContent(page.category("All Categories")), "All Categories2");
  assert.equal(page.categories().includes("Culture"), false);
  page.find((node) => node.type === "p" && /All Categories/.test(textContent(node)));
});

test("the existing article deep link still opens a draft editor without including it in the published table", async () => {
  const page = await createPage({ search: "?article=4" });
  await page.settle();
  assert.deepEqual(page.calls.listStatuses, ["published"]);
  assert.deepEqual(page.calls.edited, [4]);
  page.find((node) => node.type === "input" && node.props.value === "Draft Delta");
  page.find((node) => node.type === "button" && textContent(node) === "Save Changes");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 3);
  assert.doesNotMatch(textContent(page.table()), /Draft Delta/);
});

test("publishing a draft opened by its article deep link reloads the published table and its category counts", async () => {
  const page = await createPage({ search: "?article=4" });
  await page.settle();
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Next Step"));
  page.render();
  page.find((node) => node.type === "select" && node.props.value === "draft").props.onChange({ target: { value: "published" } });
  page.render();
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Publish Changes"));
  await page.settle();
  await page.settle();
  assert.equal(page.calls.updated[0].id, 4);
  assert.equal(page.calls.updated[0].payload.status, "published");
  assert.deepEqual(page.calls.listStatuses, ["published", "published"]);
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 4);
  assert.match(textContent(page.table()), /Draft Delta/);
  assert.equal(textContent(page.category("All Categories")), "All Categories4");
  assert.equal(textContent(page.category("Draft Only")), "Draft Only1");
  page.click(page.category("Draft Only"));
  await page.settle();
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Draft Delta/);
});

test("Drafts filters its rows and category counts by status even if the API returns published articles", async () => {
  const page = await createPage({ status: "draft", unfilteredList: true });
  assert.deepEqual(page.calls.listStatuses, ["draft"]);
  assert.equal(page.shell().title, "Drafts");
  assert.equal(page.table().props["aria-label"], "Drafted articles");
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Draft Delta/);
  assert.doesNotMatch(textContent(page.table()), /Alpha|Beta|Gamma/);
  assert.equal(textContent(page.category("All Categories")), "All Categories1");
  assert.equal(textContent(page.category("Draft Only")), "Draft Only1");
  assert.equal(page.categories().includes("Tech"), false);
});

test("Draft rows open and close the full article editor inside Drafts", async () => {
  const sidebarExtra = { type: "a", props: { href: "/topics", children: "Manage topics and research" } };
  const page = await createPage({ status: "draft", sidebarExtra });
  page.find((node) => node.props.href === "/topics");
  page.click(page.rows()[0]);
  await page.settle();
  assert.deepEqual(page.calls.edited, [4]);
  assert.equal(page.shell().title, "Drafts");
  assert.equal(page.location.pathname, "/draft");
  page.find((node) => node.type === "input" && node.props.value === "Draft Delta");
  page.find((node) => node.props["aria-label"] === "Article content");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Next Step"));
  page.render();
  page.find((node) => node.type === "select" && node.props.value === "draft");
  page.find((node) => node.type === "button" && textContent(node) === "Save Changes");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.shell().title, "Drafts");
  assert.equal(page.rows().length, 1);
  assert.equal(page.location.pathname, "/draft");
});

test("New draft opens a blank editor within Drafts and leaving it creates nothing", async () => {
  const published = await createPage();
  assert.equal(published.has((node) => node.type === "button" && /^New draft$/i.test(textContent(node))), false);

  const page = await createPage({ status: "draft" });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  assert.equal(page.shell().title, "Drafts");
  assert.equal(page.location.pathname, "/draft");
  assert.equal(page.field("Title").props.value, "");
  assert.equal(page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML, "");
  page.button("Save Draft");
  assert.deepEqual(page.calls.created, []);
  assert.deepEqual(page.calls.edited, []);
  page.fill(page.field("Title"), "Unsaved title");
  page.click(page.button("Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 1);
  assert.deepEqual(page.calls.created, []);
  page.click(page.button(/^New draft$/i));
  await page.settle();
  assert.equal(page.field("Title").props.value, "");
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Slug").props.value, "");
  assert.equal(page.field("Status").props.value, "draft");
  assert.equal(page.disabled(page.field("Status")), true);
});

test("manual drafts generate slugs from titles until the slug is edited", async () => {
  const page = await createPage({ status: "draft" });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "  A Fresh Draft!  ");
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Slug").props.value, "a-fresh-draft");
  page.fill(page.field("Slug"), "custom-manual-slug");
  page.click(page.button("Previous Step"));
  page.render();
  page.fill(page.field("Title"), "A Changed Draft");
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Slug").props.value, "custom-manual-slug");
  assert.deepEqual(page.calls.created, []);
});

test("manual draft validation blocks missing title, slug, and host site", async () => {
  const page = await createPage({ status: "draft" });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.click(page.button("Save Draft"));
  page.render();
  assert.equal(page.toast().message, "Title is required.");
  assert.deepEqual(page.calls.created, []);
  page.fill(page.field("Title"), "New draft");
  page.click(page.button("Next Step"));
  page.render();
  page.fill(page.field("Slug"), "   ");
  page.click(page.button("Save Draft"));
  page.render();
  assert.equal(page.toast().message, "Slug is required.");
  assert.deepEqual(page.calls.created, []);
  page.fill(page.field("Slug"), "new-draft");
  page.fill(page.field("Host Site"), "   ");
  page.click(page.button("Save Draft"));
  page.render();
  assert.equal(page.toast().message, "Host site is required.");
  assert.deepEqual(page.calls.created, []);
  page.fill(page.field("Host Site"), "explainit.tech");
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created.length, 1);
  assert.equal(page.calls.created[0].content, "");
  assert.equal(page.calls.created[0].status, "draft");
});

test("an empty Drafts page can create its first manual draft with rich text preserved across steps", async () => {
  const html = "<p>A <strong>handwritten</strong> story.</p>";
  const text = (textContent) => ({ nodeType: 3, textContent });
  const element = (tagName, childNodes) => ({ nodeType: 1, tagName, childNodes });
  let parsed = 0;
  const editorDocument = {
    createElement: (tagName) => {
      assert.equal(tagName, "div");
      return {
        set innerHTML(value) {
          // Stand in for browser parsing; conversion still uses the real manager.
          assert.equal(value, html);
          parsed += 1;
          this.childNodes = [element("P", [text("A "), element("STRONG", [text("handwritten")]), text(" story.")])];
        },
      };
    },
  };
  const page = await createPage({ status: "draft", initialArticles: [], editorDocument });
  assert.equal(textContent(page.category("All Categories")), "All Categories0");
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "First manual draft");
  const editor = page.find((node) => node.props["aria-label"] === "Article content");
  editor.props.ref.current.innerHTML = html;
  editor.props.onInput();
  page.click(page.button("Next Step"));
  page.render();
  page.customCategory("Handwritten");
  page.click(page.button("Previous Step"));
  page.render();
  assert.equal(page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML, html);
  page.click(page.button("Next Step"));
  page.render();
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(parsed, 1);
  assert.equal(page.calls.created.length, 1);
  assert.equal(page.calls.created[0].content, "A **handwritten** story.");
  page.click(page.button("Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /First manual draft/);
  assert.equal(textContent(page.category("Handwritten")), "Handwritten1");
});

test("a manually saved draft preserves Markdown and metadata, appears in the table, and reopens for updates", async () => {
  const page = await createPage({ status: "draft" });
  page.click(page.category("Draft Only"));
  await page.settle();
  page.fill(page.find((node) => node.props["aria-label"] === "Search drafted articles"), "Delta");
  await page.flushSearch();
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "  Manual story  ");
  // Use Markdown editing to verify content without replacing the browser DOM parser.
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.fill(page.find((node) => node.type === "input" && node.props.type === "checkbox" && typeof node.props.checked === "boolean"), true);
  const content = "# Manual story\n\nA **handwritten** draft.\n\n```mermaid\ngraph LR\n A-->B\n```";
  page.fill(page.find((node) => node.props["aria-label"] === "Article Markdown"), content);
  page.click(page.button("Next Step"));
  page.render();
  page.fill(page.field("Slug"), "manual-story-custom");
  page.customCategory("  Handwritten  ");
  page.fill(page.field("SEO Title"), "Manual story SEO");
  page.fill(page.field("Tags (comma separated)"), "manual, editing");
  page.fill(page.field("Keywords (comma separated)"), "story, draft");
  page.fill(page.field("Excerpt"), "Written from the admin page");
  page.fill(page.field("Meta Description"), "An editor-created story");
  page.click(page.button("Save Draft"));
  await page.settle();
  const [created] = page.calls.created;
  assert.equal(created.title, "Manual story");
  assert.equal(created.slug, "manual-story-custom");
  assert.equal(created.status, "draft");
  assert.equal(created.content, content);
  assert.equal(created.category, "Handwritten");
  assert.equal(created.seo_title, "Manual story SEO");
  assert.deepEqual(Array.from(created.tags), ["manual", "editing"]);
  assert.deepEqual(Array.from(created.keywords), ["story", "draft"]);
  assert.equal(created.excerpt, "Written from the admin page");
  assert.equal(created.meta_description, "An editor-created story");
  assert.equal(page.toast().type, "success");
  page.button("Save Changes");
  assert.equal(page.disabled(page.field("Status")), false);
  page.click(page.button("Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 2);
  assert.equal(page.find((node) => node.props["aria-label"] === "Search drafted articles").props.value, "");
  assert.equal(textContent(page.category("All Categories")), "All Categories2");
  assert.equal(textContent(page.category("Handwritten")), "Handwritten1");
  const row = page.rows().find((node) => /Manual story/.test(textContent(node)));
  assert.ok(row);
  page.click(row);
  await page.settle();
  assert.equal(page.field("Title").props.value, "Manual story");
  assert.equal(page.find((node) => node.props["aria-label"] === "Article Markdown").props.value, content);
  page.fill(page.field("Title"), "Manual story revised");
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.click(page.button("Save Changes"));
  await page.settle();
  assert.equal(page.calls.created.length, 1);
  assert.equal(page.calls.updated.length, 1);
  assert.equal(page.calls.updated[0].id, 5);
  assert.equal(page.calls.updated[0].payload.title, "Manual story revised");
  assert.equal(page.calls.updated[0].payload.content, content);
  assert.equal(page.location.pathname, "/draft");
});

test("failed manual draft creation retains entered content and metadata for retry", async () => {
  const page = await createPage({ status: "draft", createFailures: [new Error("A draft with this slug already exists.")] });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "Retry draft");
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.fill(page.find((node) => node.type === "input" && node.props.type === "checkbox"), true);
  page.fill(page.find((node) => node.props["aria-label"] === "Article Markdown"), "Preserved draft body");
  page.click(page.button("Next Step"));
  page.render();
  page.customCategory("Original category");
  page.fill(page.field("Slug"), "already-exists");
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.toast().type, "error");
  assert.equal(page.toast().message, "A draft with this slug already exists.");
  assert.equal(page.field("Slug").props.value, "already-exists");
  assert.equal(page.field("Custom category").props.value, "Original category");
  page.fill(page.field("Slug"), "retry-draft-unique");
  page.click(page.button("Previous Step"));
  page.render();
  assert.equal(page.field("Title").props.value, "Retry draft");
  assert.equal(page.find((node) => node.props["aria-label"] === "Article Markdown").props.value, "Preserved draft body");
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created.length, 2);
  assert.equal(page.calls.created[1].slug, "retry-draft-unique");
  assert.equal(page.calls.created[1].category, "Original category");
  assert.equal(page.calls.created[1].content, "Preserved draft body");
  page.button("Save Changes");
});

test("pending manual draft creation blocks navigation, edits, and duplicate saves before rerender", async () => {
  let resolveCreation;
  const createPromise = new Promise((resolve) => { resolveCreation = resolve; });
  const page = await createPage({ status: "draft", createPromise });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "Pending draft");
  const save = page.button("Save Draft").props.onClick;
  save();
  save();
  page.render();
  assert.equal(page.calls.created.length, 1);
  assert.equal(page.button("Saving...").props.disabled, true);
  assert.equal(page.button("Back To Table").props.disabled, true);
  assert.equal(page.button("Next Step").props.disabled, true);
  assert.equal(page.disabled(page.field("Title")), true);
  assert.equal(page.find((node) => node.props["aria-label"] === "Article content").props.contentEditable, false);
  page.click(page.button("Back To Table"));
  page.fill(page.field("Title"), "Should remain pending");
  assert.equal(page.field("Title").props.value, "Pending draft");
  resolveCreation({ ...page.calls.created[0], id: 5, status: "draft", created_at: null, updated_at: null });
  await page.settle();
  assert.equal(page.calls.created.length, 1);
  assert.equal(page.field("Title").props.value, "Pending draft");
  page.button("Save Changes");
  page.click(page.button("Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 2);
});

test("Markdown upload is available in the Drafts list and new editor, and opens the file picker", async () => {
  const published = await createPage();
  assert.equal(published.has((node) => node.type === "button" && textContent(node) === "Upload Markdown"), false);
  assert.equal(published.has((node) => node.props["aria-label"] === "Upload Markdown draft"), false);
  const page = await createPage({ status: "draft" });
  const input = page.find((node) => node.props["aria-label"] === "Upload Markdown draft");
  assert.equal(input.props.type, "file");
  assert.equal(input.props.hidden, true);
  assert.match(input.props.accept, /\.md,\.markdown/);
  page.find((node) => node.type === "a" && node.props.href === "/examples/draft-template.md" && node.props.download);
  page.click(page.button("Upload Markdown"));
  assert.equal(page.calls.filePickers, 1);
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.click(page.button("Upload Markdown"));
  assert.equal(page.calls.filePickers, 2);
  page.click(page.button("Back To Table"));
  await page.settle();
  page.click(page.rows()[0]);
  await page.settle();
  assert.equal(page.has((node) => node.type === "button" && textContent(node) === "Upload Markdown"), false);
  // Even a delivered input event cannot replace an existing article.
  chooseMarkdownFile(page, markdownFile("# Unexpected replacement"));
  await page.settle();
  assert.equal(page.field("Title").props.value, "Draft Delta");
  assert.deepEqual(page.calls.created, []);
});

test("Markdown front matter fills editable metadata and saves only its body as a draft after review", async () => {
  const page = await createPage({ status: "draft", initialArticles: [] });
  const body = "# Uploaded article\n\nA **complete** article.\n\n```mermaid\ngraph LR\n  A-->B\n```\n";
  const source = "\uFEFF" + [
    "---", 'title: "Uploaded article"', "slug: uploaded-custom", "status: published", "id: 999", "author_id: 888", "created_at: 2020-01-01",
    'seo_title: "Uploaded SEO"', "category: Technology", "subcategory: Guides", 'tags: ["data, science", "analysis"]',
    'keywords: [\'a "quoted" phrase\', "file, import"]', "host_site: explainit.tech", "language: en", "excerpt: Imported excerpt",
    "reading_time: 17", "is_featured: true", "meta_description: Imported description", "canonical_url: https://explainit.tech/uploaded-custom",
    "schema_type: BlogPosting", "open_graph_title: Social title", "open_graph_description: Social description",
    "open_graph_image: https://example.com/social.png", "featured_image_url: https://example.com/hero.png", "image_alt_text: Diagram of the process", "---",
  ].join("\r\n") + "\r\n" + body.replace(/\n/g, "\r\n");
  const input = chooseMarkdownFile(page, markdownFile(source, "article.MARKDOWN"));
  assert.equal(input.value, "", "Clear the input so choosing the same file can fire another change");
  await page.settle();
  assert.deepEqual(page.calls.created, [], "Importing must not create a server draft before review");
  assert.equal(page.field("Title").props.value, "Uploaded article");
  assert.equal(page.find((node) => node.props["aria-label"] === "Article Markdown").props.value, body);
  assert.equal(page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML, "");
  const feedback = textContent(page.find((node) => node.props.role === "status"));
  assert.match(feedback, /Loaded article\.MARKDOWN/);
  assert.match(feedback, /Ignored metadata fields: status, id, author_id, created_at\./);
  page.fill(page.field("Title"), "Reviewed article");
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Slug").props.value, "uploaded-custom");
  assert.equal(page.field("Status").props.value, "draft");
  assert.equal(page.disabled(page.field("Status")), true);
  assert.equal(page.field("Reading Time (minutes)").props.value, "17");
  assert.equal(page.field("Tags (comma separated)").props.value, '"data, science", analysis');
  assert.equal(page.field("Keywords (comma separated)").props.value, '"a ""quoted"" phrase", "file, import"');
  page.customCategory("Reviewed category");
  assert.deepEqual(page.calls.created, []);
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created.length, 1);
  const created = page.calls.created[0];
  assert.equal(created.title, "Reviewed article");
  assert.equal(created.slug, "uploaded-custom");
  assert.equal(created.status, "draft");
  assert.equal(created.content, body);
  assert.equal(created.reading_time, 17);
  assert.equal(created.category, "Reviewed category");
  assert.equal(created.subcategory, "Guides");
  assert.deepEqual(Array.from(created.tags), ["data, science", "analysis"]);
  assert.deepEqual(Array.from(created.keywords), ['a "quoted" phrase', "file, import"]);
  for (const [field, expected] of Object.entries({
    seo_title: "Uploaded SEO", host_site: "explainit.tech", language: "en", excerpt: "Imported excerpt", is_featured: true,
    meta_description: "Imported description", canonical_url: "https://explainit.tech/uploaded-custom", schema_type: "BlogPosting",
    open_graph_title: "Social title", open_graph_description: "Social description", open_graph_image: "https://example.com/social.png",
    featured_image_url: "https://example.com/hero.png", image_alt_text: "Diagram of the process",
  })) assert.equal(created[field], expected, field);
  for (const systemField of ["id", "author_id", "created_at"]) assert.equal(Object.hasOwn(created, systemField), false);
  assert.equal(page.toast().message, "Draft created successfully.");
  page.button("Save Changes");
  assert.equal(page.field("Reading Time (minutes)").props.value, "17");
  page.fill(page.field("Status"), "published");
  page.click(page.button("Publish Changes"));
  await page.settle();
  assert.equal(page.calls.updated.length, 1);
  assert.equal(page.calls.updated[0].payload.status, "published");
  assert.equal(page.calls.updated[0].payload.reading_time, 17);
  assert.equal(page.calls.updated[0].payload.content, body);
});

test("plain Markdown imports derive a title and slug and remain unsaved until Save Draft", async () => {
  const page = await createPage({ status: "draft" });
  chooseMarkdownFile(page, markdownFile("# Plain Markdown\n\nBody without front matter.\n"));
  await page.settle();
  assert.equal(page.field("Title").props.value, "Plain Markdown");
  page.click(page.button("Next Step"));
  page.render();
  assert.equal(page.field("Slug").props.value, "plain-markdown");
  assert.equal(page.field("Host Site").props.value, "explainit.tech");
  assert.equal(page.field("Reading Time (minutes)").props.value, "");
  assert.deepEqual(page.calls.created, []);
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created[0].content, "# Plain Markdown\n\nBody without front matter.\n");
  assert.equal(Object.hasOwn(page.calls.created[0], "reading_time"), false);
});

test("reopening an imported draft preserves full Markdown during a metadata-only save", async () => {
  const page = await createPage({ status: "draft", initialArticles: [] });
  const body = [
    "# Markdown features", "", "![Process diagram](https://example.com/process.png)", "",
    "> A quoted observation.", ">", "> Its second paragraph.", "", "- Parent item", "  - Nested item", "",
    "~~~python", 'print("preserve this fence")', "~~~", "",
  ].join("\n");
  chooseMarkdownFile(page, markdownFile("---\ntitle: Markdown features\ncategory: Original category\n---\n" + body));
  await page.settle();
  page.click(page.button("Save Draft"));
  await page.settle();
  assert.equal(page.calls.created.length, 1);
  assert.equal(page.calls.created[0].content, body);
  page.click(page.button("Back To Table"));
  await page.settle();
  page.click(page.rows()[0]);
  await page.settle();
  assert.equal(page.find((node) => node.props["aria-label"] === "Article Markdown").props.value, body);
  page.click(page.button("Next Step"));
  page.render();
  page.customCategory("Reviewed category");
  page.click(page.button("Save Changes"));
  await page.settle();
  assert.equal(page.calls.created.length, 1);
  assert.equal(page.calls.updated.length, 1);
  assert.equal(page.calls.updated[0].payload.category, "Reviewed category");
  assert.equal(page.calls.updated[0].payload.content, body);
});

test("invalid Markdown files preserve the existing form and allow choosing the same file again", async () => {
  const page = await createPage({ status: "draft" });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "Keep this title");
  page.fill(page.find((node) => node.type === "input" && node.props.type === "checkbox"), true);
  page.fill(page.find((node) => node.props["aria-label"] === "Article Markdown"), "Keep this body");
  let wrongExtensionReads = 0;
  let oversizedReads = 0;
  const malformed = markdownFile("---\ntitle: [broken\n---\nBody", "retry.md");
  const cases = [
    [malformed, /YAML front matter is invalid/],
    [markdownFile("# Too large", "large.md", { size: 2 * 1024 * 1024 + 1, arrayBuffer: async () => { oversizedReads += 1; return new ArrayBuffer(0); } }), /2 MiB or smaller/],
    [markdownFile("# Wrong type", "article.txt", { arrayBuffer: async () => { wrongExtensionReads += 1; return new ArrayBuffer(0); } }), /ending in \.md or \.markdown/],
    [markdownFile("# Unreadable", "unreadable.md", { arrayBuffer: async () => { throw new Error("The file could not be read."); } }), /The file could not be read/],
    [markdownFile("invalid", "invalid-utf8.md", { arrayBuffer: async () => Uint8Array.from([0x23, 0x20, 0xff]).buffer }), /UTF-8/],
  ];
  for (const [file, expected] of cases) {
    const input = chooseMarkdownFile(page, file);
    assert.equal(input.value, "");
    await page.settle();
    assert.match(textContent(page.find((node) => node.props.role === "alert")), expected);
    assert.equal(page.field("Title").props.value, "Keep this title");
    assert.equal(page.find((node) => node.props["aria-label"] === "Article Markdown").props.value, "Keep this body");
    assert.equal(page.button("Save Draft").props.disabled, false);
    assert.deepEqual(page.calls.created, []);
  }
  assert.equal(wrongExtensionReads, 0);
  assert.equal(oversizedReads, 0);
  chooseMarkdownFile(page, markdownFile("# Retried file\n\nRead successfully.", malformed.name));
  await page.settle();
  assert.equal(page.has((node) => node.props.role === "alert"), false);
  assert.equal(page.field("Title").props.value, "Retried file");
  assert.deepEqual(page.calls.created, []);
});

test("a pending Markdown read blocks saves, navigation, edits, and duplicate imports before rerender", async () => {
  let resolveRead;
  let reads = 0;
  const readPromise = new Promise((resolve) => { resolveRead = resolve; });
  const page = await createPage({ status: "draft" });
  page.click(page.button(/^New draft$/i));
  await page.settle();
  page.fill(page.field("Title"), "Existing unsaved draft");
  const onChange = page.find((node) => node.props["aria-label"] === "Upload Markdown draft").props.onChange;
  const save = page.button("Save Draft").props.onClick;
  const back = page.button("Back To Table").props.onClick;
  const editTitle = page.field("Title").props.onChange;
  const file = markdownFile("ignored until resolved", "pending.md", { arrayBuffer: () => { reads += 1; return readPromise; } });
  const first = chooseMarkdownFile(page, file, onChange);
  const duplicate = chooseMarkdownFile(page, file, onChange);
  save();
  back();
  editTitle({ target: { value: "Must not overwrite" } });
  assert.equal(first.value, "");
  assert.equal(duplicate.value, "");
  assert.equal(reads, 1);
  assert.deepEqual(page.calls.created, []);
  page.render();
  assert.equal(page.field("Title").props.value, "Existing unsaved draft");
  assert.equal(page.disabled(page.field("Title")), true);
  assert.equal(page.button("Save Draft").props.disabled, true);
  assert.equal(page.button("Back To Table").props.disabled, true);
  assert.equal(page.button("Next Step").props.disabled, true);
  assert.equal(page.button("Reading Markdown...").props.disabled, true);
  assert.equal(page.find((node) => node.props["aria-label"] === "Article content").props.contentEditable, false);
  resolveRead(await markdownFile("# Finished read\n\nImported after reading.").arrayBuffer());
  await page.settle();
  assert.equal(page.field("Title").props.value, "Finished read");
  assert.equal(page.button("Save Draft").props.disabled, false);
  assert.equal(reads, 1);
  assert.deepEqual(page.calls.created, []);
});

test("imported raw HTML is escaped when the user switches to the rich text editor", async () => {
  const page = await createPage({ status: "draft" });
  const source = '# HTML sample\n\n<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>\n\n<strong>Example markup</strong>';
  chooseMarkdownFile(page, markdownFile(source));
  await page.settle();
  assert.equal(page.find((node) => node.props["aria-label"] === "Article Markdown").props.value, source);
  const sourceToggle = page.find((node) => node.type === "input" && node.props.type === "checkbox" && node.props.checked === true);
  page.fill(sourceToggle, false);
  const html = page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML;
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(html, /&lt;strong&gt;Example markup&lt;\/strong&gt;/);
  assert.doesNotMatch(html, /<(?:img|script|strong)\b/i);
  assert.deepEqual(page.calls.created, []);
});

test("saving an edited draft keeps it in the Drafts table", async () => {
  const page = await createPage({ status: "draft" });
  page.click(page.rows()[0]);
  await page.settle();
  page.find((node) => node.type === "input" && node.props.value === "Draft Delta").props.onChange({ target: { value: "Updated Draft Delta" } });
  page.render();
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Save Changes"));
  await page.settle();
  assert.equal(page.calls.updated[0].id, 4);
  assert.equal(page.calls.updated[0].payload.status, "draft");
  assert.equal(page.calls.updated[0].payload.title, "Updated Draft Delta");
  assert.equal(page.toast().type, "success");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Updated Draft Delta/);
  assert.equal(textContent(page.category("Draft Only")), "Draft Only1");
});

test("publishing from Drafts removes the draft, its selection, and its emptied category without leaving Drafts", async () => {
  const page = await createPage({ status: "draft" });
  page.click(page.category("Draft Only"));
  await page.settle();
  page.change(page.checkbox("Select Draft Delta"));
  page.click(page.rows()[0]);
  await page.settle();
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Next Step"));
  page.render();
  page.find((node) => node.type === "select" && node.props.value === "draft").props.onChange({ target: { value: "published" } });
  page.render();
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Publish Changes"));
  await page.settle();
  assert.equal(page.calls.updated[0].id, 4);
  assert.equal(page.calls.updated[0].payload.status, "published");
  assert.equal(page.shell().title, "Drafts");
  assert.equal(page.location.pathname, "/draft");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(textContent(page.category("All Categories")), "All Categories0");
  assert.equal(page.categories().includes("Draft Only"), false);
  assert.equal(page.bulkButton().props.disabled, true);
  page.find((node) => node.props["aria-live"] === "polite" && textContent(node) === "0 selected");
  page.find((node) => node.type === "p" && /All Categories/.test(textContent(node)));
});

test("Draft deep links load the editor and return to the Drafts table", async () => {
  const page = await createPage({ status: "draft", search: "?article=4" });
  await page.settle();
  assert.deepEqual(page.calls.listStatuses, ["draft"]);
  assert.deepEqual(page.calls.edited, [4]);
  assert.equal(page.shell().title, "Drafts");
  page.find((node) => node.type === "input" && node.props.value === "Draft Delta");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Draft Delta/);
  assert.equal(page.location.pathname, "/draft");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Refresh"));
  await page.settle();
  assert.deepEqual(page.calls.edited, [4]);
  assert.equal(page.rows().length, 1);
});

const draftInventory = [
  ...articles,
  { ...articles[3], id: 5, title: "Draft Echo", slug: "draft-echo" },
  { ...articles[3], id: 6, title: "Draft Foxtrot", slug: "draft-foxtrot", category: "Other Drafts" },
];

test("Draft search limits visible selection and refresh keeps the draft filter", async () => {
  let sidebarRefreshes = 0;
  const page = await createPage({ status: "draft", initialArticles: draftInventory, onRefresh: () => { sidebarRefreshes += 1; } });
  page.find((node) => node.props["aria-label"] === "Search drafted articles").props.onChange({ target: { value: "draft-echo" } });
  await page.flushSearch();
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Draft Echo/);
  page.change(page.checkbox("Select all articles on this page"));
  page.click(page.bulkButton());
  page.render();
  assert.match(page.modal().message, /Draft Echo/);
  page.cancel();
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Refresh"));
  await page.settle();
  assert.deepEqual(page.calls.listStatuses, ["draft", "draft", "draft"]);
  assert.equal(sidebarRefreshes, 1);
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Draft Echo/);
});

test("Draft row deletion uses the single endpoint and preserves other draft selection", async () => {
  const page = await createPage({ status: "draft", initialArticles: draftInventory });
  page.change(page.checkbox("Select Draft Echo"));
  page.click(page.deleteButton("Draft Delta"));
  page.render();
  assert.match(page.modal().message, /Draft Delta/);
  assert.deepEqual(page.calls.edited, []);
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.single, [4]);
  assert.deepEqual(page.calls.bulk, []);
  assert.equal(page.rows().length, 2);
  assert.equal(page.checkbox("Select Draft Echo").props.checked, true);
  assert.equal(textContent(page.category("Draft Only")), "Draft Only1");
  assert.equal(textContent(page.category("All Categories")), "All Categories2");
});

test("Draft bulk deletion targets only the visible draft category and resets its emptied category", async () => {
  const page = await createPage({ status: "draft", initialArticles: draftInventory });
  page.click(page.category("Draft Only"));
  await page.settle();
  page.change(page.checkbox("Select all articles on this page"));
  page.click(page.bulkButton());
  page.render();
  assert.match(page.modal().message, /2 selected articles/);
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.single, []);
  assert.deepEqual(page.calls.bulk, [[4, 5]]);
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Draft Foxtrot/);
  assert.equal(page.categories().includes("Draft Only"), false);
  assert.equal(textContent(page.category("All Categories")), "All Categories1");
  assert.equal(page.bulkButton().props.disabled, true);
  assert.equal(page.shell().title, "Drafts");
});

test("article list failures show the API error and can be retried", async () => {
  const page = await createPage({ listFailures: [new Error("The API request timed out.")] });
  const alert = page.find((node) => node.props.role === "alert");
  assert.match(textContent(alert), /The API request timed out\./);
  assert.equal(page.calls.listed, 1);
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Retry"));
  await page.settle();
  assert.equal(page.calls.listed, 2);
  assert.equal(page.rows().length, 3);
});

test("article detail failures show a persistent error with retry and back controls", async () => {
  const page = await createPage({ articleFailures: [new Error("Unable to reach the API.")] });
  page.click(page.rows()[0]);
  await page.settle();
  assert.match(textContent(page.find((node) => node.props.role === "alert")), /Unable to reach the API\./);
  page.find((node) => node.type === "button" && textContent(node) === "Back To Table");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Retry"));
  await page.settle();
  assert.deepEqual(page.calls.edited, [1, 1]);
  page.find((node) => node.props["aria-label"] === "Article content");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.rows().length, 3);
});

test("selection supports partial, all, none, and clears when category changes", async () => {
  const page = await createPage();
  const all = () => page.checkbox("Select all articles on this page");
  assert.equal(page.bulkButton().props.disabled, true);
  page.change(page.checkbox("Select Alpha"));
  assert.equal(all().props.checked, false);
  assert.equal(all().props.ref.current.indeterminate, true);
  assert.equal(page.bulkButton().props.disabled, false);

  page.change(all());
  assert.equal(all().props.checked, true);
  assert.equal(all().props.ref.current.indeterminate, false);
  for (const title of ["Alpha", "Beta", "Gamma"]) assert.equal(page.checkbox(`Select ${title}`).props.checked, true);
  page.change(all());
  assert.equal(page.bulkButton().props.disabled, true);

  page.change(page.checkbox("Select Alpha"));
  page.click(page.category("Culture"));
  await page.settle();
  assert.equal(page.rows().length, 1);
  assert.equal(page.bulkButton().props.disabled, true);
  page.change(all());
  assert.equal(page.checkbox("Select Gamma").props.checked, true);
  page.click(page.category("All Categories"));
  await page.settle();
  assert.equal(page.rows().length, 3);
  assert.equal(page.checkbox("Select Alpha").props.checked, false);
  assert.equal(page.checkbox("Select Gamma").props.checked, false);
});

test("cancelled deletion keeps articles and selection without sending a request", async () => {
  const page = await createPage();
  page.change(page.checkbox("Select Alpha"));
  page.click(page.bulkButton());
  await page.settle();
  assert.equal(page.modal().open, true);
  assert.match(page.modal().title, /Delete Article/i);
  assert.match(page.modal().message, /Alpha/);
  assert.match(page.modal().message, /comments/i);
  assert.match(page.modal().message, /cannot be undone/i);
  assert.deepEqual(page.calls.single, []);
  assert.deepEqual(page.calls.bulk, []);
  page.cancel();
  assert.equal(page.modal().open, false);
  assert.equal(page.rows().length, 3);
  assert.equal(page.checkbox("Select Alpha").props.checked, true);
  assert.equal(page.checkbox("Select Alpha").props.disabled, false);
  assert.equal(page.bulkButton().props.disabled, false);
});

test("row delete uses the single endpoint, removes its article, and preserves other selection", async () => {
  const page = await createPage();
  page.change(page.checkbox("Select Alpha"));
  page.click(page.deleteButton("Beta"));
  page.render();
  assert.equal(page.modal().open, true);
  assert.match(page.modal().message, /Beta/);
  assert.deepEqual(page.calls.single, []);
  page.confirm();
  await page.settle();
  assert.equal(page.modal().open, false);
  assert.deepEqual(page.calls.single, [2]);
  assert.deepEqual(page.calls.bulk, []);
  assert.equal(page.rows().length, 2);
  assert.equal(page.checkbox("Select Alpha").props.checked, true);
  assert.equal(page.toast().type, "success");
  assert.equal(page.toast().message, "1 article deleted successfully.");
  assert.equal(textContent(page.category("All Categories")), "All Categories2");
  assert.equal(textContent(page.category("Tech")), "Tech1");
  assert.equal(textContent(page.category("Culture")), "Culture1");
  assert.deepEqual(page.calls.edited, []);
});

test("bulk delete targets the visible category and resets a category emptied by deletion", async () => {
  const page = await createPage();
  page.click(page.category("Tech"));
  await page.settle();
  page.change(page.checkbox("Select all articles on this page"));
  page.click(page.bulkButton());
  page.render();
  assert.equal(page.modal().open, true);
  assert.match(page.modal().title, /Delete Articles/i);
  assert.match(page.modal().message, /2 selected articles/);
  assert.match(page.modal().message, /comments/i);
  assert.match(page.modal().message, /cannot be undone/i);
  assert.match(page.modal().confirmText, /Delete 2 Articles/i);
  assert.deepEqual(page.calls.bulk, []);
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.single, []);
  assert.deepEqual(page.calls.bulk, [[1, 2]]);
  assert.equal(page.modal().open, false);
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Gamma/);
  assert.equal(page.checkbox("Select Gamma").props.checked, false);
  assert.equal(page.bulkButton().props.disabled, true);
  assert.equal(page.toast().message, "2 articles deleted successfully.");
  assert.ok(page.find((node) => node.type === "p" && /All Categories/.test(textContent(node))));
});

test("an open confirmation keeps the original deletion targets and blocks selection, category, and editor changes", async () => {
  const page = await createPage();
  page.change(page.checkbox("Select Alpha"));
  page.change(page.checkbox("Select Beta"));
  page.click(page.bulkButton());
  page.render();
  assert.equal(page.modal().open, true);
  assert.equal(page.checkbox("Select Gamma").props.disabled, true);
  assert.equal(page.category("Culture").props.disabled, true);
  assert.equal(page.deleteButton("Gamma").props.disabled, true);
  // Exercise the guards even if an old event is delivered after the dialog opens.
  page.checkbox("Select Alpha").props.onChange();
  page.checkbox("Select Gamma").props.onChange();
  page.category("Culture").props.onClick();
  page.click(page.rows()[2]);
  assert.equal(page.rows()[2].props["aria-disabled"], true);
  assert.equal(page.rows()[2].props.tabIndex, -1);
  page.key(page.rows()[2], "Enter");
  page.key(page.rows()[2], " ");
  page.deleteButton("Gamma").props.onClick({ stopPropagation() {} });
  page.render();
  assert.equal(page.checkbox("Select Alpha").props.checked, true);
  assert.equal(page.checkbox("Select Beta").props.checked, true);
  assert.equal(page.checkbox("Select Gamma").props.checked, false);
  assert.equal(page.rows().length, 3);
  assert.deepEqual(page.calls.edited, []);
  assert.match(page.modal().message, /2 selected articles/);
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.bulk, [[1, 2]]);
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Gamma/);
});

test("pending deletion disables controls and prevents repeated requests before a render", async () => {
  let resolveDeletion;
  const deletePromise = new Promise((resolve) => { resolveDeletion = resolve; });
  const page = await createPage({ deletePromise });
  page.change(page.checkbox("Select Alpha"));
  const button = page.bulkButton();
  page.click(button);
  page.click(button);
  page.render();
  assert.equal(page.modal().open, true);
  assert.deepEqual(page.calls.single, []);
  const confirm = page.modal().onConfirm;
  confirm();
  confirm();
  page.render();
  assert.deepEqual(page.calls.single, [1]);
  assert.equal(page.modal().loading, true);
  page.cancel();
  assert.equal(page.modal().open, true);
  assert.equal(page.bulkButton().props.disabled, true);
  assert.equal(textContent(page.bulkButton()), "Deleting...");
  assert.equal(page.checkbox("Select Beta").props.disabled, true);
  assert.equal(page.deleteButton("Beta").props.disabled, true);
  assert.equal(page.category("Culture").props.disabled, true);
  page.click(page.rows()[1]);
  await page.settle();
  assert.deepEqual(page.calls.edited, []);
  resolveDeletion({ deleted_ids: [1], deleted_count: 1 });
  await page.settle();
  assert.equal(page.modal().open, false);
  assert.equal(page.rows().length, 2);
  assert.equal(page.checkbox("Select Beta").props.disabled, false);
});

test("a failed bulk deletion keeps the shared modal open with an error and retries its selected articles", async () => {
  const page = await createPage({ deleteFailures: [new Error("Deletion unavailable")] });
  page.change(page.checkbox("Select all articles on this page"));
  page.click(page.bulkButton());
  page.render();
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.bulk, [[1, 2, 3]]);
  assert.equal(page.rows().length, 3);
  for (const title of ["Alpha", "Beta", "Gamma"]) assert.equal(page.checkbox(`Select ${title}`).props.checked, true);
  assert.equal(page.modal().open, true);
  assert.equal(page.modal().loading, false);
  assert.equal(page.modal().errorMessage, "Deletion unavailable");
  assert.equal(page.bulkButton().props.disabled, true);
  page.confirm();
  assert.equal(page.modal().errorMessage, null);
  await page.settle();
  assert.deepEqual(page.calls.bulk, [[1, 2, 3], [1, 2, 3]]);
  assert.equal(page.modal().open, false);
  page.find((node) => node.type === "div" && textContent(node) === "No published articles for this category.");
  assert.equal(page.bulkButton().props.disabled, true);
});

test("checkbox and delete clicks do not open the row editor; title row clicks still do", async () => {
  const page = await createPage();
  const checkbox = page.checkbox("Select Alpha");
  page.click(checkbox);
  page.change(checkbox);
  page.click(page.deleteButton("Beta"));
  await page.settle();
  assert.deepEqual(page.calls.edited, []);
  assert.equal(page.rows().length, 3);
  assert.equal(page.modal().open, true);
  page.cancel();
  page.click(page.rows()[0]);
  await page.settle();
  assert.deepEqual(page.calls.edited, [1]);
});

test("Articles rows open their editor with Enter and Space while keyboard controls remain isolated", async () => {
  const page = await createPage();
  assert.equal(page.key(page.checkbox("Select Alpha"), " ").stopped, true);
  assert.equal(page.key(page.deleteButton("Beta"), "Enter").stopped, true);
  assert.deepEqual(page.calls.edited, []);
  assert.equal(page.rows()[1].props.tabIndex, 0);
  assert.equal(page.key(page.rows()[1], "Enter").prevented, true);
  await page.settle();
  assert.deepEqual(page.calls.edited, [2]);
  page.find((node) => node.type === "input" && node.props.value === "Beta");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  await page.settle();
  assert.equal(page.key(page.rows()[0], " ").prevented, true);
  await page.settle();
  assert.deepEqual(page.calls.edited, [2, 1]);
  page.find((node) => node.type === "input" && node.props.value === "Alpha");
});

test("delete completion preserves another article updated while deletion was pending", async () => {
  let resolveDeletion;
  let resolveUpdate;
  const deletePromise = new Promise((resolve) => { resolveDeletion = resolve; });
  const updatePromise = new Promise((resolve) => { resolveUpdate = resolve; });
  const page = await createPage({ deletePromise, updatePromise });
  page.click(page.rows()[0]);
  await page.settle();
  const title = page.find((node) => node.type === "input" && node.props.value === "Alpha");
  title.props.onChange({ target: { value: "Updated Alpha" } });
  page.render();
  // Empty content avoids depending on a DOM parser in this state-race test.
  page.find((node) => node.props["aria-label"] === "Article content").props.ref.current.innerHTML = "";
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Publish Changes"));
  page.render();
  assert.equal(page.calls.updated[0].id, 1);
  assert.equal(page.calls.updated[0].payload.title, "Updated Alpha");
  page.click(page.find((node) => node.type === "button" && textContent(node) === "Back To Table"));
  page.render();
  page.click(page.deleteButton("Beta"));
  page.render();
  page.confirm();
  resolveUpdate({ ...articles[0], title: "Updated Alpha", content: "" });
  await page.settle();
  assert.match(textContent(page.rows()[0]), /Updated Alpha/);
  resolveDeletion({ deleted_ids: [2], deleted_count: 1 });
  await page.settle();
  assert.equal(page.rows().length, 2);
  assert.match(textContent(page.rows()[0]), /Updated Alpha/);
});

function createModal(props) {
  const listeners = new Set();
  const calls = { confirm: 0, cancel: 0 };
  let cleanup;
  let tree;
  let Button;
  const jsx = (type, nodeProps) => type === Button ? type(nodeProps) : { type, props: nodeProps };
  const jsxRuntime = { jsx, jsxs: jsx };
  const buttonModule = loadButton(jsxRuntime);
  Button = buttonModule.default;
  const context = {
    exports: {},
    window: {
      addEventListener: (name, listener) => { assert.equal(name, "keydown"); listeners.add(listener); },
      removeEventListener: (name, listener) => { assert.equal(name, "keydown"); listeners.delete(listener); },
    },
    require: (name) => {
      if (name === "react") return { useEffect: (effect) => { cleanup = effect(); } };
      if (name === "./Button") return buttonModule;
      assert.equal(name, "react/jsx-runtime");
      return jsxRuntime;
    },
  };
  vm.runInNewContext(compiledConfirmModal, context);
  function render(overrides = {}) {
    cleanup?.();
    tree = context.exports.default({
      open: true,
      message: "Delete this article?",
      onConfirm: () => { calls.confirm += 1; },
      onCancel: () => { calls.cancel += 1; },
      ...props,
      ...overrides,
    });
  }
  const modal = {
    calls, render,
    find: (predicate) => {
      const result = Array.from(walk(tree)).find(({ node }) => predicate(node));
      assert.ok(result, "Modal control not found");
      return result.node;
    },
    key: (key) => { for (const listener of listeners) listener({ key }); },
    click: (node) => { if (!node.props.disabled) node.props.onClick?.(); },
    listenerCount: () => listeners.size,
  };
  render();
  return modal;
}

test("shared ConfirmModal keeps its existing defaults and supports confirm, cancel, overlay, and Escape", () => {
  const modal = createModal();
  const dialog = modal.find((node) => node.props.role === "dialog");
  assert.equal(dialog.props["aria-label"], "Confirm");
  assert.equal(dialog.props["aria-modal"], "true");
  assert.equal(dialog.props["aria-busy"], false);
  modal.click(modal.find((node) => node.type === "button" && textContent(node) === "Delete"));
  modal.click(modal.find((node) => node.type === "button" && textContent(node) === "Cancel"));
  modal.click(modal.find((node) => node.type === "div" && node.props.className.includes("absolute")));
  modal.key("Escape");
  assert.deepEqual(modal.calls, { confirm: 1, cancel: 3 });
  modal.render({ open: false });
  assert.equal(modal.listenerCount(), 0);
});

test("shared ConfirmModal blocks dismissal and duplicate clicks while loading and shows retry errors", () => {
  const modal = createModal({ loading: true, errorMessage: "Deletion unavailable" });
  assert.equal(modal.find((node) => node.props.role === "dialog").props["aria-busy"], true);
  assert.equal(textContent(modal.find((node) => node.props.role === "alert")), "Deletion unavailable");
  for (const label of ["Delete", "Cancel"]) {
    const button = modal.find((node) => node.type === "button" && textContent(node) === label);
    assert.equal(button.props.disabled, true);
    modal.click(button);
  }
  const overlay = modal.find((node) => node.type === "div" && node.props.className.includes("absolute"));
  assert.equal(overlay.props.onClick, undefined);
  modal.click(overlay);
  modal.key("Escape");
  assert.deepEqual(modal.calls, { confirm: 0, cancel: 0 });
  modal.render({ loading: false });
  modal.click(modal.find((node) => node.type === "button" && textContent(node) === "Delete"));
  modal.key("Escape");
  assert.deepEqual(modal.calls, { confirm: 1, cancel: 1 });
});
