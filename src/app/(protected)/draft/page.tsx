"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ArticleManager from "@/components/content/ArticleManager";
import ContentWorkspace from "@/components/content/ContentWorkspace";

export default function DraftPage() {
  return <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading drafts...</p>}>
    <DraftContent />
  </Suspense>;
}

function DraftContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "";

  if (topic) return <>
    <div className="border-b bg-white px-4 py-2">
      <Link className="text-green-800 underline" href="/draft">Back to drafted articles</Link>
    </div>
    <ContentWorkspace key={topic} initialTopic={topic} />
  </>;

  return <ArticleManager key={searchParams.get("article") || "list"} status="draft" />;
}
