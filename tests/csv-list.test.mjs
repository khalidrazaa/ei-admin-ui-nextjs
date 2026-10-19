import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  await readFile(new URL("../src/lib/utils/csvList.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { formatCsvList, parseCsvList } = context.exports;
const parse = (value) => Array.from(parseCsvList(value));

test("simple comma lists keep the existing trim and empty-entry behavior", () => {
  assert.equal(formatCsvList(["Technology", "Business systems"]), "Technology, Business systems");
  assert.deepEqual(parse(" Technology, , Business systems ,"), ["Technology", "Business systems"]);
  assert.deepEqual(parse(""), []);
  assert.deepEqual(parse(" , \n , "), []);
});

test("imported list values round trip commas, quotes, and line breaks", () => {
  const values = ["Data, platforms", 'The "order" system', "First line\nSecond line", "Windows\r\nline break"];
  assert.deepEqual(parse(formatCsvList(values)), values);
  assert.equal(formatCsvList(['The "order" system']), '"The ""order"" system"');
  assert.deepEqual(parse('"Data, platforms", "The ""order"" system"'), values.slice(0, 2));
});

test("quoted fields preserve whitespace and empty strings while surrounding spaces are ignored", () => {
  const values = [" padded ", "", "tab\t", "plain"];
  assert.deepEqual(parse(formatCsvList(values)), values);
  assert.deepEqual(parse('  " padded "  , plain '), [" padded ", "plain"]);
});

test("quotes within an unquoted entry remain ordinary text", () => {
  assert.deepEqual(parse('The "order" system, Operations'), ['The "order" system', "Operations"]);
});
