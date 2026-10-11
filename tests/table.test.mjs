import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiledTable = ts.transpileModule(
  readFileSync(new URL("../src/components/ui/Table.tsx", import.meta.url), "utf8"),
  { compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } },
).outputText;

const jsx = (type, props, key) => ({ type, props, key });
const context = {
  exports: {},
  require(name) {
    if (name === "react") return {};
    assert.equal(name, "react/jsx-runtime");
    return { jsx, jsxs: jsx, Fragment: Symbol("Fragment") };
  },
};
vm.runInNewContext(compiledTable, context);
const Table = context.exports.default;

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
  }
}

function nodes(tree, type) {
  return Array.from(walk(tree)).filter(({ node }) => node.type === type).map(({ node }) => node);
}

function bodyRows(tree) {
  return nodes(nodes(tree, "tbody")[0], "tr");
}

function fire(tree, node, eventName, overrides = {}) {
  const found = Array.from(walk(tree)).find((entry) => entry.node === node);
  assert.ok(found, "Event target must be rendered");
  let stopped = false;
  let prevented = false;
  const event = {
    target: node,
    currentTarget: node,
    stopPropagation() { stopped = true; },
    preventDefault() { prevented = true; },
    ...overrides,
  };
  for (const ancestor of [node, ...found.ancestors.slice().reverse()]) {
    event.currentTarget = ancestor;
    ancestor.props[eventName]?.(event);
    if (stopped) break;
  }
  return { stopped, prevented };
}

test("Table infers columns across all supplied rows and renders scalar and structured data", () => {
  const tree = Table({ data: [
    { id: 8, article_title: "Alpha", published: false, metadata: null },
    { id: 9, article_title: "Beta", published: true, metadata: { source: "video" }, tags: ["tech", "news"] },
  ] });
  assert.deepEqual(nodes(tree, "th").map(textContent), ["Id", "Article Title", "Published", "Metadata", "Tags"]);
  const rows = bodyRows(tree);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.key), [8, 9]);
  const first = nodes(rows[0], "td").map(textContent);
  assert.deepEqual(first.slice(0, 3), ["8", "Alpha", "No"]);
  assert.match(first[3], /^(—|–|-)$/);
  assert.match(first[4], /^(—|–|-)$/);
  assert.deepEqual(nodes(rows[1], "td").map(textContent), ["9", "Beta", "Yes", '{"source":"video"}', '["tech","news"]']);
});

test("Table supports supplied column order, accessors, custom cells, and stable row keys", () => {
  const data = [{ id: "a", title: "Alpha", internal: "private" }, { id: "b", title: "Beta", internal: "private" }];
  const columns = [
    { id: "number", header: "#", render: (_row, index) => index + 1 },
    { id: "title", header: jsx("strong", { children: "Title" }), accessor: "title" },
    { id: "action", header: "Action", render: (row) => jsx("button", { children: `Delete ${row.title}` }), stopRowClick: true },
  ];
  const props = { data, columns, getRowKey: (row) => row.id, ariaLabel: "Articles" };
  const tree = Table(props);
  assert.deepEqual(nodes(tree, "th").map(textContent), ["#", "Title", "Action"]);
  assert.deepEqual(nodes(bodyRows(tree)[0], "td").map(textContent), ["1", "Alpha", "Delete Alpha"]);
  assert.doesNotMatch(textContent(tree), /private/);
  assert.equal(nodes(tree, "table")[0].props["aria-label"], "Articles");
  assert.deepEqual(bodyRows(tree).map((row) => row.key), ["a", "b"]);
  assert.deepEqual(bodyRows(Table({ ...props, data: [...data].reverse() })).map((row) => row.key), ["b", "a"]);
});

test("Table row activation supports clicks and keyboard while action cells isolate their controls", () => {
  const opened = [];
  const actions = [];
  const tree = Table({
    data: [{ id: 1, title: "Alpha" }],
    columns: [
      { id: "title", header: "Title", accessor: "title" },
      { id: "action", header: "Action", stopRowClick: true, render: (row) => jsx("button", {
        children: "Delete", onClick: () => actions.push(row.id),
      }) },
    ],
    onRowClick: (row, index) => opened.push([row.id, index]),
  });
  const row = bodyRows(tree)[0];
  const cells = nodes(row, "td");
  const button = nodes(row, "button")[0];
  assert.equal(row.props.tabIndex, 0);
  fire(tree, cells[0], "onClick");
  fire(tree, row, "onKeyDown", { key: "Enter" });
  assert.equal(fire(tree, row, "onKeyDown", { key: " " }).prevented, true);
  fire(tree, row, "onKeyDown", { key: "Escape" });
  assert.equal(fire(tree, button, "onClick").stopped, true);
  assert.equal(fire(tree, button, "onKeyDown", { key: "Enter" }).stopped, true);
  assert.deepEqual(actions, [1]);
  assert.deepEqual(opened, [[1, 0], [1, 0], [1, 0]]);
});

test("Table does not activate rows from nested keyboard controls or when a row is disabled", () => {
  const opened = [];
  const props = {
    data: [{ id: 1, title: "Alpha" }, { id: 2, title: "Beta" }],
    columns: [{ id: "title", header: "Title", render: (row) => jsx("input", { "aria-label": row.title }) }],
    onRowClick: (row) => opened.push(row.id),
    isRowDisabled: (row) => row.id === 2,
  };
  const tree = Table(props);
  const rows = bodyRows(tree);
  fire(tree, nodes(rows[0], "input")[0], "onKeyDown", { key: "Enter" });
  fire(tree, rows[1], "onClick");
  fire(tree, rows[1], "onKeyDown", { key: "Enter" });
  fire(tree, rows[1], "onKeyDown", { key: " " });
  assert.deepEqual(opened, []);
  fire(tree, rows[0], "onKeyDown", { key: "Enter" });
  assert.deepEqual(opened, [1]);
});

test("Table preserves configured columns in loading and empty states and spans the full table", () => {
  const columns = [{ id: "title", header: "Title", accessor: "title" }, { id: "status", header: "Status", accessor: "status" }];
  const empty = Table({ data: [], columns, emptyMessage: "No published articles." });
  assert.deepEqual(nodes(empty, "th").map(textContent), ["Title", "Status"]);
  assert.equal(nodes(empty, "td").length, 1);
  assert.equal(nodes(empty, "td")[0].props.colSpan, 2);
  assert.equal(textContent(nodes(empty, "td")[0]), "No published articles.");
  const loading = Table({ data: [{ title: "Old result", status: "published" }], columns, loading: true, loadingMessage: "Loading articles..." });
  assert.equal(nodes(loading, "table")[0].props["aria-busy"], true);
  assert.equal(nodes(loading, "td").length, 1);
  assert.equal(nodes(loading, "td")[0].props.colSpan, 2);
  assert.equal(textContent(nodes(loading, "td")[0]), "Loading articles...");
  assert.doesNotMatch(textContent(loading), /Old result/);
});

test("Table safely renders cyclic values and an empty inferred schema", () => {
  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => Table({ data: [{ value: circular }] }));
  const empty = Table({ data: [] });
  assert.equal(nodes(empty, "td")[0].props.colSpan, 1);
  assert.ok(textContent(nodes(empty, "td")[0]));
});
