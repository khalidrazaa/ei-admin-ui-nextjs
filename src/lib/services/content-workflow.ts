import { apiFetch } from "@/lib/api";
export type Topic = { has_generated?: boolean; topic_id: string; title: string; reader_question: string; track: string; priority: number; notes: string; status: string; archived: boolean; version: number; brief_version: number; brief: Brief; article_id: number | null; saved_version_id: number | null; published_url: string | null };
export type Brief = { audience: string; scenario: string; scope: string; exclusions: string; target_words: number; diagram: boolean; source_urls: string[] };
export type Payload = { seo_title?:string; category?:string; subcategory?:string; keywords?:string[]; language?:string; schema_type?:string; open_graph_title?:string; open_graph_description?:string; title: string; slug: string; content: string; excerpt: string; meta_description: string; tags: string[]; diagram_alt: string; unresolved_claims: string[] };
export type Finding = { severity: string; category: string; message: string };
export type Research = { summary: string; ready: boolean; gaps: string[]; claims: {claim:string; evidence:string; source_urls:string[]; qualification:string}[]; sources: {url:string; title:string; checked_at:string}[] };
export type Run = { id: string; stage: string; status: string; error: string | null; cancel_requested: boolean; attempts: number; inputs: {provider?:"openai"|"gemini";brief_version:number; version_id:number|null}; result: Research | null; created_at:string };
export type Version = { id:number; payload:Payload; brief_version:number; created_at:string };
export type Workspace = { article?: Record<string,unknown>|null; topic:Topic; runs:Run[]; versions:Version[]; qa:{id:number; version_id:number; report:{findings:Finding[]}}[]; article_fingerprint:string|null; article_status:string|null; overlaps:{id:string;title:string;similarity:number}[] };
export function call<T>(path:string, method="GET", body?:unknown) {
  return apiFetch<T>(`/admin/${path}`, {method, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
}
export const topicPath = (id:string) => `content-topics/${encodeURIComponent(id)}`;
export const getWorkspace = (id:string) => call<Workspace>(`${topicPath(id)}/workspace`);
