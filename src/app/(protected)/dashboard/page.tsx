"use client";

//import { useState } from "react";
import ProtectedPageShell from "@/components/layout/ProtectedPageShell";

export default function DashboardPage() {
  //const [loading, setLoading] = useState(false);

  return (
    <ProtectedPageShell
      title="Dashboard"
      description="Overview of publishing activity and pipeline health."
      sidebar={
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Use the main sections to scan trends, manage niches, review popular videos,
          and curate generated articles.
        </div>
      }
      contentClassName="flex-1 overflow-y-auto p-8"
    >
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="p-6 rounded-lg shadow bg-white">
          <h2 className="text-sm font-medium text-gray-500">Published Articles</h2>
          <p className="mt-2 text-3xl font-bold text-gray-800">0</p>
        </div>

        <div className="p-6 rounded-lg shadow bg-white">
          <h2 className="text-sm font-medium text-gray-500">Drafts</h2>
          <p className="mt-2 text-3xl font-bold text-gray-800">0</p>
        </div>

        <div className="p-6 rounded-lg shadow bg-white">
          <h2 className="text-sm font-medium text-gray-500">Categories</h2>
          <p className="mt-2 text-3xl font-bold text-gray-800">0</p>
        </div>

        <div className="p-6 rounded-lg shadow bg-white">
          <h2 className="text-sm font-medium text-gray-500">Most Read Article</h2>
          <p className="mt-2 text-xl font-semibold text-gray-800">—</p>
        </div>
      </section>

      {/* Placeholder for charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-lg shadow bg-white flex items-center justify-center text-gray-400">
          Traffic Chart (placeholder)
        </div>
        <div className="h-64 rounded-lg shadow bg-white flex items-center justify-center text-gray-400">
          Reads by Article (placeholder)
        </div>
      </section>
    </ProtectedPageShell>
  );
}
