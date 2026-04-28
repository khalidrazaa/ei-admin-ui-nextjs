"use client";

import { useEffect, useMemo, useState } from "react";

import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import { getArticles } from "@/lib/services/articles";
import { Article } from "@/types/types";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const articleSummary = useMemo(() => {
    const drafts = articles.filter((article) => article.status === "draft").length;
    const published = articles.filter((article) => article.status === "published").length;
    const categories = new Set(
      articles.map((article) => article.category).filter(Boolean)
    ).size;

    return {
      total: articles.length,
      drafts,
      published,
      categories,
    };
  }, [articles]);

  useEffect(() => {
    async function loadArticles() {
      try {
        setLoading(true);
        const data = await getArticles();
        setArticles(data);
      } catch (err) {
        console.error("Failed to load articles", err);
        setError("Failed to load articles");
      } finally {
        setLoading(false);
      }
    }

    loadArticles();
  }, []);

  return (
    <ProtectedPageShell
      title="Articles"
      description="Drafts generated from video transcripts will show up here."
      sidebar={
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total Articles
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {loading ? "..." : articleSummary.total}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Drafts
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {loading ? "..." : articleSummary.drafts}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Published
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {loading ? "..." : articleSummary.published}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Categories
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {loading ? "..." : articleSummary.categories}
            </div>
          </div>
        </div>
      }
      contentClassName="flex-1 overflow-y-auto p-6"
    >
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Loading articles...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          No articles yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {articles.map((article) => (
                <tr key={article.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{article.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{article.slug}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{article.status}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {article.category || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{article.host_site}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(article.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProtectedPageShell>
  );
}
