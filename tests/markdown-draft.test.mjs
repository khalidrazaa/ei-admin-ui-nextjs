import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = (relativePath) => ts.transpileModule(
  readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const csvContext = { exports: {} };
vm.runInNewContext(compile("../src/lib/utils/csvList.ts"), csvContext);
const context = { exports: {}, require: (name) => name === "./csvList" ? csvContext.exports : require(name) };
vm.runInNewContext(compile("../src/lib/utils/markdownDraft.ts"), context);
const { MAX_MARKDOWN_FILE_BYTES, validateMarkdownFile, parseMarkdownDraft } = context.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("imports article metadata separately from the full Markdown body", () => {
  const body = "\n# Warehouse trade-offs\n\nA [source](https://example.com) supports this.\n\n```sql\nselect 1;\n```\n";
  const { payload, warnings } = parseMarkdownDraft(`---
title: "Warehouse trade-offs: a guide"
slug: warehouse-guide
seo_title: Warehouse trade-offs explained
excerpt: >-
  Compare the choices
  before you decide.
category: Engineering
subcategory: Data
tags: [Databases, "Data engineering"]
keywords: warehouses, analytics
host_site: explainit.tech
language: en
meta_description: How to choose a warehouse
canonical_url: https://explainit.tech/warehouse-guide
schema_type: Article
open_graph_title: Warehouse guide
open_graph_description: |-
  Compare the choices.
  Understand the costs.
open_graph_image: https://example.com/social.png
featured_image_url: https://example.com/cover.png
image_alt_text: A warehouse comparison
is_featured: true
reading_time: 8
---
${body}`, "article.md");

  assert.deepEqual(plain(payload), {
    title: "Warehouse trade-offs: a guide", slug: "warehouse-guide", content: body, status: "draft",
    seo_title: "Warehouse trade-offs explained", excerpt: "Compare the choices before you decide.",
    category: "Engineering", subcategory: "Data", tags: ["Databases", "Data engineering"],
    keywords: ["warehouses", "analytics"], host_site: "explainit.tech", language: "en",
    meta_description: "How to choose a warehouse", canonical_url: "https://explainit.tech/warehouse-guide",
    schema_type: "Article", open_graph_title: "Warehouse guide",
    open_graph_description: "Compare the choices.\nUnderstand the costs.",
    open_graph_image: "https://example.com/social.png", featured_image_url: "https://example.com/cover.png",
    image_alt_text: "A warehouse comparison", is_featured: true, reading_time: 8,
  });
  assert.deepEqual(plain(warnings), []);
});

test("supports BOM, CRLF, empty front matter, nulls, quoted booleans and CSV lists", () => {
  const { payload } = parseMarkdownDraft("\uFEFF---\r\nseo_title: null\r\nhost_site: null\r\ntags: null\r\nkeywords: ' one, two, ,three '\r\nis_featured: ' FALSE '\r\nreading_time: null\r\n---\r\n# Café & code\r\n\r\nBody.\r\n", "guide.MARKDOWN");
  assert.equal(payload.title, "Café & code");
  assert.equal(payload.slug, "cafe-code");
  assert.equal(payload.content, "# Café & code\n\nBody.\n");
  assert.equal(payload.seo_title, null);
  assert.equal("host_site" in payload, false);
  assert.deepEqual(plain(payload.tags), []);
  assert.deepEqual(plain(payload.keywords), ["one", "two", "three"]);
  assert.equal(payload.is_featured, false);
  assert.equal(payload.reading_time, null);
  assert.equal(parseMarkdownDraft("---\n---\n# Empty metadata\nText", "guide.md").payload.title, "Empty metadata");
});

test("uses the shared CSV parser for metadata containing quoted commas and quotes", () => {
  const { payload } = parseMarkdownDraft(`---
tags: '"Research, development", "Say ""hello""", plain'
keywords: 'one, two'
---
Article`, "article.md");
  assert.deepEqual(plain(payload.tags), ["Research, development", 'Say "hello"', "plain"]);
  assert.deepEqual(plain(payload.keywords), ["one", "two"]);
});

test("imports the downloadable Markdown template with its documented metadata", () => {
  const source = readFileSync(new URL("../public/examples/draft-template.md", import.meta.url), "utf8");
  const { payload, warnings } = parseMarkdownDraft(source, "draft-template.md");
  assert.equal(payload.status, "draft");
  assert.ok(payload.title);
  assert.ok(payload.slug);
  assert.ok(payload.content.trim());
  assert.equal(payload.host_site, "explainit.tech");
  assert.ok(Array.isArray(payload.tags));
  assert.ok(Array.isArray(payload.keywords));
  assert.deepEqual(plain(warnings), []);
  assert.doesNotMatch(payload.content, /^---\n/);
});

test("plain Markdown derives a title from the first H1 outside fenced code, then its filename", () => {
  const body = "```markdown\n# Not the title\n```\n\n# Real title ##\n\nContent\n";
  const { payload } = parseMarkdownDraft(body, "ignored.md");
  assert.equal(payload.title, "Real title");
  assert.equal(payload.slug, "real-title");
  assert.equal(payload.content, body);
  assert.deepEqual(Object.keys(payload).sort(), ["content", "slug", "status", "title"]);
  const fallback = parseMarkdownDraft("## Section\n\nArticle.", "my-new_article.MARKDOWN").payload;
  assert.equal(fallback.title, "my new article");
  assert.equal(fallback.slug, "my-new-article");
  assert.equal(parseMarkdownDraft("# What is C#\nText", "file.md").payload.title, "What is C#");
});

test("ignores system, unsupported and front matter body fields without importing their values", () => {
  const { payload, warnings } = parseMarkdownDraft(`---
title: Imported
status: published
id: [untrusted]
author_id: {name: ignored}
created_at: 2025-10-20
published_at: null
content: Override attempt
diagram_alt: diagram
unresolved_claims: [private]
unknown_field: {nested: true}
__proto__: {polluted: true}
constructor: false
---
Actual article`, "file.md");
  assert.deepEqual(plain(payload), { title: "Imported", slug: "imported", status: "draft", content: "Actual article" });
  assert.equal(warnings.length, 1);
  for (const name of ["status", "id", "author_id", "created_at", "published_at", "content", "diagram_alt", "unresolved_claims", "unknown_field", "__proto__", "constructor"]) {
    assert.ok(warnings[0].includes(name));
  }
  assert.equal({}.polluted, undefined);
});

test("rejects malformed YAML and duplicate field names with a useful error", () => {
  for (const frontMatter of ["title: [unterminated", "title: One\ntitle: Two", "title: !!js/function function () {}", "title: 'bad quote"]) {
    assert.throws(() => parseMarkdownDraft(`---\n${frontMatter}\n---\nArticle`, "file.md"), /YAML front matter is invalid/);
  }
  assert.throws(() => parseMarkdownDraft("---\ntitle: No close\nArticle", "file.md"), /closing ---/);
  for (const frontMatter of ["- list", "plain scalar", "null"]) {
    assert.throws(() => parseMarkdownDraft(`---\n${frontMatter}\n---\nArticle`, "file.md"), /must contain metadata fields/);
  }
});

test("validates known metadata types instead of silently discarding them", () => {
  for (const [field, value] of [
    ["title", "42"], ["slug", "false"], ["seo_title", "[]"], ["host_site", "{}"],
    ["tags", "[one, 2]"], ["keywords", "false"], ["is_featured", "yes"],
    ["is_featured", "null"], ["reading_time", "-1"], ["reading_time", "1.5"],
    ["reading_time", "'5'"], ["reading_time", ".inf"], ["reading_time", "9007199254740992"],
  ]) {
    assert.throws(() => parseMarkdownDraft(`---\n${field}: ${value}\n---\n# Article\nBody`, "file.md"), new RegExp(`Metadata field "${field}"`));
  }
  assert.equal(parseMarkdownDraft("---\nreading_time: 0\n---\nArticle", "file.md").payload.reading_time, 0);
});

test("handles recursive aliases without traversing ignored values and bounds YAML nesting", () => {
  const result = parseMarkdownDraft("---\nignored: &cycle [*cycle]\n---\n# Article\nBody", "file.md");
  assert.equal(result.payload.title, "Article");
  assert.deepEqual(plain(result.warnings), ["Ignored metadata fields: ignored."]);
  assert.throws(() => parseMarkdownDraft("---\ntags: &cycle [*cycle]\n---\nBody", "file.md"), /Metadata field "tags"/);
  const nested = `${"[".repeat(24)}value${"]".repeat(24)}`;
  assert.throws(() => parseMarkdownDraft(`---\nignored: ${nested}\n---\nBody`, "file.md"), /YAML front matter is invalid/);
});

test("requires an article body and a usable slug", () => {
  for (const source of ["", " \n\t", "---\ntitle: Metadata only\n---\n\n"]) {
    assert.throws(() => parseMarkdownDraft(source, "file.md"), /needs an article body/);
  }
  assert.throws(() => parseMarkdownDraft("# 日本語\nArticle", "file.md"), /Add a slug field/);
  assert.equal(parseMarkdownDraft("---\nslug: japanese\n---\n# 日本語\nArticle", "file.md").payload.slug, "japanese");
  assert.throws(() => parseMarkdownDraft("Bad\0text", "file.md"), /plain text/);
});

test("accepts Markdown extensions and enforces file size before reading", () => {
  for (const name of ["draft.md", "DRAFT.MD", "draft.markdown", "draft.MARKDOWN"]) {
    assert.doesNotThrow(() => validateMarkdownFile({ name, size: MAX_MARKDOWN_FILE_BYTES }));
  }
  for (const name of ["draft.txt", "draft.md.exe", "md"]) {
    assert.throws(() => validateMarkdownFile({ name, size: 10 }), /Choose a Markdown file/);
  }
  assert.throws(() => validateMarkdownFile({ name: "draft.md", size: MAX_MARKDOWN_FILE_BYTES + 1 }), /2 MiB/);
  assert.throws(() => validateMarkdownFile({ name: "draft.md", size: 0 }), /empty/);
});
