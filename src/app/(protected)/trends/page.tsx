"use client";

import { useState, useEffect } from "react";
import ProtectedPageShell from "@/components/layout/ProtectedPageShell";
import Table, { type TableColumn } from "@/components/ui/Table";
import { getKeywords, scrapeTrends, getTrendsData } from "@/lib/services/keyword";
import { Trend } from "@/types/types";

function getExploreLink(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

const trendColumns: TableColumn<Trend>[] = ([
  { id: "trend", header: "Trend", accessor: "trend" },
  { id: "category", header: "Category", render: (item) => item.category ?? "-" },
  { id: "subcategory", header: "Subcategory", render: (item) => item.subcategory ?? "-" },
  {
    id: "search_volume",
    header: "Search Volume",
    render: (item) => item.search_volume?.toLocaleString?.() ?? "-",
  },
  { id: "is_growing", header: "Is Growing", render: (item) => item.is_growing ? "Yes" : "No" },
  { id: "status", header: "Status", accessor: "status" },
  {
    id: "started",
    header: "Started",
    render: (item) => item.started ? new Date(item.started).toLocaleString() : "-",
  },
  {
    id: "ended",
    header: "Ended",
    render: (item) => item.ended ? new Date(item.ended).toLocaleString() : "-",
  },
  {
    id: "last_updated",
    header: "Last Updated",
    render: (item) => item.last_updated ? new Date(item.last_updated).toLocaleString() : "-",
  },
  {
    id: "explore_link",
    header: "Explore Link",
    render: (item) => {
      const href = getExploreLink(item.explore_link);
      return href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          Explore
        </a>
      ) : "-";
    },
  },
] satisfies TableColumn<Trend>[]).map((column) => ({
  ...column,
  headerClassName: "border border-gray-300 px-4 py-2 font-semibold",
  className: "border border-gray-300 px-4 py-2",
}));

export default function TrendsPage() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendsList, setTrendsList] = useState<Trend[]>([]);

  // Separate states for each button
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  const [geo, setGeo] = useState("IN"); // default selection
  const [hours, setHours] = useState("168"); // default selection
  const [sts, setSts] = useState(" ");

  useEffect(() => {
  getTrendsList();
}, []);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setSearchMsg("Searching...related post/videos/news"); // clear previous message
    try {
      const data = await getKeywords(keyword.trim());
      console.log("scraped keywords", data);
      setResults(data.suggestions);
      setSearchMsg(`Found ${data.suggestions.length} suggestions`);
    } catch (err) {
      console.error("Error fetching keywords", err);
      setSearchMsg("Failed to fetch keyword suggestions");
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeTrends = async () => {
    setScrapeMsg(`Scraping trends for ${geo}, last ${hours} hours...`);
    try {
      const res = await scrapeTrends(geo, hours, sts);
      console.log("Scrape result", res);
      setScrapeMsg(
        `Scrapped ${res.result.processed_rows} & added ${res.result.inserted_count} trends, for ${geo} ${hours} hours,  repeated ${res.result.matched_count} updated ${res.result.modified_count} Categorized ${res.result.categorized_count}`
      );

      await getTrendsList();
    } catch (err) {
      console.error("Error scraping trends", err);
      setScrapeMsg("Failed to scrape trends");
    }
  };

  const getTrendsList = async () => {
    try {
      const data = await getTrendsData(); // typed correctly
      setTrendsList(data.result || []);
    } catch (err) {
      console.error("Error fetching trends data", err);
      setSearchMsg("Failed to fetch keyword suggestions");
    } finally {
      setLoading(false);
    }
  };

  
  return (
    <ProtectedPageShell
      title="Trends"
      description="Collect and review search trends before they move downstream."
      sidebar={
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Trend Rows
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {trendsList.length}
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Scrape fresh trend data or explore related keyword ideas from the search
            panel.
          </div>
        </div>
      }
      contentClassName="flex-1 overflow-y-auto p-2"
    >
      <>
        {/* Top row with two sections */}
        <div className="flex flex-col lg:flex-row justify-between gap-6 mb-6">
          {/* Scrape Trends Section */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <select
                value={geo}
                onChange={(e) => setGeo(e.target.value)}
                className="border px-3 py-2 rounded"
              >
                <option value="US">United States</option>
                <option value="IN">India</option>
              </select>
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="border px-3 py-2 rounded"
              >
                <option value="168">Past 7 days</option>
                <option value="48">Past 2 days</option>
                <option value="24">Past 24 hours</option>
                <option value="4">Past 4 hours</option>
              </select>
              <select
                value={sts}
                onChange={(e) => setSts(e.target.value)}
                className="border px-3 py-2 rounded"
              >
                <option value="active">Active</option>
                <option value=" ">All</option>
              </select>
              <button
                onClick={handleScrapeTrends}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Scrape Trends(CSV)
              </button>
            </div>
            {/* Scrape status/error */}
            {scrapeMsg && (
              <p className="mt-2 text-sm text-gray-700">{scrapeMsg}</p>
            )}
          </div>

          {/* Keyword Search Section */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input
                className="border p-2 rounded"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Enter keyword"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? "Searching..." : "Search SerpApi"}
              </button>
            </div>
            {/* Search status/error */}
            {searchMsg && (
              <p className="mt-2 text-sm text-gray-700">{searchMsg}</p>
            )}
            {/* Search results */}
            {results.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-sm text-gray-800 space-y-1">
                {results.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Trends Data</h2>
          <Table
            data={trendsList}
            columns={trendColumns}
            getRowKey={(item) => item._id}
            ariaLabel="Trends data"
            emptyMessage="No trends found"
            rowClassName="hover:bg-gray-100"
            tableClassName="min-w-full border-collapse border border-gray-300"
          />
        </div>
      </>
    </ProtectedPageShell>
  );  
} 
