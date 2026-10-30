import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
async function load(relative,deps={}){
  const source=await readFile(new URL(relative,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const context={exports:{},require:n=>deps[n]??(n==='react'?React:jsx)};vm.runInNewContext(code,context);return context.exports;
}
const images=await load('../src/lib/utils/markdownImages.ts');
const imageComponent=await load('../src/components/content/ArticleImage.tsx');
const {default:Markdown,parseFlow,safeHref}=await load('../src/components/content/ArticleMarkdown.tsx',{'@/lib/utils/markdownImages':images,'@/components/content/ArticleImage':imageComponent});
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

test('SVG and PNG render in place with captions and without cropping or figure-in-paragraph markup',()=>{
  const html=renderToStaticMarkup(React.createElement(Markdown,{content:'Before.\n![Architecture](https://api.example.com/media/a.svg "Architecture overview")\n\nText with ![Step](/media/b.png) inline.'}));
  assert.match(html,/<figure/);assert.match(html,/<figcaption[^>]*>Architecture overview/);assert.match(html,/src="https:\/\/api.example.com\/media\/a.svg"/);
  assert.match(html,/alt="Step"/);assert.match(html,/loading="lazy"/);assert.doesNotMatch(html,/<p[^>]*><figure|object-cover|<object|<iframe/);
});

test('reference images and balanced or angle destinations work while code examples stay literal',()=>{
  const content='![Architecture][diagram]\n\n[diagram]: <https://example.com/flow (1).svg> "Overview"\n\n`![sample](code.png)`\n\n~~~md\n![sample](fenced.svg)\n~~~\n';
  const html=renderToStaticMarkup(React.createElement(Markdown,{content}));
  // Spaces in a remote URL are rejected; encoded destinations remain usable.
  assert.doesNotMatch(html,/src=.*code.png|src=.*fenced.svg|<object/);
  const encoded=renderToStaticMarkup(React.createElement(Markdown,{content:content.replace('flow (1)','flow%20(1)')}));
  assert.match(encoded,/src="https:\/\/example.com\/flow%20\(1\).svg"/);
  assert.doesNotMatch(encoded,/\[diagram\]:/);
});

test('local blob preview resolution is explicit and unsafe persisted image sources are blocked',()=>{
  const content='![Diagram](diagram.svg)';
  const preview=renderToStaticMarkup(React.createElement(Markdown,{content,resolveImage:()=> 'blob:https://admin.example.com/123'}));
  assert.match(preview,/src="blob:https:\/\/admin.example.com\/123"/);
  for(const source of ['javascript:alert','data:image/svg+xml;base64,abc','//evil.example/x.svg','/\\evil.example/x.svg','blob:https://admin.example.com/123']){
    assert.equal(imageComponent.safeImageSrc(source),undefined);
  }
});

test('image alt text and titles containing escaped pipes stay in one table cell',()=>{
  const content='| Diagram |\n| --- |\n| ![Input \\| Output](https://example.com/flow.svg "Read \\| Write") |';
  const html=renderToStaticMarkup(React.createElement(Markdown,{content}));
  assert.equal((html.match(/<td\b/g)||[]).length,1);
  assert.match(html,/<img[^>]+alt="Input \| Output"/);
  assert.match(html,/<img[^>]+title="Read \| Write"/);
  assert.match(html,/<img[^>]+src="https:\/\/example.com\/flow.svg"/);
});
