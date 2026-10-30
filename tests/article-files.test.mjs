import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path,deps={}){
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={exports:{},require:n=>deps[n]};vm.runInNewContext(code,context);return context.exports;
}
const parser=load('../src/lib/utils/markdownImages.ts');
const files=load('../src/lib/utils/articleFiles.ts',{'./markdownImages':parser});
const plain=value=>JSON.parse(JSON.stringify(value));

test('matches inline/reference diagrams by exact path or unique basename and preserves external URLs',()=>{
  const content='![One](images/architecture.svg)\n\n![Two][flow]\n\n[flow]: workflow.png "Steps"\n\n![Remote](https://example.com/existing.png)\n\n`![Code](ignored.png)`\n\n```md\n![Fenced](ignored.svg)\n```';
  const result=files.getArticleImageMappings(content,[{name:'architecture.svg',size:5},{name:'workflow.png',size:5}]);
  assert.deepEqual(plain(result.manifest),{'images/architecture.svg':'architecture.svg','workflow.png':'workflow.png'});
  assert.deepEqual(plain(result.missing),[]);assert.deepEqual(plain(result.unused),[]);
});

test('explicit mapping resolves renamed files and replacements of existing URLs',()=>{
  const result=files.getArticleImageMappings('![One](missing.svg)\n\n![Old](https://example.com/old.png)',[{name:'new.svg',size:5}],{'missing.svg':'new.svg','https://example.com/old.png':'new.svg'});
  assert.deepEqual(plain(result.manifest),{'missing.svg':'new.svg','https://example.com/old.png':'new.svg'});
  assert.deepEqual(plain(result.missing),[]);
  assert.deepEqual(plain(files.getArticleImageMappings('![Absent](a.svg)',[]).missing),['a.svg']);
});

test('matches the same diagram across SVG and PNG formats without requiring Markdown edits',()=>{
  const content='![Architecture](images/architecture.png)\n\n![Steps][workflow]\n\n[workflow]: workflow.svg';
  const result=files.getArticleImageMappings(content,[{name:'architecture.svg',size:5},{name:'workflow.PNG',size:5}]);
  assert.deepEqual(plain(result.manifest),{'images/architecture.png':'architecture.svg','workflow.svg':'workflow.PNG'});
  assert.deepEqual(plain(result.missing),[]);
  assert.deepEqual(plain(result.unused),[]);
});

test('prefers exact filenames and explicit selections over alternative diagram formats',()=>{
  const selected=[{name:'architecture.svg',size:5},{name:'architecture.png',size:5}];
  const result=files.getArticleImageMappings('![Architecture](images/architecture.png)',selected);
  assert.deepEqual(plain(result.manifest),{'images/architecture.png':'architecture.png'});
  const override=files.getArticleImageMappings('![Architecture](images/architecture.png)',selected,{'images/architecture.png':'architecture.svg'});
  assert.deepEqual(plain(override.manifest),{'images/architecture.png':'architecture.svg'});
});

test('uses matching relative diagram paths before ambiguous filename stems',()=>{
  const selected=[
    {name:'flow.svg',size:5,webkitRelativePath:'diagrams/flow.svg'},
    {name:'flow.SVG',size:5,webkitRelativePath:'exports/flow.SVG'},
  ];
  const exact=files.getArticleImageMappings('![Flow](diagrams/flow.png)',selected);
  assert.deepEqual(plain(exact.manifest),{'diagrams/flow.png':'flow.svg'});
  const ambiguous=files.getArticleImageMappings('![Flow](other/flow.png)',selected);
  assert.deepEqual(plain(ambiguous.manifest),{});
  assert.deepEqual(plain(ambiguous.missing),['other/flow.png']);
});

test('does not substitute unrelated files, unsupported formats or existing remote image URLs',()=>{
  const result=files.getArticleImageMappings('![Absent](flow.png)\n\n![JPEG](other.jpg)\n\n![Remote](https://example.com/other.png)',[{name:'other.svg',size:5}]);
  assert.deepEqual(plain(result.manifest),{});
  assert.deepEqual(plain(result.missing),['flow.png','other.jpg']);
  assert.deepEqual(plain(result.unused),['other.svg']);
});

test('validates image type, count, bytes and duplicate filenames before reading uploads',()=>{
  for(const name of ['diagram.svg','diagram.PNG'])assert.doesNotThrow(()=>files.validateImageFiles([{name,size:files.MAX_ARTICLE_IMAGE_BYTES}]));
  for(const image of [{name:'wrong.jpg',size:10},{name:'empty.svg',size:0},{name:'large.png',size:files.MAX_ARTICLE_IMAGE_BYTES+1}])assert.throws(()=>files.validateImageFiles([image]));
  assert.throws(()=>files.validateImageFiles([{name:'same.svg',size:1},{name:'same.svg',size:1}]),/named/);
  assert.throws(()=>files.validateImageFiles(Array.from({length:11},(_,i)=>({name:`${i}.svg`,size:1}))),/10/);
  assert.throws(()=>files.validateImageFiles([{name:'a.svg',size:1}],files.MAX_ARTICLE_UPLOAD_BYTES),/50 MiB/);
});

test('scanner excludes escaped images, reference definitions, indentation and variable fences',()=>{
  const source='\\![Escaped](no.svg)\n\n    ![Indented](no.png)\n\n````md\n```\n![Code](no.svg)\n````\n\n![Yes](<diagrams/a (1).svg> "One")';
  const found=parser.findMarkdownImages(source);
  assert.deepEqual(plain(found.map(image=>[image.alt,image.destination,image.title])),[['Yes','diagrams/a (1).svg','One']]);
});

test('malformed repeated image starts and excessive label nesting are bounded',()=>{
  const source='!['.repeat(65536);
  assert.deepEqual(plain(parser.findMarkdownImages(source)),[]);
  assert.equal(parser.parseMarkdownImageAt(`![${'['.repeat(33)}nested${']'.repeat(33)}](a.svg)`,0),null);
  assert.equal(parser.parseMarkdownImageAt(`![${'a'.repeat(4097)}](a.svg)`,0),null);
});
