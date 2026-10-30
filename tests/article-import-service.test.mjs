import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('article file service sends one authenticated multipart request with the reviewed payload and mapping',async()=>{
  const calls=[];
  const code=ts.transpileModule(readFileSync(new URL('../src/lib/services/articles.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={exports:{},FormData,require:name=>{assert.equal(name,'@/lib/api');return {apiFetch:async(path,options)=>{calls.push({path,options});return {id:7};}};}};
  vm.runInNewContext(code,context);
  const file=new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'],'flow.svg',{type:'image/svg+xml'});
  const article={title:'Imported',slug:'imported',content:'![Flow](flow.svg)',status:'draft'};
  const manifest={'flow.svg':'flow.svg'};
  assert.deepEqual(await context.exports.importArticleFiles(null,article,[file],manifest,'request-1'),{id:7});
  assert.equal(calls[0].path,'/admin/articles/import');assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.body.get('article'),JSON.stringify(article));
  assert.equal(calls[0].options.body.get('manifest'),JSON.stringify(manifest));
  assert.equal(calls[0].options.body.get('request_id'),'request-1');
  assert.equal(calls[0].options.body.getAll('images').length,1);
  assert.equal(calls[0].options.body.get('images').name,'flow.svg');
  assert.equal(calls[0].options.timeoutMs,120000);
  await context.exports.importArticleFiles(7,{...article,expected_updated_at:'2026-10-28T10:00:00Z'},[file],manifest,'request-2');
  assert.equal(calls[1].path,'/admin/articles/7/import');assert.equal(calls[1].options.method,'PUT');
  assert.equal(JSON.parse(calls[1].options.body.get('article')).expected_updated_at,'2026-10-28T10:00:00Z');
});
