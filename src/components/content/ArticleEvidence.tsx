"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { call, Workspace } from "@/lib/services/content-workflow";
export default function ArticleEvidence({articleId,content}:{articleId:number;content:string}) {
  const [data,setData]=useState<Workspace|null>(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;setData(null);call<Workspace|null>(`content-articles/${articleId}`).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[articleId,content]);
  if(error)return <p className="text-amber-800">Research panel unavailable: {error}</p>;
  if(!data)return null;
  const version=data.versions.find(v=>v.id===data.topic.saved_version_id),qa=data.qa.find(q=>q.version_id===version?.id);
  return <details className="my-3 rounded border bg-blue-50 p-3"><summary>Research and QA · {data.topic.topic_id}</summary><Link className="underline" href={`/draft?topic=${data.topic.topic_id}`}>Open workspace and source ledger</Link>{version?.payload.content!==content&&<p>Article content differs from the saved workspace version. Its QA is stale.</p>}{qa?.report.findings.map((f,i)=><p key={i}>{f.severity}: {f.message}</p>)}{!qa&&<p>No QA report is available for the saved version.</p>}</details>;
}
