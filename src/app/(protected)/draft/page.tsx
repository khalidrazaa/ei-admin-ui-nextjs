"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ArticleManager from "@/components/content/ArticleManager";
import ContentWorkspace from "@/components/content/ContentWorkspace";
import Sidebar from "@/components/ui/Sidebar";
import Button from "@/components/ui/Button";
import { call, Topic } from "@/lib/services/content-workflow";

export default function DraftPage() {
  return <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading drafts...</p>}>
    <DraftContent />
  </Suspense>;
}

function DraftContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "";
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [topicError, setTopicError] = useState("");

  async function loadTopics() {
    setLoadingTopics(true);
    setTopicError("");
    try {
      setTopics(await call<Topic[]>("content-topics"));
    } catch (error) {
      setTopicError(error instanceof Error ? error.message : "Unable to load generated topics.");
    } finally {
      setLoadingTopics(false);
    }
  }

  useEffect(() => {
    if (!topic) void loadTopics();
  }, [topic]);

  if (topic) return <>
    <div className="border-b bg-white px-4 py-2">
      <Link className="text-green-800 underline" href="/draft">Back to drafted articles</Link>
    </div>
    <ContentWorkspace key={topic} initialTopic={topic} />
  </>;

  return <ArticleManager key={searchParams.get("article") || "list"} status="draft" onRefresh={() => void loadTopics()} sidebarExtra={
    <div className="space-y-4">
      <Link href="/topics" className="block text-sm text-green-800 underline">Manage topics and research</Link>
      <h2 className="text-sm font-semibold">Generated versions and QA</h2>
      {topicError && <div role="alert" className="space-y-2 text-sm text-red-700">
        <p>{topicError}</p>
        <Button disabled={loadingTopics} onClick={() => void loadTopics()}>Retry topics</Button>
      </div>}
      <Sidebar items={topics.filter(item => (item.has_generated || item.article_id) && item.status !== "Published").map(item => ({
        id: item.topic_id,
        label: <span className="block whitespace-normal"><span className="block text-xs text-gray-500">{item.topic_id}</span>{item.title}</span>,
        onClick: () => { window.location.href = `/draft?topic=${encodeURIComponent(item.topic_id)}`; },
      }))} emptyState={<p className="text-sm text-gray-500">{loadingTopics ? "Loading generated topics..." : "Generated topics will appear here."}</p>} />
    </div>
  } />;
}
