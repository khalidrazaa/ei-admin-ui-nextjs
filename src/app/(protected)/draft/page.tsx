"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Sidebar from "@/components/ui/Sidebar";
import Button from "@/components/ui/Button";
import Table, { TableColumn } from "@/components/ui/Table";
import ContentWorkspace from "@/components/content/ContentWorkspace";
import { getArticles } from "@/lib/services/articles";
import { call, Topic } from "@/lib/services/content-workflow";
import { Article } from "@/types/types";

const columns: TableColumn<Article>[] = [
  { id: "title", header: "Article", render: article => <div><p className="font-medium">{article.title}</p><p className="text-xs text-gray-500">{article.slug}</p></div> },
  { id: "category", header: "Category", accessor: "category" },
  { id: "status", header: "Status", accessor: "status" },
  { id: "language", header: "Language", accessor: "language" },
  { id: "reading_time", header: "Reading time", render: article => article.reading_time ? `${article.reading_time} min` : "Not set" },
  { id: "date", header: "Last updated", render: article => new Date(article.updated_at || article.drafted_at || article.created_at).toLocaleString() },
];

export default function DraftPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [drafts, inventory] = await Promise.all([getArticles("draft"), call<Topic[]>("content-topics")]);
      setArticles(drafts.filter(article => article.status === "draft"));
      setTopics(inventory);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load drafts."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    setTopic(new URLSearchParams(window.location.search).get("topic") || "");
    void load();
  }, []);

  const visible = articles.filter(article => `${article.title} ${article.slug} ${article.category || ""}`.toLowerCase().includes(search.toLowerCase()));
  if (topic) return <><div className="border-b bg-white px-4 py-2"><Link className="text-green-800 underline" href="/draft">Back to drafted articles</Link></div><ContentWorkspace initialTopic={topic}/></>;

  return <ProtectedPageShell title="Drafts" description="Review drafted articles before publishing" sidebar={<div className="space-y-4">
    <Button className="w-full" onClick={() => setSearch("")}>All drafted articles ({articles.length})</Button>
    <Link href="/topics" className="block text-sm text-green-800 underline">Manage topics and research</Link>
    <Sidebar items={topics.filter(t => (t.has_generated || t.article_id) && t.status !== "Published").map(t => ({
      id: t.topic_id,
      label: <span className="block whitespace-normal"><span className="block text-xs text-gray-500">{t.topic_id}</span>{t.title}</span>,
      onClick: () => { window.location.href = `/draft?topic=${encodeURIComponent(t.topic_id)}`; },
    }))} emptyState={<p className="text-sm text-gray-500">Generated topics will appear here.</p>}/>
  </div>}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Drafted articles</h2><Button disabled={loading} onClick={() => void load()}>Refresh</Button></div>
      <input aria-label="Search drafted articles" placeholder="Search title, slug or category" className="w-full rounded border border-green-500 px-3 py-2 text-sm" value={search} onChange={e => setSearch(e.target.value)}/>
      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error} <Button onClick={() => void load()}>Retry</Button></div>}
      <Table data={visible} columns={columns} getRowKey={article => article.id} ariaLabel="Drafted articles" loading={loading} loadingMessage="Loading drafted articles..." emptyMessage={search ? "No matching drafted articles." : "No saved drafts yet. Generate an article from Topics, then choose Save to Drafts."} className="rounded-xl border border-gray-200 bg-white" onRowClick={article => { window.location.href = `/articles?article=${article.id}`; }}/>
      <p className="text-sm text-gray-500">Select a row to edit the saved article and its metadata. Select a topic in the sidebar for generated versions and QA. Publishing remains manual.</p>
    </div>
  </ProtectedPageShell>;
}
