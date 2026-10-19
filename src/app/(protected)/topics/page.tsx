"use client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Sidebar from "@/components/ui/Sidebar";
import ContentWorkspace from "@/components/content/ContentWorkspace";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { call, Topic, topicPath } from "@/lib/services/content-workflow";

const empty = { title:"", reader_question:"", track:"Foundations", priority:0, notes:"" };
export default function Topics() {
  const [topics,setTopics]=useState<Topic[]>([]), [form,setForm]=useState(empty), [editing,setEditing]=useState<Topic|null>(null);
  const [query,setQuery]=useState(""), [archived,setArchived]=useState(false), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const [target,setTarget]=useState<Topic|null>(null), [csv,setCsv]=useState(""), [preview,setPreview]=useState<{topic_id:string;action:string}[]|null>(null);
  const [selected,setSelected]=useState('');
  const [workspaceDirty,setWorkspaceDirty]=useState(false);
  const [pendingTopic,setPendingTopic]=useState<Topic|null>(null);
  function selectTopic(id:string){setWorkspaceDirty(false);setSelected(id);setPendingTopic(null);window.history.pushState(null,'',`/topics?topic=${encodeURIComponent(id)}`);}
  useEffect(()=>{const sync=()=>setSelected(new URLSearchParams(window.location.search).get('topic')||'');sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  const load = async()=>setTopics(await call<Topic[]>("content-topics"));
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function act(work:()=>Promise<unknown>) {setBusy(true);setError("");try{await work();await load();}catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}}
  const matches = topics.filter(t=>t.archived===archived && `${t.title} ${t.topic_id} ${t.reader_question} ${t.track} ${t.status}`.toLowerCase().includes(query.toLowerCase()));
  const duplicates = form.reader_question.length>10 ? topics.filter(t=>t.topic_id!==editing?.topic_id && (t.reader_question.toLowerCase()===form.reader_question.toLowerCase() || t.title.toLowerCase()===form.title.toLowerCase())) : [];
  return <ProtectedPageShell title="Topics" description="Manage topics, briefs, research and generation" sidebarClassName="w-80" sidebar={<div className="space-y-4">
    {error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
<details open={!!editing} className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/20"><summary className="cursor-pointer font-medium">{editing?`Edit ${editing.topic_id}`:"Add topic"}</summary>    <form className="grid gap-3 rounded-xl border border-gray-200 transition hover:border-gray-300 bg-white p-3 " onSubmit={e=>{e.preventDefault();void act(async()=>{await call(editing?topicPath(editing.topic_id):"content-topics",editing?"PATCH":"POST",{...form,...(editing?{expected_version:editing.version,archived:editing.archived}:{})});setForm(empty);setEditing(null);});}}>
      <h2 className="font-semibold ">{editing?`Edit ${editing.topic_id}`:"Add topic"}</h2>
      {([['title','Working title'],['reader_question','Reader question'],['track','Track']] as const).map(([key,label])=><label key={key} className="grid gap-1 text-sm">{label}<input required minLength={key==='reader_question'?5:3} className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/20" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
      <label className="grid gap-1 text-sm">Priority (0–100)<input type="number" min="0" max="100" className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/20" value={form.priority} onChange={e=>setForm({...form,priority:Number(e.target.value)})}/></label>
      <label className="grid gap-1 text-sm ">Notes<textarea className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/20" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      {!!duplicates.length&&<p className="text-amber-800 ">Possible duplicates: {duplicates.map(t=>t.topic_id).join(', ')}. Compare scope before saving.</p>}
      <div className="flex gap-3"><Button disabled={busy} className="disabled:cursor-not-allowed disabled:opacity-50">Save topic</Button>{editing&&<Button type="button" onClick={()=>{setEditing(null);setForm(empty);}}>Cancel edit</Button>}</div>
    </form>
</details>    <details className="rounded border border-gray-200 transition hover:border-gray-300 bg-white p-4"><summary>Import / export inventory CSV</summary><p className="my-2 text-sm">Existing IDs are preserved. Imports add new topics only; missing rows never delete topics.</p>
      <input type="file" accept=".csv" aria-label="Import CSV" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(file){setCsv(await file.text());setPreview(null);}}}/>
      <Button disabled={!csv||busy} className="my-2 disabled:opacity-50" onClick={()=>void act(async()=>{const p=await call<{rows:{topic_id:string;action:string}[]}>("content-topics/import","POST",{csv_text:csv,apply:false});setPreview(p.rows);})}>Preview import</Button>
      {preview&&<div><p>{preview.filter(r=>r.action==='add').length} new topics; {preview.filter(r=>r.action!=='add').length} preserved.</p><Button disabled={busy} className="my-2 disabled:opacity-50" onClick={()=>void act(async()=>{await call("content-topics/import","POST",{csv_text:csv,apply:true});setPreview(null);setCsv("");})}>Apply import</Button></div>}
      <Button disabled={busy} className="my-2 disabled:opacity-50" onClick={()=>void act(async()=>{const result=await call<{csv_text:string}>("content-topics/export");const url=URL.createObjectURL(new Blob([result.csv_text],{type:"text/csv"}));const a=document.createElement('a');a.href=url;a.download='content-inventory.csv';a.click();URL.revokeObjectURL(url);})}>Export CSV</Button>
    </details>
    <div className="space-y-2"><input aria-label="Search topics" className="min-w-0 w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Search topic, track, question, or status" value={query} onChange={e=>setQuery(e.target.value)}/><label className="flex items-center gap-2 text-sm text-gray-600"><input className="accent-green-700" type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Archived</label></div>
<Sidebar items={matches.map(t=>({id:t.topic_id,label:<span className="block whitespace-normal"><span className="block text-xs text-gray-500">{t.topic_id} · {t.status}</span>{t.title}</span>,isActive:selected===t.topic_id,onClick:()=>{if(t.topic_id===selected)return;if(workspaceDirty){setPendingTopic(t);return;}selectTopic(t.topic_id);},isExpanded:selected===t.topic_id,footer:<div className="space-y-2"><p className="text-xs text-gray-500">{t.reader_question}</p><div className="flex flex-wrap gap-3 text-sm"><Button disabled={busy} onClick={()=>{setEditing(t);setForm({title:t.title,reader_question:t.reader_question,track:t.track,priority:t.priority,notes:t.notes});}}>Edit</Button><Button disabled={busy} onClick={()=>void act(()=>call(topicPath(t.topic_id),'PATCH',{title:t.title,reader_question:t.reader_question,track:t.track,priority:t.priority,notes:t.notes,expected_version:t.version,archived:!t.archived}))}>{t.archived?'Restore':'Archive'}</Button><Button variant="danger" disabled={busy} onClick={()=>{setError("");setTarget(t);}}>Delete</Button></div></div>}))} emptyState={<p>No matching topics. Add a topic or upload your inventory CSV.</p>}/>
    </div>}>
    {selected?<ContentWorkspace key={selected} mode="topic" embedded initialTopic={selected} onDirtyChange={setWorkspaceDirty}/>:<div className="rounded-xl border border-gray-200 transition hover:border-gray-300 bg-white p-8"><h2 className="text-xl font-semibold">Select a topic</h2><p className="mt-2 text-gray-600">Choose a topic in the sidebar to manage its brief, research and generation. Add or import topics using the sidebar controls.</p></div>}
    <ConfirmModal open={!!pendingTopic} title="Discard unsaved changes?" message={`Switch to ${pendingTopic?.title || "another topic"}? Unsaved workspace changes will be lost. Saved work and background jobs are retained.`} confirmText="Discard and switch" cancelText="Keep editing" onCancel={()=>setPendingTopic(null)} onConfirm={()=>{if(pendingTopic)selectTopic(pendingTopic.topic_id);}}/>
    <ConfirmModal open={!!target} title="Delete unused topic" message={`Delete ${target?.topic_id}: ${target?.title}? Topics with saved work must be archived instead. Articles are never deleted here.`} loading={busy} errorMessage={error || null} onCancel={()=>{setTarget(null);setError("");}} onConfirm={()=>void act(async()=>{await call(topicPath(target!.topic_id),'DELETE');setTarget(null);})}/>
  </ProtectedPageShell>;
}
