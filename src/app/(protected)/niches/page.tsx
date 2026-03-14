"use client";

import { useEffect, useRef, useState } from "react";
import { getNiches, Niche, deleteKeyword, addKeyword } from "@/lib/services/niche";

export default function NichesPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeywords, setNewKeywords] = useState<{ [nicheId: number]: string }>({});
  const inputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

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
  const keyword = newKeywords[nicheId]?.trim();
  if (!keyword) return;

  try {
    const created = await addKeyword(nicheId, keyword);

    setNiches((prev) =>
      prev.map((n) =>
        n.id === nicheId
          ? { ...n, keywords: [...n.keywords, created] }
          : n
      )
    );

    setNewKeywords((prev) => ({ ...prev, [nicheId]: "" }));

    // ⭐ keep focus on input
    inputRefs.current[nicheId]?.focus();

  } catch (err) {
    console.error("Failed to add keyword", err);
  }
}
  if (loading) {
    return <div>Loading niches...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Niches</h1>

      <div className="space-y-4">
        {niches.map((niche) => (
          <div
            key={niche.id}
            className="border rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="font-semibold">{niche.display_name}</div>

            <div className="mt-2 text-sm text-gray-600">
                {niche.keywords.map((k) => (
                    <span 
                        key = {k.id}
                        className = "flex items-center gap-1 bg-gray-200 text-gray-800 text-sm px-2 py-1 rounded"
                    >
                        {k.keyword}
                        <button 
                            onClick={() => handleDeleteKeyword(niche.id, k.id)}
                            className="text-gray-500 hover:text-gray-500">X</button>
                    </span> 
                ))}
            </div>
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
                    className="mt-3 border rounded px-2 py-1 text-sm w-64"
                />
          </div>
        ))}
      </div>
    </div>
  );
}