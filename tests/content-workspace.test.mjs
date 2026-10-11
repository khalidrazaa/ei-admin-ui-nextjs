import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';

const source=await readFile(new URL('../src/components/content/ContentWorkspace.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const text=node=>node==null?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
function* walk(node){if(Array.isArray(node)){for(const x of node)yield* walk(x);}else if(node&&typeof node==='object'&&node.props){yield node;yield* walk(node.props.children);}}
async function mount(mode='all'){
  const slots=[];let cursor=0,dirty=true,effects=[],tree;
  const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
  const hooks={
    useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,v=>{const n=typeof v==='function'?v(slots[i].value):v;if(!Object.is(n,slots[i].value)){slots[i].value=n;dirty=true;}}];},
    useRef(initial){const i=cursor++;return(slots[i]??={current:initial});},
    useEffect(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps)){slots[i]={deps};effects.push(fn);}},
    useCallback(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps))slots[i]={deps,fn};return slots[i].fn;},
  };
  const brief={audience:'CEOs and managers',scenario:'Retail',scope:'Do we need a warehouse?',exclusions:'',target_words:800,diagram:true,source_urls:[]};
  const data={topic:{topic_id:'EXPLAINIT-011',title:'Reporting',reader_question:brief.scope,track:'Architecture',status:'Idea',archived:false,version:1,brief_version:0,brief:{},article_id:null},runs:[],versions:[],qa:[],article_fingerprint:null,article_status:null,overlaps:[]};
  const calls=[];let interval;
  const call=async(path,method='GET',body)=>{
    calls.push({path,method,body});
    if(path==='content-topics')return[structuredClone(data.topic)];
    if(path.endsWith('/workspace')&&method==='PATCH'){data.topic.brief=body.brief;data.topic.version++;data.topic.brief_version++;return structuredClone(data.topic);}
    if(path.endsWith('/runs')){
      const result=body.stage==='research'?{ready:true,summary:'Supported findings',gaps:[],sources:[],claims:[]}:null;
      data.runs.unshift({id:randomUUID(),stage:body.stage,status:'completed',attempts:1,inputs:{brief_version:data.topic.brief_version},result,created_at:'2026-10-10'});
      if(body.stage==='generate'){
        data.versions.unshift({id:1,brief_version:data.topic.brief_version,created_at:'2026-10-10',payload:{title:'A useful article',slug:'useful-article',content:'## Business problem\nConcrete detail',excerpt:'Example excerpt',meta_description:'Description',tags:[],diagram_alt:'',unresolved_claims:[]}});
        data.qa.unshift({id:1,version_id:1,report:{findings:[{severity:'warning',category:'review',message:'Check operating assumptions.'}]}});
      }
      data.topic.version++;
      return {};
    }
    if(path.endsWith('/save-draft')){data.topic.article_id=42;data.topic.status='Drafted';return{article_id:42};}
    throw new Error('Unexpected call '+path);
  };
  const jsx={jsx:(type,props,key)=>({type,props:props||{},key}),jsxs:(type,props,key)=>({type,props:props||{},key})};
  const modules={react:hooks,'react/jsx-runtime':jsx,'next/link':{default:'a'},'./ArticleMarkdown':{default:()=>null},'@/components/ui/Button':'button','@/components/layout/ProtectedPageShell':{default:'shell'},'@/components/ui/Sidebar':{default:'sidebar'},'@/lib/services/content-workflow':{call,getWorkspace:async()=>structuredClone(data),topicPath:id=>`content-topics/${id}`}};
  const context={exports:{},URLSearchParams,crypto:{randomUUID},Date,JSON,Number,window:{location:{search:'?topic=EXPLAINIT-011'},addEventListener(){},removeEventListener(){},confirm:()=>true},setInterval:fn=>{interval=fn;return 1;},clearInterval(){},require:n=>{assert.ok(n in modules,n);return modules[n];}};
  vm.runInNewContext(code,context);
  async function settle(){for(let j=0;j<8;j++){while(dirty){dirty=false;cursor=0;effects=[];tree=context.exports.default({mode});for(const effect of effects)effect();}await new Promise(r=>setImmediate(r));}}
  await settle();
  const findButton=label=>[...walk(tree)].find(n=>n.type==='button'&&text(n)===label);
  return {calls,data,settle,setMode:async next=>{mode=next;dirty=true;await settle();},refresh:async()=>{await interval();await settle();},get tree(){return tree;},async click(label){const b=findButton(label);assert.ok(b,`Missing ${label}`);assert.ok(!b.props.disabled,`${label} disabled`);b.props.onClick();await settle();},button:findButton};
}
test('research and generation save workspace only; explicit Save to Drafts creates article',async()=>{
  const page=await mount();
  assert.equal(page.button('Generate article').props.disabled,true);
  await page.click('Begin research');
  assert.ok(page.calls.some(c=>c.body?.stage==='research'));
  await page.click('Generate article');
  assert.match(text(page.tree),/Check operating assumptions/);
  assert.equal(page.data.topic.article_id,null);
  assert.equal(page.calls.filter(c=>c.path.endsWith('/save-draft')).length,0);
  await page.click('Save to Drafts');
  assert.equal(page.data.topic.article_id,42);
  assert.equal(page.data.topic.status,'Drafted');
  assert.ok(!page.calls.some(c=>c.body?.status==='published'));
});
test('published article disables research and generation',async()=>{
  const page=await mount();page.data.article_status='published';await page.refresh();
  assert.equal(page.button('Begin research').props.disabled,true);
  assert.equal(page.button('Generate article').props.disabled,true);
});

test('polling does not silently accept concurrent article edits',async()=>{
  const page=await mount();
  await page.click('Begin research');await page.click('Generate article');
  page.data.article_fingerprint='edited-in-another-tab';await page.refresh();
  await page.click('Save to Drafts');
  const save=page.calls.find(c=>c.path.endsWith('/save-draft'));
  assert.equal(save.body.article_fingerprint,null);
});

test('Drafts shows generated content and metadata while research stays in Topics',async()=>{
  const page=await mount();await page.click('Begin research');await page.click('Generate article');
  page.data.versions[0].payload.seo_title='Specific SEO title';
  page.data.versions[0].id=2;await page.refresh();
  await page.setMode('draft');
  assert.equal(page.button('Begin research'),undefined);
  assert.equal(page.button('Generate article'),undefined);
  assert.match(text(page.tree),/Generated article metadata/);
  assert.match(text(page.tree),/Specific SEO title/);
  assert.ok(page.button('Save to Drafts'));
  await page.setMode('topic');
  assert.ok(page.button('Begin research'));
  assert.equal(page.button('Save to Drafts'),undefined);
  assert.match(text(page.tree),/Review article, metadata and QA in Drafts/);
});
