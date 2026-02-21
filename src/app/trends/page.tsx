"use client";

import { useState, useEffect } from "react";
import { getKeywords, scrapeTrends, getTrendsData } from "../../../lib/services/keyword";
import { Trend } from "../../../types/types";

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
    <div>
      <div className="p-2">
        {/* Top row with two sections */}
        <div className="flex justify-between gap-6 mb-6">
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
      </div>
          <div>
      <h2 className="text-lg font-semibold mb-2">Trends Data</h2>
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border border-gray-300 px-4 py-2">Trend</th>
            <th className="border border-gray-300 px-4 py-2">Category</th>
            <th className="border border-gray-300 px-4 py-2">Subcategory</th>
            <th className="border border-gray-300 px-4 py-2">Search Volume</th>
            <th className="border border-gray-300 px-4 py-2">Is Growing</th>
            <th className="border border-gray-300 px-4 py-2">Status</th>
            <th className="border border-gray-300 px-4 py-2">Started</th>
            <th className="border border-gray-300 px-4 py-2">Ended</th>
            <th className="border border-gray-300 px-4 py-2">Last Updated</th>
            <th className="border border-gray-300 px-4 py-2">Explore Link</th>
          </tr>
        </thead>
        <tbody>
          {trendsList.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-center p-4">
                No trends found
              </td>
            </tr>
          ) : (
            trendsList.map((item) => (
              <tr key={item._id} className="hover:bg-gray-100">
                <td className="border border-gray-300 px-4 py-2">{item.trend}</td>
                <td className="border border-gray-300 px-4 py-2">{item.category ?? "-"}</td>
                <td className="border border-gray-300 px-4 py-2">{item.subcategory ?? "-"}</td>
                <td className="border border-gray-300 px-4 py-2">{item.search_volume?.toLocaleString?.() ?? "-"}</td>
                <td className="border border-gray-300 px-4 py-2">{item.is_growing ? "Yes" : "No"}</td>
                <td className="border border-gray-300 px-4 py-2">{item.status}</td>
                <td className="border border-gray-300 px-4 py-2">{item.started ? new Date(item.started).toLocaleString() : "-"}</td>
                <td className="border border-gray-300 px-4 py-2">{item.ended ? new Date(item.ended).toLocaleString() : "-"}</td>
                <td className="border border-gray-300 px-4 py-2">{item.last_updated ? new Date(item.last_updated).toLocaleString() : "-"}</td>
              </tr>
            ))
          )}
        </tbody>
        </table>
    </div>
  </div>
          
  );  
} 