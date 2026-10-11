import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const source=await readFile(new URL('../src/components/content/ArticleMarkdown.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const context={exports:{},require:n=>n==='react'?React:jsx};vm.runInNewContext(code,context);
const {default:Markdown,parseFlow,safeHref}=context.exports;
test('renders tables, numbered lists and safe citations',()=>{
  const html=renderToStaticMarkup(React.createElement(Markdown,{content:'| Choice | Cost |\n| --- | --- |\n| Warehouse | Variable |\n\n1. Gather evidence\n2. Review\n\n[Docs](https://example.com)'}));
  assert.match(html,/<table/);assert.match(html,/<ol/);assert.match(html,/href="https:\/\/example.com"/);
});
test('renders supported flow without injecting executable HTML',()=>{
  const html=renderToStaticMarkup(React.createElement(Markdown,{content:'```mermaid\nflowchart TD\nA[Sources] -->|Daily| B[Warehouse]\nB --> C[Managers]\n```'}));
  assert.match(html,/<svg/);assert.match(html,/<figcaption/);assert.match(html,/Daily/);
  assert.equal(parseFlow('flowchart TD\nclick A "javascript:alert(1)"'),null);
});
test('unsafe links and raw scripts are not executed',()=>{
  assert.equal(safeHref('javascript:alert(1)'),undefined);
  assert.equal(safeHref('//evil.example'),undefined);
  const html=renderToStaticMarkup(React.createElement(Markdown,{content:'<script>alert(1)</script>\n\n[bad](javascript:alert)'}));
  assert.doesNotMatch(html,/<script|href="javascript/);assert.match(html,/&lt;script/);
});
