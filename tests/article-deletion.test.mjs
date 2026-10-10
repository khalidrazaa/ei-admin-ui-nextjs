import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

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
const compiledConfirmModal = compile("../src/components/ui/ConfirmModal.tsx");
const compiledButton = compile("../src/components/ui/Button.tsx");

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
async function createPage({ deleteResult, deleteFailures = [], deletePromise, updatePromise, listFailures = [], articleFailures = [], search = "" } = {}) {
  const slots = [];
  const calls = { single: [], bulk: [], edited: [], updated: [], listed: 0, listStatuses: [] };
  const storedArticles = articles.map((article) => ({ ...article }));
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  const Shell = () => {};
  const Toast = () => {};
  const ConfirmModal = () => {};
  let Button;
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
    if (type === Button) return type(props);
    if (props.ref && !props.ref.current) props.ref.current = { indeterminate: false, innerHTML: "" };
    return { type, props, key };
  };
  const jsxRuntime = { jsx, jsxs: jsx, Fragment: Symbol("Fragment") };
  const buttonModule = loadButton(jsxRuntime);
  Button = buttonModule.default;
  async function remove(ids) {
    if (deletePromise) return deletePromise;
    const failure = deleteFailures.shift();
    if (failure) throw failure;
    return deleteResult ?? { deleted_ids: ids, deleted_count: ids.length };
  }
  const modules = {
    react: hooks,
    "react/jsx-runtime": jsxRuntime,
    "@/components/layout/ProtectedPageShell": { __esModule: true, default: Shell },
    "@/components/ui/Toast": { __esModule: true, default: Toast },
    "@/components/ui/ConfirmModal": { __esModule: true, default: ConfirmModal },
    "@/components/ui/Button": buttonModule,
    "@/lib/services/host-sites": { getHostSites: async () => [] },
    "@/lib/services/articles": {
      getArticles: async (status) => {
        calls.listed += 1;
        calls.listStatuses.push(status);
        const failure = listFailures.shift();
        if (failure) throw failure;
        return storedArticles.filter((article) => !status || article.status === status).map((article) => ({ ...article }));
      },
      getArticle: async (id) => {
        calls.edited.push(id);
        const failure = articleFailures.shift();
        if (failure) throw failure;
        return storedArticles.find((article) => article.id === id);
      },
      updateArticle: async (id, payload) => {
        calls.updated.push({ id, payload });
        if (updatePromise) return updatePromise;
        const index = storedArticles.findIndex((article) => article.id === id);
        storedArticles[index] = { ...storedArticles[index], ...payload };
        return { ...storedArticles[index] };
      },
      deleteArticle: async (id) => { calls.single.push(id); return remove([id]); },
      deleteArticles: async (ids) => { calls.bulk.push(Array.from(ids)); return remove(Array.from(ids)); },
    },
  };
  const context = {
    exports: {}, Error, URLSearchParams,
    console: { error: () => {} },
    window: {
      location: { search },
      confirm: () => { assert.fail("Article deletion must use the shared ConfirmModal"); },
      setTimeout: () => 1,
      clearTimeout: () => {},
    },
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(compiledPage, context);
  function render() {
    for (let iteration = 0; dirty; iteration += 1) {
      assert.ok(iteration < 20, "Page did not settle after state updates");
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
  const page = {
    calls, render, settle, find, click,
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

test("Articles table requests published articles and excludes drafts from rows, selection, and category counts", async () => {
  const page = await createPage();
  assert.deepEqual(page.calls.listStatuses, ["published"]);
  assert.equal(page.rows().length, 3);
  assert.doesNotMatch(textContent(page.table()), /Draft Delta/);
  assert.equal(textContent(page.category("All Categories")), "All Categories3");
  assert.equal(textContent(page.category("Tech")), "Tech2");
  assert.equal(textContent(page.category("Culture")), "Culture1");
  assert.equal(page.categories().includes("Draft Only"), false);
  page.change(page.checkbox("Select all articles in this category"));
  page.click(page.bulkButton());
  page.render();
  page.confirm();
  await page.settle();
  assert.deepEqual(page.calls.bulk, [[1, 2, 3]]);
});

test("saving a published article as draft removes its row and resets its emptied category", async () => {
  const page = await createPage();
  page.click(page.category("Culture"));
  page.render();
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
  page.render();
  assert.equal(page.rows().length, 1);
  assert.match(textContent(page.rows()[0]), /Draft Delta/);
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
  const all = () => page.checkbox("Select all articles in this category");
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
  page.render();
  assert.equal(page.rows().length, 1);
  assert.equal(page.bulkButton().props.disabled, true);
  page.change(all());
  assert.equal(page.checkbox("Select Gamma").props.checked, true);
  page.click(page.category("All Categories"));
  page.render();
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
  page.render();
  page.change(page.checkbox("Select all articles in this category"));
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
  page.change(page.checkbox("Select all articles in this category"));
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
