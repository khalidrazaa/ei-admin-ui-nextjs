"use client";

import { useEffect, useRef, useState } from "react";
import { getNiches, Niche, deleteKeyword, addKeyword, deleteNiche, createNiche } from "@/lib/services/niche";

export default function NichesPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeywords, setNewKeywords] = useState<{ [nicheId: number]: string }>({});
  const inputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [newNiche, setNewNiche] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getNiches();
        setNiches(data);
      } catch (err) {
        console.error("Failed to load niches", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleDeleteKeyword(nicheId: number, keywordId: number) {
    try {
      await deleteKeyword(nicheId, keywordId);

      setNiches((prev) =>
        prev.map((n) =>
          n.id === nicheId
            ? {
                ...n,
                keywords: n.keywords.filter((k) => k.id !== keywordId),
              }
            : n
        )
      );
    } catch (err) {
      console.error("Failed to delete keyword", err);
    }
  }

  async function handleAddKeyword(nicheId: number) {
    const raw = newKeywords[nicheId]?.trim();
    if (!raw) return;

    // split by comma
    const keywords = raw
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    try {
      const createdKeywords = await Promise.all(
        keywords.map((k) => addKeyword(nicheId, k))
      );

      setNiches((prev) =>
        prev.map((n) =>
          n.id === nicheId
            ? {
                ...n,
                keywords: [...n.keywords, ...createdKeywords],
              }
            : n
        )
      );

      setNewKeywords((prev) => ({ ...prev, [nicheId]: "" }));

      inputRefs.current[nicheId]?.focus();
    } catch (err) {
      console.error("Failed to add keyword", err);
    }
  }

  async function handleCreateNiche() {
    if (!newNiche.trim()) return;

    try {
      const created = await createNiche(newNiche);

      setNiches((prev) => [...prev, created]);
      setNewNiche("");
    } catch (err) {
      console.error("Failed to create niche", err);
    }
  }

  async function handleDeleteNiche(nicheId: number) {
    if (!confirm("Delete this niche?")) return;

    try {
      await deleteNiche(nicheId);
      setNiches((prev) => prev.filter((n) => n.id !== nicheId));

    } catch (err) {
      console.error("Failed to delete niche", err);
    }
  }

  if (loading) {
    return <div>Loading niches...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Niches</h1>
      <div className="flex gap-2 mb-6">
      <input
        type="text"
        placeholder="New niche name"
        value={newNiche}
        onChange={(e) => setNewNiche(e.target.value)}
        className="border border-green-500 rounded px-2 py-0.5 text-sm min-w-[100px] focus:outline-none focus:ring-1 focus:ring-green-300"
      />
    
      <button
        onClick={handleCreateNiche}
        className="bg-gray-500 text-green-500 px-2 py-1 rounded text-sm hover:bg-green-700 hover:text-gray-300"
      >
        + Niche
      </button>
    </div>

      <div className="space-y-4">
        {niches.map((niche) => (
          <div
            key={niche.id}
            className="border rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="flex justify-between items-center">
              <div className="font-semibold">{niche.display_name}</div>

              <button
                onClick={() => handleDeleteNiche(niche.id)}
                className="bg-gray-500 text-red-300 px-2 py-1 rounded text-sm hover:bg-red-700 hover:text-gray-300"
              >
                Delete
              </button>
            </div>

            <div className="mt-2 flex flex-wrap item-center gap-2">
              {niche.keywords.map((k) => (
                  <span 
                      key = {k.id}
                      className = "flex items-center gap-2 bg-gray-200 text-gray-800 text-sm px-2 py-1 rounded"
                  >
                      {k.keyword}
                      <button 
                          onClick={() => handleDeleteKeyword(niche.id, k.id)}
                          className="text-red-500 hover:text-red-800">X</button>
                  </span> 
              ))}
                <input
                  ref={(el) => {inputRefs.current[niche.id] = el;}}
                  type="text"
                  placeholder="Add keyword"
                  value={newKeywords[niche.id] || ""}
                  onChange={(e) =>
                      setNewKeywords((prev) => ({
                          ...prev,
                          [niche.id]: e.target.value,
                      }))
                  }
                  onKeyDown={(e) => {
                      if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddKeyword(niche.id);
                      }
                  }}
                  className="border border-green-500 rounded px-2 py-0.5 text-sm min-w-[100px] focus:outline-none focus:ring-1 focus:ring-green-300"
                />
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}